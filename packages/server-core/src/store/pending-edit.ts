
/**
 * PendingEditStore：Agent 提议的文件改动暂存区。
 *
 * 写文件类的工具（write_file / edit_file）不直接落盘，而是 propose 一条 PendingEdit：
 *  - 用户在 ComposerPanel / DiffEditor 里审查后 accept/reject
 *  - accept 前会触发 onBeforeWrite hook（被 server 接成自动 checkpoint）
 *  - 同一路径的连续提议会自动合并（叠加），让 Agent 多次 edit_file 在 UI 上只显示最终态
 *
 * 事务性 acceptAll：
 *  - 第一阶段（prepare）：把所有目标内容写到 .minicodeide/staging/<id>.tmp（不影响线上文件）
 *  - 第二阶段（commit）：fs.rename 把 staging 文件原子搬到目标路径
 *  - 任一阶段失败：回滚已搬移的（用 onBeforeWrite 拿到的 oldContent 还原）
 *
 * 这样能避免"改 5 个文件，第 3 个失败 → 前 2 个已落盘但状态损坏"的半提交问题。
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface PendingEdit {
  /** 唯一 id */
  id: string;
  /** 相对路径 */
  path: string;
  /** 文件原内容（可能 null=新建文件） */
  oldContent: string | null;
  /** 期望写入的新内容 */
  newContent: string;
  /** 来源工具名，便于审计 */
  tool: string;
  /** 时间戳 */
  createdAt: number;
  status: 'pending' | 'accepted' | 'rejected';
  /** propose 时文件的 mtime（毫秒），用于检测外部修改 */
  mtimeAtPropose: number;
}

/**
 * 单进程内的"待审查编辑"。
 * 后续可换成 SQLite + 历史归档。
 */
export class PendingEditStore {
  private byPath = new Map<string, PendingEdit>();
  private byId = new Map<string, PendingEdit>();
  /** 在真正写盘前会被调用，用于做 checkpoint */
  public onBeforeWrite?: (edits: PendingEdit[]) => Promise<void>;

  constructor(private cwd: string) {}

  list(): PendingEdit[] {
    return [...this.byPath.values()].filter((e) => e.status === 'pending');
  }

  get(id: string) {
    return this.byId.get(id);
  }

  getByPath(p: string) {
    return this.byPath.get(p);
  }

  /** 取最新的"虚拟内容"：若有 pending，则用 pending；否则读磁盘 */
  async virtualRead(relPath: string): Promise<string> {
    const pending = this.byPath.get(relPath);
    if (pending && pending.status === 'pending') return pending.newContent;
    const abs = path.resolve(this.cwd, relPath);
    return fs.readFile(abs, 'utf-8');
  }

