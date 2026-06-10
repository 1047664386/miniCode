
/**
 * SubagentManager —— 子 Agent 调度器（仿 CodeFlicker 单 Agent + 多 Worker 模式）
 *
 * 核心设计（与 CodeFlicker 对齐 + 极简化）：
 *  1. 层级模式：父 Agent dispatch → 子 Agent 独立 runAgent loop → 完成 push announce
 *  2. Push not Poll：子 Agent 完成结果通过 EventEmitter 推送，父 Agent 等下一 turn 自动看到
 *  3. 深度/并发硬限制：maxDepth=2, maxConcurrentPerParent=3, runTimeoutMs=120s
 *  4. 工具集裁剪：子 Agent registry 不含 dispatch_subagent、update_plan
 *  5. 幂等：runId 唯一，重复 announce 跳过
 *  6. 独立 jsonl：子 session 单独落盘（便于审计 + 崩溃续接复用同套机制）
 *
 * 与 CodeFlicker 的差异：
 *  - 没有跨 Channel / Thread 绑定（IDE 场景不需要）
 *  - 没有 ACP（CLI 桥接）
 *  - 没有多 Agent 配置（统一用主 LLM + 全工具池）
 *  - announce 路径只有 1 条（queue 注入），无 embedded inject（runAgent 是 async generator
 *    不好"中途插消息"，所以采用「等当前 turn 跑完 + 自动启 follow-up turn」）
 */
import {
  ToolRegistry,
  registerBuiltinTools,
  runAgent,
  type LLMProvider,
  type ChatMessage,
  type ToolContext,
} from '@mini/core';
import { getProfile, type AgentProfile } from './agent-profile-loader.js';
import {
  TypedEmitter,
  type SubagentSpec,
  type SubagentRun,
  type SubagentManagerOpts,
  type ManagerEvents,
} from './subagent-types.js';
import { ProfileWatcher } from './profile-watcher.js';

// 重新导出类型，方便外部从 subagent-manager 直接导入
export type { SubagentSpec, SubagentRun, SubagentManagerOpts, ManagerEvents };

export class SubagentManager extends TypedEmitter<ManagerEvents> {
  private opts: Required<Omit<SubagentManagerOpts, 'defaultModel' | 'worktrees'>> & {
    defaultModel?: string | (() => string | undefined);
    worktrees?: SubagentManagerOpts['worktrees'];
  };
  private runs = new Map<string, SubagentRun>();
  /** parentSessionId → active runIds（用于并发限制 + announce 路由） */
  private byParent = new Map<string, Set<string>>();
  /** runId 幂等：已经 announce 过的不再二次推送 */
  private announced = new Set<string>();
  /** 已推送但还没被父 turn 消费的 announce message（父端 follow-up turn 拉取） */
  private pendingAnnounceByParent = new Map<string, string[]>();
  /** Profile hot-reload watcher */
  private profileWatcher: ProfileWatcher;

  constructor(opts: SubagentManagerOpts) {
    super();
    this.opts = {
      maxDepth: 2,
      maxConcurrentPerParent: 3,
      runTimeoutMs: 120_000,
      ...opts,
    };
    this.profileWatcher = new ProfileWatcher(opts.workspaceRoot);
    // 启动时加载角色 profile + fs.watch
    this.profileWatcher.init().catch(() => undefined);
  }

  /** 手动刷新 profile（用户编辑 .minicodeide/agents/ 后调用） */
  async refreshProfiles(): Promise<number> {
    const map = await this.profileWatcher.refresh();
    return map.size;
  }

  /** 返回当前所有 profile 名（用于 tool description 动态填充） */
  getProfileNames(): Array<{ name: string; description: string }> {
    return this.profileWatcher.getProfileNames();
  }

  /** 等待某个 parent 当前所有 active subagent 完成（或 timeout）。父 turn 末尾用 */
  async awaitAllForParent(parentSessionId: string, timeoutMs = 60_000): Promise<void> {
    const active = this.byParent.get(parentSessionId);
    if (!active || active.size === 0) return;
    const deadline = Date.now() + timeoutMs;
    await new Promise<void>((resolve) => {
      const tick = () => {
        const cur = this.byParent.get(parentSessionId);
        if (!cur || cur.size === 0) return resolve();
        if (Date.now() >= deadline) return resolve();
        setTimeout(tick, 100);
      };
      tick();
    });
  }

