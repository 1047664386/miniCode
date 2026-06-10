import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';
import type { Tool } from './tool-registry.js';
import { fuzzyApply } from './fuzzy-apply.js';
import { webFetchTool } from './web-fetch-tool.js';
import { applyPatchTool } from './apply-patch-tool.js';
import {
  gitStatusTool,
  gitDiffTool,
  gitLogTool,
  gitBranchTool,
  gitCommitTool,
} from './git-tools.js';
import { readImageTool, screenshotTool } from './image-tools.js';

const pExecFile = promisify(execFile);

function resolveInside(cwd: string, p: string) {
  const abs = path.resolve(cwd, p);
  if (!abs.startsWith(path.resolve(cwd))) {
    throw new Error(`Path escapes workspace: ${p}`);
  }
  return abs;
}

/**
 * 在源文件里找跟 needle 第一行最相似的若干行，作为 didYouMean 候选。
 * 用最简单的"trim 后相同前缀长度"打分，够 LLM 自我纠正用。
 */
function findSimilarLines(
  source: string,
  needle: string,
  topN: number,
): Array<{ line: number; text: string; score: number }> {
  const firstNeedleLine = needle.split('\n')[0].trim();
  if (!firstNeedleLine) return [];
  const sourceLines = source.split('\n');
  const scored: Array<{ line: number; text: string; score: number }> = [];
  for (let i = 0; i < sourceLines.length; i++) {
    const ln = sourceLines[i].trim();
    if (!ln) continue;
    const score = commonPrefixLen(ln, firstNeedleLine) + commonSubstrLen(ln, firstNeedleLine);
    if (score >= 6) {
      scored.push({ line: i + 1, text: sourceLines[i].slice(0, 200), score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}

function commonPrefixLen(a: string, b: string): number {
  let i = 0;
  const n = Math.min(a.length, b.length);
  while (i < n && a[i] === b[i]) i++;
  return i;
}

function commonSubstrLen(a: string, b: string): number {
  // 简单 LCS 长度的廉价近似：取最长公共子串长度（O(nm) 但字符串短，无所谓）
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0) return 0;
  let best = 0;
  // 滚动数组
  let prev = new Array(m + 1).fill(0);
  let curr = new Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
        if (curr[j] > best) best = curr[j];
      } else {
        curr[j] = 0;
      }
    }
    [prev, curr] = [curr, prev];
    curr.fill(0);
  }
  return best;
}

export const readFileTool: Tool = {
  name: 'read_file',
  description:
    'Read the contents of a file as UTF-8 text and return it with line numbers.\n\n' +
    'WHEN TO USE:\n' +
    '  - You need to see actual file contents before editing or analyzing.\n' +
    '  - You want to cite a specific path:line in your reply.\n' +
    'WHEN NOT TO USE:\n' +
    '  - To search across many files — use grep_search instead.\n' +
    '  - To check whether a file exists — use list_files on the parent directory.\n' +
    '  - To read binary files — this tool only handles UTF-8 text.\n\n' +
    'BEHAVIOR:\n' +
    '  - Default returns the first 500 lines. Pass start_line / end_line for windowed reads.\n' +
    '  - Each line is prefixed with its 1-based line number in the form "  42→content". The arrow (→) is a separator; line numbers are display-only metadata.\n' +
    '  - When the requested window exceeds the file, the result is truncated and a hint is returned with the next start_line to continue from.\n' +
    '  - If the path is wrong, returns ok:false with sibling-entry hints ("did you mean ...?"). Do NOT retry blindly with the same path; pick from the suggestions or use list_files.\n\n' +
    'EDITING NOTE: when you later call edit_file, do NOT include the line-number prefix ("  42→") in oldString. Use only the actual file content (the part after the arrow). Preserve exact indentation (tabs vs spaces) and trailing whitespace.\n\n' +
    'PERFORMANCE: cheap. parallelSafe: emit multiple read_file calls in one turn to read several files at once.',
  parallelSafe: true,
  schema: z.object({
    path: z.string().describe('Path relative to workspace'),
    start_line: z.number().int().optional().describe('1-based inclusive; defaults to 1'),
    end_line: z
      .number()
      .int()
      .optional()
      .describe('1-based inclusive; defaults to start_line + 500'),
  }),
  async execute(input, ctx) {
    const abs = resolveInside(ctx.cwd, (input as any).path);
    let text: string;
    try {
      text = await fs.readFile(abs, 'utf-8');
    } catch (e: any) {
      // 提示 LLM 路径错了，给 didYouMean 的轻提示
      const dir = path.dirname(abs);
      let siblings: string[] = [];
      try {
        siblings = (await fs.readdir(dir)).slice(0, 20);
      } catch {
        /* ignore */
      }
      return {
        ok: false,
        error: `Cannot read file: ${e?.message ?? e}`,
        hint:
          siblings.length > 0
            ? `Sibling entries in ${path.relative(ctx.cwd, dir)}: ${siblings.join(', ')}. Did you mean one of these?`
            : 'Check the path; try list_files on the parent directory first.',
      };
    }
    const lines = text.split('\n');
    const total = lines.length;
    const DEFAULT_WINDOW = 500;
    const s0 = Math.max(0, ((input as any).start_line ?? 1) - 1);
    const requestedEnd = (input as any).end_line as number | undefined;
    const e0 = Math.min(total, requestedEnd ?? Math.min(total, s0 + DEFAULT_WINDOW));
    const slice = lines.slice(s0, e0);
    // 加行号前缀，统一与 read_file 输出格式（业界标准，方便 LLM 引用）
    const numbered = slice
      .map((ln, i) => {
        const lineNo = String(s0 + i + 1).padStart(6, ' ');
        return `${lineNo}→${ln}`;
      })
      .join('\n');
    const truncated = e0 < total;
    const omitted = total - e0;
    return {
      content: numbered,
      path: (input as any).path,
      start_line: s0 + 1,
      end_line: e0,
      total_lines: total,
      truncated,
      ...(truncated
        ? {
            hint: `Showed lines ${s0 + 1}-${e0} of ${total}. ${omitted} more lines below. ` +
              `Call read_file again with start_line=${e0 + 1} to continue, ` +
              `or use grep_search / list_file_symbols to navigate.`,
          }
        : {}),
    };
  },
};

export const writeFileTool: Tool = {
  name: 'write_file',
  description:
    'Create a new file or completely replace an existing file\'s contents. The change goes through the user\'s pending-edit review (Diff Editor); the file on disk is NOT modified until the user clicks Accept.\n\n' +
    'WHEN TO USE:\n' +
    '  - The file does NOT exist yet (brand-new file).\n' +
    '  - You are rewriting > 70% of an existing file (full overwrite is cleaner than many edit_file calls).\n' +
    'WHEN NOT TO USE:\n' +
    '  - For small targeted changes — use edit_file (preserves surrounding context, smaller diff).\n' +
    '  - To append to a file — read_file first, then write_file with prepended old content. There is no append mode.\n\n' +
    'BEHAVIOR:\n' +
    '  - Returns { pendingEditId } on success. The user reviews the diff and decides.\n' +
    '  - Same file proposed multiple times will MERGE in pending state — your latest content wins.\n' +
    '  - Path is resolved inside the workspace (cannot escape with ../).\n\n' +
    'IMPORTANT: this tool is NOT parallelSafe. The agent loop runs write tools serially in the order you emit them. Order matters when one file imports another.',
  schema: z.object({ path: z.string(), content: z.string() }),
  async execute(input, ctx) {
    const rel = (input as any).path as string;
    const content = (input as any).content as string;
    if (ctx.proposeEdit) {
      const { id } = await ctx.proposeEdit({ path: rel, newContent: content, tool: 'write_file' });
      return { ok: true, pendingEditId: id, message: 'Diff sent to user for review' };
    }
    const abs = resolveInside(ctx.cwd, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, 'utf-8');
    return { ok: true, path: rel };
  },
};

