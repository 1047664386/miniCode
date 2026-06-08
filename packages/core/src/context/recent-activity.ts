/**
 * Recent Activity Tracker —— 把"最近你刚动过/搜过的东西"作为上下文注入
 * ---------------------------------------------------------------
 * 设计：
 *  - server 端维护一个轻量环形缓冲，记录最近的：
 *      1) 用户编辑过的文件（来自 propose+accept、save 通知，或前端 didChange 上报）
 *      2) 最近 grep_search 的 query 及命中文件
 *      3) 最近 read_file 的目标
 *  - 召回时按 sessionId 取最近 N 个，渲染成一段紧凑 system 提示
 *  - 容量小（每个 session 最多 30 条）、自动衰减（>30 min 不要）
 *
 * 这能解决"用户问 '继续刚才那个事' / '改完这个文件' 时 LLM 不知道'刚才'指什么"的问题。
 */
import path from 'node:path';

export type ActivityKind = 'edit' | 'read' | 'search' | 'view';

export interface ActivityEvent {
  kind: ActivityKind;
  /** 主要目标：文件路径 / search query */
  target: string;
  /** 附加信息：search 命中文件、edit 摘要 */
  meta?: string;
  ts: number;
}

interface SessionActivity {
  events: ActivityEvent[];
}

export interface RecentActivityOptions {
  /** 每个 session 最多保留多少条 */
  perSessionCap?: number;
  /** 最大保留时间（ms），超出的进入召回时被过滤 */
  ttlMs?: number;
  /** 最多保留多少个 session */
  maxSessions?: number;
}

export class RecentActivityTracker {
  private map = new Map<string, SessionActivity>();
  private perSessionCap: number;
  private ttlMs: number;
  private maxSessions: number;

  constructor(opts: RecentActivityOptions = {}) {
    this.perSessionCap = opts.perSessionCap ?? 30;
    this.ttlMs = opts.ttlMs ?? 30 * 60 * 1000;
    this.maxSessions = opts.maxSessions ?? 128;
  }

  record(sessionId: string, ev: Omit<ActivityEvent, 'ts'>) {
    if (!sessionId) return;
    let s = this.map.get(sessionId);
    if (!s) {
      s = { events: [] };
      this.map.set(sessionId, s);
      this.evictLruSessions();
    }
    s.events.push({ ...ev, ts: Date.now() });
    if (s.events.length > this.perSessionCap) {
      s.events.splice(0, s.events.length - this.perSessionCap);
    }
  }

  private evictLruSessions() {
    if (this.map.size <= this.maxSessions) return;
    const all = [...this.map.entries()];
    all.sort((a, b) => {
      const la = a[1].events[a[1].events.length - 1]?.ts ?? 0;
      const lb = b[1].events[b[1].events.length - 1]?.ts ?? 0;
      return la - lb;
    });
    while (this.map.size > this.maxSessions && all.length) {
      const [k] = all.shift()!;
      this.map.delete(k);
    }
  }

  /**
   * 渲染成 system 注入文本。空 → 返回 null。
   * 输出示例：
   *   <recent-activity>
   *   - edited src/foo.ts, src/bar.ts (最近 2 min)
   *   - searched "useEffect cleanup" → src/hooks/use-mount.ts
   *   - read package.json
   *   </recent-activity>
   */
  render(sessionId: string): string | null {
    const s = this.map.get(sessionId);
    if (!s) return null;
    const now = Date.now();
    const fresh = s.events.filter((e) => now - e.ts <= this.ttlMs);
    if (fresh.length === 0) return null;

    // 分桶
    const edits: { file: string; ts: number }[] = [];
    const reads: { file: string; ts: number }[] = [];
    const searches: { query: string; hits: string[]; ts: number }[] = [];
    const views: { file: string; ts: number }[] = [];

    for (const ev of fresh) {
      if (ev.kind === 'edit') edits.push({ file: ev.target, ts: ev.ts });
      else if (ev.kind === 'read') reads.push({ file: ev.target, ts: ev.ts });
      else if (ev.kind === 'view') views.push({ file: ev.target, ts: ev.ts });
      else if (ev.kind === 'search') {
        searches.push({
          query: ev.target,
          hits: ev.meta ? ev.meta.split(',').slice(0, 3) : [],
          ts: ev.ts,
        });
      }
    }

    // 去重：保留最近的同名记录
    const uniqEdits = uniqueByFile(edits).slice(-5);
    const uniqReads = uniqueByFile(reads).slice(-5);
    const uniqViews = uniqueByFile(views).slice(-3);
    const recentSearches = searches.slice(-3);

    const lines: string[] = [];
    if (uniqEdits.length) {
      lines.push(`- Edited: ${uniqEdits.map((e) => path.basename(e.file)).join(', ')}`);
    }
    if (uniqViews.length) {
      lines.push(`- Currently viewing: ${uniqViews.map((v) => path.basename(v.file)).join(', ')}`);
    }
    if (uniqReads.length) {
      lines.push(`- Recently read: ${uniqReads.map((r) => path.basename(r.file)).join(', ')}`);
    }
    if (recentSearches.length) {
      for (const s of recentSearches) {
        const hitStr = s.hits.length ? ` → ${s.hits.join(', ')}` : '';
        lines.push(`- Searched "${truncate(s.query, 50)}"${hitStr}`);
      }
    }
    if (lines.length === 0) return null;

    return `<recent-activity>\nUser's recent IDE activity (last ${Math.round(this.ttlMs / 60000)} min). Use this to understand "this file"/"that bug"/"continue":\n${lines.join('\n')}\n</recent-activity>`;
  }

  /** 调试 / metrics 用 */
  size(sessionId?: string) {
    if (sessionId) return this.map.get(sessionId)?.events.length ?? 0;
    let total = 0;
    for (const s of this.map.values()) total += s.events.length;
    return total;
  }
}

function uniqueByFile<T extends { file: string }>(arr: T[]): T[] {
  const seen = new Map<string, T>();
  for (const x of arr) seen.set(x.file, x);
  return [...seen.values()];
}

function truncate(s: string, n: number) {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}