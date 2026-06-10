
/**
 * 混合召回：BM25 + 向量，用 Reciprocal Rank Fusion 融合排名。
 * RRF 公式：score(d) = Σ 1/(k + rank_i(d))，k=60 是经典默认值。
 * 没有 vectors 时降级为纯 BM25。
 *
 * 末端可选 cross-encoder rerank（由 RERANKER env 控制，见 reranker.ts）：
 *  - 召回阶段先取 topK*3 的"粗排"
 *  - rerank 后输出 topK
 *  - reranker 不存在/失败时保持 RRF 顺序
 */
import type { CodebaseIndex, Embedder } from '@mini/indexer';
import type { Reranker } from './reranker.js';

export interface RetrievalHit {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  text: string;
  score: number;
  sources: string[]; // 'bm25' / 'vector'
  /** rerank 后的 cross-encoder 分（0~1），未 rerank 时为 undefined */
  rerankScore?: number;
}

export async function hybridRetrieve(
  index: CodebaseIndex,
  embedder: Embedder,
  query: string,
  topK = 8,
  reranker?: Reranker,
): Promise<RetrievalHit[]> {
  const RRF_K = 60;
  // 召回阶段拿多一点候选，留给 rerank 重排
  const overFetch = reranker && reranker.name !== 'identity' ? topK * 3 : topK * 2;

  // 1. BM25
  const bmHits = index.bm25.search(query, overFetch);

  // 2. 向量
  let vecHits: { item: any; score: number }[] = [];
  if (index.vectors.size() > 0) {
    try {
      const [v] = await embedder.embed([query]);
      vecHits = index.vectors.search(v, overFetch);
    } catch (e) {
      console.warn('[retrieval] vector search failed, falling back to BM25 only:', (e as Error).message);
    }
  }

  // 3. RRF 融合
  const scores = new Map<string, RetrievalHit>();
  bmHits.forEach((h, rank) => {
    const id = h.chunk.id;
    scores.set(id, {
      id,
      path: h.chunk.file,
      startLine: h.chunk.startLine,
      endLine: h.chunk.endLine,
      text: h.chunk.text,
      score: 1 / (RRF_K + rank + 1),
      sources: ['bm25'],
    });
  });
  vecHits.forEach((h, rank) => {
    const id = h.item.id;
    const existing = scores.get(id);
    if (existing) {
      existing.score += 1 / (RRF_K + rank + 1);
      if (!existing.sources.includes('vector')) existing.sources.push('vector');
    } else {
      scores.set(id, {
        id,
        path: h.item.path,
        startLine: h.item.startLine,
        endLine: h.item.endLine,
        text: h.item.text,
        score: 1 / (RRF_K + rank + 1),
        sources: ['vector'],
      });
    }
  });

  const fused = Array.from(scores.values()).sort((a, b) => b.score - a.score);

  // 4. 可选 cross-encoder rerank（只对 fused 的 topK*3 候选跑）
  if (reranker && reranker.name !== 'identity' && fused.length > 1) {
    const candidates = fused.slice(0, overFetch).map((h) => ({
      id: h.id,
      text: h.text,
      meta: h,
    }));
    try {
      const reranked = await reranker.rerank(query, candidates, topK);
      return reranked.map((r) => ({
        ...(r.candidate.meta as RetrievalHit),
        rerankScore: r.score,
      }));
    } catch (e) {
      console.warn('[retrieval] rerank failed, using RRF order:', (e as Error).message);
    }
  }

  return fused.slice(0, topK);
}