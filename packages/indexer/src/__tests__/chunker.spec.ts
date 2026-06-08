/**
 * Chunker 最小自测：验证 symbol-aware 切片对常见 TS 写法表现正常。
 * 跑法：pnpm --filter @mini/indexer exec tsx src/__tests__/chunker.spec.ts
 */
import { chunkText, chunkTextWithSymbols } from '../chunker.js';
import { extractFacts } from '../extractor.js';

const tests: Array<{ name: string; fn: () => void }> = [];
const it = (name: string, fn: () => void) => tests.push({ name, fn });
const assert = (cond: any, msg: string) => {
  if (!cond) throw new Error(msg);
};

// 1) naive 切片完全等价旧行为
it('naive: 40-line chunks with 5 overlap', () => {
  const text = Array.from({ length: 100 }, (_, i) => `line${i + 1}`).join('\n');
  const chunks = chunkText('a.ts', text);
  assert(chunks.length > 0, 'must produce chunks');
  assert(chunks[0].startLine === 1, 'first chunk starts at 1');
  assert(chunks[0].endLine === 40, 'first chunk ends at 40');
  // 第二个 chunk 起点 = 40 - 5 + 1 = 36
  assert(chunks[1].startLine === 36, `overlap broken: ${chunks[1].startLine}`);
});

// 2) symbol-aware：没 symbol 自动回退 naive
it('symbol-aware: no symbols → fallback to naive', () => {
  const text = 'just plain text\nno code here';
  const chunks = chunkTextWithSymbols('a.txt', text, []);
  assert(chunks.length > 0, 'produces chunks');
  assert(chunks[0].source === 'naive', `expected naive source, got ${chunks[0].source}`);
});

// 3) symbol-aware：典型 TS 文件 — 每个 symbol 一个 chunk
it('symbol-aware: typical TS file', () => {
  const text = `
import { x } from './x';

// Helper utility
function helper(a: number) {
  return a + 1;
}

/**
 * The main class.
 */
class Main {
  doSomething() {
    return helper(1);
  }
}

export const value = 42;
`.trimStart();
  const facts = extractFacts('a.ts', text);
  assert(facts, 'extractFacts should not return null');
  const chunks = chunkTextWithSymbols(
    'a.ts',
    text,
    facts!.symbols.map((s) => ({ name: s.name, startLine: s.startLine, endLine: s.endLine })),
  );
  // 应该有：preamble + helper + Main + value（4 个 chunk，或合并的 gap）
  const symNames = chunks.filter((c) => c.source === 'symbol').map((c) => c.symbolName);
  assert(symNames.includes('helper'), `helper missing: ${symNames.join(',')}`);
  assert(symNames.includes('Main'), `Main missing: ${symNames.join(',')}`);
  // class 内的 method 不单独成 chunk（被 class 包含）
  assert(!symNames.includes('doSomething'), `method should not produce top-level chunk`);
  // 注释应包进 chunk（Helper 注释在 helper symbol chunk 开头）
  const helperChunk = chunks.find((c) => c.symbolName === 'helper')!;
  assert(helperChunk.text.includes('Helper utility'), 'comment must be attached');
});

// 4) symbol-aware：长 symbol 二级切分
it('symbol-aware: long symbol gets sub-chunked', () => {
  const longBody = Array.from({ length: 250 }, (_, i) => `  const x${i} = ${i};`).join('\n');
  const text = `function huge() {\n${longBody}\n}\n`;
  const facts = extractFacts('a.ts', text);
  const chunks = chunkTextWithSymbols(
    'a.ts',
    text,
    facts!.symbols.map((s) => ({ name: s.name, startLine: s.startLine, endLine: s.endLine })),
  );
  const hugeChunks = chunks.filter((c) => c.symbolName?.startsWith('huge'));
  assert(hugeChunks.length >= 2, `expected >=2 sub-chunks for long fn, got ${hugeChunks.length}`);
  assert(
    hugeChunks.some((c) => c.symbolName === 'huge#header'),
    'expected #header sub-chunk',
  );
});

// 5) id 唯一
it('chunk ids are unique', () => {
  const text = `function a(){}\nfunction b(){}\nfunction c(){}`;
  const facts = extractFacts('a.ts', text);
  const chunks = chunkTextWithSymbols(
    'a.ts',
    text,
    facts!.symbols.map((s) => ({ name: s.name, startLine: s.startLine, endLine: s.endLine })),
  );
  const ids = chunks.map((c) => c.id);
  assert(new Set(ids).size === ids.length, `duplicate ids: ${ids.join(',')}`);
});

let passed = 0;
let failed = 0;
for (const t of tests) {
  try {
    t.fn();
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