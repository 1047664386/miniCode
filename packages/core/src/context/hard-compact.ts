/**
 * Hard Compactor —— 当 LLM 抛 "context_length_exceeded" 类错误时的紧急压缩
 * ---------------------------------------------------------------
 * 区别于正常 compactHistory（按预算预防性压）：
 *   hardCompact 是被动的、激进的 —— 只保留 system + 最后 N 条，中间全摘要。
 *   适用场景：tokenizer 估算误差 5-10% → 预防性压缩没顶住 → LLM 真的返 4xx 上下文超限。
 *
 * 后果：
 *   - 必丢中间所有 tool_call/result 细节 → 调用方需明白这次代价
 *   - 摘要走启发式（fallbackSummary），不再调 LLM（避免再次超限）
 */
import type { ChatMessage } from '../llm/types.js';

export interface HardCompactOptions {
  /** 保留最后多少条 user/assistant 消息（不含 tool） */
  keepLast?: number;
  /** 用于辨识 system 消息：保留所有 cacheHint=ephemeral 的（即 stable system） */
  keepStable?: boolean;
}

/**
 * 启发式判断错误是否是 context overflow。
 * OpenAI: "context_length_exceeded" / "maximum context length"
 * Anthropic: "prompt is too long" / 400 with 'context'
 * DeepSeek/Moonshot: 类似关键词
 */
export function isContextOverflow(err: unknown): boolean {
  const s = (err && typeof err === 'object' && 'message' in (err as any))
    ? String((err as any).message)
    : String(err ?? '');
  if (!s) return false;
  return (
    /context[_\s]?length[_\s]?exceeded/i.test(s) ||
    /maximum context length/i.test(s) ||
    /prompt.*too long/i.test(s) ||
    /context.*too long/i.test(s) ||
    /context.*limit/i.test(s) ||
    /reduce.*length.*messages/i.test(s) ||
    /token.*limit/i.test(s)
  );
}

export function hardCompact(messages: ChatMessage[], opts: HardCompactOptions = {}): ChatMessage[] {
  const keepLast = opts.keepLast ?? 3;
  const keepStable = opts.keepStable !== false;

  // 1) 保留所有 stable system（cacheHint=ephemeral 是 stable 标记）
  const stableHead: ChatMessage[] = [];
  let cursor = 0;
  if (keepStable) {
    while (cursor < messages.length && messages[cursor].role === 'system') {
      stableHead.push(messages[cursor]);
      cursor++;
    }
  }

  // 2) 收集"最后 keepLast 条 user/assistant"
  const tail: ChatMessage[] = [];
  let userAsstCount = 0;
  for (let i = messages.length - 1; i >= cursor; i--) {
    const m = messages[i];
    if (m.role === 'user' || m.role === 'assistant') {
      tail.unshift(m);
      userAsstCount++;
      if (userAsstCount >= keepLast) break;
    }
    // tool 消息：跟随它对应的 assistant 一起进 tail（避免孤立）
    if (m.role === 'tool') tail.unshift(m);
  }

  // 3) 中间全部摘要（统计性的，启发式抽取）
  const middleEnd = messages.length - tail.length;
  const middle = messages.slice(cursor, middleEnd);
  const summary = summarizeHard(middle);
  const summaryMsg: ChatMessage = {
    role: 'system',
    content:
      `[HARD-COMPACT] Context overflow occurred — ${middle.length} earlier messages have been collapsed into the summary below. Tool call details have been lost.\n` +
      summary +
      `\n(Do NOT try to read those earlier tool outputs again; if needed, re-run the tool with current context.)`,
  };

  // 4) tail 头不能是 tool（孤立）
  while (tail.length > 0 && tail[0].role === 'tool') tail.shift();

  return [...stableHead, summaryMsg, ...tail];
}

function summarizeHard(middle: ChatMessage[]): string {
  if (middle.length === 0) return '(no middle content)';
  const paths = new Set<string>();
  const tools = new Map<string, number>();
  const errors: string[] = [];
  /** P1 修复：保留 assistant 消息中的关键决策/推理片段 */
  const decisions: string[] = [];

  // 决策关键词（中英文）
  const decisionPatterns = [
    /I(?:'ll| will| need to| should| decided to| plan to| think)\b[^\n.]{5,120}/gi,
    /let me\b[^\n.]{5,120}/gi,
    /(?:决定|接下来|需要|应该|打算|计划|先|然后|因此)[^\n。]{3,80}/g,
    /(?:based on|because|the issue is|the problem|root cause)[^\n.]{5,120}/gi,
  ];

  for (const m of middle) {
    const txt = (m.content ?? '').toString();
    for (const p of txt.matchAll(/[\w./-]+\.[a-zA-Z]{1,5}\b/g)) {
      if (paths.size < 40) paths.add(p[0]);
    }
    if (m.role === 'tool' && m.name) {
      tools.set(m.name, (tools.get(m.name) ?? 0) + 1);
    }
    if (m.role === 'assistant' && (m as any).tool_calls) {
      for (const tc of (m as any).tool_calls as Array<{ name: string }>) {
        tools.set(tc.name, (tools.get(tc.name) ?? 0) + 1);
      }
    }
    for (const e of txt.matchAll(/(?:Error|error|failed|exception)[:\s][^\n]{0,180}/gi)) {
      if (errors.length < 5) errors.push(e[0].slice(0, 180));
    }

    // P1 修复：从 assistant 消息中提取决策/推理片段
    if (m.role === 'assistant' && txt.length > 10) {
      let matchedInThisMsg = false;
      for (const pattern of decisionPatterns) {
        for (const match of txt.matchAll(pattern)) {
          if (decisions.length < 5) {
            decisions.push(match[0].trim().slice(0, 120));
            matchedInThisMsg = true;
          }
        }
        if (decisions.length >= 5) break;
      }
      // CR fix (P3): 只有当这条 assistant 消息没匹配到任何决策时，才 fallback 到首句
      // 之前用 txt.startsWith(d) 判断不可靠（d 可能在消息中间），改用 flag
      if (decisions.length < 5 && !matchedInThisMsg) {
        const firstSentence = txt.split(/[.\n。]/)[0]?.trim();
        if (firstSentence && firstSentence.length > 8 && firstSentence.length < 120) {
          // 跳过以代码围栏开头的消息（没有决策价值）
          if (!firstSentence.startsWith('```') && !firstSentence.startsWith('~~~')) {
            decisions.push(firstSentence);
          }
        }
      }
    }
  }

  const lines: string[] = [];
  lines.push(`Compacted ${middle.length} messages.`);
  if (decisions.length) {
    lines.push(`Key decisions/reasoning:\n  - ${decisions.join('\n  - ')}`);
  }
  if (tools.size) {
    const sorted = [...tools.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    lines.push(`Tool usage: ${sorted.map(([n, c]) => `${n}×${c}`).join(', ')}`);
  }
  if (paths.size) {
    lines.push(`Files touched: ${[...paths].slice(0, 25).join(', ')}`);
  }
  if (errors.length) {
    lines.push(`Errors seen:\n  - ${errors.join('\n  - ')}`);
  }
  return lines.join('\n');
}