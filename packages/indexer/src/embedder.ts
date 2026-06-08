/**
 * Embedder：把文本变成向量。
 * 支持两种后端：
 *   - openai-compat: 直接走 OpenAI/Moonshot/DeepSeek/Ollama 等 /v1/embeddings 接口
 *   - hash: 简易兜底（无 API Key 时也能跑），用 hashing trick 生成 256 维稀疏向量
 *
 * 这样：1) 没 key 也能 demo；2) 有 key 时一行配置切到真 embedding 模型。
 */
export interface Embedder {
  /** embedding 维度，VectorStore 用来 sanity check */
  readonly dim: number;
  readonly name: string;
  embed(texts: string[]): Promise<Float32Array[]>;
}

// ---------------- OpenAI compatible ----------------
export interface OpenAIEmbedderOptions {
  baseUrl: string; // 例：https://api.openai.com/v1 or https://api.deepseek.com/v1
  apiKey: string;
  model: string; // 例：text-embedding-3-small / BAAI/bge-m3
  dim?: number; // 部分模型支持降维参数
  batchSize?: number;
}

export class OpenAIEmbedder implements Embedder {
  readonly name: string;
  readonly dim: number;
  private batchSize: number;

  constructor(private opts: OpenAIEmbedderOptions) {
    this.name = `openai:${opts.model}`;
    this.dim = opts.dim ?? 1536;
    this.batchSize = opts.batchSize ?? 32;
  }

  async embed(texts: string[]): Promise<Float32Array[]> {
    const out: Float32Array[] = [];
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);
      const body: any = { model: this.opts.model, input: batch };
      if (this.opts.dim) body.dimensions = this.opts.dim;
      const r = await fetch(this.opts.baseUrl.replace(/\/$/, '') + '/embeddings', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.opts.apiKey}`,
        },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`embedding failed: ${r.status} ${await r.text()}`);
      const j = (await r.json()) as any;
      for (const d of j.data) out.push(new Float32Array(d.embedding));
    }
    return out;
  }
}

// ---------------- Hashing trick fallback ----------------
/**
 * 完全本地、无依赖的 fallback embedder：
 *   - 分词（小写 + 拆非字母数字）
 *   - 每个 token 用 fnv-1a 哈希到 [0, dim)
 *   - 累加 tf，再 L2 normalize
 * 这是 NLP 早期 hashing trick / 简化版 sentence embedding。
 * 对 demo / 没 key 的情况"够用"，召回质量不如真 embedding，但能跑通整条链路。
 */
export class HashEmbedder implements Embedder {
  readonly name = 'hash:fnv1a-256';
  readonly dim = 256;

  async embed(texts: string[]): Promise<Float32Array[]> {
    return texts.map((t) => this.one(t));
  }

  private one(text: string): Float32Array {
    const v = new Float32Array(this.dim);
    const tokens = text.toLowerCase().split(/[^a-z0-9_]+/).filter((x) => x.length > 1);
    for (const tok of tokens) {
      const h = fnv1a(tok) % this.dim;
      v[h] += 1;
    }
    // L2 normalize
    let norm = 0;
    for (let i = 0; i < v.length; i++) norm += v[i] * v[i];
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < v.length; i++) v[i] /= norm;
    return v;
  }
}

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// ---------------- 工厂 ----------------
export interface EmbedderConfig {
  provider?: 'openai' | 'hash';
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  dim?: number;
}

export function createEmbedder(cfg: EmbedderConfig): Embedder {
  if (cfg.provider === 'openai' && cfg.apiKey && cfg.baseUrl && cfg.model) {
    return new OpenAIEmbedder({
      baseUrl: cfg.baseUrl,
      apiKey: cfg.apiKey,
      model: cfg.model,
      dim: cfg.dim,
    });
  }
  return new HashEmbedder();
}