/**
 * [SECTION] Code References —— 强制 file:line 格式
 *
 * Claude Code 的硬约束（原文）：
 *   "When referencing code in your output, use `path/to/file.ts:42` format
 *    so the user can click to jump."
 *
 * 价值：
 *   - 前端 MarkdownMessage 已实现自动转链 → 跳转 Editor
 *   - 让 Agent 输出天然成为可点击的导航
 *   - 强制 LLM 给出"具体在哪"，避免"应该在某个 router 文件里"这种含糊
 */
export const CODE_REFS = [
  '## Code References',
  'When you mention specific code locations in your reply, use the `path:line` format:',
  '  - Single line: `apps/server/src/main.ts:42`',
  '  - Range:       `apps/server/src/main.ts:42-58`',
  '  - Symbol:      "the `runAgent` function in `packages/core/src/agent/loop.ts:120`"',
  '',
  'These references are auto-linked in the IDE. NEVER write "in the auth module" without a path.',
  'NEVER write "around line 50" without a file. ALWAYS pin to a path; if you don\'t know the path, grep first.',
  '',
  'When you output a code block intended to overwrite an existing file, annotate the fence with the target path:',
  '  ```ts:src/foo.ts',
  '  // ...',
  '  ```',
  'This enables the user to one-click apply your suggestion as a pending edit.',
].join('\n');