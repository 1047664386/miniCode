/**
 * History Compactor — 按 token budget 切 head/middle/tail，对应 CodeFlicker L1 Window 思想。
 *
 * 关键设计：
 *  - 全程按 token 而不是消息条数（不同模型 budget 不同，行为也不同）
 *  - head 保留最早 N 条（系统级初始指令、首个 user query）
 *  - tail 从最新消息向前按 token 累加，至少保 minUserMessages 条 user/assistant
 *  - 中间 middle 暂时用一条 system 占位说明被截断；预留 LLM 摘要 hook
 *  - tool_call ↔ tool_result 配对保护：不能把 tool_call 留下而 tool_result 被切走
 *
 * L2 LLM 摘要在本项目里用一个可选 summarizer 函数注入；不传就 fallback 占位文本。
 */
import type { ChatMessage } from '../llm/types.js';
import {
  estimateMessageTokens,
  estimateMessagesTokens,
  resolveCompactionThresholds,
  type TokenEstimateOptions,
  type CompactionThresholds,
} from './token-estimator.js';

export type Summarizer = (middleMessages: ChatMessage[]) => Promise<string>;

export interface CompactHistoryOptions {
  /** 当前模型名，用于查 contextWindow */
  model?: string;
  /** 已经定型的 system + tools schema 占用的 token，从总 budget 里扣 */
  reservedTokens?: number;
  /** 头部保留条数（默认 2，对应初始 system 指令 / 首条 user query） */
  headKeep?: number;
  /** tail 至少保留多少条 user/assistant（防止只剩 tool 消息无法回答） */
  tailMinUserMessages?: number;
  /** L2 摘要器（可选，传入则用 LLM 摘要中间段，否则占位） */
  summarize?: Summarizer;
  /** token 估算 opts（可注入真实 tokenizer） */
  tokenOpts?: TokenEstimateOptions;
  /** 自定义阈值覆盖 */
  thresholds?: Parameters<typeof resolveCompactionThresholds>[1];
}

export interface CompactResult {
  messages: ChatMessage[];
  /** 实际使用的阈值（debug） */
  thresholds: CompactionThresholds;
  /** 压缩前/后 token */
  beforeTokens: number;
  afterTokens: number;
  /** 是否真的压缩了 */
  compacted: boolean;
  /** 摘要文本（如果 L2 跑了） */
  summaryText?: string;
}

/**
 * 主入口：给一段 history（不含本轮 user message），返回压缩后的 history。
 *
 * 流程：
 *   1. 算 thresholds（基于 model）
 *   2. 估当前 history token，若 < triggerTokens → 不压缩直接返回
 *   3. 切 head / tail（按 targetTokens - reservedTokens 倒推）
 *   4. middle = head 与 tail 之间
 *   5. tool 配对保护：tail 头是 tool result → 向后挪一位避免孤立
 *   6. middle 走 L2 摘要（如果有 summarizer），否则占位
 *   7. 返回 [head, summaryMsg, tail]
 */
