/**
 * Error Recovery —— 借鉴自 docs/learn-claude-code/s11_error_recovery。
 * ---------------------------------------------------------------
 * 三种最常见的恢复模式：
 *
 *   max_tokens 截断       → 第一次：升级 maxTokens 8K→64K；第二次：注入续写提示
 *   prompt_too_long       → 触发 reactive compact（hard-compact），重试一次
 *   429 / 529 临时故障    → 指数退避 + jitter，连续失败 → 切 fallback model（由上层处理）
 *
 * 本模块只做"分类 + 决策建议"，具体的重试动作由 loop.ts 的循环来执行。
 */
import type { ChatMessage } from '../llm/types.js';

export type RecoveryAction =
  | { kind: 'truncated_escalate'; nextMaxTokens: number }
  | { kind: 'truncated_continue'; injectMessage: string }
  | { kind: 'overflow_compact' }
  | { kind: 'backoff'; delayMs: number; attempt: number; switchModel?: boolean }
  | { kind: 'fatal'; reason: string };

export interface RecoveryState {
  /** max_tokens 是否已经升级过（一次机会）*/
  hasEscalatedMaxTokens: boolean;
  /** 续写次数（最多 MAX_CONTINUATION_RETRIES）*/
  continuationCount: number;
  /** reactive compact 是否已经做过（一次机会）*/
  hasAttemptedReactiveCompact: boolean;
  /** 429/529 退避计数 */
  backoffAttempts: number;
}

export const DEFAULT_MAX_TOKENS = 8000;
export const ESCALATED_MAX_TOKENS = 64000;
export const MAX_CONTINUATION_RETRIES = 3;
export const MAX_BACKOFF_ATTEMPTS = 5;

export function createRecoveryState(): RecoveryState {
  return {
    hasEscalatedMaxTokens: false,
    continuationCount: 0,
    hasAttemptedReactiveCompact: false,
    backoffAttempts: 0,
  };
}

/** 分类错误：返回错误类型字符串供调用方决策 */
export type ClassifiedError =
  | 'max_tokens'
  | 'prompt_too_long'
  | 'rate_limit'      // 429
  | 'overloaded'      // 529 / 503
  | 'timeout'
  | 'auth'
  | 'unknown';

export function classifyError(err: unknown, finishReason?: string): ClassifiedError {
  if (finishReason === 'length') return 'max_tokens';

  const msg = (err && typeof err === 'object' && 'message' in (err as any))
    ? String((err as any).message)
    : String(err ?? '');
  const status = (err && typeof err === 'object' && 'status' in (err as any))
    ? Number((err as any).status)
    : 0;

  if (status === 429 || /rate.?limit|too many requests/i.test(msg)) return 'rate_limit';
  if (status === 529 || status === 503 || /overloaded|service unavailable/i.test(msg)) return 'overloaded';
  if (status === 401 || status === 403 || /unauthorized|invalid.*api.*key|authentication/i.test(msg)) return 'auth';
  if (/timeout|timed out|ETIMEDOUT|ECONNRESET/i.test(msg)) return 'timeout';

  if (
    /context[_\s]?length[_\s]?exceeded/i.test(msg) ||
    /maximum context length/i.test(msg) ||
    /prompt.*too long/i.test(msg) ||
    /context.*too long/i.test(msg) ||
    /context.*limit/i.test(msg) ||
    /reduce.*length.*messages/i.test(msg) ||
    /token.*limit/i.test(msg)
  ) return 'prompt_too_long';

  return 'unknown';
}

/** 指数退避（带 jitter）：1s → 2s → 4s → 8s → 16s，每档 ±20% */
export function computeBackoff(attempt: number): number {
  const base = 1000 * Math.pow(2, Math.min(attempt, 4));
  const jitter = base * 0.2 * (Math.random() * 2 - 1);
  return Math.max(500, Math.floor(base + jitter));
}

/** 决策：max_tokens 触发时该怎么办 */
export function decideTruncatedAction(state: RecoveryState): RecoveryAction {
  if (!state.hasEscalatedMaxTokens) {
    state.hasEscalatedMaxTokens = true;
    return { kind: 'truncated_escalate', nextMaxTokens: ESCALATED_MAX_TOKENS };
  }
  if (state.continuationCount < MAX_CONTINUATION_RETRIES) {
    state.continuationCount++;
    return {
      kind: 'truncated_continue',
      injectMessage:
        'Output token limit hit. Resume directly from where you stopped — ' +
        'no apology, no recap. Pick up mid-thought.',
    };
  }
  return { kind: 'fatal', reason: 'max_tokens still truncated after 3 continuations; bailing out.' };
}

/** 决策：prompt_too_long 触发时该怎么办 */
export function decideOverflowAction(state: RecoveryState): RecoveryAction {
  if (!state.hasAttemptedReactiveCompact) {
    state.hasAttemptedReactiveCompact = true;
    return { kind: 'overflow_compact' };
  }
  return { kind: 'fatal', reason: 'context still overflowing after reactive compact.' };
}

/** 决策：429/529 退避 */
export function decideBackoffAction(state: RecoveryState, classified: ClassifiedError): RecoveryAction {
  state.backoffAttempts++;
  if (state.backoffAttempts > MAX_BACKOFF_ATTEMPTS) {
    return { kind: 'fatal', reason: `${classified}: exceeded ${MAX_BACKOFF_ATTEMPTS} retries` };
  }
  // 连续 3 次 529 → 提示切 fallback model
  const switchModel = classified === 'overloaded' && state.backoffAttempts >= 3;
  return {
    kind: 'backoff',
    delayMs: computeBackoff(state.backoffAttempts - 1),
    attempt: state.backoffAttempts,
    switchModel,
  };
}

/** 帮辅工具：检查最后一条 assistant 是否被截断（finishReason === 'length'） */
export function lastAssistantTruncated(messages: ChatMessage[]): boolean {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') return false; // 我们没存 finishReason，外部传
  }
  return false;
}