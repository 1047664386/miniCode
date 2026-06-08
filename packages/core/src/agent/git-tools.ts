/**
 * git-tools —— 结构化 git 工具
 *
 * 当前 LLM 用 run_command 自拼 git 命令，错误率高（quote、stage path、commit message 转义）。
 * 这里把高频操作封成 structured tools，返回 JSON 给 LLM。
 *
 * 工具集：
 *  - git_status:  workdir / staged 变更清单
 *  - git_diff:    workdir / staged / 指定文件 diff
 *  - git_log:     最近 N 次提交（hash/author/subject）
 *  - git_branch:  当前分支
 *  - git_commit:  add + commit（message 通过 stdin 传，避免 shell 注入）
 *
 * 设计：
 *  - 命令一律 execFile（不走 shell），消除注入风险
 *  - 错误信息精简（exit code + stderr 前 800 字节）
 *  - parallelSafe: 读类 true，commit false
 */
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';
import type { Tool } from './tool-registry.js';

const pExecFile = promisify(execFile);
const MAX_BUFFER = 32 * 1024 * 1024;

async function git(cwd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  try {
    const r = await pExecFile('git', args, { cwd, maxBuffer: MAX_BUFFER });
    return { stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
  } catch (e: any) {
    const stderr = (e?.stderr ?? '').toString().slice(0, 800);
    throw new Error(`git ${args.join(' ')} failed: ${stderr || e?.message}`);
  }
}

export const gitStatusTool: Tool = {
  name: 'git_status',
  description:
    'Get structured working-tree status (modified / added / deleted / untracked / renamed). Returns { branch, entries: [{ status, path, staged }] }.\n\n' +
    'WHEN TO USE: before commit, to know what would be staged; or to verify your edits actually changed the working tree.\n' +
    'WHEN NOT TO USE: if you only need a single file\'s diff — use git_diff with path.\n\n' +
    'parallelSafe: true (read-only).',
  parallelSafe: true,
  schema: z.object({}),
  async execute(_input, ctx) {
    const { stdout: branchOut } = await git(ctx.cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);
    const { stdout } = await git(ctx.cwd, ['status', '--porcelain=v1', '-z']);
    const entries: Array<{ status: string; path: string; staged: boolean }> = [];
    // -z 用 \0 分割
    const parts = stdout.split('\0').filter(Boolean);
    for (const seg of parts) {
      if (seg.length < 3) continue;
      const xy = seg.slice(0, 2);
      const p = seg.slice(3);
      const x = xy[0]; // staged
      const y = xy[1]; // workdir
      if (x !== ' ' && x !== '?') {
        entries.push({ status: x, path: p, staged: true });
      }
      if (y !== ' ') {
        const stat = y === '?' ? '?' : y;
        entries.push({ status: stat, path: p, staged: false });
      }
    }
    return { ok: true, branch: branchOut.trim(), entries, count: entries.length };
  },
};

export const gitDiffTool: Tool = {
  name: 'git_diff',
  description:
    'Get a unified-diff of working tree or staged changes (optionally scoped to a file). Returns the raw diff text (truncated to 32KB).\n\n' +
    'WHEN TO USE:\n' +
    '  - Before commit: review what you actually changed.\n' +
    '  - After receiving "tests fail" hint: see what diverged from HEAD.\n' +
    '  - To produce a patch you can feed back to apply_patch.\n\n' +
    'OPTIONS: { path?: string, staged?: boolean, base?: string }. base="HEAD~1" gets last commit\'s diff.\n\n' +
    'parallelSafe: true.',
  parallelSafe: true,
  schema: z.object({
    path: z.string().optional(),
    staged: z.boolean().optional(),
    base: z.string().optional().describe('Compare against a ref (e.g. "HEAD~1", "main")'),
  }),
  async execute(input, ctx) {
    const { path: p, staged, base } = input as { path?: string; staged?: boolean; base?: string };
    const args = ['diff'];
    if (staged) args.push('--cached');
    if (base) args.push(base);
    if (p) args.push('--', p);
    const { stdout } = await git(ctx.cwd, args);
    const truncated = stdout.length > 32_000;
    return { ok: true, diff: truncated ? stdout.slice(0, 32_000) + '\n...[truncated]' : stdout, truncated };
  },
};

export const gitLogTool: Tool = {
  name: 'git_log',
  description:
    'Get the most recent N commits (hash, short hash, ISO date, author, subject). Use to understand recent project history before making non-trivial changes.\n\n' +
    'parallelSafe: true.',
  parallelSafe: true,
  schema: z.object({
    n: z.number().int().min(1).max(100).optional().default(20),
    path: z.string().optional().describe('Limit to commits touching this path'),
  }),
  async execute(input, ctx) {
    const { n, path: p } = input as { n: number; path?: string };
    const fmt = '%H%x1f%h%x1f%aI%x1f%an%x1f%s';
    const args = ['log', `--pretty=format:${fmt}`, `-n`, String(n)];
    if (p) args.push('--', p);
    const { stdout } = await git(ctx.cwd, args);
    const commits = stdout
      .split('\n')
      .filter(Boolean)
      .map((ln) => {
        const [hash, shortHash, date, author, subject] = ln.split('\x1f');
        return { hash, shortHash, date, author, subject };
      });
    return { ok: true, commits, count: commits.length };
  },
};

export const gitBranchTool: Tool = {
  name: 'git_branch',
  description: 'Get the current branch name. parallelSafe: true.',
  parallelSafe: true,
  schema: z.object({}),
  async execute(_input, ctx) {
    const { stdout } = await git(ctx.cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);
    return { ok: true, branch: stdout.trim() };
  },
};

export const gitCommitTool: Tool = {
  name: 'git_commit',
  description:
    'Stage and commit changes. By default stages all modified+untracked files (git add -A); pass `paths` to scope. The commit message is passed via -F (file), so quotes/newlines in the message are safe.\n\n' +
    'WHEN TO USE: after the user explicitly asks for a commit, OR after auto-verify passes and the user has accepted all edits.\n' +
    'WHEN NOT TO USE: speculatively. NEVER commit without user intent — even if "all tests pass". Commits are user-visible state changes.\n\n' +
    'BEHAVIOR:\n' +
    '  - Returns { ok, hash, subject, filesChanged }.\n' +
    '  - If working tree is clean, returns { ok: false, error: "nothing to commit" } — do NOT retry.\n' +
    '  - Conventional commits style is recommended ("feat:", "fix:", "chore:").\n\n' +
    'NOT parallelSafe (write).',
  parallelSafe: false,
  requiresApproval: true, // 默认进 ask 流程；后端 exec policy 可放行
  schema: z.object({
    message: z.string().min(1).describe('Commit message (multi-line OK).'),
    paths: z.array(z.string()).optional().describe('If empty/omitted, stages all (git add -A).'),
  }),
  async execute(input, ctx) {
    const { message, paths } = input as { message: string; paths?: string[] };
    if (paths && paths.length) {
      await git(ctx.cwd, ['add', '--', ...paths]);
    } else {
      await git(ctx.cwd, ['add', '-A']);
    }
    const tmp = path.join(ctx.cwd, '.minicodeide-commit-' + Date.now() + '.txt');
    await fs.writeFile(tmp, message, 'utf-8');
    try {
      await git(ctx.cwd, ['commit', '-F', tmp]);
    } catch (e: any) {
      const msg = String(e?.message ?? '');
      if (/nothing to commit/i.test(msg)) {
        return { ok: false, error: 'nothing to commit (working tree clean or no staged changes)' };
      }
      throw e;
    } finally {
      await fs.unlink(tmp).catch(() => undefined);
    }
    const fmt = '%H%x1f%h%x1f%s';
    const { stdout } = await git(ctx.cwd, ['log', '-1', `--pretty=format:${fmt}`]);
    const [hash, shortHash, subject] = stdout.split('\x1f');
    return { ok: true, hash, shortHash, subject };
  },
};