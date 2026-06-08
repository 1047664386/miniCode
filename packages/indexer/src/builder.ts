/**
 * 索引构建器：从工作区根扫描所有源文件，构建三层索引：
 *
 *  1. BM25Index  — 关键词检索（fast, 词法）
 *  2. SymbolGraph — tree-sitter 抽取的符号 + 调用图（导航类问题）
 *  3. VectorStore — embedding 语义检索（意图类问题）
 *
 * 这三层在 server 的 hybridRetrieve 里用 RRF 融合，召回质量比单纯向量好很多。
 *
 * 增量更新由 apps/server 的 IndexWatcher 负责，本文件只关心全量构建。
 */
import { promises as fs } from 'node:fs';
import { scanWorkspace } from './scanner.js';
import { chunkText, chunkTextWithSymbols, type Chunk } from './chunker.js';
import { BM25Index } from './bm25.js';
import { extractFacts } from './extractor.js';
import { SymbolGraph } from './symbol-graph.js';
import { VectorStore, type VectorItem } from './vector-store.js';
import type { Embedder } from './embedder.js';

export interface CodebaseIndex {
  bm25: BM25Index;
  symbols: SymbolGraph;
  vectors: VectorStore;
  embedderName: string;
  chunkCount: number;
  fileCount: number;
  symbolCount: number;
}

export interface IndexProgress {
  scanned: number;
  total: number;
  current?: string;
  phase: 'scan' | 'embed' | 'done';
}

export interface BuildOptions {
  embedder?: Embedder;
  /** 持久化 vector 的路径 */
  vectorPath?: string;
  /** 增量：从磁盘 load 旧 vectors 再补差 */
  reuseVectors?: boolean;
}

export async function buildIndex(
  root: string,
  opts: BuildOptions = {},
  onProgress?: (p: IndexProgress) => void,
): Promise<CodebaseIndex> {
  const files = await scanWorkspace(root);
  const bm25 = new BM25Index();
  const symbols = new SymbolGraph();
  const vectors = new VectorStore();
  if (opts.reuseVectors && opts.vectorPath) await vectors.load(opts.vectorPath);

  let scanned = 0;
  const allChunks: Chunk[] = [];

  for (const f of files) {
    try {
      const text = await fs.readFile(f.abs, 'utf-8');
      const facts = extractFacts(f.path, text);
      // 优先用 symbol-aware 切片；非代码 / parse 失败 → 自动退回 naive
      const chunks =
        facts && facts.symbols.length > 0
          ? chunkTextWithSymbols(
              f.path,
              text,
              facts.symbols.map((s) => ({ name: s.name, startLine: s.startLine, endLine: s.endLine })),
            )
          : chunkText(f.path, text);
      allChunks.push(...chunks);
      if (facts) symbols.upsert(facts);
    } catch {
      /* skip */
    }
    scanned++;
    if (scanned % 25 === 0 || scanned === files.length) {
      onProgress?.({ scanned, total: files.length, current: f.path, phase: 'scan' });
    }
  }
  bm25.add(allChunks);

  // ---- embedding（可选）----
  let embedderName = 'none';
  if (opts.embedder) {
    const emb = opts.embedder;
    embedderName = emb.name;
    // 简化：直接重算所有 chunks 的 embedding（增量优化留给 watcher）
    if (!opts.reuseVectors) vectors.clear();
    const BATCH = 64;
    for (let i = 0; i < allChunks.length; i += BATCH) {
      const batch = allChunks.slice(i, i + BATCH);
      const texts = batch.map((c) => buildEmbedText(c));
      const vecs = await emb.embed(texts);
      const items: VectorItem[] = batch.map((c, j) => ({
        id: c.id,
        path: c.path,
        startLine: c.startLine,
        endLine: c.endLine,
        text: c.text,
        vec: vecs[j],
        model: emb.name,
      }));
      vectors.add(items);
      onProgress?.({
        scanned: Math.min(i + BATCH, allChunks.length),
        total: allChunks.length,
        current: batch[0]?.path,
        phase: 'embed',
      });
    }
    if (opts.vectorPath) await vectors.save(opts.vectorPath);
  }

  onProgress?.({ scanned: files.length, total: files.length, phase: 'done' });
  const stats = symbols.stats();
  return {
    bm25,
    symbols,
    vectors,
    embedderName,
    chunkCount: allChunks.length,
    fileCount: files.length,
    symbolCount: stats.symbols,
  };
}

/** 给 chunk 文本加上路径前缀，能让 embedding 更"语义"些 */
function buildEmbedText(c: Chunk): string {
  return `// ${c.path}\n${c.text}`;
}