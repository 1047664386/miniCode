/**
 * SubagentManager 共享类型定义
 *
 * 包含所有接口、事件类型和 TypedEmitter 基类。
 * 从 subagent-manager.ts 拆出，保持主文件 < 500 行。
 */
import { EventEmitter } from 'node:events';
import type { LLMProvider, ToolContext } from '@mini/core';
import type { SessionStore } from '../store/index.js';

// ─── 公开接口 ────────────────────────────────────────────

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

// ─── 内部事件类型 ─────────────────────────────────────────

export interface ManagerEvents {
  /** 子 Agent 出了一段 text（用于父端实时可视化，不强制） */
  child_text: { runId: string; text: string };
  /** 子 Agent 调了一次 tool */
  child_tool: { runId: string; tool: string };
  /** 子 Agent 完成 / 失败 / 超时（push announce 的源） */
  announce: { run: SubagentRun };
  /** 子 Agent 产生了 tool_result（包含结果摘要） */
  child_tool_result: { runId: string; tool: string; resultPreview: string };
}

// ─── TypedEmitter 基类 ──────────────────────────────────

type Listener<T> = (payload: T) => void;

export class TypedEmitter<E extends Record<string, any>> {
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