  /** 提交一次编辑（覆盖同路径的旧 pending） */
  async propose(opts: {
    path: string;
    newContent: string;
    tool: string;
  }): Promise<PendingEdit> {
    const abs = path.resolve(this.cwd, opts.path);
    let oldContent: string | null = null;
    let mtimeAtPropose = 0;
    try {
      const stat = await fs.stat(abs);
      oldContent = await fs.readFile(abs, 'utf-8');
      mtimeAtPropose = stat.mtimeMs;
    } catch {
      oldContent = null; // 新建文件
      mtimeAtPropose = 0;
    }
    const id = `edit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const edit: PendingEdit = {
      id,
      path: opts.path,
      oldContent,
      newContent: opts.newContent,
      tool: opts.tool,
      createdAt: Date.now(),
      status: 'pending',
      mtimeAtPropose,
    };
    // 替换同路径旧 pending
    const old = this.byPath.get(opts.path);
    if (old) this.byId.delete(old.id);
    this.byPath.set(opts.path, edit);
    this.byId.set(id, edit);
    return edit;
  }

  /**
   * 检查文件在 propose 之后是否被外部修改过。
   * 如果 mtime 变了（精确到毫秒），说明有人在 propose 和 accept 之间修改了文件。
   */
  private async checkExternalModification(edit: PendingEdit): Promise<void> {
    // 新建文件（mtimeAtPropose=0）不需要检测
    if (edit.mtimeAtPropose === 0) return;
    const abs = path.resolve(this.cwd, edit.path);
    let stat;
    try {
      stat = await fs.stat(abs);
    } catch (e: any) {
      // 文件被删除了（ENOENT），对于新建文件的 pending 不算冲突
      if (e.code === 'ENOENT' && edit.oldContent === null) return;
      throw e;
    }
    // mtime 变了说明文件被外部修改过（容差 1ms 防止浮点精度问题）
    if (Math.abs(stat.mtimeMs - edit.mtimeAtPropose) > 1) {
      throw new Error(
        `File "${edit.path}" was modified externally since the edit was proposed. ` +
        `The pending edit may be based on stale content. ` +
        `Please re-read the file and propose a new edit.`,
      );
    }
  }

  async accept(id: string) {
    const edit = this.byId.get(id);
    if (!edit) throw new Error('Edit not found');
    if (edit.status !== 'pending') return edit;
    // P1 修复：accept 前检测文件是否被外部修改
    await this.checkExternalModification(edit);
    if (this.onBeforeWrite) await this.onBeforeWrite([edit]);
    const abs = path.resolve(this.cwd, edit.path);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, edit.newContent, 'utf-8');
    edit.status = 'accepted';
    this.byPath.delete(edit.path);
    return edit;
  }

  reject(id: string) {
    const edit = this.byId.get(id);
    if (!edit) throw new Error('Edit not found');
    if (edit.status !== 'pending') return edit;
    edit.status = 'rejected';
    this.byPath.delete(edit.path);
    return edit;
  }

  async acceptAll() {
    const all = this.list();
    if (!all.length) return [];
    // P1 修复：acceptAll 前批量检测文件是否被外部修改
    for (const edit of all) {
      await this.checkExternalModification(edit);
    }
    if (this.onBeforeWrite) await this.onBeforeWrite(all);

    // ============ Phase 1: prepare to staging ============
    const stagingRoot = path.resolve(this.cwd, '.minicodeide', 'staging');
    await fs.mkdir(stagingRoot, { recursive: true });

    const prepared: Array<{
      edit: PendingEdit;
      target: string;
      stagingFile: string;
    }> = [];

    try {
      for (const edit of all) {
        const target = path.resolve(this.cwd, edit.path);
        const stagingFile = path.join(
          stagingRoot,
          `${edit.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.tmp`,
        );
        await fs.writeFile(stagingFile, edit.newContent, 'utf-8');
        prepared.push({ edit, target, stagingFile });
      }
    } catch (err) {
      // staging 阶段失败：清理临时文件后抛出
      await Promise.allSettled(
        prepared.map((p) => fs.unlink(p.stagingFile).catch(() => undefined)),
      );
      throw new Error(`acceptAll prepare failed: ${(err as Error)?.message ?? err}`);
    }

    // ============ Phase 2: commit (rename) with rollback ============
    const committed: Array<{ edit: PendingEdit; target: string; oldContent: string | null }> = [];
    try {
      for (const p of prepared) {
        await fs.mkdir(path.dirname(p.target), { recursive: true });
        try {
          await fs.rename(p.stagingFile, p.target);
        } catch (renameErr: any) {
          // P2 修复：EXDEV（跨设备）时 rename 会失败，改用 copyFile + unlink
          if (renameErr?.code === 'EXDEV') {
            await fs.copyFile(p.stagingFile, p.target);
            // unlink 失败不影响 commit：copyFile 已成功，target 内容正确。
            // 必须 catch 住，否则错误冒泡到外层会触发回滚，
            // 用 oldContent 覆盖已经正确的 target（CR 发现的 bug）。
            await fs.unlink(p.stagingFile).catch(() => undefined);
          } else {
            throw renameErr;
          }
        }
        committed.push({ edit: p.edit, target: p.target, oldContent: p.edit.oldContent });
      }
    } catch (err) {
      // 任一 rename 失败 → 用 oldContent 回滚已 commit 的
      for (const c of committed) {
        try {
          if (c.oldContent === null) {
            await fs.unlink(c.target).catch(() => undefined);
          } else {
            await fs.writeFile(c.target, c.oldContent, 'utf-8');
          }
        } catch {
          /* best-effort rollback */
        }
      }
      // 清理还没 commit 的 staging 文件
      const committedIds = new Set(committed.map((c) => c.edit.id));
      await Promise.allSettled(
        prepared
          .filter((p) => !committedIds.has(p.edit.id))
          .map((p) => fs.unlink(p.stagingFile).catch(() => undefined)),
      );
      throw new Error(
        `acceptAll commit failed (rolled back ${committed.length} files): ${(err as Error)?.message ?? err}`,
      );
    }

    // 全部成功
    const results: PendingEdit[] = [];
    for (const c of committed) {
      c.edit.status = 'accepted';
      this.byPath.delete(c.edit.path);
      results.push(c.edit);
    }
    return results;
  }
}