
/**
 * 云端版 builtin-tools —— 把 read_file/write_file/list_files/run_command 全部
 * 路由到当前 session 对应的 SandboxHandle，让 LLM 能在云沙箱里"动手"。
 *
 * 设计要点：
 *  - 工具签名/描述尽量与 packages/core/builtin-tools.ts 对齐，LLM 复用提示词
 *  - 不依赖宿主机 fs（云端不能访问用户本地文件）
 *  - 大文件保护：读 > 256KB 截断；写无限制（沙箱内）
 */
import { z } from 'zod';
import type { Tool } from '@mini/core';
import type { SandboxHandle } from '@mini/sandbox';

export function makeSandboxTools(sb: SandboxHandle): Tool[] {
  const readFile: Tool = {
    name: 'read_file',
    description:
      'Read a UTF-8 text file from the cloud sandbox. Provide a path relative to the workspace root (e.g. "src/index.ts"). ' +
      'Returns first 500 lines by default; pass start_line/end_line for windowed reads.',
    schema: z.object({
      path: z.string().describe('relative path inside sandbox'),
      start_line: z.number().int().min(1).optional(),
      end_line: z.number().int().min(1).optional(),
    }),
    parallelSafe: true,
    async execute(input) {
      const r = await sb.read(input.path);
      const lines = r.content.split('\n');
      const start = (input.start_line ?? 1) - 1;
      const end = input.end_line ?? Math.min(lines.length, start + 500);
      const slice = lines.slice(start, end);
      const out = slice.map((l, i) => `${start + i + 1}→${l}`).join('\n');
      return { path: input.path, totalLines: lines.length, content: out };
    },
  };

  const writeFile: Tool = {
    name: 'write_file',
    description: 'Write/overwrite a UTF-8 text file in the cloud sandbox.',
    schema: z.object({
      path: z.string(),
      content: z.string(),
    }),
    async execute(input) {
      await sb.write(input.path, input.content, 'utf-8');
      return { path: input.path, bytes: input.content.length };
    },
  };

  const listFiles: Tool = {
    name: 'list_files',
    description: 'List files/dirs inside sandbox (recursive when recursive=true).',
    schema: z.object({
      path: z.string().optional().describe('default "/"'),
      recursive: z.boolean().optional(),
    }),
    parallelSafe: true,
    async execute(input) {
      const list = await sb.list({ path: input.path ?? '/', recursive: !!input.recursive });
      return list.slice(0, 1000).map((f) => ({
        path: f.path.replace(/^\//, ''),
        isDir: f.isDir,
        size: f.size,
      }));
    },
  };

  const runCommand: Tool = {
    name: 'run_command',
    description:
      'Run a shell command inside the sandbox. Returns {exitCode, stdout, stderr}. ' +
      'Default timeout 60s. Use this for tests, builds, installs, etc.',
    schema: z.object({
      command: z.string(),
      cwd: z.string().optional(),
      timeoutSec: z.number().int().min(1).max(300).optional(),
    }),
    requiresApproval: false,
    async execute(input) {
      const r = await sb.exec(input.command, {
        cwd: input.cwd,
        timeoutSec: input.timeoutSec ?? 60,
      });
      // 截断超长输出
      const cap = (s: string) => (s.length > 8000 ? s.slice(0, 8000) + '\n…[truncated]' : s);
      return {
        exitCode: r.exitCode,
        stdout: cap(r.stdout),
        stderr: cap(r.stderr),
      };
    },
  };

  // 简易 grep：基于 run_command 的 grep -rn
  const grepSearch: Tool = {
    name: 'grep_search',
    description: 'Search a regex across the sandbox filesystem (uses ripgrep if available, else grep -rn).',
    schema: z.object({
      pattern: z.string(),
      path: z.string().optional(),
    }),
    parallelSafe: true,
    async execute(input) {
      const cwd = input.path ?? '/';
      const escaped = input.pattern.replace(/'/g, `'\\''`);
      const cmd = `command -v rg >/dev/null 2>&1 && rg -n --no-heading -- '${escaped}' . 2>/dev/null | head -200 || grep -rn --color=never -- '${escaped}' . 2>/dev/null | head -200`;
      const r = await sb.exec(cmd, { cwd, timeoutSec: 30 });
      return { matches: r.stdout.split('\n').filter(Boolean).slice(0, 200) };
    },
  };

  return [readFile, writeFile, listFiles, runCommand, grepSearch];
}