  /**
   * 父 Agent 调 dispatch_subagent 时进入这里。
   * 立刻返回 runId（不阻塞父 turn），后台跑 runAgent。
   */
  async spawn(spec: SubagentSpec): Promise<{ runId: string; childSessionId: string }> {
    // 1. depth check
    const childDepth = spec.parentDepth + 1;
    if (childDepth > this.opts.maxDepth) {
      throw new Error(`Subagent depth limit (${this.opts.maxDepth}) reached`);
    }
    // 2. concurrent check
    const activeForParent = this.byParent.get(spec.parentSessionId)?.size ?? 0;
    if (activeForParent >= this.opts.maxConcurrentPerParent) {
      throw new Error(
        `Max concurrent subagents per parent (${this.opts.maxConcurrentPerParent}) reached`,
      );
    }
    // 3. 创建独立子 session（落盘）
    const child = await this.opts.sessions.create(
      `[subagent] ${spec.label ?? spec.task.slice(0, 40)}`,
    );
    const runId = `srun_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const run: SubagentRun = {
      runId,
      childSessionId: child.id,
      parentSessionId: spec.parentSessionId,
      label: spec.label ?? '(no-label)',
      task: spec.task,
      role: spec.role,
      status: 'running',
      startedAt: Date.now(),
      depth: childDepth,
    };
    this.runs.set(runId, run);
    if (!this.byParent.has(spec.parentSessionId)) this.byParent.set(spec.parentSessionId, new Set());
    this.byParent.get(spec.parentSessionId)!.add(runId);

    // 4. 后台启动（不 await）
    void this.runChild(run);
    return { runId, childSessionId: child.id };
  }

  /** 父端在新 turn 启动前拉取累积的 announce，作为合成 user 消息合入 */
  pickPendingAnnouncements(parentSessionId: string): string[] {
    const buf = this.pendingAnnounceByParent.get(parentSessionId);
    if (!buf || buf.length === 0) return [];
    this.pendingAnnounceByParent.delete(parentSessionId);
    return buf;
  }

  hasPending(parentSessionId: string): boolean {
    return (this.pendingAnnounceByParent.get(parentSessionId)?.length ?? 0) > 0;
  }

  list(parentSessionId?: string): SubagentRun[] {
    const all = [...this.runs.values()];
    if (parentSessionId) return all.filter((r) => r.parentSessionId === parentSessionId);
    return all;
  }

  /** 停止 profile watcher（server shutdown 时调用） */
  stopProfileWatcher() {
    this.profileWatcher.stop();
  }

  // ─── 私有方法 ─────────────────────────────────────────

  private async runChild(run: SubagentRun) {
    const profiles = this.profileWatcher.getProfiles();
    const profile = run.role ? getProfile(profiles, run.role) : undefined;
    const systemPrompt = this.buildSystemPrompt(run, profile);
    const childRegistry = this.buildChildRegistry(profile);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: run.task },
    ];

    const abort = new AbortController();
    const timeoutHandle = setTimeout(() => abort.abort(), this.opts.runTimeoutMs);

    let childTurnId: string | undefined;
    try {
      childTurnId = await this.opts.sessions
        .startTurn(run.childSessionId, run.task)
        .catch(() => undefined);
      await this.opts.sessions.append(run.childSessionId, { role: 'user', content: run.task });

      const childCtx: ToolContext = {
        ...this.opts.childToolCtxFactory(),
        subagentDepth: run.depth,
      };

      // worktree 隔离（如果配置了 worktrees）
      if (this.opts.worktrees) {
        try {
          const wt = await this.opts.worktrees.createForSubagent(run.runId);
          if (wt.isolated) {
            childCtx.cwd = wt.path;
          }
        } catch {
          // worktree 创建失败 → 不隔离，继续跑
        }
      }

      await this.executeAgentLoop(run, childRegistry, messages, childCtx, abort, childTurnId);
    } catch (e: any) {
      const isTimeout = abort.signal.aborted;
      run.status = isTimeout ? 'timeout' : 'error';
      run.error = e?.message ?? String(e);
      if (childTurnId) {
        await this.opts.sessions
          .interruptTurn(run.childSessionId, childTurnId, run.error)
          .catch(() => undefined);
      }
    } finally {
      clearTimeout(timeoutHandle);
      run.finishedAt = Date.now();
      this.byParent.get(run.parentSessionId)?.delete(run.runId);
      this.deliverAnnounce(run);
      if (this.opts.worktrees) {
        this.opts.worktrees.remove(run.runId, { keepBranch: true }).catch(() => undefined);
      }
    }
  }

  /** 执行子 Agent 的 runAgent 循环，收集事件 */
  private async executeAgentLoop(
    run: SubagentRun,
    registry: ToolRegistry,
    messages: ChatMessage[],
    childCtx: ToolContext,
    abort: AbortController,
    childTurnId: string | undefined,
  ) {
    let assistantBuf = '';
    const resolvedLlm =
      typeof this.opts.llm === 'function' ? (this.opts.llm as () => LLMProvider)() : this.opts.llm;
    const resolvedModel =
      typeof this.opts.defaultModel === 'function'
        ? (this.opts.defaultModel as () => string | undefined)()
        : this.opts.defaultModel;

    for await (const ev of runAgent({
      llm: resolvedLlm,
      registry,
      messages,
      toolCtx: childCtx,
      signal: abort.signal,
      maxSteps: 8,
      model: resolvedModel,
    })) {
      if (ev.type === 'text' && ev.text) {
        assistantBuf += ev.text;
        if (childTurnId) {
          this.opts.sessions.appendChunk(run.childSessionId, childTurnId, ev.text).catch(() => undefined);
        }
        this.emit('child_text', { runId: run.runId, text: ev.text });
      }
      if (ev.type === 'tool_call' && ev.toolCall) {
        this.emit('child_tool', { runId: run.runId, tool: ev.toolCall.name });
        if (childTurnId) {
          this.opts.sessions
            .appendTool(run.childSessionId, childTurnId, {
              name: ev.toolCall.name,
              args: ev.toolCall.arguments,
            })
            .catch(() => undefined);
        }
      }
      if (ev.type === 'tool_result') {
        const preview = typeof (ev as any).toolResult === 'string'
          ? (ev as any).toolResult.slice(0, 80).replace(/\n/g, ' ')
          : '';
        this.emit('child_tool_result', {
          runId: run.runId,
          tool: (ev as any).toolCall?.name ?? 'unknown',
          resultPreview: preview,
        });
      }
      if (ev.type === 'error') {
        throw new Error(ev.error ?? 'subagent error');
      }
    }

    const finalText = assistantBuf.trim();
    run.result = finalText;
    run.status = 'completed';
    if (childTurnId) {
      await this.opts.sessions.endTurn(run.childSessionId, childTurnId, finalText).catch(() => undefined);
    }
  }

  /** 构建 system prompt */
  private buildSystemPrompt(run: SubagentRun, profile?: AgentProfile): string {
    const lines: string[] = [];
    if (profile) {
      lines.push(
        `[Subagent Role: ${profile.name}]`,
        profile.systemPrompt,
        '',
        `[Subagent Context]`,
        `You are running as a subagent (depth ${run.depth}/${this.opts.maxDepth}) with role "${profile.name}".`,
        `Role description: ${profile.description}`,
        'Your output will be auto-delivered to the requester as a single "[Subagent Completed]" message.',
      );
      if (profile.sandbox === 'read_only') {
        lines.push('', '[Sandbox: read_only]', 'You CANNOT write files. Your job is to read, analyze, and report findings.');
      }
    } else {
      lines.push(
        '[Subagent Context]',
        `You are running as a subagent (depth ${run.depth}/${this.opts.maxDepth}).`,
        'Your output will be auto-delivered to the requester as a single "[Subagent Completed]" message.',
      );
    }
    lines.push(
      '',
      '[Rules]',
      '- You CANNOT spawn further subagents (dispatch_subagent is disabled here).',
      '- You CANNOT modify the parent plan (update_plan is disabled here).',
      '- Be concise. Produce a final answer in 1 turn if possible; max 8 steps.',
      '- Do not poll status of other agents. You have no visibility into siblings.',
      '',
      `[Subagent Task]: ${run.task}`,
    );
    return lines.join('\n');
  }

  /** 子 Agent 的 registry：拿全 builtin，然后剔除危险/不该有的；profile 可进一步裁剪 */
  private buildChildRegistry(profile?: AgentProfile): ToolRegistry {
    const r = new ToolRegistry();
    registerBuiltinTools(r);
    r.unregister('dispatch_subagent');
    r.unregister('update_plan');

    if (profile) {
      if (profile.allowedTools && profile.allowedTools.length > 0) {
        const allNames = r.list().map((t) => t.name);
        for (const name of allNames) {
          if (!profile.allowedTools.includes(name)) r.unregister(name);
        }
      } else if (profile.deniedTools && profile.deniedTools.length > 0) {
        for (const name of profile.deniedTools) r.unregister(name);
      }
      if (profile.sandbox === 'read_only') {
        r.unregister('write_file');
        r.unregister('edit_file');
        r.unregister('run_command');
      }
    } else {
      r.unregister('write_file');
      r.unregister('edit_file');
      r.unregister('run_command');
    }
    return r;
  }

  /** 把 run 结果构建 announce message 并放入父的 pending 队列 */
  private deliverAnnounce(run: SubagentRun) {
    if (this.announced.has(run.runId)) return;
    this.announced.add(run.runId);
    const lines: string[] = [];
    lines.push(`[Subagent Completed] runId=${run.runId} label=${run.label} outcome=${run.status}`);
    if (run.status === 'completed') {
      lines.push('---');
      lines.push(run.result ?? '(empty)');
    } else {
      lines.push(`error: ${run.error ?? '(unknown)'}`);
    }
    const msg = lines.join('\n');
    if (!this.pendingAnnounceByParent.has(run.parentSessionId)) {
      this.pendingAnnounceByParent.set(run.parentSessionId, []);
    }
    this.pendingAnnounceByParent.get(run.parentSessionId)!.push(msg);
    this.emit('announce', { run });
  }
}
