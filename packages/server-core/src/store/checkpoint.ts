

/**
 * Checkpoint：每次 accept pending edits 之前，把被修改文件的原内容打包存档。
 * 用户可以 Revert，回到任意 checkpoint 的状态（多文件一起回退）。
 *
 * 存储：内存 + .minicodeide/checkpoints/<id>.json（崩溃恢复友好）。
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface CheckpointFile {
  path: string;
  /** 备份的"修改前"内容；null 表示该文件原本不存在（即新建） */
  oldContent: string | null;
  /** 这次提交后写入的内容；revert 时用来判断是否真的变了 */
  newContent: string;
}
export interface Checkpoint {
  id: string;
  label: string;
  createdAt: number;
  /** 关联的 trigger，例如 'accept_all' / 'agent_step' / 'user_save' */
  trigger: string;
  files: CheckpointFile[];
  reverted: boolean;
}

const DIR_NAME = '.minicodeide/checkpoints';

export class CheckpointStore {
  private list_: Checkpoint[] = [];
  private dir: string;

  constructor(private cwd: string) {
    this.dir = path.join(cwd, DIR_NAME);
  }

  async init() {
    await fs.mkdir(this.dir, { recursive: true });
    // 启动时加载历史 checkpoint（最多 100 个）
    try {
      const files = await fs.readdir(this.dir);
      const jsonFiles = files.filter((f) => f.endsWith('.json')).sort();
      for (const f of jsonFiles.slice(-100)) {
        try {
          const raw = await fs.readFile(path.join(this.dir, f), 'utf-8');
          this.list_.push(JSON.parse(raw));
        } catch {
          /* skip bad */
        }
      }
      this.list_.sort((a, b) => b.createdAt - a.createdAt);
    } catch {
      /* */
    }
  }

  list(): Checkpoint[] {
    // 最新在前
    return [...this.list_].sort((a, b) => b.createdAt - a.createdAt);
  }

  get(id: string): Checkpoint | undefined {
    return this.list_.find((c) => c.id === id);
  }

  /**
   * 创建一个 checkpoint：传入即将要写入的文件们，自动读取它们的"修改前"内容。
   * 调用方应该在「真正写盘前」调用本方法。
   */
  async create(opts: {
    label: string;
    trigger: string;
    files: { path: string; newContent: string }[];
  }): Promise<Checkpoint> {
    const captured: CheckpointFile[] = [];
    for (const f of opts.files) {
      const abs = path.resolve(this.cwd, f.path);
      let oldContent: string | null = null;
      try {
        oldContent = await fs.readFile(abs, 'utf-8');
      } catch {
        oldContent = null;
      }
      captured.push({ path: f.path, oldContent, newContent: f.newContent });
    }
    const cp: Checkpoint = {
      id: `cp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label: opts.label,
      createdAt: Date.now(),
      trigger: opts.trigger,
      files: captured,
      reverted: false,
    };
    this.list_.unshift(cp);
    // 持久化
    await fs
      .writeFile(path.join(this.dir, `${cp.id}.json`), JSON.stringify(cp, null, 2))
      .catch(() => {});
    return cp;
  }

  /**
   * 回滚 checkpoint：把所有备份文件回写到磁盘。
   * - oldContent === null：删除该文件
   * - 否则：写回 oldContent
   */
  async revert(id: string): Promise<{ ok: boolean; affected: string[]; missing: string[] }> {
    const cp = this.get(id);
    if (!cp) throw new Error('Checkpoint not found');
    const affected: string[] = [];
    const missing: string[] = [];
    for (const f of cp.files) {
      const abs = path.resolve(this.cwd, f.path);
      if (f.oldContent === null) {
        // 原本不存在 → revert 时删除
        try {
          await fs.unlink(abs);
          affected.push(f.path);
        } catch {
          missing.push(f.path);
        }
      } else {
        try {
          await fs.mkdir(path.dirname(abs), { recursive: true });
          await fs.writeFile(abs, f.oldContent, 'utf-8');
          affected.push(f.path);
        } catch {
          missing.push(f.path);
        }
      }
    }
    cp.reverted = true;
    await fs
      .writeFile(path.join(this.dir, `${cp.id}.json`), JSON.stringify(cp, null, 2))
      .catch(() => {});
    return { ok: true, affected, missing };
  }

  /** 删除超过限制的旧 checkpoint */
  async prune(max = 100) {
    if (this.list_.length <= max) return;
    const removed = this.list_.slice(max);
    this.list_ = this.list_.slice(0, max);
    for (const cp of removed) {
      await fs.unlink(path.join(this.dir, `${cp.id}.json`)).catch(() => {});
    }
  }
}