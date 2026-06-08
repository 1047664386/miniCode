/**
 * Memory hybrid recall 验证：
 *  - 不配 embedder → 行为完全等价旧版（纯词法）
 *  - 配 mock embedder → 即使词法 0 命中也能召回（语义路径生效）
 *
 * 跑法：pnpm --filter @mini/core exec tsx src/memory/__tests__/store.spec.ts
 */
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MemoryStore, type MemoryEmbedder } from '../store.js';

const tests: Array<{ name: string; fn: () => Promise<void> }> = [];
const it = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });
const assert = (cond: any, msg: string) => {
  if (!cond) throw new Error(msg);
};

async function tmpRoot() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'mem-test-'));
}

// 1) 纯词法行为（无 embedder）
it('lexical recall without embedder', async () => {
  const rootDir = await tmpRoot();
  const m = new MemoryStore({ projectPath: '/x/y', rootDir });
  await m.upsert('user', {
    title: 'Use TypeScript strict mode',
    content: 'Always enable strict in tsconfig',
    category: 'user_preference',
    keywords: ['typescript', 'strict'],
  });
  await m.upsert('project', {
    title: 'Use pnpm not npm',
    content: 'Package manager is pnpm',
    category: 'project_knowledge',
    keywords: ['pnpm'],
  });
  const hits = await m.recall('strict', { topK: 5 });
  assert(hits.length === 1, `expected 1 hit, got ${hits.length}`);
  assert(hits[0].title.includes('TypeScript'), 'wrong hit');
});

// 2) 词法 0 命中 → 语义 mock embedder 兜底
it('semantic recall fills lexical gap', async () => {
  const rootDir = await tmpRoot();
  // mock embedder：把关键字预映射到固定向量；同语义的 query / item 给同向量
  const semanticMap: Record<string, number[]> = {
    QUERY: [1, 0, 0, 0],
    ITEM_A: [1, 0, 0, 0], // 同语义
    ITEM_B: [0, 1, 0, 0],
  };
  const emb: MemoryEmbedder = {
    async embed(texts: string[]) {
      return texts.map((t) => {
        if (t === '__QUERY__') return semanticMap.QUERY;
        if (t.includes('Eskimo')) return semanticMap.ITEM_A;
        return semanticMap.ITEM_B;
      });
    },
  };
  const m = new MemoryStore({ projectPath: '/x/z', rootDir, embedder: emb });
  await m.upsert('user', {
    title: 'Eskimo cooking',
    content: 'Northern recipes',
    category: 'experience',
  });
  await m.upsert('user', {
    title: 'Unrelated note',
    content: 'Nothing here',
    category: 'experience',
  });
  // query 是 __QUERY__（mock），词法不会命中任何 item，只有语义路径能召回
  const hits = await m.recall('__QUERY__', { topK: 1 });
  assert(hits.length === 1, `expected 1 hit, got ${hits.length}`);
  assert(hits[0].title === 'Eskimo cooking', `wrong semantic hit: ${hits[0].title}`);
});

// 3) reembedAll 给旧条目补 vec
it('reembedAll backfills vectors', async () => {
  const rootDir = await tmpRoot();
  // 先用无 embedder 写入
  const m1 = new MemoryStore({ projectPath: '/x/a', rootDir });
  await m1.upsert('user', { title: 't1', content: 'c1', category: 'experience' });
  await m1.upsert('user', { title: 't2', content: 'c2', category: 'experience' });
  // 再插入 embedder + reembed
  const emb: MemoryEmbedder = {
    async embed(texts: string[]) {
      return texts.map(() => [0.5, 0.5]);
    },
  };
  const m2 = new MemoryStore({ projectPath: '/x/a', rootDir, embedder: emb });
  const stats = await m2.reembedAll();
  assert(stats.embedded === 2, `expected 2 embedded, got ${stats.embedded}`);
});

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