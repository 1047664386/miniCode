/**
 * createStorage — 根据环境变量选择实现
 *
 * 环境变量 STORAGE_KIND:
 *   - 'jsonl'    （默认）→ JsonlStorage（文件，桌面版用）
 *   - 'sqlite'   → 后续 PrismaSqliteStorage（桌面版数据库，TODO M1.5）
 *   - 'postgres' → 后续 PrismaPgStorage（云端 TODO M2）
 *
 * 桌面版完全无感（默认 jsonl，零迁移）；
 * 云端启动时设置 STORAGE_KIND=postgres + DATABASE_URL。
 */
import { JsonlStorage } from './jsonl.js';
import type { SessionStorage } from './types.js';

export interface CreateStorageOpts {
  /** JsonlStorage 需要的根目录（workspace 路径） */
  workspace?: string;
  /** 显式指定后端，不传则读 process.env.STORAGE_KIND */
  kind?: 'jsonl' | 'sqlite' | 'postgres';
}

export function createStorage(opts: CreateStorageOpts = {}): SessionStorage {
  const kind = opts.kind ?? (process.env.STORAGE_KIND as 'jsonl' | 'sqlite' | 'postgres' | undefined) ?? 'jsonl';
  switch (kind) {
    case 'jsonl': {
      if (!opts.workspace) throw new Error('JsonlStorage requires workspace');
      return new JsonlStorage(opts.workspace);
    }
    case 'sqlite':
      throw new Error('PrismaSqliteStorage not implemented yet (M1.5)');
    case 'postgres':
      throw new Error('PrismaPgStorage not implemented yet (M2)');
    default:
      throw new Error(`unknown storage kind: ${kind}`);
  }
}