export const editFileTool: Tool = {
  name: 'edit_file',
  description:
    'Propose a precise, in-place edit to an existing file by replacing oldString with newString. The change goes through pending-edit review; the file on disk is NOT modified until the user clicks Accept.\n\n' +
    'WHEN TO USE:\n' +
    '  - Targeted changes (rename, fix bug, add a function, modify a config value).\n' +
    '  - You can clearly identify a unique passage of existing code to anchor on.\n' +
    'WHEN NOT TO USE:\n' +
    '  - For brand-new files — use write_file.\n' +
    '  - For full-file rewrites — use write_file (faster, lower error rate).\n' +
    '  - To make many edits to the same file in one turn — emit multiple edit_file calls; they will be merged.\n\n' +
    'CRITICAL RULES:\n' +
    '  1. ALWAYS read_file the target first. Do NOT guess what the file currently contains.\n' +
    '  2. oldString MUST match the existing content EXACTLY — same whitespace, tabs, trailing spaces, and newlines. The tool will FAIL if oldString is not found.\n' +
    '  3. oldString MUST be UNIQUE in the file. If your edit could match in 2+ places, include MORE surrounding context (1-3 anchor lines above/below) until it is unique.\n' +
    '  4. Do NOT include line-number prefixes (e.g. "  42→") from read_file output — those are display metadata. Use only the actual content after the arrow separator.\n' +
    '  5. To replace every occurrence, set replaceAll:true. Otherwise only the first match is replaced.\n\n' +
    'FAILURE HANDLING:\n' +
    '  - On miss, the tool returns didYouMean candidates: the 3 lines in the file most similar to your oldString. Use them to refine, then retry. Do NOT retry with the same oldString.\n' +
    '  - If you fail twice, STOP and either read_file again with a wider window or rethink the approach.\n\n' +
    'INTERNAL: uses fuzzy-apply (exact → trim-line → whitespace-collapse → line-anchor) before giving up. Returns matchStrategy in the success result so you know which path matched.',
  schema: z.object({
    path: z.string(),
    oldString: z.string(),
    newString: z.string(),
    /** 替换所有出现，默认仅第一处 */
    replaceAll: z.boolean().optional(),
  }),
  async execute(input, ctx) {
    const rel = (input as any).path as string;
    const oldS = (input as any).oldString as string;
    const newS = (input as any).newString as string;
    const replaceAll = !!(input as any).replaceAll;
    // 优先用虚拟读取，叠加已有 pending
    const before = ctx.virtualRead
      ? await ctx.virtualRead(rel)
      : await fs.readFile(resolveInside(ctx.cwd, rel), 'utf-8');

    const result = fuzzyApply(before, oldS, newS, { replaceAll });
    if (!result.ok || !result.next) {
      // 给 LLM 一组 "did you mean" 候选：从源文件里找跟 oldString 第一行最相似的几行
      const candidates = findSimilarLines(before, oldS, 3);
      const hint =
        `${result.reason ?? 'oldString not found'}. Tip: keep oldString small (5-15 lines), ` +
        `avoid trailing whitespace, and include unique surrounding lines as anchor.`;
      throw new Error(
        JSON.stringify({
          error: 'edit_failed',
          message: hint,
          didYouMean: candidates,
          suggestion:
            candidates.length > 0
              ? 'The file contains lines that look similar. Read the file again and copy the exact text verbatim.'
              : 'No similar lines found. Are you sure the path is right? Use read_file to verify the current content.',
        }),
      );
    }
    const next = result.next;

    if (ctx.proposeEdit) {
      const { id } = await ctx.proposeEdit({ path: rel, newContent: next, tool: 'edit_file' });
      return {
        ok: true,
        pendingEditId: id,
        message: 'Diff sent to user for review',
        matchStrategy: result.strategy,
      };
    }
    await fs.writeFile(resolveInside(ctx.cwd, rel), next, 'utf-8');
    return { ok: true, matchStrategy: result.strategy };
  },
};

export const listFilesTool: Tool = {
  name: 'list_files',
  description:
    'List entries (files and subdirectories) in a directory of the workspace. Returns structured items with type, name, and size in bytes.\n\n' +
    'WHEN TO USE:\n' +
    '  - You need to know what is in a specific directory before reading.\n' +
    '  - The user mentioned a folder by name and you want to inspect its layout.\n' +
    'WHEN NOT TO USE:\n' +
    '  - To search for code by content — use grep_search.\n' +
    '  - To find a symbol by name — use find_symbol.\n' +
    '  - To answer "where is the code for X?" — use semantic_search.\n' +
    '  - To recursively walk a large repo — do NOT. It will return thousands of items and waste context. Prefer targeted grep / semantic_search.\n\n' +
    'BEHAVIOR:\n' +
    '  - By default ignores node_modules, .git, dist, build, .next, .minicodeide, and dotfiles. This is the right behavior 95% of the time.\n' +
    '  - recursive:true walks subdirectories. Use sparingly.\n' +
    '  - parallelSafe: combine with read_file in one turn for fast file overview.',
  parallelSafe: true,
  schema: z.object({
    path: z.string().default('.'),
    recursive: z.boolean().optional(),
    /** 最多返回多少条；默认 200 */
    limit: z.number().int().min(1).max(2000).optional(),
  }),
  async execute(input, ctx) {
    const abs = resolveInside(ctx.cwd, (input as any).path);
    const limit = ((input as any).limit as number | undefined) ?? 200;
    const recursive = !!(input as any).recursive;
    interface Entry {
      path: string;
      type: 'file' | 'dir';
      size?: number;
    }
    const out: Entry[] = [];
    let truncated = false;
    const walk = async (dir: string) => {
      if (out.length >= limit) {
        truncated = true;
        return;
      }
      let entries: any[] = [];
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      // 稳定排序：目录优先 + 名字字母序
      entries.sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      for (const e of entries) {
        if (out.length >= limit) {
          truncated = true;
          return;
        }
        if (
          e.name === 'node_modules' ||
          e.name === 'dist' ||
          e.name === '.git' ||
          e.name === '.minicodeide' ||
          e.name.startsWith('.')
        ) {
          continue;
        }
        const full = path.join(dir, e.name);
        const rel = path.relative(ctx.cwd, full);
        if (e.isDirectory()) {
          out.push({ path: rel, type: 'dir' });
          if (recursive) await walk(full);
        } else {
          let size: number | undefined;
          try {
            const st = await fs.stat(full);
            size = st.size;
          } catch {
            /* ignore */
          }
          out.push({ path: rel, type: 'file', size });
        }
      }
    };
    await walk(abs);
    return {
      ok: true,
      root: (input as any).path,
      count: out.length,
      truncated,
      entries: out,
      ...(truncated
        ? {
            hint: `Truncated at ${limit}. Pass limit=<n> to fetch more, or scope down with a deeper path.`,
          }
        : {}),
    };
  },
};

