/**
 * MemoryStore —— 项目/用户 双 scope 的长期记忆
 * ---------------------------------------------------------------
 * 这一版相对上一版的核心升级：
 *  1. 加 importance (1-5) + lastHitAt → 召回分数 = bm25 * importance * decay
 *  2. atomic write（temp → rename）→ 解决并发写丢数据
 *  3. 召回算法从 substring count 升级为 token-level frequency + idf 近似
 *  4. 加 maintainMemory()：去重（标题/正文近似）+ 衰减归档（>30 天 + hitCount<2）
 *  5. 接口化：MemoryBackend interface，方便以后接 SQLite/FTS5
 *
 * 在线召回（recall）只读 + 单文件；后台 maintenance 才会改文件 → 并发友好。
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export type MemoryScope = 'user' | 'project';
export type MemoryCategory =
  | 'user_preference'
  | 'project_knowledge'
  | 'experience'
  | 'task_pattern'
  | 'other';

/**
 * Memory embedder duck-type：跟 LLMProvider.embed 签名兼容，
 * 也可以传任何返回 number[][] 的实现。
 * 不强制依赖 @mini/indexer，避免 core ↔ indexer 循环。
 */
export interface MemoryEmbedder {
  embed(texts: string[]): Promise<number[][]>;
}

export interface MemoryItem {
  id: string;
  scope: MemoryScope;
  category: MemoryCategory;
  title: string;
  content: string;
  keywords: string[];
  /** 重要性 1-5，越高越优先；默认 3。auto-memory 可以根据置信度给 4 / 5 */
  importance: number;
  createdAt: number;
  updatedAt: number;
  hitCount: number;
  /** 最近一次被召回的时间戳（用于衰减 + 归档判定） */
  lastHitAt?: number;
  /** 来源：'user' = 用户手动加；'auto' = LLM 自动沉淀 */
  source?: 'user' | 'auto';
  /** 归档状态：true → 不参与召回，仅保留以备恢复 */
  archived?: boolean;
  /**
   * 语义向量（可选）。upsert 时若 store 配了 embedder 则自动算并写入。
   * 已有的旧条目可通过 reembedAll() 批量补齐。
   */
  vec?: number[];
  /** 计算 vec 时用的 embedder 名（变化时可强制重算） */
  vecModel?: string;
}

export interface MemoryStoreOptions {
  projectPath: string;
  rootDir?: string;
  /**
   * 可选 embedder。提供时：
   *  - upsert 自动计算 vec
   *  - recall 走 lexical + semantic RRF 混合
   * 不提供 → 行为完全等同旧版（纯词法）
   */
  embedder?: MemoryEmbedder;
}

export interface RecallOptions {
  topK?: number;
  /** 召回时是否排除已归档的（默认 true） */
  excludeArchived?: boolean;
  /** 召回时强制更新 lastHitAt / hitCount（默认 true） */
  trackHits?: boolean;
}

const NOW = () => Date.now();
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 衰减函数：>30 天没被命中开始指数衰减，半衰期 30 天。
 * 永不归零（最低 0.1），让冷门但重要的记忆仍能在没有更好选项时召回。
 */
function decayFactor(lastHitAt: number | undefined, now: number): number {
  if (!lastHitAt) return 1; // 还没被召回过 → 不衰减（新进入的记忆）
  const daysSinceHit = (now - lastHitAt) / DAY_MS;
  if (daysSinceHit <= 30) return 1;
  const halfLives = (daysSinceHit - 30) / 30;
  return Math.max(0.1, Math.pow(0.5, halfLives));
}

/**
 * 粗糙 tokenize：按非词字符切；保留中文连续序列；小写化。
 * 不做完整分词（依赖 jieba 太重），靠 1-3 字 unigram 就能 cover 80% 场景。
 */
function tokenize(s: string): string[] {
  if (!s) return [];
  const lo = s.toLowerCase();
  const out: string[] = [];
  // 英文/数字 token
  for (const m of lo.matchAll(/[a-z0-9_]{2,}/g)) out.push(m[0]);
  // 中文：按字 + 二字 bigram
  const cjk = [...lo].filter((c) => /[\u4e00-\u9fff]/.test(c));
  for (let i = 0; i < cjk.length; i++) {
    out.push(cjk[i]);
    if (i + 1 < cjk.length) out.push(cjk[i] + cjk[i + 1]);
  }
  return out;
}

