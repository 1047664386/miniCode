
/**
 * 轻量 Git 集成 —— 用 child_process 直接调 git CLI。
 *
 * 选择 child_process 而非 simple-git/isomorphic-git：
 *  - 不引入新依赖
 *  - 用户机器肯定有 git
 *  - diff 文本格式直接喂给 LLM 更友好
 *
 * 暴露能力：
 *  - status: 当前修改/未跟踪文件列表
 *  - diff: 工作区相对 HEAD 的 unified diff（可指定 path）
 *  - branch: 当前分支
 *  - log: 最近 N 条提交
 *  - commit: 用 message 提交（先 add 指定文件，或 add -A）
 */
import { exec as _exec } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(_exec);

export interface GitStatusEntry {
  /** 'M' modified | 'A' added | 'D' deleted | '?' untracked | 'R' renamed */
  status: string;
  path: string;
  staged: boolean;
}

export interface GitLogEntry {
  hash: string;
  shortHash: string;
  date: string;
  author: string;
  subject: string;
}

const MAX_BUFFER = 32 * 1024 * 1024; // 32MB（够装大 diff）

async function run(cmd: string, cwd: string): Promise<string> {
  const { stdout } = await exec(cmd, { cwd, maxBuffer: MAX_BUFFER });
  return stdout;
}

export async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    await run('git rev-parse --is-inside-work-tree', cwd);
    return true;
  } catch {
    return false;
  }
}

export async function gitStatus(cwd: string): Promise<GitStatusEntry[]> {
  // porcelain v1：每行 'XY path'，X=staged, Y=unstaged
  const out = await run('git status --porcelain', cwd);
  const result: GitStatusEntry[] = [];
  for (const ln of out.split('\n')) {
    if (!ln) continue;
    const x = ln[0];
    const y = ln[1];
    const p = ln.slice(3).trim();
    // 优先报告 staged 状态（如果 staged 的话）
    if (x !== ' ' && x !== '?') {
      result.push({ status: x, path: p, staged: true });
    }
    if (y !== ' ' && (y !== ' ' || x === '?')) {
      // ?? 未跟踪
      result.push({ status: y === ' ' ? x : y, path: p, staged: false });
    }
  }
  return result;
}

export async function gitDiff(
  cwd: string,
  opts: { path?: string; staged?: boolean } = {},
): Promise<string> {
  const args = ['diff'];
  if (opts.staged) args.push('--cached');
  if (opts.path) args.push('--', opts.path.replace(/'/g, "'\\''"));
  return run('git ' + args.join(' '), cwd);
}

export async function gitBranch(cwd: string): Promise<string> {
  return (await run('git rev-parse --abbrev-ref HEAD', cwd)).trim();
}

export async function gitLog(cwd: string, n = 20): Promise<GitLogEntry[]> {
  // 用 \x1f 作字段分隔符（unit separator），避免和 message 混淆
  const fmt = '%H%x1f%h%x1f%aI%x1f%an%x1f%s';
  const out = await run(`git log --pretty=format:${fmt} -n ${n}`, cwd);
  return out
    .split('\n')
    .filter(Boolean)
    .map((ln) => {
      const [hash, shortHash, date, author, subject] = ln.split('\x1f');
      return { hash, shortHash, date, author, subject };
    });
}

/** 用指定 message 提交。paths 为空数组 → add -A，全部已变更文件 */
export async function gitCommit(
  cwd: string,
  message: string,
  paths: string[] = [],
): Promise<{ hash: string; subject: string }> {
  if (paths.length === 0) {
    await run('git add -A', cwd);
  } else {
    const safe = paths.map((p) => `'${p.replace(/'/g, "'\\''")}'`).join(' ');
    await run(`git add ${safe}`, cwd);
  }
  // 写 message 到临时文件以避免 shell 注入
  const file = `/tmp/.minicodeide-commit-${Date.now()}.txt`;
  const fs = await import('node:fs/promises');
  await fs.writeFile(file, message, 'utf-8');
  try {
    await run(`git commit -F '${file}'`, cwd);
  } finally {
    await fs.unlink(file).catch(() => undefined);
  }
  const log = await gitLog(cwd, 1);
  return { hash: log[0]?.hash ?? '', subject: log[0]?.subject ?? '' };
}