export const grepTool: Tool = {
  name: 'grep_search',
  description:
    'Search files in the workspace using a regular expression. Returns matching lines with their 1-based line numbers and (optionally) surrounding context.\n\n' +
    'WHEN TO USE:\n' +
    '  - You have a literal token to find: a function name, an import path, an error message, a config key, a CSS class.\n' +
    '  - You want to find ALL call sites of something (combine with find_references for symbols you can identify by name).\n' +
    '  - PREFER grep_search over semantic_search when you have keywords. Embedding-based search is fuzzy; literal grep is precise.\n' +
    'WHEN NOT TO USE:\n' +
    '  - Conceptual questions like "where is auth handled?" — use semantic_search.\n' +
    '  - Looking up a symbol definition by exact name — use find_symbol (faster, returns the signature).\n' +
    '  - Reading a known file end-to-end — use read_file.\n\n' +
    'PATTERN TIPS:\n' +
    '  - JS regex syntax. Escape special chars: ( ) [ ] { } . * + ? \\ |\n' +
    '  - Use case_insensitive:true to relax matching.\n' +
    '  - Use context_lines:N (0-10) to see surrounding lines (great for understanding the call site).\n' +
    '  - Use file_pattern with glob-ish basenames: "*.ts", "*.{md,mdx}", "*.test.ts".\n\n' +
    'BEHAVIOR:\n' +
    '  - Auto-skips node_modules, .git, dist, dotfiles.\n' +
    '  - Caps at 200 hits and returns truncated:true — narrow the pattern or path if you hit the cap.\n' +
    '  - parallelSafe: emit multiple grep_search calls (different patterns / paths) in one turn for fast triangulation.\n\n' +
    'IF YOU GET 0 HITS: try (a) case_insensitive, (b) relax the regex (drop word boundaries), (c) widen file_pattern, (d) check the path. Do NOT retry with the exact same args.',
  parallelSafe: true,
  schema: z.object({
    pattern: z.string().describe('Regex pattern (JS syntax)'),
    path: z.string().default('.'),
    /** glob 风格的文件名过滤；e.g. "*.ts" / "*.{md,mdx}" */
    file_pattern: z
      .string()
      .optional()
      .describe('Glob pattern over file basename, e.g. "*.ts" or "*.{md,mdx}"'),
    case_insensitive: z.boolean().optional(),
    /** 每条命中前后展示的行数 */
    context_lines: z
      .number()
      .int()
      .min(0)
      .max(10)
      .optional()
      .describe('Lines of context before/after the match (default 0)'),
    /** 老字段保留兼容 */
    glob: z.string().optional(),
  }),
  async execute(input, ctx) {
    const abs = resolveInside(ctx.cwd, (input as any).path);
    const flags = (input as any).case_insensitive ? 'i' : '';
    let re: RegExp;
    try {
      re = new RegExp((input as any).pattern, flags);
    } catch (e: any) {
      return { ok: false, error: `Invalid regex: ${e?.message ?? e}`, hint: 'Escape special chars like ( ) [ ] { } . * + ? \\' };
    }
    const fileGlob = (input as any).file_pattern ?? (input as any).glob;
    const globRe = fileGlob ? globToRegex(fileGlob) : null;
    const ctxN = ((input as any).context_lines as number | undefined) ?? 0;
    interface Hit {
      file: string;
      line: number;
      text: string;
      context?: { line: number; text: string }[];
    }
    const hits: Hit[] = [];
    let filesScanned = 0;
    let filesSkipped = 0;
    const walk = async (dir: string) => {
      if (hits.length >= 200) return;
      let entries: any[] = [];
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        if (hits.length >= 200) return;
        if (
          e.name === 'node_modules' ||
          e.name === 'dist' ||
          e.name === '.git' ||
          e.name.startsWith('.')
        ) {
          continue;
        }
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          await walk(full);
        } else {
          if (globRe && !globRe.test(e.name)) {
            filesSkipped += 1;
            continue;
          }
          filesScanned += 1;
          try {
            const text = await fs.readFile(full, 'utf-8');
            const lines = text.split('\n');
            for (let i = 0; i < lines.length; i++) {
              if (re.test(lines[i])) {
                const hit: Hit = {
                  file: path.relative(ctx.cwd, full),
                  line: i + 1,
                  text: lines[i].slice(0, 400),
                };
                if (ctxN > 0) {
                  const lo = Math.max(0, i - ctxN);
                  const hi = Math.min(lines.length, i + ctxN + 1);
                  hit.context = [];
                  for (let j = lo; j < hi; j++) {
                    if (j === i) continue;
                    hit.context.push({ line: j + 1, text: lines[j].slice(0, 400) });
                  }
                }
                hits.push(hit);
                if (hits.length >= 200) return;
              }
            }
          } catch {
            /* binary or unreadable */
          }
        }
      }
    };
    await walk(abs);
    return {
      ok: true,
      pattern: (input as any).pattern,
      count: hits.length,
      truncated: hits.length >= 200,
      files_scanned: filesScanned,
      files_skipped: filesSkipped,
      hits,
      ...(hits.length === 0
        ? {
            hint:
              'No matches found. Try: case_insensitive:true, or relax the pattern (escape special chars), ' +
              'or widen file_pattern. For conceptual queries, semantic_search is better than grep.',
          }
        : {}),
    };
  },
};

/** 把 glob（*, ?, {a,b}）转 RegExp。只覆盖常见 case，够用即可。 */
function globToRegex(glob: string): RegExp {
  let re = '^';
  let i = 0;
  while (i < glob.length) {
    const c = glob[i];
    if (c === '*') re += '.*';
    else if (c === '?') re += '.';
    else if (c === '.') re += '\\.';
    else if (c === '{') {
      const end = glob.indexOf('}', i);
      if (end < 0) {
        re += '\\{';
      } else {
        const inner = glob.slice(i + 1, end).split(',');
        re += '(?:' + inner.map((s) => s.replace(/\./g, '\\.')).join('|') + ')';
        i = end;
      }
    } else if (/[a-zA-Z0-9_\-]/.test(c)) {
      re += c;
    } else {
      re += '\\' + c;
    }
    i++;
  }
  re += '$';
  return new RegExp(re);
}

