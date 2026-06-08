/**
 * InjectionCache — 跨轮注入去重缓存
 * ----------------------------------------------------------------
 * 灵感来源：CodeFlicker / OpenViking 的同名组件。
 *
 * 解决的问题：
 *   一条记忆/规则/auto-context 在多轮对话里反复被 recall 出来 →
 *   每轮都重新注入到 system prompt → token 浪费 + 模型对重复内容过度关注。
 *
 * 解决方案：
 *   - 按 sessionId 维护一个 (normalizedKey -> contentHash) 的 LRU
 *   - 同一 session 内：key 命中 + hash 一致 → 这条本轮跳过注入
 *   - hash 变了 → 视为内容更新 → 仍然注入并刷新 hash
 *
 * 这是注意力管理体系里"防线 2：信息去重"的具体实现。
 */
import { createHash } from 'node:crypto';

export interface InjectionCandidate {
  /** 唯一资源 id，例如 ov://memories/foo.md / file:///xxx / 本地 memory id */
  uri: string;
  /** 注入的实际文本内容 */
  content: string;
  /** 排序/调试用，可选 */
  score?: number;
  category?: string;
}

export interface FilterResult {
  kept: InjectionCandidate[];
  /** 被跳过的 uri（已注入过且未变） */
  dropped: string[];
}

interface SessionEntry {
  /** key -> hash */
  entries: Map<string, string>;
  lastTouchedAt: number;
}

export interface InjectionCacheOptions {
  /** 单 session 最多缓存多少条；超出按 LRU 淘汰最旧的 */
  perSessionCap?: number;
  /** 全局最多保留多少个 session */
  maxSessions?: number;
}

/**
 * 实例化一个 InjectionCache 共享给所有 chat 请求；按 sessionId 隔离记忆。
 */
export class InjectionCache {
  private sessions = new Map<string, SessionEntry>();
  private perSessionCap: number;
  private maxSessions: number;

  constructor(opts: InjectionCacheOptions = {}) {
    this.perSessionCap = opts.perSessionCap ?? 100;
    this.maxSessions = opts.maxSessions ?? 64;
  }

  /**
   * 过滤候选。返回应该真正注入的列表 + 被跳过的 uri 列表。
   * 同时把 kept 的 (key, hash) 写入缓存，保证下一轮同样的内容会被跳过。
   */
  filter(sessionId: string, items: InjectionCandidate[]): FilterResult {
    const entry = this.touch(sessionId);
    const kept: InjectionCandidate[] = [];
    const dropped: string[] = [];

    for (const it of items) {
      const key = normalizeUri(it.uri);
      const hash = contentHash(it.content);
      const old = entry.entries.get(key);
      if (old === hash) {
        dropped.push(it.uri);
        continue;
      }
      kept.push(it);
      entry.entries.set(key, hash);
    }

    // 单 session LRU：删最早 set 的（Map 自带插入顺序）
    while (entry.entries.size > this.perSessionCap) {
      const oldest = entry.entries.keys().next().value;
      if (oldest === undefined) break;
      entry.entries.delete(oldest);
    }
    return { kept, dropped };
  }

  /** session 结束 / reset 时调用，清理空间 */
  drop(sessionId: string) {
    this.sessions.delete(sessionId);
  }

  /** 调试用 */
  stats() {
    return {
      sessions: this.sessions.size,
      totalEntries: [...this.sessions.values()].reduce((s, e) => s + e.entries.size, 0),
    };
  }

  private touch(sessionId: string): SessionEntry {
    let e = this.sessions.get(sessionId);
    if (!e) {
      e = { entries: new Map(), lastTouchedAt: Date.now() };
      this.sessions.set(sessionId, e);
      // 全局 LRU：超过上限就把最久没被 touch 的 session 删掉
      if (this.sessions.size > this.maxSessions) {
        let lru: string | null = null;
        let lruAt = Infinity;
        for (const [sid, ent] of this.sessions) {
          if (ent.lastTouchedAt < lruAt) {
            lru = sid;
            lruAt = ent.lastTouchedAt;
          }
        }
        if (lru) this.sessions.delete(lru);
      }
    } else {
      e.lastTouchedAt = Date.now();
    }
    return e;
  }
}

/**
 * 标准化 URI，作为缓存 key。
 * - 去掉 .md 后缀（同一记忆有/无后缀视作同一资源）
 * - scheme 和 host 小写（避免 OV://x.com 与 ov://x.com 各占一格）
 * - 去掉末尾斜杠
 */
export function normalizeUri(uri: string): string {
  if (!uri) return '';
  let u = uri.trim();
  // 协议小写
  u = u.replace(/^([a-zA-Z][a-zA-Z0-9+\-.]*:\/\/)/, (m) => m.toLowerCase());
  // 去尾斜杠
  while (u.endsWith('/')) u = u.slice(0, -1);
  // 去 .md 后缀
  if (u.toLowerCase().endsWith('.md')) u = u.slice(0, -3);
  return u;
}

/** SHA256 取前 16 位 hex 作为内容指纹（够用且省空间） */
export function contentHash(text: string): string {
  return createHash('sha256').update(text || '').digest('hex').slice(0, 16);
}