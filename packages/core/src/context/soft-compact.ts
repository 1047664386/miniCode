/**
 * Soft Compactor —— 主动、便宜、不调 LLM 的多层压缩管线。
 * ---------------------------------------------------------------
 * 借鉴自 docs/learn-claude-code/s08_context_compact，但做了 TS / 项目化适配。
 *
 * 三层都不消耗 LLM token：
 *
 *   L1  snipCompact          消息条数 > maxMessages → 中间塞 [snipped N messages] 占位
 *   L2  microCompact         旧 tool_result 压成一行占位（保留最近 keepRecent 条）
 *   L3  spillLargeToolResults 单条 tool_result > maxResultBytes → 落盘 .minicodeide/tool-cache/<id>.txt
 *                            messages 里改写为 "[stored at xxx]"
 *
 * 调用方在每次 LLM call 之前 pipeline 跑：
 *   messages = compactPipeline(messages, { workspace })
 *
 * L4 (hard / reactive compact) 仍由 hard-compact.ts 在 catch 到 overflow 时兜底。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { ChatMessage } from '../llm/types.js';

export interface SoftCompactOptions {
  /** L1: 总消息数阈值；超过即在中间塞 snipped */
  maxMessages?: number;
  /** L1: 头部保留多少条 */
  keepHead?: number;
  /** L2: 保留最近多少条 tool_result 完整内容 */
  keepRecentToolResults?: number;
  /** L2: 单条 tool_result 超过此长度才考虑压成占位 */
  microMinChars?: number;
  /** L3: 单条 tool_result 超过此字节数 → 落盘 */
  spillThresholdBytes?: number;
  /** L3: 落盘目录（默认 <workspace>/.minicodeide/tool-cache） */
  workspace?: string;
}

const DEFAULT_OPTS: Required<Omit<SoftCompactOptions, 'workspace'>> = {
  maxMessages: 60,
  keepHead: 3,
  keepRecentToolResults: 3,
  microMinChars: 400,
  spillThresholdBytes: 4 * 1024, // 4KB — aggressive spill to preserve context for long ReAct loops
};

/** L1: 消息条数过多 → 中间塞占位符 */
export function snipCompact(messages: ChatMessage[], opts: SoftCompactOptions = {}): ChatMessage[] {
  const o = { ...DEFAULT_OPTS, ...opts };
  if (messages.length <= o.maxMessages) return messages;

  // 不能砍 system / 不能砍 tail；中间砍掉 user/assistant/tool 三类的连续段
  // 规则：保留头 keepHead 条 + 尾 (maxMessages-keepHead) 条
  const keepTail = o.maxMessages - o.keepHead;
  const head = messages.slice(0, o.keepHead);
  const tail = messages.slice(messages.length - keepTail);
  // 修剪 tail 头部不能是 tool（孤立）
  while (tail.length && tail[0].role === 'tool') tail.shift();
  const snipped = messages.length - head.length - tail.length;
  if (snipped <= 0) return messages;

  const placeholder: ChatMessage = {
    role: 'system',
    content: `[snipped ${snipped} earlier messages from conversation middle to keep context under control]`,
  };
  return [...head, placeholder, ...tail];
}

/**
 * L2: 旧 tool_result 内容压成一行占位（保留最近 keepRecent 条完整）。
 * 也处理 assistant 消息上 tool_calls 的 *回填* 文本（即 role=tool 的 content）。
 */
export function microCompact(messages: ChatMessage[], opts: SoftCompactOptions = {}): ChatMessage[] {
  const o = { ...DEFAULT_OPTS, ...opts };

  // 找出所有 role=tool 的索引
  const toolIdx: number[] = [];
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === 'tool') toolIdx.push(i);
  }
  if (toolIdx.length <= o.keepRecentToolResults) return messages;

  const compactSet = new Set(toolIdx.slice(0, toolIdx.length - o.keepRecentToolResults));
  return messages.map((m, i) => {
    if (!compactSet.has(i)) return m;
    if (m.role !== 'tool') return m;
    const len = (m.content ?? '').length;
    if (len < o.microMinChars) return m;
    return {
      ...m,
      content: `[Earlier tool result compacted (${len} chars). Re-run the tool with current context if you need it again.]`,
    };
  });
}

/**
 * L3: 单条 tool_result 过大 → 落盘，messages 里只保留索引行。
 *
 * 落盘文件路径：<workspace>/.minicodeide/tool-cache/<sha1-prefix>.txt
 * 模型可以用 `read_file` 读回（路径在 placeholder 里给出）。
 */
export function spillLargeToolResults(
  messages: ChatMessage[],
  opts: SoftCompactOptions = {},
): ChatMessage[] {
  const o = { ...DEFAULT_OPTS, ...opts };
  const ws = opts.workspace;
  if (!ws) return messages; // 没 workspace → 不落盘
  const cacheDir = path.join(ws, '.minicodeide', 'tool-cache');

  let dirReady = false;
  return messages.map((m) => {
    if (m.role !== 'tool') return m;
    const content = m.content ?? '';
    const bytes = Buffer.byteLength(content, 'utf8');
    if (bytes < o.spillThresholdBytes) return m;

    if (!dirReady) {
      try {
        fs.mkdirSync(cacheDir, { recursive: true });
        dirReady = true;
      } catch {
        return m; // 落盘失败 → 不动它
      }
    }
    const hash = crypto.createHash('sha1').update(content).digest('hex').slice(0, 12);
    const file = path.join(cacheDir, `${hash}.txt`);
    try {
      if (!fs.existsSync(file)) fs.writeFileSync(file, content, 'utf8');
    } catch {
      return m;
    }
    const rel = path.relative(ws, file).replace(/\\/g, '/');
    const head = content.slice(0, 400).replace(/\s+/g, ' ');
    return {
      ...m,
      content:
        `[large tool result spilled to disk: ${rel} (${bytes} bytes)]\n` +
        `Preview: ${head}...\n` +
        `If you need the full content, call read_file with path="${rel}".`,
    };
  });
}

/**
 * 完整 pipeline：L3 spill → L2 micro → L1 snip。
 * 先压单条大内容（最值钱），再压旧 tool_result，最后才砍消息条数。
 */
export function compactPipeline(
  messages: ChatMessage[],
  opts: SoftCompactOptions = {},
): ChatMessage[] {
  let m = messages;
  m = spillLargeToolResults(m, opts);
  m = microCompact(m, opts);
  m = snipCompact(m, opts);
  return m;
}