export const runCommandTool: Tool = {
  name: 'run_command',
  description:
    'Execute a shell command in the workspace and return its stdout/stderr/exit code. The command goes through an exec policy that classifies it as auto-run / require-approval / auto-deny.\n\n' +
    'WHEN TO USE:\n' +
    '  - Run tests / lints / builds / type-checks (these are the high-value use cases).\n' +
    '  - Inspect git state (`git status`, `git log`, `git diff`).\n' +
    '  - Run a project-specific script defined in package.json.\n' +
    'WHEN NOT TO USE:\n' +
    '  - To READ files — use read_file (no shell needed, structured output).\n' +
    '  - To LIST files — use list_files.\n' +
    '  - To EDIT files — use edit_file or write_file. Do NOT pipe `echo "..." > file` — it bypasses pending-edit review.\n' +
    '  - To search code — use grep_search.\n\n' +
    'POLICY (you cannot bypass this):\n' +
    '  - AUTO-RUN: ls / cat / grep / git status / pnpm test / tsc — run immediately.\n' +
    '  - ASK: rm / git commit / git push / unknown commands — user must Approve in the UI before running.\n' +
    '  - DENY: sudo / rm -rf / / curl to internal hosts / `base64 -d | sh` and other obfuscation — returns ok:false, denied:true. Do not try to bypass with `node -e "require(\'child_process\')..."` workarounds; that is also caught by review.\n\n' +
    'BACKGROUND MODE:\n' +
    '  - Set run_in_background:true for long-running commands (npm install, pytest suite, docker build, dev server).\n' +
    '  - Returns { ok:true, bg_id } immediately. You can continue with other tools while it runs.\n' +
    '  - Later call get_background_result(id) to fetch output, list_background_tasks() to see all, cancel_background_task(id) to kill.\n' +
    '  - The system auto-detects likely-slow commands and may switch to background mode even if you didn\'t set the flag.\n\n' +
    'QUOTING: ALWAYS quote paths that may contain spaces. Single-quote literal strings to prevent shell expansion.\n\n' +
    'NOT parallelSafe: write/exec class. Runs serially in the order emitted.',
  schema: z.object({
    command: z.string(),
    cwd: z.string().optional(),
    run_in_background: z.boolean().optional(),
  }),
  // requiresApproval 不再硬开 —— 改由 execPolicy 动态决定（ask 时 ctx.approve）
  async execute(input, ctx) {
    const command = (input as any).command as string;
    const cwd = (input as any).cwd ? resolveInside(ctx.cwd, (input as any).cwd) : ctx.cwd;
    const runBg = !!(input as any).run_in_background || isLikelySlow(command);

    // 1. 策略判定
    const decision = ctx.execPolicy
      ? ctx.execPolicy(command)
      : { verdict: 'ask' as const, reason: 'no policy configured', matchedRule: 'no-policy' };

    if (decision.verdict === 'deny') {
      // 教学性错误：让 LLM 知道为什么被拒，可以换种方式
      return {
        ok: false,
        denied: true,
        reason: decision.reason,
        matchedRule: decision.matchedRule,
        hint:
          'Command was denied by exec policy. Consider a safer alternative: ' +
          'use read_file/list_files/grep for inspection, edit_file for changes. ' +
          'Avoid sudo / rm -rf / curl / ssh — propose to the user instead.',
      };
    }

    if (decision.verdict === 'ask') {
      if (!ctx.approve) {
        return {
          ok: false,
          denied: true,
          reason: 'Command requires approval but no approver wired',
          matchedRule: decision.matchedRule,
        };
      }
      const ok = await ctx.approve({
        tool: 'run_command',
        args: { command, cwd, reason: decision.reason, matchedRule: decision.matchedRule, runBg },
      });
      if (!ok) {
        return {
          ok: false,
          denied: true,
          reason: 'User rejected command',
          matchedRule: 'user-reject',
        };
      }
    }

    // 2. 后台分支
    if (runBg && ctx.backgroundTasks) {
      try {
        const t = ctx.backgroundTasks.start(command, cwd);
        return {
          ok: true,
          bg_id: t.id,
          status: t.status,
          message:
            `Command started in background (id=${t.id}). ` +
            'Continue with other work; call `get_background_result` with this id to fetch stdout when ready.',
        };
      } catch (e: any) {
        return { ok: false, error: e?.message ?? String(e), policy: decision };
      }
    }

    // 2b. P1 修复：文件修改类命令执行前自动创建 checkpoint
    //     使用户可以通过 checkpoint revert 撤销 run_command 的副作用
    if (ctx.checkpoint) {
      const affectedFiles = detectAffectedFiles(command, ctx.cwd);
      if (affectedFiles.length > 0) {
        await ctx.checkpoint({
          label: `run_command: ${command.slice(0, 60)}`,
          trigger: 'run_command',
          files: affectedFiles.map((p) => ({ path: p, newContent: '' })),
        }).catch(() => undefined);
      }
    }

    // 3. 同步执行
    try {
      const { stdout, stderr } = await pExecFile('sh', ['-c', command], {
        cwd,
        timeout: 60_000,
        maxBuffer: 4 * 1024 * 1024,
      });
      return { ok: true, stdout, stderr, policy: decision };
    } catch (e: any) {
      return {
        ok: false,
        error: e?.message ?? String(e),
        stdout: e?.stdout ?? '',
        stderr: e?.stderr ?? '',
        policy: decision,
      };
    }
  },
};

/** 启发式判断：命令是否多半超过 30s（用于在模型没显式 run_in_background 时兜底） */
function isLikelySlow(cmd: string): boolean {
  const c = cmd.toLowerCase();
  const slow = [
    'npm install', 'pnpm install', 'yarn install', 'npm i ', 'pnpm i ',
    'npm run build', 'pnpm run build', 'pnpm build', 'yarn build',
    'pip install', 'cargo build', 'cargo run', 'go build', 'mvn ',
    'docker build', 'docker compose up', 'docker-compose up',
    'pytest', 'jest', 'vitest run', 'tsc -b',
  ];
  return slow.some((kw) => c.includes(kw));
}

/**
 * P1 修复：启发式检测命令可能修改的文件列表。
 * 用于 run_command 执行前自动创建 checkpoint，使用户可以 revert。
 *
 * 覆盖常见的文件修改类命令：
 *   cp/mv/ln → 目标文件；touch/mkdir → 指定路径；
 *   sed -i/awk -i/tee → 目标文件；rm → 被删文件；
 *   install/pip install/npm install → 标记项目根目录。
 *
 * 返回空数组 = 无法判断 / 纯只读命令 → 不需要 checkpoint。
 */
function detectAffectedFiles(command: string, cwd: string): string[] {
  const cmd = command.trim();
  const files: string[] = [];
  // 按 | && || ; 拆分复合命令，逐段分析
  const segments = cmd.split(/\s*(?:\|\||&&|\||;)\s*/);

  for (const seg of segments) {
    const trimmedSeg = seg.trim();
    if (!trimmedSeg) continue;

    // CR fix (P2): 提取 shell 重定向目标（> / >>）
    // 匹配 >file, > file, >>file, >> file 等模式
    for (const m of trimmedSeg.matchAll(/>{1,2}\s*(\S+)/g)) {
      const target = m[1];
      if (target && !target.startsWith('-') && !target.endsWith('/')) {
        files.push(target);
      }
    }

    const parts = trimmedSeg.split(/\s+/);
    if (parts.length === 0) continue;
    const prog = parts[0].replace(/^(?:sudo\s+)?/, '').split('/').pop()?.toLowerCase() ?? '';

    // cp src dst / mv src dst / ln [-s] src dst
    if (prog === 'cp' || prog === 'mv' || prog === 'ln') {
      const target = parts[parts.length - 1];
      // CR fix (P2): 目标以 / 结尾 = 目录，跳过（checkpoint 无法快照目录）
      if (target && !target.startsWith('-') && !target.endsWith('/')) {
        files.push(target);
      }
    }
    // touch file1 file2 ...
    else if (prog === 'touch') {
      for (const p of parts.slice(1)) {
        if (!p.startsWith('-') && !p.endsWith('/')) files.push(p);
      }
    }
    // mkdir [-p] dir1 dir2 ...
    else if (prog === 'mkdir') {
      for (const p of parts.slice(1)) {
        if (!p.startsWith('-') && !p.endsWith('/')) files.push(p);
      }
    }
    // rm file1 file2 ...
    else if (prog === 'rm') {
      for (const p of parts.slice(1)) {
        if (!p.startsWith('-') && !p.endsWith('/')) files.push(p);
      }
    }
    // sed -i ... file / awk -i ... file
    else if (prog === 'sed' || prog === 'awk') {
      if (seg.includes(' -i ')) {
        const target = parts[parts.length - 1];
        if (target && !target.startsWith('-') && target.includes('.')) files.push(target);
      }
    }
    // tee file
    else if (prog === 'tee') {
      for (const p of parts.slice(1)) {
        if (!p.startsWith('-') && !p.startsWith('>') && !p.endsWith('/')) files.push(p);
      }
    }
    // patch -p1 < file.patch / git apply file.patch
    else if (prog === 'patch' || (prog === 'git' && parts[1] === 'apply')) {
      // patch 可能修改多个文件，不做具体文件提取（太复杂）
    }
    // 包管理器 install → 标记 package.json / package-lock.json
    else if (
      (prog === 'npm' || prog === 'pnpm' || prog === 'yarn') &&
      parts.slice(1).some((p) => p === 'install' || p === 'i' || p === 'add')
    ) {
      files.push('package.json', 'package-lock.json');
    }
    // pip install → pyproject.toml / requirements.txt
    else if (prog === 'pip' && parts.slice(1).some((p) => p === 'install')) {
      files.push('requirements.txt');
    }
  }

  // 去重 + 过滤纯 flag / 空值
  return [...new Set(files)].filter((f) => f && !f.startsWith('-'));
}

export const listBackgroundTasksTool: Tool = {
  name: 'list_background_tasks',
  description:
    'List all background tasks started via run_command(run_in_background=true). ' +
    'Returns id / command / status (running|completed|failed|cancelled) / startedAt / exitCode.',
  schema: z.object({}),
  parallelSafe: true,
  async execute(_input, ctx) {
    if (!ctx.backgroundTasks) return { tasks: [] };
    return { tasks: ctx.backgroundTasks.list() };
  },
};

