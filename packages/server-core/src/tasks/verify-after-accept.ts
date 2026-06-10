
/**
 * Auto-Verify on Accept
 * --------------------------------------------------
 * 当用户 Accept 一个 pending edit 后，**立刻**对受影响的 TS/JS 文件跑 tsc --noEmit，
 * 把失败结果以 system message 形式塞进**下一次 chat turn** 的 systemExtras，
 * 让 LLM 自动看到 "你刚刚改的代码没编过，错误如下"。
 *
 * 设计要点：
 *  1. 只对 .ts/.tsx 跑 typecheck（其它扩展不参与，否则 Markdown / JSON edits 也会触发）
 *  2. 整个 workspace tsc 太慢 → 用 monorepo 感知：找最近的 tsconfig.json，对那个 package 跑
 *  3. 失败 / 成功结果只**保留到下次 buildMessages 消费**，消费过即清空（一次性）
 *  4. 跑 tsc 是异步的；如果用户 Accept 后立刻发了下一条消息，结果可能晚一拍——
 *     这种边界情况下，结果会被注入到再下一轮，可接受。
 *
 * 借鉴：Claude Code 在 Edit accept 后自动 typecheck 的行为（SWE-bench 关键技巧）
 */
import { exec } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface VerifyRecord {
  /** 受影响文件相对路径（用于 LLM 的 hint） */
  files: string[];
  /** typecheck 是否通过 */
  ok: boolean;
  /** 命令文本 */
  command: string;
  /** 截断后的 stderr / 错误摘要（≤ 4KB） */
  output: string;
  /** 时间戳 */
  at: number;
}

export class VerifyAfterAcceptStore {
  private queue: VerifyRecord[] = [];
  /** 防抖：同一个 package 上多次连续 accept，只跑最后一次 */
  private inflight = new Map<string, Promise<void>>();

  constructor(private cwd: string) {}

  /** 用户 Accept 一批 edits 后调用。非阻塞：异步跑，结果进队列。 */
  trigger(filePaths: string[]): void {
    const tsFiles = filePaths.filter((p) => /\.(ts|tsx|mts|cts)$/.test(p));
    if (tsFiles.length === 0) return;
    // 按"距离 cwd 最近的 tsconfig"分桶
    void this.runAsync(tsFiles).catch(() => {});
  }

  private async runAsync(tsFiles: string[]): Promise<void> {
    const pkgDir = await this.findNearestTsconfigDir(tsFiles[0]);
    const key = pkgDir ?? this.cwd;
    if (this.inflight.has(key)) return; // 已有相同包的 verify 在跑

    const task = (async () => {
      const cwd = pkgDir ? path.resolve(this.cwd, pkgDir) : this.cwd;
      const command = 'npx tsc --noEmit';
      const result = await execLimited(command, cwd, 60_000);
      const output =
        result.stdout.slice(0, 2000) +
        (result.stderr ? '\n[stderr]\n' + result.stderr.slice(0, 2000) : '');
      this.queue.push({
        files: tsFiles,
        ok: result.code === 0,
        command: pkgDir ? `(cd ${pkgDir}) ${command}` : command,
        output: output.trim(),
        at: Date.now(),
      });
    })().finally(() => this.inflight.delete(key));

    this.inflight.set(key, task);
  }

  private async findNearestTsconfigDir(relFile: string): Promise<string | null> {
    let dir = path.dirname(path.resolve(this.cwd, relFile));
    const root = path.resolve(this.cwd);
    while (true) {
      try {
        await fs.access(path.join(dir, 'tsconfig.json'));
        const rel = path.relative(root, dir);
        return rel || '.'; // 工作区根本身
      } catch {
        // ignore
      }
      const parent = path.dirname(dir);
      if (parent === dir || !dir.startsWith(root)) return null;
      dir = parent;
    }
  }

  /**
   * 让 buildMessages 在装配 systemExtras 时调用：
   * 一次性消费已积累的 verify 结果，渲染成 system 段落塞进去。
   */
  consumeForSystem(): string {
    if (this.queue.length === 0) return '';
    const records = this.queue.splice(0);
    const lines: string[] = [];
    lines.push('## Auto-Verification Results (post-accept)');
    lines.push(
      'The user just accepted edits to the files below. The system **automatically** ran a typecheck. Review:',
    );
    for (const r of records) {
      lines.push('');
      lines.push(`### ${r.ok ? 'PASS' : 'FAIL'} — ${r.command}`);
      lines.push(`Files: ${r.files.map((f) => `\`${f}\``).join(', ')}`);
      if (!r.ok) {
        lines.push('```');
        lines.push(r.output);
        lines.push('```');
        lines.push(
          'IMPORTANT: The accepted edits introduced or surfaced typecheck errors. Fix them in your next response — read the affected files, identify the root cause, and propose corrected edits. Do NOT claim the task done.',
        );
      } else {
        lines.push('Typecheck passed. You may proceed.');
      }
    }
    return lines.join('\n');
  }

  /** debug API */
  peek(): VerifyRecord[] {
    return [...this.queue];
  }
}

function execLimited(
  cmd: string,
  cwd: string,
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    exec(
      cmd,
      { cwd, timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout, stderr) => {
        const code =
          err && typeof (err as any).code === 'number' ? ((err as any).code as number) : err ? 1 : 0;
        resolve({ stdout: stdout || '', stderr: stderr || (err ? String(err.message) : ''), code });
      },
    );
  });
}