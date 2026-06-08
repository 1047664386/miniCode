 /**
 * BM25 索引：在没接入 embedding 时也能提供语义近似的"语义检索"兜底。
 * 接入 embedding 之后，作为 hybrid 检索的关键词路。
 */
import type { Chunk } from './chunker.js';

interface Doc {
  id: number;
  chunk: Chunk;
  terms: string[];
  tf: Map<string, number>;
  len: number;
}

const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'is', 'are', 'to', 'of', 'in', 'for', 'on', 'with',
  'this', 'that', 'it', 'as', 'be', 'by', 'at', 'from', 'we', 'you', 'i',
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9_\u4e00-\u9fa5]+/)
    .filter((t) => t && t.length > 1 && !STOP.has(t));
}

export class BM25Index {
  private docs: Doc[] = [];
  private df = new Map<string, number>();
  private avgdl = 0;
  private readonly k1 = 1.5;
  private readonly b = 0.75;

  add(chunks: Chunk[]) {
    for (const c of chunks) {
      const terms = tokenize(`${c.file} ${c.text}`);
      const tf = new Map<string, number>();
      for (const t of terms) tf.set(t, (tf.get(t) ?? 0) + 1);
      const id = this.docs.length;
      this.docs.push({ id, chunk: c, terms, tf, len: terms.length });
      for (const t of new Set(terms)) this.df.set(t, (this.df.get(t) ?? 0) + 1);
    }
    this.avgdl = this.docs.reduce((s, d) => s + d.len, 0) / Math.max(1, this.docs.length);
  }

  /** 删除某文件所有 chunks（增量索引用） */
  removeByPath(filePath: string) {
    const remaining: Doc[] = [];
    for (const d of this.docs) {
      if (d.chunk.path === filePath) {
        for (const t of new Set(d.terms)) {
          const c = this.df.get(t) ?? 0;
          if (c <= 1) this.df.delete(t);
          else this.df.set(t, c - 1);
        }
        continue;
      }
      remaining.push(d);
    }
    // 重新分配连续 id
    this.docs = remaining.map((d, i) => ({ ...d, id: i }));
    this.avgdl =
      this.docs.length > 0
        ? this.docs.reduce((s, d) => s + d.len, 0) / this.docs.length
        : 0;
  }

  /** 替换某路径所有 chunks（先 remove 再 add） */
  upsertFile(filePath: string, chunks: Chunk[]) {
    this.removeByPath(filePath);
    this.add(chunks);
  }

  search(query: string, k = 8): { chunk: Chunk; score: number }[] {
    const qTerms = tokenize(query);
    const N = this.docs.length;
    const scores: { chunk: Chunk; score: number }[] = [];
    for (const d of this.docs) {
      let s = 0;
      for (const t of qTerms) {
        const f = d.tf.get(t);
        if (!f) continue;
        const df = this.df.get(t) ?? 0;
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        const denom = f + this.k1 * (1 - this.b + (this.b * d.len) / this.avgdl);
        s += idf * ((f * (this.k1 + 1)) / denom);
      }
      if (s > 0) scores.push({ chunk: d.chunk, score: s });
    }
    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, k);
  }

  size() {
    return this.docs.length;
  }
}