export const getBackgroundResultTool: Tool = {
  name: 'get_background_result',
  description:
    'Fetch stdout/stderr/exit code of a background task by id. ' +
    'Status will be one of running|completed|failed|cancelled. ' +
    'If still running, returns partial output so far.',
  schema: z.object({ id: z.string() }),
  parallelSafe: true,
  async execute(input, ctx) {
    if (!ctx.backgroundTasks) return { error: 'no background task manager wired' };
    const t = ctx.backgroundTasks.get((input as any).id);
    if (!t) return { error: `No background task ${(input as any).id}` };
    return t;
  },
};

export const cancelBackgroundTaskTool: Tool = {
  name: 'cancel_background_task',
  description: 'Cancel a running background task by id (sends SIGTERM, then SIGKILL after 3s).',
  schema: z.object({ id: z.string() }),
  async execute(input, ctx) {
    if (!ctx.backgroundTasks) return { ok: false, error: 'no background task manager wired' };
    const ok = ctx.backgroundTasks.cancel((input as any).id);
    return { ok };
  },
};

export const findSymbolTool: Tool = {
  name: 'find_symbol',
  description:
    'Locate the DEFINITION of a code symbol (function, class, interface, type, const) by name. Backed by a tree-sitter symbol graph indexed at startup. Returns the file path, 1-based line, and signature snippet.\n\n' +
    'WHEN TO USE:\n' +
    '  - You know the symbol name (or a substring) and want to jump to where it is defined.\n' +
    '  - You want the function signature without reading the whole file.\n' +
    'WHEN NOT TO USE:\n' +
    '  - To find call sites — use find_references after find_symbol.\n' +
    '  - For natural-language intent ("where is rate limiting?") — use semantic_search.\n' +
    '  - For arbitrary text patterns — use grep_search.\n\n' +
    'BEHAVIOR:\n' +
    '  - Fuzzy matches by substring (case-insensitive). "build" matches buildIndex / rebuildAll.\n' +
    '  - Returns up to `limit` (default 15, max 50) ranked by name closeness.\n' +
    '  - Falls back to ok:false with hint if the symbol index is not yet built.\n' +
    '  - parallelSafe: combine with read_file in one turn ("find then read context").',
  parallelSafe: true,
  schema: z.object({
    query: z.string().describe('Symbol name or substring, e.g. "buildIndex" or "User"'),
    limit: z.number().int().min(1).max(50).optional(),
  }),
  async execute({ query, limit = 15 }, ctx) {
    if (!ctx.codeIntel) return { ok: false, error: 'code intel not available' };
    const symbols = await ctx.codeIntel.findSymbol(query, limit);
    return { ok: true, count: symbols.length, symbols };
  },
};

export const findReferencesTool: Tool = {
  name: 'find_references',
  description:
    'Find all locations where a named symbol is referenced (called, imported, or used). Backed by the symbol graph; results are deduplicated and grouped by file.\n\n' +
    'WHEN TO USE:\n' +
    '  - You changed (or plan to change) a function/class signature and need to update every caller.\n' +
    '  - The user asks "who uses X?".\n' +
    '  - You want to assess blast radius before refactoring.\n' +
    'WHEN NOT TO USE:\n' +
    '  - To find the definition — use find_symbol first.\n' +
    '  - For string occurrences (e.g. a CSS class name, a route path) — use grep_search; references only tracks code-level identifiers.\n\n' +
    'BEHAVIOR:\n' +
    '  - Match is by EXACT name. Pass the precise identifier returned by find_symbol.\n' +
    '  - Returns { count, references: [{ file, line, snippet }] }.\n' +
    '  - parallelSafe.',
  parallelSafe: true,
  schema: z.object({
    name: z.string().describe('Exact symbol name'),
  }),
  async execute({ name }, ctx) {
    if (!ctx.codeIntel) return { ok: false, error: 'code intel not available' };
    const refs = await ctx.codeIntel.findReferences(name);
    return { ok: true, count: refs.length, references: refs };
  },
};

export const semanticSearchTool: Tool = {
  name: 'semantic_search',
  description:
    'Hybrid (BM25 + vector + symbol graph, fused via RRF) semantic search over the codebase by NATURAL-LANGUAGE query. Returns ranked code chunks with file:line.\n\n' +
    'WHEN TO USE:\n' +
    '  - You don\'t know the exact keyword. Question-shaped queries: "where is rate limiting applied?", "how does auth refresh work?", "the place that handles file uploads".\n' +
    '  - Triangulating an unfamiliar codebase — use semantic_search to seed, then read_file / find_symbol for precision.\n' +
    'WHEN NOT TO USE:\n' +
    '  - You already know the literal token — grep_search is precise and faster.\n' +
    '  - You know the symbol name — find_symbol gives you the exact definition.\n' +
    '  - Looking for files by name — list_files / glob.\n\n' +
    'TIPS:\n' +
    '  - Phrase queries as a question or a short description, not as keywords. "function that validates JWT" beats "jwt validate".\n' +
    '  - k controls result count (1-20, default 8). 5-10 is the sweet spot.\n' +
    '  - parallelSafe: emit multiple semantic_search calls (different angles) in one turn.',
  parallelSafe: true,
  schema: z.object({
    query: z.string().describe('Natural language query'),
    k: z.number().int().min(1).max(20).optional(),
  }),
  async execute({ query, k = 8 }, ctx) {
    if (!ctx.codeIntel) return { ok: false, error: 'code intel not available' };
    const hits = await ctx.codeIntel.semanticSearch(query, k);
    return { ok: true, count: hits.length, hits };
  },
};

export const listFileSymbolsTool: Tool = {
  name: 'list_file_symbols',
  description:
    'Return an outline of all top-level symbols (functions, classes, interfaces, types, exports) defined in a single file. Like a tree view for that file.\n\n' +
    'WHEN TO USE:\n' +
    '  - You opened a large file and want to know its shape before reading specific sections.\n' +
    '  - You need to find a method by name within a known file without reading the whole thing.\n' +
    'WHEN NOT TO USE:\n' +
    '  - For a workspace-wide search — use find_symbol.\n' +
    '  - To read code content — use read_file with start_line/end_line; this tool only returns names + locations.\n\n' +
    'BEHAVIOR: returns [{ name, kind, line }]. parallelSafe.',
  parallelSafe: true,
  schema: z.object({
    path: z.string().describe('Relative file path'),
  }),
  async execute({ path: p }, ctx) {
    if (!ctx.codeIntel) return { ok: false, error: 'code intel not available' };
    const symbols = await ctx.codeIntel.listFileSymbols(p);
    return { ok: true, count: symbols.length, symbols };
  },
};

/**
 * update_plan —— 让 Agent 显式声明 / 推进任务计划。
 *
 * 用法（System prompt 里建议 LLM 在多步任务开始时先调一次）：
 *   update_plan({
 *     summary: "implement OAuth login",
 *     items: [
 *       { id: "1", content: "add login form",   status: "in_progress" },
 *       { id: "2", content: "wire callback",    status: "pending" },
 *       { id: "3", content: "store user token", status: "pending" },
 *     ]
 *   })
 *
 * 前端通过 SSE event=plan 实时接收，渲染 ☐ / ⏳ / ✅ 列表。
 *
 * parallelSafe=true：plan 更新只是发个事件，不写文件不跑命令，可以和别的读类工具并发。
 */
