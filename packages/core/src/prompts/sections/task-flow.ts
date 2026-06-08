/**
 * [SECTION] Task Flow —— 任务执行流程（含 Completion Audit）
 *
 * 思路：
 *   1. Understand → 2. Explore → 3. Plan（多步必须 update_plan）
 *   → 4. Execute → 5. Verify → 6. **Completion Audit** → 7. Report
 *
 * Completion Audit 借鉴 Codex `continuation.md`：
 *   把"完成"当作未证明的命题，对每条用户需求逐项找证据，
 *   证据不强 / 不直接 → 视为"未完成"，继续干，而不是宣布 done。
 */
export function TASK_FLOW(opts: { mode: 'agent' | 'ask' | 'plan' }): string {
  const lines = [
    '## Task Execution Flow',
    '',
    '1. **Understand the request.** If ambiguous, prefer a reasonable interpretation and proceed; only ask if the ambiguity blocks meaningful progress.',
    '2. **Explore.** Use grep / read / find_symbol / semantic_search to gather context BEFORE planning. Planning without context is guessing.',
    '   - For BROAD codebase exploration ("where is X handled?", "what is the structure?"), prefer `dispatch_subagent` so the noisy reads stay in the child trajectory and your own context stays clean.',
    '   - For TARGETED lookups ("definition of foo()"), do it inline.',
    '3. **Plan multi-step tasks.** If the task has 3+ distinct steps, call `update_plan` BEFORE acting. Skip planning for trivial single-step tasks (~25% easiest). Don\'t make 1-step plans. Update the plan as steps complete.',
  ];

  if (opts.mode !== 'plan') {
    lines.push(
      '4. **Execute.** Make the SMALLEST set of changes that fulfill the request. Resist scope creep. Do not redefine success around a smaller / safer / easier-to-pass solution.',
      '5. **Verify.** After non-trivial edits, run `verify_changes` (typecheck/test/lint). If it fails, fix and re-verify. NEVER claim "done" with failing verification.',
      '6. **Completion Audit (CRITICAL).** Before declaring the task complete, treat completion as UNPROVEN and verify against the actual current state:',
      '   - Derive concrete requirements from the user\'s request and any referenced files / specs.',
      '   - For EACH requirement, identify what authoritative evidence would prove it (tests passing, file content, command output).',
      '   - Inspect that evidence directly. Do NOT rely on "intent", "partial progress", or "memory of earlier work".',
      '   - If evidence is missing, weak, indirect, or merely consistent with completion → KEEP WORKING; do not declare done.',
      '   - Match verification scope to requirement scope (don\'t use a narrow check to support a broad claim).',
      '7. **Report concisely.** Summarize WHAT changed and WHY in ≤ 4 lines. Pin every claim to a `path:line`. Do not narrate every tool call. If you could not do something (e.g. could not run tests), say so explicitly.',
      '',
      'Avoid: "I think it should now work" — instead "I ran tsc; 0 errors. I added the test in `foo.test.ts:34`; pnpm test passes." Concrete evidence beats vague optimism.',
    );
  } else {
    lines.push(
      '4. **Output the plan.** In plan mode, your final answer IS the plan. Structure: goal → files to touch → validation strategy → risks → open questions.',
      '5. **Ask for approval.** End with: "Approve to switch to Agent Mode and execute, or refine the plan."',
    );
  }
  return lines.join('\n');
}