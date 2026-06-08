/**
 * VectorStore：内存余弦相似度 + 可选 jsonl 持久化。
 * 一个项目几千 chunks 完全够用，省去 LanceDB/Qdrant 部署成本。
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface VectorItem {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  text: string;
  vec: Float32Array;
  /** 用哪个 embedder 算的，换 embedder 时要丢弃 */
  model: string;
}

export interface VectorHit {
  item: Omit<VectorItem, 'vec'>;
  score: number;
}

export class VectorStore {
  private items: VectorItem[] = [];

  size() {
    return this.items.length;
  }

  /** 替换某文件所有向量（增量重建时用） */
  upsertFile(filePath: string, items: VectorItem[]) {
    this.items = this.items.filter((x) => x.path !== filePath);
    this.items.push(...items);
  }

  add(items: VectorItem[]) {
    this.items.push(...items);
  }

  clear() {
    this.items = [];
  }

  /**
   * 余弦相似度 top-k。
   * 注意：所有向量必须已 L2 normalize（embedder 都做了），所以余弦 = 点积。
   */
  search(query: Float32Array, k = 10): VectorHit[] {
    if (this.items.length === 0) return [];
    const results: VectorHit[] = [];
    for (const it of this.items) {
      if (it.vec.length !== query.length) continue;
      let dot = 0;
      const v = it.vec;
      const len = v.length;
      for (let i = 0; i < len; i++) dot += v[i] * query[i];
      results.push({
        item: {
          id: it.id,
          path: it.path,
          startLine: it.startLine,
          endLine: it.endLine,
          text: it.text,
          model: it.model,
        },
        score: dot,
      });
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, k);
  }

  // ---- 持久化（jsonl，每行一个 item，便于增量 append） ----
  async save(filePath: string) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const lines = this.items.map((it) =>
      JSON.stringify({
        ...it,
        vec: Array.from(it.vec),
      }),
    );
    await fs.writeFile(filePath, lines.join('\n'), 'utf-8');
  }

  async load(filePath: string) {
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      this.items = [];
      for (const line of raw.split('\n')) {
        if (!line.trim()) continue;
        const obj = JSON.parse(line);
        this.items.push({
          ...obj,
          vec: new Float32Array(obj.vec),
        });
      }
    } catch (e: any) {
      if (e?.code !== 'ENOENT') throw e;
    }
  }
}