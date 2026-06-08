/**
 * apply_patch — Codex 风格 unified diff 工具
 *
 * 让 LLM 用 git-style diff 一次应用多文件改动，比反复 edit_file token 消耗低得多。
 *
 * 输入格式 (unified diff 子集，宽松解析):
 *
 *   --- a/path/to/file.ts
 *   +++ b/path/to/file.ts
 *   @@ -10,3 +10,4 @@ optional context
 *    -old line A
 *    +new line B
 *     unchanged context
 *
 * 支持:
 *  - 多 hunk 多文件
 *  - 新建文件 (--- /dev/null)
 *  - 删除文件 (+++ /dev/null)
 *  - 二次模糊匹配 (与 edit_file 一致: exact → trim → whitespace-collapse)
 *
 * 不支持 (保守起见):
 *  - 重命名 (git rename detection), 需要 LLM 自己做 delete + create
 *  - 二进制 diff
 *
 * 设计:
 *  - 全部走 ctx.proposeEdit(如有), 保证用户在 IDE 里能审 diff
 *  - parallelSafe=false: 写类工具
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { Tool } from './tool-registry.js';

/**
 * 单个 hunk 结构，对应 diff 中的 @@ ... @@ 块
 */
interface Hunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[]; // 原始行（含前缀 ' ' / '-' / '+'）
}

/**
 * 单个文件的 diff 补丁结构
 */
interface FilePatch {
  oldPath: string | null; // null = 新建文件
  newPath: string | null; // null = 删除文件
  hunks: Hunk[];
}

/**
 * 解析 unified diff 字符串为 FilePatch 数组
 * @param patch 原始 diff 字符串
 * @returns 解析后的文件补丁列表
 */
function parsePatch(patch: string): FilePatch[] {
  const lines = patch.split(/\r?\n/);
  const files: FilePatch[] = [];
  let cur: FilePatch | null = null;
  let curHunk: Hunk | null = null;

  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];

    // --- 开头表示新文件的旧路径
    if (ln.startsWith('--- ')) {
      // 保存上一个文件的 hunk
      if (cur && curHunk) cur.hunks.push(curHunk);
      if (cur) files.push(cur);

      const oldPath = ln.slice(4).trim();
      cur = {
        oldPath: oldPath === '/dev/null' ? null : oldPath.replace(/^a\//, ''),
        newPath: null,
        hunks: [],
      };
      curHunk = null;
      continue;
    }

    // +++ 开头表示新文件的新路径
    if (ln.startsWith('+++ ') && cur) {
      const newPath = ln.slice(4).trim();
      cur.newPath = newPath === '/dev/null' ? null : newPath.replace(/^b\//, '');
      continue;
    }

    // @@ 开头表示 hunk 的位置信息
    if (ln.startsWith('@@ ') && cur) {
      if (curHunk) cur.hunks.push(curHunk);
      // 解析 @@ -oldStart,oldLines +newStart,newLines @@
      const m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(ln);
      if (!m) continue;

      curHunk = {
        oldStart: Number(m[1]),
        oldLines: Number(m[2] ?? '1'),
        newStart: Number(m[3]),
        newLines: Number(m[4] ?? '1'),
        lines: [],
      };
      continue;
    }

    // 收集 hunk 中的行（空格、-、+ 开头）
    if (curHunk && (ln.startsWith(' ') || ln.startsWith('+') || ln.startsWith('-'))) {
      curHunk.lines.push(ln);
      continue;
    }

    // 其他行（diff header、diff --git 等）忽略
  }

  // 保存最后一个文件和 hunk
  if (cur && curHunk) cur.hunks.push(curHunk);
  if (cur) files.push(cur);

  return files;
}

/**
 * 把 hunk 应用到 source 内容上，返回新内容
 * @param source 原始文件内容
 * @param hunk 要应用的 hunk
 * @returns 成功时返回 { ok: true, result: 新内容 }, 失败时返回 { ok: false, error: 错误信息 }
 */
function applyHunk(source: string, hunk: Hunk): { ok: true; result: string } | { ok: false; error: string } {
  const srcLines = source.split('\n');
  const oldBlock: string[] = [];
  const newBlock: string[] = [];

  // 拆分 hunk 中的旧行和新行
  for (const ln of hunk.lines) {
    const tag = ln[0];
    const body = ln.slice(1);
    if (tag === ' ' || tag === '-') oldBlock.push(body);
    if (tag === ' ' || tag === '+') newBlock.push(body);
  }

  // 1. 精确匹配：从 hunk 声明的 oldStart-1 行开始找
  const start = Math.max(0, hunk.oldStart - 1);
  const matchExact = (idx: number) => {
    for (let i = 0; i < oldBlock.length; i++) {
      if (srcLines[idx + i] !== oldBlock[i]) return false;
    }
    return true;
  };

  let foundIdx = -1;
  if (matchExact(start)) {
    foundIdx = start;
  } else {
    // 2. ±10 行模糊匹配（行号漂移）
    for (let d = 1; d <= 10 && foundIdx < 0; d++) {
      if (start - d >= 0 && matchExact(start - d)) foundIdx = start - d;
      else if (start + d < srcLines.length && matchExact(start + d)) foundIdx = start + d;
    }
  }

  if (foundIdx < 0) {
    // 3. 回退到 trim 模糊匹配（忽略前后空格）
    const trimmedOld = oldBlock.map(s => s.trim());
    outer: for (let i = 0; i + oldBlock.length <= srcLines.length; i++) {
      let ok = true;
      for (let j = 0; j < oldBlock.length; j++) {
        if (srcLines[i + j].trim() !== trimmedOld[j]) {
          ok = false;
          break;
        }
      }
      if (ok) {
        foundIdx = i;
        break outer;
      }
    }
  }

  if (foundIdx < 0) {
    return {
      ok: false,
      error: `Hunk @@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@ failed: context not found`,
    };
  }

  // 替换旧块为新块
  const out = [
    ...srcLines.slice(0, foundIdx),
    ...newBlock,
    ...srcLines.slice(foundIdx + oldBlock.length),
  ];

  return { ok: true, result: out.join('\n') };
}

