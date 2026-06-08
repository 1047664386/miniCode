
/**
 * 增量索引 watcher：监听工作区文件变更，更新 BM25 / SymbolGraph / VectorStore。
 *
 * 设计原则：
 *  - 文件变更很碎，需要 debounce 合并（300ms 窗口内的多次 change 合并成一次 reindex）。
 *  - 删除 → 三层都 removeByPath；新增/修改 → re-chunk + re-extract + re-embed。
 *  - embedding 单文件成本可控（一个文件通常 < 10 个 chunk，调一次 batch embed 就够）。
 *  - 持久化 vectors：每次 batch 处理完异步 save，避免阻塞 watcher。
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import chokidar, { type FSWatcher } from 'chokidar';
import { chunkText, chunkTextWithSymbols } from '@mini/indexer';
import { extractFacts } from '@mini/indexer';
import type { CodebaseIndex } from '@mini/indexer';
import type { Embedder } from '@mini/indexer';
import type { VectorItem } from '@mini/indexer';

export interface WatcherOptions {
  /** 工作区根 */
  root: string;
  /** 索引实例（in-place 更新） */
  index: () => CodebaseIndex | null;
  /** 当前 embedder */
  embedder: () => Embedder;
  /** vectors jsonl 持久化路径（按当前 embedder） */
  vectorPath: () => string;
  /** 忽略列表（glob 或 path 子串都接受） */
  ignored?: (string | RegExp)[];
  /** debounce 窗口 ms */
  debounceMs?: number;
  /** 文件大小硬上限 byte，超过跳过 */
  maxFileSize?: number;
  /** 单次最大 reindex 文件数（防止保存项目脚手架时雪崩） */
  burstLimit?: number;
  /** 进度回调 */
  onProgress?: (msg: string) => void;
}

const DEFAULT_IGNORED: (string | RegExp)[] = [
  /node_modules/,
  /\.git\//,
  /\.minicodeide/,
  /dist\//,
  /\.next\//,
  /\.cache\//,
  /\.DS_Store/,
];

export class IndexWatcher {
  private watcher?: FSWatcher;
  /** 等待处理的文件队列：add/change/unlink */
  private pending = new Map<string, 'change' | 'unlink'>();
  private timer?: NodeJS.Timeout;
  private flushing = false;

  constructor(private opts: WatcherOptions) {}

  start() {
    const ignored = [...DEFAULT_IGNORED, ...(this.opts.ignored ?? [])];
    this.watcher = chokidar.watch(this.opts.root, {
      ignored: (p: string) => ignored.some((rule) =>
        rule instanceof RegExp ? rule.test(p) : p.includes(rule),
      ),
      ignoreInitial: true, // 初始扫描由 builder 做
      persistent: true,
      awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
    });

    this.watcher
      .on('add', (p: string) => this.enqueue(p, 'change'))
      .on('change', (p: string) => this.enqueue(p, 'change'))
      .on('unlink', (p: string) => this.enqueue(p, 'unlink'));

    this.opts.onProgress?.(`[watcher] watching ${this.opts.root}`);
  }

  async stop() {
    await this.watcher?.close();
    if (this.timer) clearTimeout(this.timer);
  }

  private enqueue(abs: string, kind: 'change' | 'unlink') {
    const rel = path.relative(this.opts.root, abs);
    if (!rel || rel.startsWith('..')) return;
    this.pending.set(rel, kind);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), this.opts.debounceMs ?? 300);
  }

  private async flush() {
    if (this.flushing) {
      // 上一批还没完，留下次 debounce 再处理
      this.timer = setTimeout(() => void this.flush(), 200);
      return;
    }
    this.flushing = true;
    try {
      const idx = this.opts.index();
      if (!idx) {
        this.opts.onProgress?.('[watcher] index not ready, skip');
        return;
      }
      const batch = [...this.pending.entries()];
      this.pending.clear();

      const burst = this.opts.burstLimit ?? 200;
      if (batch.length > burst) {
        this.opts.onProgress?.(
          `[watcher] burst ${batch.length} > ${burst}; skip embedding this round (BM25 still updated)`,
        );
      }

      const embedder = this.opts.embedder();
      const max = this.opts.maxFileSize ?? 500_000;

      const allNewItems: VectorItem[] = [];

      for (const [relPath, kind] of batch) {
        if (kind === 'unlink') {
          idx.bm25.removeByPath(relPath);
          idx.symbols.remove(relPath);
          idx.vectors.upsertFile(relPath, []);
          continue;
        }
        // change / add
        const abs = path.join(this.opts.root, relPath);
        let text = '';
        try {
          const stat = await fs.stat(abs);
          if (!stat.isFile()) continue;
          if (stat.size > max) {
            this.opts.onProgress?.(`[watcher] skip ${relPath} (${stat.size}b > ${max})`);
            continue;
          }
          text = await fs.readFile(abs, 'utf-8');
        } catch {
          // 可能瞬时被删
          idx.bm25.removeByPath(relPath);
          idx.symbols.remove(relPath);
          idx.vectors.upsertFile(relPath, []);
          continue;
        }

        const facts = extractFacts(relPath, text);
        const chunks =
          facts && facts.symbols.length > 0
            ? chunkTextWithSymbols(
                relPath,
                text,
                facts.symbols.map((s) => ({ name: s.name, startLine: s.startLine, endLine: s.endLine })),
              )
            : chunkText(relPath, text);
        idx.bm25.upsertFile(relPath, chunks);

        if (facts) idx.symbols.upsert(facts);

        // embedding：burst 太大时跳过，避免成本爆炸
        if (batch.length <= burst && chunks.length) {
          try {
            const vecs = await embedder.embed(chunks.map((c) => `// ${c.path}\n${c.text}`));
            const items: VectorItem[] = chunks.map((c, i) => ({
              id: c.id,
              path: c.path,
              startLine: c.startLine,
              endLine: c.endLine,
              text: c.text,
              vec: vecs[i],
              model: embedder.name,
            }));
            idx.vectors.upsertFile(relPath, items);
            allNewItems.push(...items);
          } catch (e) {
            this.opts.onProgress?.(`[watcher] embed failed ${relPath}: ${(e as Error).message}`);
          }
        } else {
          // 不 embed 时，把旧 vectors 删掉，避免脏数据
          idx.vectors.upsertFile(relPath, []);
        }
      }

      this.opts.onProgress?.(
        `[watcher] flushed ${batch.length} change(s); +${allNewItems.length} vectors`,
      );

      // 异步持久化 vectors（不阻塞）
      if (allNewItems.length) {
        idx.vectors.save(this.opts.vectorPath()).catch((e) => {
          console.warn('[watcher] vectors.save failed:', e.message);
        });
      }
    } finally {
      this.flushing = false;
    }
  }
}