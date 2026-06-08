/**
 * Hook Bus —— Agent 生命周期扩展点。
 *
 * 设计目标：让 loop.ts 保持稳定的核心结构，所有"非循环本职"的逻辑
 * （权限检查、副作用埋点、自动 git add、日志上报、上下文注入...）
 * 都通过 hook 注册到外面，不再侵入循环。
 *
 * 借鉴自 docs/learn-claude-code/s04_hooks，但是用 TypeScript 类
 * 实现 + 强类型 payload。
 *
 * 四个事件，覆盖一个完整的 agent cycle：
 *
 *   UserPromptSubmit  用户输入提交后、进入 LLM 前   → 可注入额外 context
 *   PreToolUse        工具执行前                     → 可拦截（return {block,reason}）
 *   PostToolUse       工具执行后                     → 仅副作用（log/checkpoint/...）
 *   Stop              loop 即将退出时                → 可强制续跑（return {forceContinue, prompt}）
 */
import type { ChatMessage, ToolCall } from '../llm/types.js';

export type HookEvent =
  | 'UserPromptSubmit'
  | 'PreToolUse'
  | 'PostToolUse'
  | 'Stop';

export interface UserPromptSubmitPayload {
  /** 用户最后一条消息文本（已经合成到 messages 末尾） */
  userText: string;
  /** 整个 messages 数组（hook 可只读地查看） */
  messages: ChatMessage[];
}

export interface UserPromptSubmitResult {
  /** 注入到下一次 LLM 调用前的额外 system 提示（可选） */
  injectSystem?: string;
  /** 直接拒绝该 prompt（极少用，通常用于敏感词过滤等） */
  block?: boolean;
  blockReason?: string;
}

export interface PreToolUsePayload {
  call: ToolCall;
  /** 当前轮次（0-based） */
  step: number;
}

export interface PreToolUseResult {
  /** 阻断本次 tool 执行，错误信息会作为 tool_result 注入回 LLM */
  block?: boolean;
  blockReason?: string;
  /** 改写参数（罕用，但保留扩展点） */
  rewriteArguments?: Record<string, unknown>;
}

export interface PostToolUsePayload {
  call: ToolCall;
  ok: boolean;
  result?: unknown;
  error?: string;
  step: number;
  /** 单次 tool 执行耗时（ms） */
  durationMs: number;
}

export interface StopPayload {
  /** 退出原因：模型主动 done / 达到 maxSteps / 异常退出 */
  reason: 'done' | 'max_steps' | 'error';
  step: number;
  messages: ChatMessage[];
}

export interface StopResult {
  /** 强制继续循环：注入一条 user 消息，让 Agent 再跑一轮 */
  forceContinue?: boolean;
  injectUserMessage?: string;
}

export type HookHandler =
  | ((payload: UserPromptSubmitPayload) =>
      | void
      | UserPromptSubmitResult
      | Promise<void | UserPromptSubmitResult>)
  | ((payload: PreToolUsePayload) =>
      | void
      | PreToolUseResult
      | Promise<void | PreToolUseResult>)
  | ((payload: PostToolUsePayload) => void | Promise<void>)
  | ((payload: StopPayload) =>
      | void
      | StopResult
      | Promise<void | StopResult>);

interface RegisteredHook {
  name: string;
  handler: HookHandler;
}

/**
 * HookBus —— 一个简单的事件 → handler 列表的注册表。
 *
 * 用法：
 *   const bus = new HookBus();
 *   bus.on('PreToolUse', 'exec-policy', (p) => {...});
 *   ...
 *   const result = await bus.trigger('PreToolUse', payload);
 *
 * 顺序：handler 按注册顺序依次跑。
 *  - PreToolUse / UserPromptSubmit：第一个返回 `block:true` 的 handler 立刻生效，后续不跑（短路）
 *  - PostToolUse：所有 handler 都跑（仅副作用），异常会被 swallow + console.error
 *  - Stop：所有 handler 都跑，所有 forceContinue 取并集（任一为 true 即续跑）
 */
