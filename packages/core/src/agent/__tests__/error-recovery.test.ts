/**
 * Error Recovery 单测
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyError,
  computeBackoff,
  createRecoveryState,
  decideTruncatedAction,
  decideOverflowAction,
  decideBackoffAction,
  ESCALATED_MAX_TOKENS,
  MAX_BACKOFF_ATTEMPTS,
} from '../error-recovery.js';

test('classifyError: max_tokens by finishReason', () => {
  assert.equal(classifyError(null, 'length'), 'max_tokens');
});

test('classifyError: 429 / 529 / overloaded msg', () => {
  assert.equal(classifyError({ status: 429, message: 'rate limit' }), 'rate_limit');
  assert.equal(classifyError({ status: 529, message: 'overloaded' }), 'overloaded');
  assert.equal(classifyError({ status: 503 }), 'overloaded');
  assert.equal(classifyError(new Error('Service overloaded, try later')), 'overloaded');
});

test('classifyError: prompt_too_long 各种话术', () => {
  assert.equal(classifyError(new Error('context_length_exceeded')), 'prompt_too_long');
  assert.equal(classifyError(new Error('Maximum context length is 200000')), 'prompt_too_long');
  assert.equal(classifyError(new Error('prompt is too long')), 'prompt_too_long');
});

test('classifyError: auth/timeout/unknown', () => {
  assert.equal(classifyError({ status: 401 }), 'auth');
  assert.equal(classifyError(new Error('ETIMEDOUT something')), 'timeout');
  assert.equal(classifyError(new Error('weird error')), 'unknown');
});

test('decideTruncatedAction: 第一次升级，第二次续写，第 N 次 fatal', () => {
  const s = createRecoveryState();
  const a1 = decideTruncatedAction(s);
  assert.equal(a1.kind, 'truncated_escalate');
  if (a1.kind === 'truncated_escalate') assert.equal(a1.nextMaxTokens, ESCALATED_MAX_TOKENS);

  for (let i = 0; i < 3; i++) {
    const a = decideTruncatedAction(s);
    assert.equal(a.kind, 'truncated_continue');
  }
  const last = decideTruncatedAction(s);
  assert.equal(last.kind, 'fatal');
});

test('decideOverflowAction: 一次 compact 后 fatal', () => {
  const s = createRecoveryState();
  assert.equal(decideOverflowAction(s).kind, 'overflow_compact');
  assert.equal(decideOverflowAction(s).kind, 'fatal');
});

test('decideBackoffAction: 累积超过 MAX_BACKOFF_ATTEMPTS 变 fatal', () => {
  const s = createRecoveryState();
  for (let i = 0; i < MAX_BACKOFF_ATTEMPTS; i++) {
    const a = decideBackoffAction(s, 'rate_limit');
    assert.equal(a.kind, 'backoff');
  }
  const last = decideBackoffAction(s, 'rate_limit');
  assert.equal(last.kind, 'fatal');
});

test('decideBackoffAction: 第 3 次 overloaded 给 switchModel 提示', () => {
  const s = createRecoveryState();
  decideBackoffAction(s, 'overloaded');
  decideBackoffAction(s, 'overloaded');
  const a = decideBackoffAction(s, 'overloaded');
  assert.equal(a.kind, 'backoff');
  if (a.kind === 'backoff') assert.equal(a.switchModel, true);
});

test('computeBackoff: 单调封顶 + 抖动在 ±20% 内', () => {
  for (let i = 0; i < 6; i++) {
    const v = computeBackoff(i);
    const base = 1000 * Math.pow(2, Math.min(i, 4));
    assert.ok(v >= Math.floor(base * 0.8) - 1, `attempt ${i}: ${v} < ${base * 0.8}`);
    assert.ok(v <= Math.floor(base * 1.2) + 1, `attempt ${i}: ${v} > ${base * 1.2}`);
  }
});