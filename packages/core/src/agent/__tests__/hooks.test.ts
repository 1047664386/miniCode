
/**
 * Hook Bus 单测 —— 用 node:test，无需额外依赖。
 *
 * 跑：node --test --import tsx packages/core/src/agent/__tests__/hooks.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HookBus } from '../hooks.js';

test('HookBus: PreToolUse 第一个 block 短路', async () => {
  const bus = new HookBus();
  const order: string[] = [];
  bus.on('PreToolUse', 'a', () => {
    order.push('a');
    return { block: true, blockReason: 'nope' };
  });
  bus.on('PreToolUse', 'b', () => {
    order.push('b');
  });
  const r = await bus.triggerPreToolUse({
    call: { id: '1', name: 'x', arguments: {} },
    step: 0,
  });
  assert.equal(r.block, true);
  assert.equal(r.blockReason, 'nope');
  assert.deepEqual(order, ['a']); // b 被短路
});

test('HookBus: UserPromptSubmit 多个 injectSystem 合并', async () => {
  const bus = new HookBus();
  bus.on('UserPromptSubmit', 'a', () => ({ injectSystem: 'A' }));
  bus.on('UserPromptSubmit', 'b', () => ({ injectSystem: 'B' }));
  const r = await bus.triggerUserPromptSubmit({ userText: '', messages: [] });
  assert.equal(r.injectSystem, 'A\n\nB');
  assert.equal(r.block, undefined);
});

test('HookBus: PostToolUse 异常被吞、不影响其他 handler', async () => {
  const bus = new HookBus();
  let bRan = false;
  bus.on('PostToolUse', 'crash', () => {
    throw new Error('boom');
  });
  bus.on('PostToolUse', 'ok', () => {
    bRan = true;
  });
  await bus.triggerPostToolUse({
    call: { id: '1', name: 'x', arguments: {} },
    ok: true,
    step: 0,
    durationMs: 1,
  });
  assert.equal(bRan, true);
});

test('HookBus: Stop 多个 forceContinue 取并集，message 拼接', async () => {
  const bus = new HookBus();
  bus.on('Stop', 'a', () => undefined);
  bus.on('Stop', 'b', () => ({ forceContinue: true, injectUserMessage: 'work harder' }));
  bus.on('Stop', 'c', () => ({ forceContinue: false }));
  const r = await bus.triggerStop({ reason: 'done', step: 3, messages: [] });
  assert.equal(r.forceContinue, true);
  assert.match(r.injectUserMessage ?? '', /work harder/);
});

test('HookBus: off 注销后不再触发', async () => {
  const bus = new HookBus();
  let n = 0;
  bus.on('PostToolUse', 'count', () => {
    n++;
  });
  bus.off('PostToolUse', 'count');
  await bus.triggerPostToolUse({
    call: { id: '1', name: 'x', arguments: {} },
    ok: true,
    step: 0,
    durationMs: 1,
  });
  assert.equal(n, 0);
});