export const updatePlanTool: Tool = {
  name: 'update_plan',
  description:
    'Declare or update the high-level task plan that the user sees in the IDE\'s plan panel. Each call REPLACES the entire plan with the items array provided.\n\n' +
    'WHEN TO USE:\n' +
    '  - At the START of any task with 3+ distinct steps. Outline ALL steps up front so the user knows what you intend to do.\n' +
    '  - AFTER completing each step, call again with the same items but updated statuses (mark the just-finished one completed, set the next one in_progress).\n' +
    'WHEN NOT TO USE:\n' +
    '  - Single-step tasks ("rename this variable", "explain this function"). Do not pollute the plan UI with trivia.\n' +
    '  - To brainstorm — use the `think` tool for that.\n\n' +
    'RULES:\n' +
    '  - Each item: { id, content, status, priority?, parentId?, note? }. status ∈ { pending, in_progress, completed }; priority ∈ { high, medium, low }.\n' +
    '  - Exactly ONE item should be in_progress at any time. Multiple in_progress is treated as a bug.\n' +
    '  - id should be stable across updates (you are updating the SAME plan, not creating new ones).\n' +
    '  - content should be 1 line, action-oriented ("Add Foo type to schema", not "Foo schema").\n' +
    '  - Use parentId to nest sub-tasks under a parent (max depth 2). Useful for breaking a big step into 2-3 sub-steps.\n' +
    '  - Use priority sparingly: only mark high/low when meaningful. Default is medium-equivalent (no badge).\n' +
    '  - note: optional 1-line context (e.g. "blocked on lib upgrade", "see issue #123"). Keep it short.\n' +
    '  - Mark a step completed IMMEDIATELY after finishing it; do not batch.\n\n' +
    'parallelSafe: only emits an SSE event, no FS/exec side effects.',
  parallelSafe: true,
  schema: z.object({
    items: z.array(
      z.object({
        id: z.string(),
        content: z.string(),
        status: z.enum(['pending', 'in_progress', 'completed']),
        priority: z.enum(['high', 'medium', 'low']).optional(),
        parentId: z.string().optional(),
        note: z.string().optional(),
      }),
    ),
    summary: z.string().optional(),
  }),
  async execute({ items, summary }, ctx) {
    if (ctx.updatePlan) {
      await ctx.updatePlan({ items, summary });
    }
    const total = items.length;
    const done = items.filter((i: any) => i.status === 'completed').length;
    const ip = items.filter((i: any) => i.status === 'in_progress').length;
    return { ok: true, total, completed: done, in_progress: ip };
  },
};

/**
 * verify_changes —— Self-Verification 工具
 *
 * Agent 改完文件后用它跑 tsc/test/lint/任意命令；返回结构化结果：
 *  - { ok: true,  summary: 'no errors' }
 *  - { ok: false, summary: '3 errors in 2 files', errors: [...截断后...], hint: '...' }
 *
 * 设计要点：
 *  1. 输出强结构化，**每条 error 限制 200 字节**，最多 12 条，防止整个 trajectory 被刷爆
 *  2. 自动推断 monorepo / 单仓常用命令（pnpm > yarn > npm；vitest > jest > tsc）
 *  3. 失败时 hint 字段直接告诉 agent "去看 X 文件的第 N 行" / "可能漏写了 import"
 *  4. parallelSafe=false：跑命令会改变 fs 状态（compile cache 等），保守串行
 */
export const verifyChangesTool: Tool = {
  name: 'verify_changes',
  description:
    'Run a verification step (typecheck / test / lint / custom command) and return a STRUCTURED summary of any failures. This is your self-check after editing code.\n\n' +
    'WHEN TO USE:\n' +
    '  - AFTER any non-trivial edit to TS/JS code → kind:"typecheck".\n' +
    '  - After changes to test files → kind:"test".\n' +
    '  - After config / lint-rule changes → kind:"lint".\n' +
    '  - For project-specific verification (e.g. running a generator) → kind:"exec" with a command.\n' +
    'WHEN NOT TO USE:\n' +
    '  - To run arbitrary shell commands — use run_command (no parsing of output).\n' +
    '  - For reads / explorations — verify_changes is heavy (spawns a build); use grep/read for inspection.\n\n' +
    'OUTPUT (CRITICAL FOR YOU TO USE):\n' +
    '  - { ok: true, summary }                         → verification passed; you can claim done.\n' +
    '  - { ok: false, errors: [{ file, line, col, message }], hint, tail } → fix and re-verify.\n' +
    '  - errors[] is RANKED and TRUNCATED (max 12, each msg ≤ 200 chars). Fix the FIRST 1-3; many later ones cascade.\n' +
    '  - hint suggests an action ("missing import", "type mismatch", etc.). Honor it.\n' +
    '  - tail contains the last ~15 lines of stderr if no structured errors were parsed.\n\n' +
    'AUTO-DETECTION:\n' +
    '  - typecheck → detects pnpm/yarn/npm + tsc; supports `pkg` for monorepo filters (e.g. pkg:"@mini/server").\n' +
    '  - test → reads package.json and prefers vitest > jest > npm test.\n' +
    '  - lint → prefers eslint . if available.\n\n' +
    'DO NOT mark the user\'s task done until verify_changes returns ok:true OR you have explicitly told the user why verification was skipped.',
  // 跑命令本身是写副作用（compile cache 等），保守串行
  parallelSafe: false,
  schema: z.object({
    kind: z
      .enum(['typecheck', 'test', 'lint', 'exec'])
      .describe(
        'typecheck = tsc --noEmit (auto-detect monorepo); test = pnpm test / npm test; lint = eslint .; exec = run a custom command',
      ),
    /** kind=exec 时必填，其余可选（用来覆盖默认命令） */
    command: z.string().optional(),
    /** kind=typecheck/test 时可选：指定 workspace 子包 */
    pkg: z
      .string()
      .optional()
      .describe('Optional pnpm workspace filter, e.g. "@mini/server"'),
    /** 超时（毫秒），默认 120000 = 2min */
    timeoutMs: z.number().int().optional(),
  }),
  async execute(input, ctx) {
    const kind = (input as any).kind as 'typecheck' | 'test' | 'lint' | 'exec';
    const pkg = (input as any).pkg as string | undefined;
    const custom = (input as any).command as string | undefined;
    const timeoutMs = ((input as any).timeoutMs as number | undefined) ?? 120_000;
    const cmd = await resolveVerifyCommand(ctx.cwd, kind, custom, pkg);
    if (!cmd) {
      return {
        ok: false,
        skipped: true,
        reason: `Cannot determine command for kind=${kind} (no package.json / no script). Use kind:'exec' with explicit command.`,
      };
    }
    const t0 = Date.now();
    let stdout = '';
    let stderr = '';
    let exitCode: number | null = 0;
    try {
      const { exec: _exec } = await import('node:child_process');
      // 用 shell exec 而非 execFile 以便支持 "pnpm tsc -p X" 这类复合命令
      const result = await new Promise<{ stdout: string; stderr: string; code: number | null }>(
        (resolve) => {
          const p = _exec(
            cmd,
            { cwd: ctx.cwd, maxBuffer: 8 * 1024 * 1024, timeout: timeoutMs },
            (err: any, so: string, se: string) => {
              resolve({
                stdout: String(so ?? ''),
                stderr: String(se ?? ''),
                code: err ? (err.code as number) ?? 1 : 0,
              });
            },
          );
          // 兜底
          (p as any).on?.('error', () => undefined);
        },
      );
      stdout = result.stdout;
      stderr = result.stderr;
      exitCode = result.code;
    } catch (e: any) {
      return { ok: false, summary: `process error: ${e?.message ?? e}` };
    }
    const elapsed = Date.now() - t0;
    return summarizeVerify({ kind, cmd, exitCode, stdout, stderr, elapsed });
  },
};

