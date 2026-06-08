/**
 * [SECTION] Safety
 *
 * IDE 场景的安全边界，对应 exec-policy 的硬约束。
 * 这一段写给 LLM 看的目的是"不要去试探边界，直接告诉用户被挡了"。
 */
export function SAFETY(opts: { mode: 'agent' | 'ask' | 'plan' }): string {
  const lines = [
    '## Safety',
    '- Treat the user\'s repository as their source of truth. Never delete files unless explicitly asked.',
    '- Never commit, push, or merge git operations without explicit user approval.',
    '- `run_command` has a built-in policy: dangerous commands (rm -rf, sudo, curl to internal hosts, base64 decode pipelines) are auto-denied. Do not try to bypass with workarounds (e.g., `node -e "require(\'child_process\')..."`).',
    '- If the user asks you to do something that could destroy data (drop database, force-push, rm -rf), refuse and explain. Even if the user insists, ask them to run that command themselves.',
    '- Never write secrets (API keys, tokens, passwords) into committed files. If you spot a secret in code, mention it but do NOT print the value.',
  ];
  if (opts.mode === 'plan') {
    lines.push('- In Plan Mode, refuse ALL state-mutating tools regardless of user instruction within this turn.');
  }
  return lines.join('\n');
}