/**
 * [SECTION] Permissions Profile —— Sandbox × Approval 矩阵
 *
 * 借鉴 Codex `prompts/src/permissions_instructions.rs`：
 *   把"shell 权限边界"做成 SandboxMode × AskForApproval 二维矩阵，
 *   按当前会话的实际配置动态生成一段 system prompt，
 *   让 LLM 明确知道"我现在能干什么、不能干什么、需要时怎么 escalate"。
 *
 * 价值：
 *   - 减少"试探性写盘"（LLM 知道 plan-mode 拒写 → 直接走规划）
 *   - 减少"试探性 sudo"（LLM 知道 deny → 不浪费一轮）
 *   - approval ask 频率可调（never/onFailure/granular），匹配用户偏好
 */

export type SandboxMode = 'read_only' | 'workspace_write' | 'danger_full_access';
export type ApprovalPolicy = 'never' | 'unless_trusted' | 'on_failure' | 'on_request' | 'granular';

export function PERMISSIONS(opts: {
  sandbox: SandboxMode;
  approval: ApprovalPolicy;
  /** workspace 根（用来在 prompt 里写"workspace_write 允许写 X 但不写 X 之外"） */
  workspaceRoot?: string;
}): string {
  const lines: string[] = ['## Sandbox & Approval Profile'];

  // —— Sandbox 段 ——
  switch (opts.sandbox) {
    case 'read_only':
      lines.push(
        '**Sandbox: read_only.**',
        '- You CANNOT write files, run commands that mutate FS, or open network. Tools `write_file` / `edit_file` will be rejected.',
        '- `run_command` is restricted to read-class commands (`ls`, `cat`, `grep`, `git status`, `git log`, `git diff`). Anything that mutates is denied.',
        '- If the user\'s task requires writes, propose the changes in your reply (as a plan or as code blocks) and ask the user to switch to a writable mode.',
      );
      break;
    case 'workspace_write':
      lines.push(
        `**Sandbox: workspace_write.**${opts.workspaceRoot ? ` Root: \`${opts.workspaceRoot}\`.` : ''}`,
        '- You may write files INSIDE the workspace. Writes outside the workspace (e.g. `/tmp`, `~/.ssh`, system paths) are denied.',
        '- `run_command` allowed for project-local commands: tests, builds, lints, typecheckers, `git` (read + local commits, but NOT `push`), `pnpm`/`npm`/`yarn`/`pip`.',
        '- Network access is restricted to **package registries** and explicitly allowed hosts. Random `curl`/`wget` to arbitrary URLs is denied or requires approval.',
      );
      break;
    case 'danger_full_access':
      lines.push(
        '**Sandbox: danger_full_access.** No FS or command sandboxing. The user has accepted that you can do anything the OS allows.',
        '- Even so: do NOT run destructive commands (`rm -rf /`, `git push --force`, `sudo`) without first explaining what and why.',
        '- Treat this as "the user is YOLO; you must be MORE careful, not less".',
      );
      break;
  }

  // —— Approval 段 ——
  lines.push('');
  switch (opts.approval) {
    case 'never':
      lines.push(
        '**Approval: never.** Do not call any tool that requires approval. If a `run_command` would be classified as ASK by exec policy, treat it as denied — do NOT attempt; explain to the user what you would have done and ask them to grant permission or run it themselves.',
      );
      break;
    case 'unless_trusted':
      lines.push(
        '**Approval: unless_trusted.** Pre-allowed safe commands (read-only, well-known package commands) run silently. Anything else (including unfamiliar commands) prompts the user. If a prompt is denied, do NOT retry the same command in the same session.',
      );
      break;
    case 'on_failure':
      lines.push(
        '**Approval: on_failure.** Commands run in the sandbox first. If they fail due to sandbox restrictions, the system asks the user before retrying with elevated privilege. This means: try the simplest sandboxed approach first; do not preemptively ask for elevation.',
      );
      break;
    case 'on_request':
      lines.push(
        '**Approval: on_request.** Commands run unattended unless YOU explicitly request approval (e.g. for destructive ops, large-scope refactors, or anything you want a second opinion on). Use this judiciously — every approval is a context-switch for the user.',
      );
      break;
    case 'granular':
      lines.push(
        '**Approval: granular.** Each non-trivial command requires explicit approval. Batch your asks: if you need to run 3 related commands, propose all 3 in one message and ask the user to approve the bundle, rather than asking 3 times.',
      );
      break;
  }

  // —— Escalation 通用建议 ——
  lines.push(
    '',
    '**Escalation discipline:**',
    '- When you need elevated permission, EXPLAIN WHY in plain English first ("I need to install foo because the failing test depends on it"), THEN propose the command. Do not ask for approval without context.',
    '- If a command is denied, treat the denial as informative ("the user does not want this approach") — pivot to an alternative, do not retry the same command.',
    '- If you genuinely cannot proceed without elevated permission and none is granted, explicitly tell the user: "I need X to continue. Without it, the next step is blocked."',
  );

  return lines.join('\n');
}