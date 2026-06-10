
/**
 * Worktree Manager —— 借鉴自 docs/learn-claude-code/s18_worktree_isolation。
 *
 * 当父 Agent 同时 dispatch 多个 subagent 写文件时，要避免他们互相覆盖同一个
 * config.ts。Git worktree 提供了"同一仓库下的多目录 + 多分支"隔离，开销极小。
 *
 * 提供的能力：
 *   - createForSubagent(taskId)  → 在 .minicodeide/worktrees/<taskId>/ 上创建 wt/<taskId> 分支
 *   - getPath(taskId)            → 查这个 task 的工作目录
 *   - removeWorktree(taskId, keepBranch)
 *
 * 当 git 不可用 / 不是 git 仓库时，自动 fallback 为"用主目录"，不抛错。
 */
import * as path from 'node:path';
import * as fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const pExec = promisify(execFile);

const VALID_NAME = /^[A-Za-z0-9._-]{1,64}$/;

export interface WorktreeInfo {
  taskId: string;
  worktreeName: string;
  path: string;
  branch: string;
  createdAt: number;
}

export class WorktreeManager {
  private readonly rootDir: string;
  private active = new Map<string, WorktreeInfo>();
  private gitAvailable: boolean | null = null;

  constructor(private workspace: string) {
    this.rootDir = path.join(workspace, '.minicodeide', 'worktrees');
  }

  async isGitRepo(): Promise<boolean> {
    if (this.gitAvailable !== null) return this.gitAvailable;
    try {
      await pExec('git', ['rev-parse', '--is-inside-work-tree'], { cwd: this.workspace });
      this.gitAvailable = true;
    } catch {
      this.gitAvailable = false;
    }
    return this.gitAvailable;
  }

  /**
   * 给一个 subagent 任务创建一个独立 worktree。
   * 返回 path：subagent 应该在这个目录下工作。
   * 如果 git 不可用 → 返回主 workspace（不隔离，但不报错）。
   */
  async createForSubagent(taskId: string): Promise<{ path: string; isolated: boolean; info?: WorktreeInfo }> {
    if (!(await this.isGitRepo())) {
      return { path: this.workspace, isolated: false };
    }
    const name = sanitizeName(taskId);
    const wtPath = path.join(this.rootDir, name);
    if (this.active.has(taskId)) {
      const info = this.active.get(taskId)!;
      return { path: info.path, isolated: true, info };
    }
    if (fs.existsSync(wtPath)) {
      // 已存在：直接重用
      const info: WorktreeInfo = {
        taskId,
        worktreeName: name,
        path: wtPath,
        branch: `wt/${name}`,
        createdAt: Date.now(),
      };
      this.active.set(taskId, info);
      return { path: wtPath, isolated: true, info };
    }
    try {
      fs.mkdirSync(this.rootDir, { recursive: true });
      await pExec(
        'git',
        ['worktree', 'add', wtPath, '-b', `wt/${name}`, 'HEAD'],
        { cwd: this.workspace },
      );
      const info: WorktreeInfo = {
        taskId,
        worktreeName: name,
        path: wtPath,
        branch: `wt/${name}`,
        createdAt: Date.now(),
      };
      this.active.set(taskId, info);
      return { path: wtPath, isolated: true, info };
    } catch (e) {
      // 创建失败 → 退化为主目录
      return { path: this.workspace, isolated: false };
    }
  }

  getPath(taskId: string): string | undefined {
    return this.active.get(taskId)?.path;
  }

  async remove(taskId: string, opts: { keepBranch?: boolean } = {}): Promise<boolean> {
    const info = this.active.get(taskId);
    if (!info) return false;
    try {
      await pExec('git', ['worktree', 'remove', info.path, '--force'], { cwd: this.workspace });
      if (!opts.keepBranch) {
        try {
          await pExec('git', ['branch', '-D', info.branch], { cwd: this.workspace });
        } catch {/* ignore */}
      }
      this.active.delete(taskId);
      return true;
    } catch {
      return false;
    }
  }

  list(): WorktreeInfo[] {
    return [...this.active.values()];
  }
}

function sanitizeName(raw: string): string {
  const cleaned = raw.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 60);
  if (!cleaned) return `task-${Date.now().toString(36)}`;
  if (!VALID_NAME.test(cleaned)) return `task-${Date.now().toString(36)}`;
  return cleaned;
}