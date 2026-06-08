user_pasted_clipboard_long_content_as_file_轻量自测：验证 callS.txt
/**
 * 轻量自测：验证 callStructured 的核心解析/校验路径（不打真 LLM，CI 友好）。
 *
 * 跑法：
 *   pnpm --filter @mini/core exec tsx src/llm/__tests__/structured.spec.ts
 */
import { z } from 'zod';
import { callStructured, StructuredCallError } from '../structured.js';
import type { LLMProvider, ChatMessage, LLMChatOptions, ChatChunk } from '../types.js';

/** mock provider：按预设字符串吐 delta，最后 done */
function mockLLM(responses: string[]): LLMProvider {
  let call = 0;
  return {
    name: 'mock',
    async *chatStream(_messages: ChatMessage[], _opts?: LLMChatOptions): AsyncIterable<ChatChunk> {
      const text = responses[Math.min(call, responses.length - 1)];
      call++;
      yield { delta: text };
      yield { done: true, finishReason: 'stop' };
    },
  };
}

const tests: Array<{ name: string; fn: () => Promise<void> }> = [];
function it(name: string, fn: () => Promise<void>) {
  tests.push({ name, fn });
}
function assertEq<T>(actual: T, expected: T, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`[${label}] expected ${e} got ${a}`);
}

const Schema = z.object({
  items: z.array(
    z.object({
      title: z.string(),
      category: z.enum(['a', 'b', 'c']),
    }),
  ),
});

// 1) 纯 JSON
it('plain JSON', async () => {
  const llm = mockLLM(['{"items":[{"title":"hello","category":"a"}]}']);
  const r = await callStructured(llm, {
    schema: Schema,
    messages: [{ role: 'user', content: 'go' }],
  });
  assertEq(r.attempts, 1, 'attempts');
  assertEq(r.data.items[0].title, 'hello', 'title');
});

// 2) JSON 包在 markdown fence 里
it('JSON in markdown fence', async () => {
  const llm = mockLLM(['Here is the result:\n```json\n{"items":[{"title":"x","category":"b"}]}\n```\nDone.']);
  const r = await callStructured(llm, {
    schema: Schema,
    messages: [{ role: 'user', content: 'go' }],
  });
  assertEq(r.data.items[0].category, 'b', 'category');
});

// 3) JSON 前后有散文（括号匹配提取）
it('JSON with surrounding prose', async () => {
  const llm = mockLLM(['Sure! {"items":[{"title":"y","category":"c"}]} that is all.']);
  const r = await callStructured(llm, {
    schema: Schema,
    messages: [{ role: 'user', content: 'go' }],
  });
  assertEq(r.data.items[0].title, 'y', 'title');
});

// 4) 嵌套对象（验证括号匹配栈）
it('nested objects', async () => {
  const Sch = z.object({ wrap: z.object({ nested: z.object({ k: z.string() }) }) });
  const llm = mockLLM(['junk {"wrap":{"nested":{"k":"v"}}} more junk']);
  const r = await callStructured(llm, {
    schema: Sch,
    messages: [{ role: 'user', content: 'go' }],
  });
  assertEq(r.data.wrap.nested.k, 'v', 'nested');
});

// 5) 第一次坏 JSON → 第二次自动修复（带错误反馈重试）
it('retry on bad JSON', async () => {
  const llm = mockLLM([
    '{"items":[{"title":"bad",}', // 坏 JSON
    '{"items":[{"title":"good","category":"a"}]}', // 第二次好的
  ]);
  const r = await callStructured(llm, {
    schema: Schema,
    messages: [{ role: 'user', content: 'go' }],
    maxRetries: 1,
  });
  assertEq(r.attempts, 2, 'attempts');
  assertEq(r.data.items[0].title, 'good', 'title');
});

// 6) 始终失败 → 抛 StructuredCallError
it('throws after exhausted retries', async () => {
  const llm = mockLLM(['not json at all', 'still not json', 'nope']);
  let thrown = false;
  try {
    await callStructured(llm, {
      schema: Schema,
      messages: [{ role: 'user', content: 'go' }],
      maxRetries: 2,
    });
  } catch (e) {
    thrown = true;
    if (!(e instanceof StructuredCallError)) throw new Error('expected StructuredCallError');
    assertEq(e.attempts, 3, 'attempts on error');
  }
  if (!thrown) throw new Error('should have thrown');
});

// 7) Schema 校验失败 → 重试
it('schema mismatch retry', async () => {
  const llm = mockLLM([
    '{"items":[{"title":"x","category":"WRONG_VALUE"}]}', // enum 失败
    '{"items":[{"title":"x","category":"a"}]}',
  ]);
  const r = await callStructured(llm, {
    schema: Schema,
    messages: [{ role: 'user', content: 'go' }],
    maxRetries: 1,
  });
  assertEq(r.attempts, 2, 'attempts');
  assertEq(r.data.items[0].category, 'a', 'category');
});

// 8) Anthropic provider → 不下发 responseFormat（仅观察 opts）
it('anthropic provider skips responseFormat', async () => {
  let observedOpts: LLMChatOptions | undefined;
  const llm: LLMProvider = {
    name: 'anthropic',
    async *chatStream(_m, opts) {
      observedOpts = opts;
      yield { delta: '{"items":[{"title":"a","category":"a"}]}' };
      yield { done: true };
    },
  };
  await callStructured(llm, {
    schema: Schema,
    messages: [{ role: 'user', content: 'go' }],
  });
  if (observedOpts?.responseFormat !== undefined) {
    throw new Error('anthropic should not receive responseFormat');
  }
});

// 9) OpenAI-compat provider → 下发 responseFormat
it('openai provider receives responseFormat', async () => {
  let observedOpts: LLMChatOptions | undefined;
  const llm: LLMProvider = {
    name: 'openai-compat',
    async *chatStream(_m, opts) {
      observedOpts = opts;
      yield { delta: '{"items":[{"title":"a","category":"a"}]}' };
      yield { done: true };
    },
  };
  await callStructured(llm, {
    schema: Schema,
    messages: [{ role: 'user', content: 'go' }],
  });
  if (!observedOpts?.responseFormat) {
    throw new Error('openai should receive responseFormat');
  }
});

// 跑
(async () => {
  let passed = 0;
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      passed++;
      console.log(`  ✓ ${t.name}`);
    } catch (e: any) {
      failed++;
      console.error(`  ✗ ${t.name}`);
      console.error(`    ${e?.message ?? e}`);
    }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();