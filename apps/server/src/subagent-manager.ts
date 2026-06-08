
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
import { EventEmitter } from 'node:events';
import {
  ToolRegistry,
  registerBuiltinTools,
  runAgent,
  type LLMProvider,
  type ChatMessage,
  type ToolContext,
} from '@mini/core';
import { SessionStore } from './session-store.js';
import { loadAgentProfiles, getProfile, type AgentProfile } from './agent-profile-loader.js';
import * as fsSync from 'node:fs';
import path from 'node:path';

export interface SubagentSpec {
  task: string;
  label?: string;
  /** 角色名（来自 .minicodeide/agents/<name>.md），不设 = 默认子 Agent */
  role?: string;
  parentSessionId: string;
  parentTurnId?: string;
  /** 父 depth；子 depth = parent + 1 */
  parentDepth: number;
}

export interface SubagentRun {
  runId: string;
  childSessionId: string;
  parentSessionId: string;
  label: string;
  task: string;
  /** 角色 profile 名（来自 .minicodeide/agents/<name>.md） */
  role?: string;
  status: 'running' | 'completed' | 'error' | 'timeout';
  startedAt: number;
  finishedAt?: number;
  /** 子 Agent 最终 assistant 回复 */
  result?: string;
  error?: string;
  depth: number;
}

export interface SubagentManagerOpts {
  /** 子 Agent 用的 LLM —— 可以是固定实例，也可以是 getter（运行时拿最新） */
  llm: LLMProvider | (() => LLMProvider);
  sessions: SessionStore;
  /** 给子 Agent 用的 toolCtx 工厂（cwd / codeIntel / skills 共享，但去掉 dispatchSubagent / updatePlan / proposeEdit） */
  childToolCtxFactory: () => Omit<ToolContext, 'updatePlan' | 'proposeEdit' | 'dispatchSubagent'>;
  /** workspace 根路径（加载 .minicodeide/agents/ 用） */
  workspaceRoot: string;
  /** 全局默认 model；可以是 getter（运行时取最新 fast/chat 配置） */
  defaultModel?: string | (() => string | undefined);
  maxDepth?: number;
  maxConcurrentPerParent?: number;
  runTimeoutMs?: number;
  /**
   * 可选：worktree 隔离器。当多 subagent 并行写文件时，给每个 subagent 分配
   * 独立 .minicodeide/worktrees/<runId> 目录，避免互相覆盖。
   * 不传 = 不隔离（所有 subagent 共享 workspace cwd）。
   */
  worktrees?: {
    createForSubagent(taskId: string): Promise<{ path: string; isolated: boolean }>;
    remove(taskId: string, opts?: { keepBranch?: boolean }): Promise<boolean>;
  };
}

interface ManagerEvents {
  /** 子 Agent 出了一段 text（用于父端实时可视化，不强制） */
  child_text: { runId: string; text: string };
  /** 子 Agent 调了一次 tool */
  child_tool: { runId: string; tool: string };
  /** 子 Agent 完成 / 失败 / 超时（push announce 的源） */
  announce: { run: SubagentRun };
  /** 子 Agent 产生了 tool_result（包含结果摘要） */
  child_tool_result: { runId: string; tool: string; resultPreview: string };
}

