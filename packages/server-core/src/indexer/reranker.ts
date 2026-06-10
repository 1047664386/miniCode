
/**
 * Cross-Encoder Reranker
 * ----------------------------------------------------------
 * 检索的 RRF 融合只解决"排名"层面的偏差，**相关性**还得靠真正读 query/doc 对的模型。
 *
 * 设计：
 *  - 抽象 Reranker 接口：rerank(query, candidates) → 按分数降序的同结构数组
 *  - 默认实现 TransformersReranker：用 @xenova/transformers 跑 cross-encoder
 *    （默认模型 Xenova/ms-marco-MiniLM-L-6-v2，~22MB，CPU 30-50ms / pair）
 *  - 懒加载：第一次调用才加载模型，避免空跑 server 时浪费内存
 *  - 失败时 silently fallback：返回原顺序，never throw
 *  - 启用方式：env RERANKER=on（默认 off）+ providers 配置可覆盖
 *
 * 评测：用 evals harness 比较 rerank on/off 下的 case 通过率。
 */

export interface RerankCandidate {
  /** 用于排序的 id，原样保留传回 */
  id: string;
  /** 拿来算分的文本（建议截断到 ~512 tokens / 2000 字符） */
  text: string;
  /** 任意 payload，原样保留 */
  meta?: unknown;
}

export interface RerankResult<T extends RerankCandidate = RerankCandidate> {
  candidate: T;
  /** 0~1 之间的相关性分（实际通常是 sigmoid(cross_encoder_logit)） */
  score: number;
}

export interface Reranker {
  /** 按 query 对 candidates 排序，输出 topN（默认全部） */
  rerank<T extends RerankCandidate>(query: string, candidates: T[], topN?: number): Promise<RerankResult<T>[]>;
  /** 名称（埋点 / 日志） */
  name: string;
}

/** No-op reranker：保持原顺序，等价于"不开 reranker" */
export class IdentityReranker implements Reranker {
  name = 'identity';
  async rerank<T extends RerankCandidate>(_q: string, cs: T[], topN?: number) {
    return cs.slice(0, topN ?? cs.length).map((c, i) => ({
      candidate: c,
      score: 1 - i / cs.length,
    }));
  }
}

/**
 * 基于 @xenova/transformers 的 cross-encoder reranker
 *
 * 模型选择：
 *  - Xenova/ms-marco-MiniLM-L-6-v2  默认；小快好（推荐）
 *  - Xenova/bge-reranker-base       中文/代码更强但慢 2-3x
 */
export class TransformersReranker implements Reranker {
  name: string;
  private pipelinePromise: Promise<any> | null = null;
  private modelId: string;
  private failed = false;

  constructor(modelId = 'Xenova/ms-marco-MiniLM-L-6-v2') {
    this.modelId = modelId;
    this.name = `xenova:${modelId.split('/').pop()}`;
  }

  private async getPipeline() {
    if (this.failed) return null;
    if (!this.pipelinePromise) {
      this.pipelinePromise = (async () => {
        try {
          // 注意：用 variable 引入避免 TS 静态解析（@xenova/transformers 为可选依赖）
          const modName = '@xenova/transformers';
          const mod: any = await import(/* @vite-ignore */ modName);
          // 关掉本地缓存检查的 chatty 输出
          if (mod.env) {
            mod.env.allowLocalModels = mod.env.allowLocalModels ?? false;
            mod.env.useBrowserCache = false;
          }
          return await mod.pipeline('text-classification', this.modelId);
        } catch (e) {
          console.warn(`[reranker] failed to load ${this.modelId}:`, (e as Error).message);
          this.failed = true;
          return null;
        }
      })();
    }
    return this.pipelinePromise;
  }

  async rerank<T extends RerankCandidate>(query: string, candidates: T[], topN?: number): Promise<RerankResult<T>[]> {
    if (candidates.length === 0) return [];
    const pipe = await this.getPipeline();
    if (!pipe) {
      // 降级：保持原序
      return candidates.slice(0, topN ?? candidates.length).map((c, i) => ({
        candidate: c,
        score: 1 - i / candidates.length,
      }));
    }
    try {
      // cross-encoder 的标准做法：[query, doc] pair → sigmoid logit
      // transformers.js 的 text-classification pipeline 支持 { text, text_pair } 形式
      const inputs = candidates.map((c) => ({
        text: query,
        text_pair: c.text.slice(0, 2000),
      }));
      const out = await pipe(inputs, { topk: 1 });
      // out: 数组，每项形如 [{ label: 'LABEL_0', score: 0.87 }]
      const scored = candidates.map((c, i) => {
        const r = Array.isArray(out[i]) ? out[i][0] : out[i];
        const s = typeof r?.score === 'number' ? r.score : 0;
        return { candidate: c, score: s };
      });
      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, topN ?? scored.length);
    } catch (e) {
      console.warn('[reranker] rerank failed, fallback to identity:', (e as Error).message);
      return candidates.slice(0, topN ?? candidates.length).map((c, i) => ({
        candidate: c,
        score: 1 - i / candidates.length,
      }));
    }
  }
}

/**
 * 工厂：按 env / 配置决定 reranker
 *  - RERANKER=off              → Identity（无操作）
 *  - RERANKER=on (默认 model)   → TransformersReranker
 *  - RERANKER=<modelId>        → TransformersReranker(<modelId>)
 */
export function buildReranker(env: NodeJS.ProcessEnv = process.env): Reranker {
  const v = (env.RERANKER ?? 'off').trim();
  if (!v || v === 'off' || v === '0' || v === 'false') return new IdentityReranker();
  if (v === 'on' || v === '1' || v === 'true') return new TransformersReranker();
  return new TransformersReranker(v);
}