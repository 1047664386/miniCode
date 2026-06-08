/**
 * Hard Compact 单测
 * - 验证 ephemeral 消息在压缩后保留
 * - 验证 stable system 消息（cacheHint='ephemeral'）不被丢弃
 * - 验证压缩后 tail 结构完整（不会出现孤立 tool 消息）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hardCompact, isContextOverflow } from '../hard-compact.js';
import type { ChatMessage } from '../../llm/types.js';

function mk(role: ChatMessage['role'], content: string, extra?: Partial<ChatMessage>): ChatMessage {
  return { role, content, ...extra };
}

test('isContextOverflow: 识别 OpenAI context_length_exceeded', () => {
  assert.equal(isContextOverflow({ message: 'context_length_exceeded: too many tokens' }), true);
});

test('isContextOverflow: 识别 Anthropic prompt too long', () => {
  assert.equal(isContextOverflow({ message: 'prompt is too long: 250000 tokens > 200000 maximum' }), true);
});

test('isContextOverflow: 非 overflow 错误返回 false', () => {
  assert.equal(isContextOverflow({ message: 'rate_limit_exceeded' }), false);
  assert.equal(isContextOverflow(null), false);
  assert.equal(isContextOverflow(undefined), false);
});

test('hardCompact: 保留 stable system 消息（cacheHint=ephemeral）', () => {
  const msgs: ChatMessage[] = [
    mk('system', 'sys-stable-1', { cacheHint: 'ephemeral' }),
    mk('system', 'sys-stable-2', { cacheHint: 'ephemeral' }),
    mk('user', 'q1'),
    mk('assistant', 'a1'),
    mk('tool', 'tool1'),
    mk('user', 'q2'),
    mk('assistant', 'a2'),
    mk('user', 'q3'),
    mk('assistant', 'a3'),
  ];
  const out = hardCompact(msgs, { keepLast: 2, keepStable: true });
  // stable system 消息保留
  assert.equal(out[0].role, 'system');
  assert.equal(out[0].cacheHint, 'ephemeral');
  assert.equal(out[1].role, 'system');
  assert.equal(out[1].cacheHint, 'ephemeral');
  // 应该有 HARD-COMPACT summary
  const summaryMsg = out.find((m) => (m.content ?? '').includes('[HARD-COMPACT]'));
  assert.ok(summaryMsg, 'expected a HARD-COMPACT summary message');
  // tail 应该包含最后 2 组 user+assistant
  const userAsst = out.filter((m) => m.role === 'user' || m.role === 'assistant');
  assert.ok(userAsst.length >= 2, `expected >=2 user/assistant in tail, got ${userAsst.length}`);
});

test('hardCompact: 不会产生孤立的 tool 消息（tail 头不能是 tool）', () => {
  const msgs: ChatMessage[] = [
    mk('system', 'sys'),
    mk('user', 'q1'),
    mk('assistant', 'a1'),
    mk('tool', 'orphan-tool-result'),
    mk('tool', 'orphan-tool-result-2'),
    mk('user', 'q2'),
    mk('assistant', 'a2'),
    mk('user', 'q3'),
    mk('assistant', 'a3'),
  ];
  const out = hardCompact(msgs, { keepLast: 2 });
  // tail 的第一条不能是 tool
  const firstNonSummaryNonSystem = out.find((m) =>
    m.role !== 'system' || !(m.content ?? '').includes('[HARD-COMPACT]')
  );
  // After stable + summary, first message should not be tool
  const summaryIdx = out.findIndex((m) => (m.content ?? '').includes('[HARD-COMPACT]'));
  const afterSummary = out.slice(summaryIdx + 1);
  if (afterSummary.length > 0) {
    assert.notEqual(afterSummary[0].role, 'tool', 'tail should not start with an orphan tool message');
  }
});

test('hardCompact: 无中间消息时 summary 为 empty', () => {
  const msgs: ChatMessage[] = [
    mk('system', 'sys'),
    mk('user', 'q1'),
    mk('assistant', 'a1'),
  ];
  const out = hardCompact(msgs, { keepLast: 3 });
  // 全部保留，summary 应该说 no middle content
  const summaryMsg = out.find((m) => (m.content ?? '').includes('[HARD-COMPACT]'));
  if (summaryMsg) {
    assert.match(summaryMsg.content ?? '', /no middle content/);
  }
});

test('hardCompact: keepStable=false 时不保留 stable system', () => {
  const msgs: ChatMessage[] = [
    mk('system', 'sys-stable', { cacheHint: 'ephemeral' }),
    mk('user', 'q1'),
    mk('assistant', 'a1'),
    mk('user', 'q2'),
    mk('assistant', 'a2'),
  ];
  const out = hardCompact(msgs, { keepLast: 2, keepStable: false });
  // 不应该有 cacheHint=ephemeral 的消息
  const ephemeralMsgs = out.filter((m) => m.cacheHint === 'ephemeral');
  assert.equal(ephemeralMsgs.length, 0, 'expected no ephemeral messages when keepStable=false');
});