export async function compactHistory(
  history: ChatMessage[],
  opts: CompactHistoryOptions = {},
): Promise<CompactResult> {
  const thresholds = resolveCompactionThresholds(opts.model, opts.thresholds, opts.tokenOpts);
  const tokenOpts = opts.tokenOpts;
  const reserved = opts.reservedTokens ?? 0;
  const headKeep = opts.headKeep ?? 2;
  const tailMinUserMessages = opts.tailMinUserMessages ?? 5;

  const beforeTokens = estimateMessagesTokens(history, tokenOpts) + reserved;

  // [短路] 没超过触发阈值，不动
  if (beforeTokens < thresholds.triggerTokens || history.length <= headKeep + 2) {
    return {
      messages: history,
      thresholds,
      beforeTokens,
      afterTokens: beforeTokens,
      compacted: false,
    };
  }

  // [窗口规划]
  const head = history.slice(0, Math.min(headKeep, history.length));
  const headTokens = estimateMessagesTokens(head, tokenOpts);

  // tail 预算 = targetTokens - reserved - headTokens - 摘要预估（约 500 token）
  const SUMMARY_BUDGET = 500;
  const tailBudget = Math.max(
    1000,
    thresholds.targetTokens - reserved - headTokens - SUMMARY_BUDGET,
  );

  // 从最新消息向前累加，直到超出 budget 或达到 head 边界
  const tail: ChatMessage[] = [];
  let tailTokens = 0;
  let userMsgInTail = 0;
  for (let i = history.length - 1; i >= head.length; i--) {
    const m = history[i];
    const t = estimateMessageTokens(m, tokenOpts);
    if (tailTokens + t > tailBudget && userMsgInTail >= tailMinUserMessages) break;
    tail.unshift(m);
    tailTokens += t;
    if (m.role === 'user' || m.role === 'assistant') userMsgInTail++;
  }

  // [tool 配对保护] tail 头部不能是 tool 消息（孤立 result，找不到对应 call）
  while (tail.length > 0 && tail[0].role === 'tool') {
    tail.shift();
  }
  // [tool 配对保护] head 尾部不能是带 tool_calls 的 assistant（call 在 head, result 被切到 middle 了）
  let safeHead = head.slice();
  while (safeHead.length > 0) {
    const last = safeHead[safeHead.length - 1];
    if (last.role === 'assistant' && (last as any).tool_calls?.length) {
      safeHead.pop();
    } else {
      break;
    }
  }

  // [middle]
  const middle = history.slice(safeHead.length, history.length - tail.length);

  if (middle.length === 0) {
    // 没东西可压
    return {
      messages: [...safeHead, ...tail],
      thresholds,
      beforeTokens,
      afterTokens: estimateMessagesTokens([...safeHead, ...tail], tokenOpts) + reserved,
      compacted: false,
    };
  }

  // [L2 摘要]
  let summaryText: string;
  try {
    if (opts.summarize) {
      summaryText = await opts.summarize(middle);
    } else {
      // 占位 fallback：列 paths / errors / decisions 这几个高价值信号
      summaryText = fallbackSummary(middle);
    }
  } catch (err) {
    // L2 失败 → 退化到占位（CodeFlicker 这里走 L4 文件 offload，本项目暂不实现）
    summaryText = fallbackSummary(middle, err);
  }

  const summaryMsg: ChatMessage = {
    role: 'system',
    content:
      `[Compacted ${middle.length} earlier messages — short-term → long-term memory transition]\n` +
      `${summaryText}\n` +
      `(IMPORTANT: keep this system message in subsequent compactions)`,
  };

  const out = [...safeHead, summaryMsg, ...tail];
  const afterTokens = estimateMessagesTokens(out, tokenOpts) + reserved;
  return {
    messages: out,
    thresholds,
    beforeTokens,
    afterTokens,
    compacted: true,
    summaryText,
  };
}

/**
 * fallback 摘要：在没接入 LLM 摘要器时用启发式抽取关键信号。
 * 提取：file paths / errors / decisions / TODOs。
 *
 * 比"... [N earlier messages truncated] ..."强得多。
 */
function fallbackSummary(middle: ChatMessage[], err?: unknown): string {
  const lines: string[] = [];
  if (err) lines.push(`(L2 summarizer failed: ${(err as Error)?.message ?? err}, using heuristic fallback)`);

  const paths = new Set<string>();
  const errors: string[] = [];
  const decisions: string[] = [];

  for (const m of middle) {
    const txt = (m.content ?? '').toString();
    // 文件路径（相对/绝对）
    for (const p of txt.matchAll(/[\w./-]+\.[a-zA-Z]{1,5}\b/g)) {
      if (paths.size < 30) paths.add(p[0]);
    }
    // 错误关键字
    for (const e of txt.matchAll(/(?:Error|error|failed|exception)[:\s][^\n]{0,200}/gi)) {
      if (errors.length < 5) errors.push(e[0].slice(0, 200));
    }
    // 决策性句子
    for (const d of txt.matchAll(/(?:I will|I'll|让我|我决定|Let's|Let me|TODO)[^\n.]{0,200}/gi)) {
      if (decisions.length < 5) decisions.push(d[0].slice(0, 200));
    }
  }

  if (paths.size) lines.push(`Files mentioned: ${[...paths].slice(0, 20).join(', ')}`);
  if (errors.length) lines.push(`Errors observed:\n  - ${errors.join('\n  - ')}`);
  if (decisions.length) lines.push(`Key actions/decisions:\n  - ${decisions.join('\n  - ')}`);

  if (!lines.length) {
    lines.push(`(${middle.length} messages truncated, no extractable signals)`);
  }
  return lines.join('\n');
}