/**
 * 解析路径，确保不超出工作区根目录
 * @param cwd 当前工作目录
 * @param p 目标路径
 * @returns 解析后的绝对路径
 */
function resolveInside(cwd: string, p: string): string {
  const abs = path.resolve(cwd, p);
  if (!abs.startsWith(path.resolve(cwd))) {
    throw new Error('Path escapes workspace');
  }
  return abs;
}

/**
 * apply_patch 工具定义
 */
export const applyPatchTool: Tool = {
  name: 'apply_patch',
  description:
    `Apply a unified-diff patch (git-style) to one or more files in the workspace. Atomic per-file: all hunks of a file apply or none do. Supports new files (--- /dev/null), deleted files (+++ /dev/null), and multi-file patches.\n\n

WHEN TO USE:
- Multi-file refactor (3+ files changing together): one apply_patch is far cheaper in tokens than N edit_file calls.
- Renaming a symbol across the project after find_references.
- Replacing a known-good diff (e.g., from a previous tool result, a git log, or the user pastes one).
- Small single edit – use edit_file (smaller surface area, easier on retry).
- Auto-generated files where exact line numbers are unstable – use write_file with full content.

PATCH FORMAT (relaxed unified-diff):
--- a/path/to/file.ts
+++ b/path/to/file.ts
@@ -10,3 +10,4 @@
-old line A
+new line B
 unchanged context

BEHAVIOR:
- "All or nothing": if any hunk fails to find its context, the WHOLE file is rolled back.
- Diff tolerance: each hunk first tries exact match at its declared line, then ±10 line search, then trim-equality fallback.
- Returns what you propose: { path, ok, action: "created"|"deleted"|"failed", error: } so you can retry only the failed files.
- All writes go through proposeEdit (user sees a Diff tab in the IDE before accept).`,
  parallelSafe: false,
  schema: z.object({
    patch: z.string().describe('The unified-diff patch text (one or more files).'),
  }),

  async execute(input, ctx) {
    const { patch } = input as { patch: string };
    let parsed: FilePatch[];

    try {
      parsed = parsePatch(patch);
    } catch (e: any) {
      return { ok: false, error: `parse error: ${e?.message ?? String(e)}` };
    }

    if (!parsed.length) {
      return { ok: false, error: 'No file diffs found in patch (need at least one --- / +++ pair).' };
    }

    const results: Array<{ path: string; ok: boolean; action: string; error?: string }> = [];

    for (const fp of parsed) {
      const targetPath = fp.newPath ?? fp.oldPath;
      if (!targetPath) {
        results.push({ path: '<unknown>', ok: false, action: 'failed', error: 'no path in diff header' });
        continue;
      }

      try {
        const abs = resolveInside(ctx.cwd, targetPath);

        // 删除文件
        if (fp.newPath === null && fp.oldPath) {
          // 通过 proposeEdit 不太自然（删除没有 newContent），这里直接 fs.unlink
          try {
            await fs.unlink(abs);
            results.push({ path: targetPath, ok: true, action: 'deleted' });
          } catch (e: any) {
            results.push({ path: targetPath, ok: false, action: 'failed', error: `unlink: ${e.message}` });
          }
          continue;
        }

        // 新建或修改文件
        let source = '';
        let isNew = false;

        if (fp.oldPath === null) {
          // 新建文件
          isNew = true;
        } else {
          try {
            source = await fs.readFile(abs, 'utf8');
          } catch {
            // 文件不存在，当作新建
            isNew = true;
          }
        }

        // 顺序应用所有 hunk
        let cur = source;
        let failed: string | null = null;
        for (const h of fp.hunks) {
          const r = applyHunk(cur, h);
          if (!r.ok) {
            failed = r.error;
            break;
          }
          cur = r.result;
        }

        if (failed) {
          results.push({ path: targetPath, ok: false, action: 'failed', error: failed });
          continue;
        }

        // 落盘：优先用 proposeEdit（让用户审 diff）
        if (ctx.proposeEdit) {
          await ctx.proposeEdit({ path: targetPath, newContent: cur, tool: 'apply_patch' });
        } else {
          await fs.mkdir(path.dirname(abs), { recursive: true });
          await fs.writeFile(abs, cur, 'utf8');
        }

        results.push({ path: targetPath, ok: true, action: isNew ? 'created' : 'modified' });
      } catch (e: any) {
        results.push({ path: targetPath, ok: false, action: 'failed', error: e.message ?? String(e) });
      }
    }

    const okCount = results.filter(r => r.ok).length;
    return {
      ok: okCount > 0,
      results,
      summary: `${okCount}/${results.length} file(s) applied`,
      hint: okCount < results.length
        ? 'Some files failed. Read them with read_file to see current content, then retry only the failed hunks with corrected line numbers / context.'
        : undefined,
    };
  },
};