export class HookBus {
  private handlers: Record<HookEvent, RegisteredHook[]> = {
    UserPromptSubmit: [],
    PreToolUse: [],
    PostToolUse: [],
    Stop: [],
  };

  on(event: 'UserPromptSubmit', name: string, handler: (p: UserPromptSubmitPayload) => void | UserPromptSubmitResult | Promise<void | UserPromptSubmitResult>): this;
  on(event: 'PreToolUse', name: string, handler: (p: PreToolUsePayload) => void | PreToolUseResult | Promise<void | PreToolUseResult>): this;
  on(event: 'PostToolUse', name: string, handler: (p: PostToolUsePayload) => void | Promise<void>): this;
  on(event: 'Stop', name: string, handler: (p: StopPayload) => void | StopResult | Promise<void | StopResult>): this;
  on(event: HookEvent, name: string, handler: HookHandler): this {
    this.handlers[event].push({ name, handler });
    return this;
  }

  off(event: HookEvent, name: string): this {
    this.handlers[event] = this.handlers[event].filter((h) => h.name !== name);
    return this;
  }

  list(event: HookEvent): string[] {
    return this.handlers[event].map((h) => h.name);
  }

  /** 触发 UserPromptSubmit；短路语义：第一个 block 直接返回，否则合并 injectSystem */
  async triggerUserPromptSubmit(p: UserPromptSubmitPayload): Promise<UserPromptSubmitResult> {
    const merged: UserPromptSubmitResult = {};
    const injects: string[] = [];
    for (const h of this.handlers.UserPromptSubmit) {
      try {
        const r = (await (h.handler as any)(p)) as UserPromptSubmitResult | undefined;
        if (r?.block) {
          return { block: true, blockReason: r.blockReason ?? `Blocked by hook ${h.name}` };
        }
        if (r?.injectSystem) injects.push(r.injectSystem);
      } catch (e: any) {
        console.error(`[HookBus] UserPromptSubmit hook "${h.name}" threw:`, e?.message ?? e);
      }
    }
    if (injects.length) merged.injectSystem = injects.join('\n\n');
    return merged;
  }

  /** 触发 PreToolUse；短路语义：第一个 block 立刻返回 */
  async triggerPreToolUse(p: PreToolUsePayload): Promise<PreToolUseResult> {
    const acc: PreToolUseResult = {};
    for (const h of this.handlers.PreToolUse) {
      try {
        const r = (await (h.handler as any)(p)) as PreToolUseResult | undefined;
        if (r?.block) {
          return { block: true, blockReason: r.blockReason ?? `Blocked by hook ${h.name}` };
        }
        if (r?.rewriteArguments) acc.rewriteArguments = r.rewriteArguments;
      } catch (e: any) {
        console.error(`[HookBus] PreToolUse hook "${h.name}" threw:`, e?.message ?? e);
      }
    }
    return acc;
  }

  /** 触发 PostToolUse；纯副作用，所有 handler 都跑，异常 swallow */
  async triggerPostToolUse(p: PostToolUsePayload): Promise<void> {
    for (const h of this.handlers.PostToolUse) {
      try {
        await (h.handler as any)(p);
      } catch (e: any) {
        console.error(`[HookBus] PostToolUse hook "${h.name}" threw:`, e?.message ?? e);
      }
    }
  }

  /** 触发 Stop；所有 handler 都跑，forceContinue 取并集 */
  async triggerStop(p: StopPayload): Promise<StopResult> {
    let forceContinue = false;
    const messages: string[] = [];
    for (const h of this.handlers.Stop) {
      try {
        const r = (await (h.handler as any)(p)) as StopResult | undefined;
        if (r?.forceContinue) forceContinue = true;
        if (r?.injectUserMessage) messages.push(r.injectUserMessage);
      } catch (e: any) {
        console.error(`[HookBus] Stop hook "${h.name}" threw:`, e?.message ?? e);
      }
    }
    return forceContinue
      ? { forceContinue: true, injectUserMessage: messages.join('\n') || 'Continue.' }
      : {};
  }
}