/** atomic write：先写 .tmp 再 rename → 即便中途 crash 也不会留半个 JSON */
async function atomicWrite(file: string, content: string) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp.${process.pid}.${Date.now()}`;
  await fs.writeFile(tmp, content, 'utf-8');
  await fs.rename(tmp, file);
}

export class MemoryStore {
  private rootDir: string;
  private projectDir: string;
  private embedder?: MemoryEmbedder;

  constructor(private opts: MemoryStoreOptions) {
    this.rootDir = opts.rootDir ?? path.join(os.homedir(), '.minicodeide');
    const hash = simpleHash(opts.projectPath);
    this.projectDir = path.join(this.rootDir, 'projects', hash);
    this.embedder = opts.embedder;
  }

  /** 运行时切换 embedder（provider 切换时调用） */
  setEmbedder(emb?: MemoryEmbedder) {
    this.embedder = emb;
  }

  private file(scope: MemoryScope) {
    return scope === 'user'
      ? path.join(this.rootDir, 'user', 'memories.json')
      : path.join(this.projectDir, 'memories.json');
  }

  private async readAll(scope: MemoryScope): Promise<MemoryItem[]> {
    const file = this.file(scope);
    try {
      const txt = await fs.readFile(file, 'utf-8');
      const arr = JSON.parse(txt) as MemoryItem[];
      // 兼容旧记录：补齐 importance/source 默认值
      return arr.map((m) => ({
        ...m,
        importance: m.importance ?? 3,
        source: m.source ?? 'user',
      }));
    } catch {
      return [];
    }
  }

  private async writeAll(scope: MemoryScope, items: MemoryItem[]) {
    await atomicWrite(this.file(scope), JSON.stringify(items, null, 2));
  }

  async list(scope: MemoryScope, includeArchived = false) {
    const all = await this.readAll(scope);
    return includeArchived ? all : all.filter((m) => !m.archived);
  }

  async upsert(
    scope: MemoryScope,
    item: Partial<MemoryItem> & { title: string; content: string; category: MemoryCategory; keywords?: string[] },
  ): Promise<MemoryItem> {
    const all = await this.readAll(scope);
    const now = NOW();
    let target = item.id ? all.find((x) => x.id === item.id) : undefined;
    if (target) {
      Object.assign(target, item, { updatedAt: now });
    } else {
      target = {
        id: item.id ?? `mem_${now}_${Math.random().toString(36).slice(2, 6)}`,
        scope,
        category: item.category,
        title: item.title,
        content: item.content,
        keywords: item.keywords ?? [],
        importance: item.importance ?? 3,
        createdAt: now,
        updatedAt: now,
        hitCount: 0,
        source: item.source ?? 'user',
        archived: false,
      };
      all.push(target);
    }
    // 写入时算 embedding（如果配了 embedder）。失败不影响主流程 —— 退化为纯词法召回
    if (this.embedder) {
      try {
        const text = `${target.title}\n${target.content}\n${target.keywords.join(' ')}`;
        const [vec] = await this.embedder.embed([text]);
        if (vec && vec.length > 0) {
          target.vec = Array.from(vec);
          target.vecModel = (this.embedder as any).name ?? 'embedder';
        }
      } catch {
        /* embedding failure → fallback to lexical only */
      }
    }
    await this.writeAll(scope, all);
    return target;
  }

  async delete(scope: MemoryScope, id: string) {
    const all = await this.readAll(scope);
    const next = all.filter((x) => x.id !== id);
    if (next.length === all.length) return false;
    await this.writeAll(scope, next);
    return true;
  }

  /**
   * 召回（升级版 v3）：
   *   - 词法分支：score = sum_token(idfApprox * tf) * importance * decay
   *   - 语义分支（embedder 可用时）：cosine(query_vec, item.vec) * importance * decay
   *   - 二者用 Reciprocal Rank Fusion 融合，k=60（与 retrieval.ts 一致）
   *
   * 没有 embedder 或 query embed 失败 → 自动降级为纯词法（行为兼容旧版）
   */
  async recall(query: string, opts: RecallOptions = {}): Promise<MemoryItem[]> {
    const topK = opts.topK ?? 5;
    const excludeArchived = opts.excludeArchived !== false;
    const trackHits = opts.trackHits !== false;

    const userMems = await this.readAll('user');
    const projMems = await this.readAll('project');
    const merged = [...userMems, ...projMems].filter((m) => (excludeArchived ? !m.archived : true));
    if (!merged.length) return [];
    const now = NOW();

    // ---- 词法分支 ----
    const lexicalRanked = this.scoreLexical(query, merged, now);

    // ---- 语义分支（best-effort）----
    let semanticRanked: { m: MemoryItem; score: number }[] = [];
    if (this.embedder && merged.some((m) => m.vec && m.vec.length > 0)) {
      try {
        const [qVec] = await this.embedder.embed([query]);
        if (qVec && qVec.length > 0) {
          semanticRanked = merged
            .map((m) => {
              if (!m.vec || m.vec.length !== qVec.length) return { m, score: 0 };
              const sim = cosine(qVec, m.vec);
              if (sim <= 0) return { m, score: 0 };
              const imp = Math.max(1, Math.min(5, m.importance)) / 3;
              const dec = decayFactor(m.lastHitAt, now);
              return { m, score: sim * imp * dec };
            })
            .filter((x) => x.score > 0)
            .sort((a, b) => b.score - a.score);
        }
      } catch {
        /* embedding query failed → fallback to lexical only */
      }
    }

    // ---- RRF 融合 ----
    let final: MemoryItem[];
    if (semanticRanked.length === 0) {
      // 没有语义信号 → 纯词法
      final = lexicalRanked.slice(0, topK).map((s) => s.m);
    } else {
      const RRF_K = 60;
      const fused = new Map<string, { m: MemoryItem; score: number }>();
      lexicalRanked.forEach((s, rank) => {
        fused.set(s.m.id, { m: s.m, score: 1 / (RRF_K + rank + 1) });
      });
      semanticRanked.forEach((s, rank) => {
        const existing = fused.get(s.m.id);
        const r = 1 / (RRF_K + rank + 1);
        if (existing) existing.score += r;
        else fused.set(s.m.id, { m: s.m, score: r });
      });
      final = [...fused.values()]
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .map((x) => x.m);
    }

    if (final.length && trackHits) {
      this.trackHitsBg(final, now).catch(() => undefined);
    }
    return final;
  }

  /** 词法打分（旧版逻辑提出来，便于复用） */
  private scoreLexical(query: string, items: MemoryItem[], now: number): { m: MemoryItem; score: number }[] {
    const qTokens = tokenize(query);
    if (!qTokens.length) return [];
    const scored = items.map((m) => {
      const blob = `${m.title} ${m.title} ${m.content} ${m.keywords.join(' ')}`;
      const dTokens = tokenize(blob);
      const dCount: Record<string, number> = {};
      for (const t of dTokens) dCount[t] = (dCount[t] ?? 0) + 1;
      let raw = 0;
      const seen = new Set<string>();
      for (const t of qTokens) {
        if (seen.has(t)) continue;
        seen.add(t);
        const tf = dCount[t] ?? 0;
        if (tf === 0) continue;
        const idf = t.length >= 3 ? 1.5 : 1.0;
        raw += idf * Math.log(1 + tf);
      }
      if (raw === 0) return { m, score: 0 };
      const imp = Math.max(1, Math.min(5, m.importance)) / 3;
      const dec = decayFactor(m.lastHitAt, now);
      return { m, score: raw * imp * dec };
    });
    return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
  }

  /**
   * 给已有 memory 批量补 embedding（用户切换 embedder 或首次启用时跑一次）。
   * 没配 embedder → 直接返回 {scanned:0, embedded:0}
   */
  async reembedAll(): Promise<{ scanned: number; embedded: number }> {
    if (!this.embedder) return { scanned: 0, embedded: 0 };
    let scanned = 0;
    let embedded = 0;
    const targetModel = (this.embedder as any).name ?? 'embedder';
    for (const scope of ['user', 'project'] as const) {
      const all = await this.readAll(scope);
      const need = all.filter((m) => !m.archived && (!m.vec || m.vecModel !== targetModel));
      if (!need.length) {
        scanned += all.length;
        continue;
      }
      // 分批，避免一次 embed 几百条
      const BATCH = 32;
      for (let i = 0; i < need.length; i += BATCH) {
        const batch = need.slice(i, i + BATCH);
        try {
          const vecs = await this.embedder.embed(
            batch.map((m) => `${m.title}\n${m.content}\n${m.keywords.join(' ')}`),
          );
          for (let j = 0; j < batch.length; j++) {
            const v = vecs[j];
            if (v && v.length > 0) {
              batch[j].vec = Array.from(v);
              batch[j].vecModel = targetModel;
              embedded++;
            }
          }
        } catch {
          /* skip this batch */
        }
      }
      scanned += all.length;
      await this.writeAll(scope, all);
    }
    return { scanned, embedded };
  }

  private async trackHitsBg(hits: MemoryItem[], now: number) {
    const hitIds = new Set(hits.map((h) => h.id));
    for (const scope of ['user', 'project'] as const) {
      const all = await this.readAll(scope);
      let changed = false;
      for (const m of all) {
        if (hitIds.has(m.id)) {
          m.hitCount++;
          m.lastHitAt = now;
          changed = true;
        }
      }
      if (changed) await this.writeAll(scope, all);
    }
  }

  /**
   * 维护任务（建议每天跑一次 / 启动时跑一次）：
   *   1. 归档 30+ 天未命中且 hitCount<2 的 (低价值) 记忆 → archived=true，不再召回
   *   2. 去重：title+content 高度相似 → 保留 hitCount/importance 高的，归档其它
   * 返回统计信息便于报告。
   */
  async maintain(opts: { staleDays?: number; staleHitMax?: number; dedupThreshold?: number } = {}) {
    const staleDays = opts.staleDays ?? 90; // 默认 90 天，比衰减门槛宽松
    const staleHitMax = opts.staleHitMax ?? 1;
    const dedupThreshold = opts.dedupThreshold ?? 0.85;
    const now = NOW();
    const report = { archivedStale: 0, archivedDup: 0, scanned: 0 };

    for (const scope of ['user', 'project'] as const) {
      const all = await this.readAll(scope);
      let dirty = false;

      // 1) stale archive
      for (const m of all) {
        if (m.archived) continue;
        report.scanned++;
        const hitAt = m.lastHitAt ?? m.createdAt;
        const days = (now - hitAt) / DAY_MS;
        if (days > staleDays && m.hitCount <= staleHitMax) {
          m.archived = true;
          report.archivedStale++;
          dirty = true;
        }
      }

      // 2) dedup（O(n^2) 在 n<500 时完全 ok）
      const active = all.filter((m) => !m.archived);
      for (let i = 0; i < active.length; i++) {
        for (let j = i + 1; j < active.length; j++) {
          if (active[i].archived || active[j].archived) continue;
          const sim = similarity(active[i], active[j]);
          if (sim >= dedupThreshold) {
            // 保留 importance * (1+hitCount) 大的；另一条 archive
            const scoreI = active[i].importance * (1 + active[i].hitCount);
            const scoreJ = active[j].importance * (1 + active[j].hitCount);
            const loser = scoreI >= scoreJ ? active[j] : active[i];
            loser.archived = true;
            report.archivedDup++;
            dirty = true;
          }
        }
      }
      if (dirty) await this.writeAll(scope, all);
    }
    return report;
  }
}

/** Jaccard 相似度（token 集合） */
function similarity(a: MemoryItem, b: MemoryItem): number {
  const sa = new Set(tokenize(a.title + ' ' + a.content));
  const sb = new Set(tokenize(b.title + ' ' + b.content));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  const union = sa.size + sb.size - inter;
  return inter / union;
}

/**
 * Cosine similarity for two number arrays.
 * 已假设 embedder 输出已 L2 normalize 时仍稳健（多算一次也 ok）。
 */
function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i];
    const y = b[i];
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

function simpleHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}