// 简易类型化 emitter
type Listener<T> = (payload: T) => void;
class TypedEmitter<E extends Record<string, any>> {
  private ee = new EventEmitter();
  on<K extends keyof E>(ev: K, fn: Listener<E[K]>) {
    this.ee.on(ev as string, fn);
    return this;
  }
  off<K extends keyof E>(ev: K, fn: Listener<E[K]>) {
    this.ee.off(ev as string, fn);
    return this;
  }
  emit<K extends keyof E>(ev: K, payload: E[K]) {
    this.ee.emit(ev as string, payload);
  }
}

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
  /** 角色 profile 缓存（启动时加载一次，文件变更时可手动 refresh） */
  private profiles = new Map<string, AgentProfile>();
  /** fs.watch watcher instance（hot-reload 用） */
  private profileWatcher: fsSync.FSWatcher | null = null;
  /** debounce timer for hot-reload */
  private profileReloadTimer: ReturnType<typeof setTimeout> | null = null;

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

  constructor(opts: SubagentManagerOpts) {
    super();
    this.opts = {
      maxDepth: 2,
      maxConcurrentPerParent: 3,
      runTimeoutMs: 120_000,
      ...opts,
    };
    // 启动时加载角色 profile
    loadAgentProfiles(opts.workspaceRoot).then((map) => {
      this.profiles = map;
      if (map.size > 0) {
        console.log(`[subagents] Loaded ${map.size} agent profiles: ${[...map.keys()].join(', ')}`);
      }
    }).catch(() => undefined);

    // --- P3-D5: Agent Profile hot-reload ---
    // fs.watch .minicodeide/agents/ 目录，自动刷新 profiles
    this._startProfileWatcher(opts.workspaceRoot);
  }

  /** 手动刷新 profile（用户编辑 .minicodeide/agents/ 后调用） */
  async refreshProfiles(): Promise<number> {
    this.profiles = await loadAgentProfiles(this.opts.workspaceRoot);
    return this.profiles.size;
  }

  /** 返回当前所有 profile 名（用于 tool description 动态填充） */
  getProfileNames(): Array<{ name: string; description: string }> {
    return [...this.profiles.values()].map((p) => ({ name: p.name, description: p.description }));
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

  private async runChild(run: SubagentRun) {
    // 查找角色 profile（如果 spec.role 指定了）
    const profile = run.role ? getProfile(this.profiles, run.role) : undefined;

    // 构建 system prompt
    const systemLines: string[] = [];

    if (profile) {
      // 角色专属 system prompt（从 .minicodeide/agents/<name>.md body）
      systemLines.push(
        `[Subagent Role: ${profile.name}]`,
        profile.systemPrompt,
        '',
        `[Subagent Context]`,
        `You are running as a subagent (depth ${run.depth}/${this.opts.maxDepth}) with role "${profile.name}".`,
        `Role description: ${profile.description}`,
        'Your output will be auto-delivered to the requester as a single "[Subagent Completed]" message.',
      );
      if (profile.sandbox === 'read_only') {
        systemLines.push('', '[Sandbox: read_only]', 'You CANNOT write files. Your job is to read, analyze, and report findings.');
      }
    } else {
      // 默认子 Agent system prompt
      systemLines.push(
        '[Subagent Context]',
        `You are running as a subagent (depth ${run.depth}/${this.opts.maxDepth}).`,
        'Your output will be auto-delivered to the requester as a single "[Subagent Completed]" message.',
      );
    }

    systemLines.push(
      '',
      '[Rules]',
      '- You CANNOT spawn further subagents (dispatch_subagent is disabled here).',
      '- You CANNOT modify the parent plan (update_plan is disabled here).',
      '- Be concise. Produce a final answer in 1 turn if possible; max 8 steps.',
      '- Do not poll status of other agents. You have no visibility into siblings.',
      '',
      `[Subagent Task]: ${run.task}`,
    );

    const SUBAGENT_SYSTEM = systemLines.join('\n');

    // 子 Agent registry：根据 profile 裁剪工具集
    const childRegistry = this.buildChildRegistry(profile);

    const messages: ChatMessage[] = [
      { role: 'system', content: SUBAGENT_SYSTEM },
      { role: 'user', content: run.task },
    ];

    const abort = new AbortController();
    const timeoutHandle = setTimeout(() => abort.abort(), this.opts.runTimeoutMs);

    // 子 session 也开 turn 记录（复用 SessionStore 的 jsonl 事件流）
    let childTurnId: string | undefined;
    try {
      childTurnId = await this.opts.sessions
        .startTurn(run.childSessionId, run.task)
        .catch(() => undefined);
      await this.opts.sessions.append(run.childSessionId, { role: 'user', content: run.task });

      const childCtx: ToolContext = {
        ...this.opts.childToolCtxFactory(),
        subagentDepth: run.depth, // 即使子 registry 没有 dispatch tool，也带上 depth 信息
      };

      // ---- worktree 隔离（如果配置了 worktrees）----
      let isolatedPath: string | undefined;
      if (this.opts.worktrees) {
        try {
          const wt = await this.opts.worktrees.createForSubagent(run.runId);
          if (wt.isolated) {
            isolatedPath = wt.path;
            childCtx.cwd = wt.path; // 子 Agent 的 cwd 切到隔离目录
          }
        } catch {
          // worktree 创建失败 → 不隔离，继续跑
        }
      }

      let assistantBuf = '';
      const resolvedLlm =
        typeof this.opts.llm === 'function' ? (this.opts.llm as () => LLMProvider)() : this.opts.llm;
      const resolvedModel =
        typeof this.opts.defaultModel === 'function'
          ? (this.opts.defaultModel as () => string | undefined)()
          : this.opts.defaultModel;
      for await (const ev of runAgent({
        llm: resolvedLlm,
        registry: childRegistry,
        messages,
        toolCtx: childCtx,
        signal: abort.signal,
        maxSteps: 8,
        model: resolvedModel,
      })) {
        if (ev.type === 'text' && ev.text) {
          assistantBuf += ev.text;
          if (childTurnId) {
            this.opts.sessions
              .appendChunk(run.childSessionId, childTurnId, ev.text)
              .catch(() => undefined);
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
        await this.opts.sessions
          .endTurn(run.childSessionId, childTurnId, finalText)
          .catch(() => undefined);
      }
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
      // worktree 清理（默认 keepBranch=true，让用户能看 / 合并；目录还是删掉防止累积）
      if (this.opts.worktrees) {
        this.opts.worktrees.remove(run.runId, { keepBranch: true }).catch(() => undefined);
      }
    }
  }

  /** 把 run 结果构建 announce message 并放入父的 pending 队列（zero-token，user 角色注入） */
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

  /** 子 Agent 的 registry：拿全 builtin，然后剔除危险/不该有的；profile 可进一步裁剪 */
  private buildChildRegistry(profile?: AgentProfile): ToolRegistry {
    const r = new ToolRegistry();
    registerBuiltinTools(r);
    // 基础裁剪（所有子 Agent 都不能有）
    r.unregister('dispatch_subagent');
    r.unregister('update_plan');

    // 角色裁剪
    if (profile) {
      if (profile.allowedTools && profile.allowedTools.length > 0) {
        // 白名单模式：只保留 allowedTools 里的工具
        const allNames = r.list().map((t) => t.name);
        for (const name of allNames) {
          if (!profile.allowedTools.includes(name)) {
            r.unregister(name);
          }
        }
      } else if (profile.deniedTools && profile.deniedTools.length > 0) {
        // 黑名单模式：去掉 deniedTools
        for (const name of profile.deniedTools) {
          r.unregister(name);
        }
      }

      // sandbox: read_only → 强制去掉所有写工具
      if (profile.sandbox === 'read_only') {
        r.unregister('write_file');
        r.unregister('edit_file');
        r.unregister('run_command');
      }
    } else {
      // 默认子 Agent（无角色）：去掉写 + shell（保守策略）
      r.unregister('write_file');
      r.unregister('edit_file');
      r.unregister('run_command');
    }
    return r;
  }

  // --- P3-D5: Agent Profile hot-reload ---
  /**
   * 启动 fs.watch 监听 .minicodeide/agents/ 目录变更。
   * 文件增/删/改 → debounce 500ms → 自动 refreshProfiles。
   * 无 agents 目录或 fs.watch 不可用 → 静默跳过。
   */
  private _startProfileWatcher(workspaceRoot: string) {
    const agentsDir = path.join(workspaceRoot, '.minicodeide', 'agents');
    try {
      // 先确认目录存在
      const stat = fsSync.statSync(agentsDir);
      if (!stat.isDirectory()) return;
    } catch {
      // 目录不存在 → 不监听（后续创建目录后需手动调 refreshProfiles 或重启 server）
      return;
    }

    try {
      this.profileWatcher = fsSync.watch(agentsDir, (eventType: string, filename: string | null) => {
        if (!filename || !filename.endsWith('.md')) return;
        // debounce：避免同一文件短时间内多次触发
        if (this.profileReloadTimer) clearTimeout(this.profileReloadTimer);
        this.profileReloadTimer = setTimeout(async () => {
          try {
            const count = await this.refreshProfiles();
            console.log(`[subagents] Hot-reloaded ${count} agent profiles (trigger: ${eventType} ${filename})`);
          } catch (e: any) {
            console.error(`[subagents] Hot-reload failed: ${e?.message ?? e}`);
          }
        }, 500);
      });
      console.log(`[subagents] Watching ${agentsDir} for profile hot-reload`);
    } catch (e: any) {
      console.warn(`[subagents] fs.watch on ${agentsDir} failed: ${e?.message ?? e}. Profiles will NOT auto-reload.`);
    }
  }

  /** 停止 profile watcher（server shutdown 时调用） */
  stopProfileWatcher() {
    if (this.profileWatcher) {
      this.profileWatcher.close();
      this.profileWatcher = null;
    }
    if (this.profileReloadTimer) {
      clearTimeout(this.profileReloadTimer);
      this.profileReloadTimer = null;
    }
  }
}