/** 根据 kind 推断命令；找不到时返回 null */
async function resolveVerifyCommand(
  cwd: string,
  kind: 'typecheck' | 'test' | 'lint' | 'exec',
  custom: string | undefined,
  pkg: string | undefined,
): Promise<string | null> {
  if (kind === 'exec') return custom ?? null;
  const hasPnpm = await fileExists(path.join(cwd, 'pnpm-workspace.yaml'));
  const pkgFile = path.join(cwd, 'package.json');
  if (!(await fileExists(pkgFile))) return custom ?? null;
  const json = JSON.parse(await fs.readFile(pkgFile, 'utf-8'));
  const scripts: Record<string, string> = json.scripts ?? {};
  const filter = pkg ? `--filter ${pkg}` : '-r';
  if (kind === 'typecheck') {
    if (custom) return custom;
    if (scripts.typecheck) return hasPnpm ? `pnpm ${filter} typecheck` : 'npm run typecheck';
    return 'npx tsc --noEmit';
  }
  if (kind === 'test') {
    if (custom) return custom;
    if (scripts.test) return hasPnpm ? `pnpm ${filter} test` : 'npm test';
    return null;
  }
  if (kind === 'lint') {
    if (custom) return custom;
    if (scripts.lint) return hasPnpm ? `pnpm ${filter} lint` : 'npm run lint';
    return 'npx eslint .';
  }
  return null;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * 把 tsc/jest/vitest 的输出压成 LLM 友好的小 JSON。
 *
 * 提取规则（够通用）：
 *  - tsc:  "path(L,C): error TSxxxx: message"
 *  - jest: "FAIL  path"  + "  ● test > name"  + "    Error: ..."
 *  - eslint: "path\n  L:C  error  msg  rule-id"
 *  - 兜底：抓 stderr 最后 N 行
 */
function summarizeVerify(args: {
  kind: string;
  cmd: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  elapsed: number;
}) {
  const { kind, cmd, exitCode, stdout, stderr, elapsed } = args;
  const text = stdout + '\n' + stderr;
  const MAX_ERR = 12;
  const MAX_LINE = 200;

  let errors: { file?: string; line?: number; col?: number; message: string }[] = [];

  // 1. tsc pattern
  const tscRe = /(.+?)\((\d+),(\d+)\):\s*(error|warning)\s+(TS\d+):\s*(.+)/g;
  for (const m of text.matchAll(tscRe)) {
    errors.push({
      file: m[1],
      line: Number(m[2]),
      col: Number(m[3]),
      message: `${m[5]}: ${m[6]}`.slice(0, MAX_LINE),
    });
    if (errors.length >= MAX_ERR) break;
  }
  // 2. eslint pattern：path 单独一行，下面 "  L:C  error  msg  rule"
  if (errors.length === 0) {
    const lines = text.split('\n');
    let currentFile: string | undefined;
    for (const ln of lines) {
      const fileMatch = ln.match(/^([^\s].+\.\w+)$/);
      if (fileMatch) {
        currentFile = fileMatch[1];
        continue;
      }
      const ruleMatch = ln.match(/^\s+(\d+):(\d+)\s+(error|warning)\s+(.+?)\s+([\w/-]+)$/);
      if (ruleMatch && currentFile) {
        errors.push({
          file: currentFile,
          line: Number(ruleMatch[1]),
          col: Number(ruleMatch[2]),
          message: `${ruleMatch[4]} (${ruleMatch[5]})`.slice(0, MAX_LINE),
        });
        if (errors.length >= MAX_ERR) break;
      }
    }
  }
  // 3. 兜底：失败时取 stderr 最后 8 行
  if (errors.length === 0 && exitCode !== 0) {
    const tail = (stderr || stdout)
      .split('\n')
      .filter((l) => l.trim())
      .slice(-8);
    for (const ln of tail) errors.push({ message: ln.slice(0, MAX_LINE) });
  }

  const ok = exitCode === 0;
  // 给 LLM 一个 actionable hint
  let hint: string | undefined;
  if (!ok) {
    if (errors.find((e) => /Cannot find module|TS2307/.test(e.message))) {
      hint =
        'Module import error: check the path, file extension, and whether the dependency is installed.';
    } else if (errors.find((e) => /TS2304/.test(e.message))) {
      hint =
        'Undefined symbol: you probably need to add an import or define the variable before use.';
    } else if (errors.find((e) => /TS2345|TS2322/.test(e.message))) {
      hint =
        'Type mismatch: align argument/return types or add explicit casts. Re-read the function signature.';
    } else if (errors.length === 0) {
      hint =
        'Process exited non-zero but no structured errors were parsed. Inspect stderr manually with run_command or read the log.';
    } else {
      hint = `Fix the first ${Math.min(3, errors.length)} error(s); they often cascade.`;
    }
  }

  return {
    ok,
    kind,
    cmd,
    exitCode,
    elapsedMs: elapsed,
    summary: ok
      ? `OK (${kind}) in ${elapsed}ms`
      : `${errors.length}+ issue(s) (${kind}) — see errors[]`,
    errors: errors.slice(0, MAX_ERR),
    hint,
    // tail 给 LLM 看原始输出，但严格截断
    tail: ok ? undefined : (stderr || stdout).split('\n').slice(-15).join('\n').slice(-2000),
  };
}

/**
 * use_skill —— Progressive Disclosure 风格的 skill 加载工具
 *
 * Skill 在 system prompt 里只暴露 name + description（概要），
 * 这里把 SKILL.md 全文 + 支持文件清单注入回 tool result，
 * LLM 拿到详细指引后照执行。
 *
 * 设计：
 *  - 失败（skill 不存在）→ 返回 error 字符串而不是 throw，给 LLM 自我纠正空间
 *  - 返回 supportFiles 路径列表（不展开）— LLM 想看就用 read_file 拉
 *  - parallelSafe=true：只读 SKILL.md，可并发
 */
/**
 * think —— 让 Agent 显式做 scratchpad reasoning
 *
 * 业界 best practice（Anthropic 2024 Q4 blog "Improve agent performance with extended thinking"）：
 * 在工具结果返回后，Agent 经常需要"想一想"才能决定下一步。直接让它在 assistant text 里思考有两个问题：
 *   1. token 大量浪费在思考内容上，前端 chat bubble 也乱
 *   2. 一些模型（claude / gpt）的 tool_use 模式下，发了 tool_call 就不允许同步出长文本
 *
 * 加一个 `think` tool（no-op）让 Agent 主动"写下"思考过程：
 *   - 入参只有 thought 字符串
 *   - 返回 { ok: true } 立即结束
 *   - parallelSafe=true：不影响别的工具
 *   - 前端可以用折叠 UI 把 think 单独渲染（避免污染主对话流）
 *
 * 对比 update_plan：plan 是"我要做 1/2/3"，think 是"刚才看到 X，所以我决定 Y"。
 * 两者协同：read tool → think → update_plan → 执行。
 */
export const thinkTool: Tool = {
  name: 'think',
  description:
    'Write down your reasoning. This tool has NO side effects — it only records your thought into the trajectory so the UI can render it (often collapsed) and the model can use it as scratch space.\n\n' +
    'WHEN TO USE (high-leverage scenarios):\n' +
    '  - You just got an ambiguous tool result and need to decide which of several next steps to take.\n' +
    '  - You are about to make a non-trivial edit and want to lay out the approach in 3-5 sentences first.\n' +
    '  - You hit a tool failure and are about to retry: pause and think first about WHY it failed and what to change.\n' +
    '  - The system inserted a [loop-breaker] hint — think before continuing.\n' +
    'WHEN NOT TO USE:\n' +
    '  - For the FINAL answer to the user — output that as normal assistant text.\n' +
    '  - To stall or pad. Empty / vague thoughts ("let me think...") waste tokens.\n' +
    '  - Inside other tool arguments (do NOT do `read_file({ path: "hmm I think it might be ..." })`).\n\n' +
    'GUIDANCE: keep thoughts FOCUSED. Structure: (1) what I observed, (2) what it implies, (3) what I will do next. Aim for 3-8 sentences.',
  parallelSafe: true,
  schema: z.object({
    thought: z
      .string()
      .describe(
        'Your reasoning. Keep it focused: what you observed, what the implications are, what you will do next.',
      ),
  }),
  async execute(input) {
    const t = String((input as any).thought ?? '').slice(0, 4000);
    return { ok: true, thought: t };
  },
};

export const useSkillTool: Tool = {
  name: 'use_skill',
  description:
    'Load the FULL body of a named skill (a curated playbook for a recurring task type). The system prompt only lists skills by name + 1-line summary; this tool fetches the detailed instructions when one matches.\n\n' +
    'WHEN TO USE:\n' +
    '  - The user\'s request matches a skill listed in the system prompt (e.g. user asks "review my code" and a `code-review` skill exists).\n' +
    '  - You see a skill that promises to handle exactly this kind of task.\n' +
    'WHEN NOT TO USE:\n' +
    '  - To browse skills aimlessly — only load when one matches.\n' +
    '  - Skills already loaded earlier in this conversation — reuse the previously loaded content; do not re-fetch.\n\n' +
    'RETURNS:\n' +
    '  - content: the full SKILL.md body (instructions you should follow).\n' +
    '  - directory: absolute path to the skill folder.\n' +
    '  - supportFiles: list of additional reference files in the skill folder (read with read_file using `directory` + "/" + filename).\n\n' +
    'After loading, follow the skill\'s instructions as if they were extra system prompt for this turn.',
  parallelSafe: true,
  schema: z.object({
    name: z.string().describe('Exact skill name (case-sensitive) as shown in the system prompt'),
    reason: z.string().optional().describe('Why you need this skill; helps with logging.'),
  }),
  async execute(input, ctx) {
    const name = (input as any).name as string;
    if (!ctx.skills) {
      return {
        ok: false,
        error: 'Skills not configured on this server. Cannot load.',
      };
    }
    const full = await ctx.skills.loadFull(name);
    if (!full) {
      const available = ctx.skills.list().map((s) => s.name).slice(0, 20).join(', ');
      return {
        ok: false,
        error: `Skill "${name}" not found. Available: ${available || '(none)'}`,
      };
    }
    return {
      ok: true,
      name: full.name,
      description: full.description,
      directory: full.directory,
      supportFiles: full.supportFiles,
      content: full.body,
      hint:
        full.supportFiles.length > 0
          ? `This skill has ${full.supportFiles.length} support files in its directory; ` +
            'use read_file with the absolute path (directory + "/" + file) to load any you need.'
          : undefined,
    };
  },
};

/**
 * dispatch_subagent —— 启动一个独立 ReAct 循环跑子任务
 *
 * 跟父 Agent 的区别：
 *  - 独立 messages history（不污染父 context）
 *  - 独立 turn / session（jsonl 单独落盘，崩溃可见）
 *  - 不能再调 dispatch_subagent（防嵌套，server 注入时 depth+1 + 禁用）
 *  - 不能调 update_plan（plan 是父 agent 的）
 *
 * 返回 immediately，不阻塞父 turn。
 * 完成后通过 push announce 把结果作为 user message 注入父 session。
 *
 * 设计哲学（仿 CodeFlicker）：
 *  - 「单 Agent + 多 Worker」层级模式，不是 AutoGen 群聊
 *  - 信息单向：父 → 子（spawn prompt）+ 子 → 父（announce），无双向对话
 *  - 子 Agent 必须 stateless：无 memory_search / 无 sessions_list
 *  - Push not Poll：父 Agent 不查状态，等结果自动注入
 */
export const dispatchSubagentTool: Tool = {
  name: 'dispatch_subagent',
  description:
    'Spawn an independent sub-agent (its own ReAct loop, its own messages history, its own jsonl session) to handle a focused subtask. The sub-agent shares your tools (read/edit/grep) but cannot call dispatch_subagent or update_plan.\n\n' +
    'WHEN TO USE:\n' +
    '  - PARALLEL FAN-OUT: "add JSDoc to these 5 files" → dispatch 5 subagents, one per file. They run concurrently.\n' +
    '  - CONTEXT ISOLATION: a sub-task whose exploration would dump 50KB of file contents into your context. Dispatch a subagent so the noise stays in the child trajectory.\n' +
    '  - SPECIALIZED ROLE: use a project-defined subagent (.minicodeide/agents/<name>.md) for code review, test writing, etc.\n' +
    '    Pass the `role` field to activate a profile — the subagent gets a role-specific system prompt and a tailored tool set.\n' +
    '    Available roles: {roles}\n' +
    'WHEN NOT TO USE:\n' +
    '  - For trivial reads/edits — just do it inline; spawning is expensive (extra LLM call, context warm-up).\n' +
    '  - For tasks needing the parent\'s full context — the child starts blank.\n' +
    '  - In a child agent (already nested) — nesting beyond depth 2 is blocked.\n\n' +
    'PROTOCOL (PUSH, NOT POLL):\n' +
    '  - Returns IMMEDIATELY with { runId, childSessionId }. Do NOT wait, do NOT poll.\n' +
    '  - When the subagent finishes, the system pushes a synthetic user message to YOU containing its result: "[Subagent Completed] <label>\\n<result>".\n' +
    '  - Continue your work in the meantime. The result will arrive as a normal turn boundary.\n\n' +
    'TASK QUALITY:\n' +
    '  - The `task` field IS the subagent\'s user message. Make it self-contained: include file paths, success criteria, and any context the subagent needs (it cannot see your conversation).\n' +
    '  - Bad:  "review this"  — Good: "Review packages/core/src/agent/loop.ts for bugs in the retry logic. Output a list of issues with line numbers, no rewrites."\n' +
    '  - `label` (optional, short) is shown in the IDE\'s subagent panel to help the user track which child is which.',
  parallelSafe: false, // 串行 spawn，避免一次性触发 5 个 LLM 调用
  schema: z.object({
    task: z.string().describe('The focused task description sent to the sub-agent as user message'),
    label: z.string().optional().describe('Short label for tracking (e.g. "review-foo.ts")'),
    role: z.string().optional().describe('Role profile name from .minicodeide/agents/<name>.md — e.g. "code-reviewer", "test-writer", "debugger". If omitted, uses the default subagent prompt.'),
  }),
  async execute(input, ctx) {
    if (!ctx.dispatchSubagent) {
      return { ok: false, error: 'Subagent dispatch not available on this server' };
    }
    const depth = ctx.subagentDepth ?? 0;
    if (depth >= 2) {
      // hard cap：父 agent depth 0，子 agent depth 1，最多再叫一层 depth 2（已实质禁掉嵌套）
      // 这里其实子 agent 的 registry 已经不含本 tool，但 defense in depth
      return { ok: false, error: `Subagent nesting depth limit reached (${depth})` };
    }
    const { task, label, role } = input as { task: string; label?: string; role?: string };
    try {
      const r = await ctx.dispatchSubagent({ task, label, role });
      return {
        ok: true,
        runId: r.runId,
        childSessionId: r.childSessionId,
        note:
          'Sub-agent dispatched. Result will arrive as a "[Subagent Completed]" user message. ' +
          'Do not call list_sessions / sleep / poll. Continue with other work or wait.',
      };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? String(e) };
    }
  },
};

export function registerBuiltinTools(registry: import('./tool-registry.js').ToolRegistry) {
  registry
    .register(readFileTool)
    .register(writeFileTool)
    .register(editFileTool)
    .register(listFilesTool)
    .register(grepTool)
    .register(runCommandTool)
    .register(listBackgroundTasksTool)
    .register(getBackgroundResultTool)
    .register(cancelBackgroundTaskTool)
    .register(findSymbolTool)
    .register(findReferencesTool)
    .register(semanticSearchTool)
    .register(listFileSymbolsTool)
    .register(updatePlanTool)
    .register(verifyChangesTool)
    .register(useSkillTool)
    .register(thinkTool)
    .register(webFetchTool)
    .register(applyPatchTool)
    .register(gitStatusTool)
    .register(gitDiffTool)
    .register(gitLogTool)
    .register(gitBranchTool)
    .register(gitCommitTool)
    .register(dispatchSubagentTool)
    .register(readImageTool)
    .register(screenshotTool);
  return registry;
}
