user_pasted_clipboard_long_content_as_file_Soft Compact.txt
/**
 * Soft Compact 单测
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  snipCompact,
  microCompact,
  spillLargeToolResults,
  compactPipeline,
} from '../soft-compact.js';
import type { ChatMessage } from '../../llm/types.js';

function mk(role: ChatMessage['role'], content: string): ChatMessage {
  return { role, content };
}

test('snipCompact: 消息数 <= maxMessages → 不变', () => {
  const msgs: ChatMessage[] = Array.from({ length: 5 }, (_, i) => mk('user', `m${i}`));
  const out = snipCompact(msgs, { maxMessages: 60 });
  assert.equal(out.length, 5);
});

test('snipCompact: 消息数 > maxMessages → 中间塞 placeholder', () => {
  const msgs: ChatMessage[] = Array.from({ length: 100 }, (_, i) =>
    mk(i % 2 ? 'assistant' : 'user', `m${i}`),
  );
  const out = snipCompact(msgs, { maxMessages: 30, keepHead: 3 });
  assert.ok(out.length <= 31, `expected <=31 got ${out.length}`);
  assert.match(out[3].content ?? '', /snipped \d+ earlier messages/);
  // 头 3 条原样
  assert.equal(out[0].content, 'm0');
  assert.equal(out[1].content, 'm1');
  // 尾保留
  assert.equal(out[out.length - 1].content, 'm99');
});

test('microCompact: 老的长 tool_result 被压占位，最近 N 条原样', () => {
  const long = 'x'.repeat(800);
  const msgs: ChatMessage[] = [
    mk('user', 'q1'),
    mk('tool', long),
    mk('tool', long),
    mk('tool', long),
    mk('tool', long),
    mk('tool', long),
  ];
  const out = microCompact(msgs, { keepRecentToolResults: 3, microMinChars: 400 });
  // 最早那两条 tool 被压
  assert.match(out[1].content ?? '', /Earlier tool result compacted/);
  assert.match(out[2].content ?? '', /Earlier tool result compacted/);
  // 最近 3 条不动
  assert.equal(out[3].content, long);
  assert.equal(out[4].content, long);
  assert.equal(out[5].content, long);
});

test('microCompact: 短 tool_result 不动', () => {
  const short = 'short'.repeat(10); // 50 chars
  const msgs: ChatMessage[] = [
    mk('tool', short),
    mk('tool', short),
    mk('tool', short),
    mk('tool', short),
  ];
  const out = microCompact(msgs, { keepRecentToolResults: 1, microMinChars: 400 });
  for (const m of out) assert.equal(m.content, short);
});

test('spillLargeToolResults: 大内容落盘 + messages 里改写', () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'spill-'));
  const huge = 'A'.repeat(50 * 1024); // 50KB > 32KB
  const msgs: ChatMessage[] = [mk('user', 'q'), mk('tool', huge)];
  const out = spillLargeToolResults(msgs, { workspace: ws, spillThresholdBytes: 32 * 1024 });
  assert.match(out[1].content ?? '', /spilled to disk/);
  assert.match(out[1].content ?? '', /Preview:/);
  // 文件实际写入了
  const cacheDir = path.join(ws, '.minicodeide', 'tool-cache');
  const files = fs.readdirSync(cacheDir);
  assert.equal(files.length, 1);
  const onDisk = fs.readFileSync(path.join(cacheDir, files[0]), 'utf-8');
  assert.equal(onDisk.length, huge.length);
});

test('spillLargeToolResults: 没 workspace → 不动', () => {
  const huge = 'A'.repeat(50 * 1024);
  const msgs: ChatMessage[] = [mk('tool', huge)];
  const out = spillLargeToolResults(msgs);
  assert.equal(out[0].content, huge);
});

test('compactPipeline: 三层组合不会丢 system / 头尾', () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'pipe-'));
  const msgs: ChatMessage[] = [mk('system', 'sys')];
  for (let i = 0; i < 80; i++) {
    msgs.push(mk('user', `q${i}`));
    msgs.push(mk('assistant', `a${i}`));
    msgs.push(mk('tool', i % 5 === 0 ? 'x'.repeat(40 * 1024) : 'short'));
  }
  const out = compactPipeline(msgs, {
    workspace: ws,
    maxMessages: 30,
    keepHead: 2,
    keepRecentToolResults: 3,
  });
  // system 必须保留
  assert.equal(out[0].role, 'system');
  // 末尾仍然能找到最后的 tool/assistant
  const last = out[out.length - 1];
  assert.ok(['tool', 'assistant', 'user'].includes(last.role));
  // 至少触发了一种压缩
  const joined = JSON.stringify(out);
  assert.ok(
    /snipped|Earlier tool result compacted|spilled to disk/.test(joined),
    'expected at least one compact marker',
  );
});