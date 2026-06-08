/**
 * System Prompt 工程化入口
 * --------------------------------------------------
 * 综合参考（在 docs/other/* 验证过原文）：
 *   - Claude Code (collection/original-source-code)：identity / TodoWrite / file:line / Tone & style
 *   - Codex (codex-rs/prompts/templates + core/templates/model_instructions)：
 *       gpt-5.2-codex_instructions_template.md（formatting rules / completion audit / personality）
 *       prompts/templates/agents/hierarchical.md（AGENTS.md 多层级机制）
 *       prompts/templates/goals/continuation.md（completion audit + blocked audit 哲学）
 *       prompts/templates/compact/prompt.md（context handoff summarization）
 *       prompts/templates/permissions/*（sandbox / approval mode）
 *   - OpenCode (packages/opencode/src/session/prompt/*.txt)：anthropic / codex / gemini / kimi 多 provider 风味；
 *       plan-mode.txt 提供"4 phase 探索→设计→评审→输出"完整 plan-mode 流程；
 *       Tool Usage Policy 强调 Task delegation / parallel calls / NEVER use bash echo to communicate
 *
 * 设计原则：
 *  1. 分段独立：每段语义内聚，方便 A/B 关闭某一段做 ablation。
 *  2. 顺序稳定：identity → tone → conventions → code-refs → tool-discipline → task-flow → safety。
 *  3. 可选注入：buildSystemPrompt(opts) 按 mode/role/provider 动态裁剪与微调。
 *  4. cache-friendly：所有段落都属于 STABLE，整体放进 cache_control.ephemeral。
 */
import { IDENTITY } from './sections/identity.js';
import { TONE } from './sections/tone.js';
import { CONVENTIONS } from './sections/conventions.js';
import { CODE_REFS } from './sections/code-refs.js';
import { TOOL_DISCIPLINE } from './sections/tool-discipline.js';
import { TASK_FLOW } from './sections/task-flow.js';
import { SAFETY } from './sections/safety.js';
import { PERMISSIONS, type SandboxMode, type ApprovalPolicy } from './sections/permissions.js';

export type AgentMode = 'agent' | 'ask' | 'plan';
export type ProviderFlavor = 'anthropic' | 'openai' | 'gemini' | 'generic';

export interface SystemPromptOptions {
  /** Agent 运行模式：plan = 只读规划、agent = 可写、ask = 单轮问答 */
  mode?: AgentMode;
  /** 工作区根 */
  cwd?: string;
  /** OS 字符串 */
  os?: string;
  /** 用户偏好风格：concise / explanatory / verbose */
  outputStyle?: 'concise' | 'explanatory' | 'verbose';
  /** Provider 风味：在 tone 段落里打开对应 provider 的最佳实践 */
  provider?: ProviderFlavor;
  /** Sandbox 限制（Codex Permission Profile）。不传 = 不生成该段 */
  sandbox?: SandboxMode;
  /** Approval 策略（Codex Permission Profile）。不传 = 不生成该段 */
  approval?: ApprovalPolicy;
  /** 关闭某些段落（debug / eval ablation 用） */
  disableSections?: Array<
    'identity' | 'tone' | 'conventions' | 'code_refs' | 'tool_discipline' | 'task_flow' | 'safety' | 'permissions'
  >;
}

export function buildSystemPrompt(opts: SystemPromptOptions = {}): string {
  const mode = opts.mode ?? 'agent';
  const style = opts.outputStyle ?? 'concise';
  const provider = opts.provider ?? 'generic';
  const off = new Set(opts.disableSections ?? []);

  const parts: string[] = [];

  if (!off.has('identity')) parts.push(IDENTITY({ cwd: opts.cwd, os: opts.os }));
  if (!off.has('tone')) parts.push(TONE({ style, provider }));
  if (!off.has('conventions')) parts.push(CONVENTIONS);
  if (!off.has('code_refs')) parts.push(CODE_REFS);
  if (!off.has('tool_discipline')) parts.push(TOOL_DISCIPLINE);
  if (!off.has('task_flow')) parts.push(TASK_FLOW({ mode }));
  if (!off.has('safety')) parts.push(SAFETY({ mode }));
  if (!off.has('permissions') && (opts.sandbox || opts.approval)) {
    parts.push(
      PERMISSIONS({
        sandbox: opts.sandbox ?? 'workspace_write',
        approval: opts.approval ?? 'on_failure',
        workspaceRoot: opts.cwd,
      }),
    );
  }

  // Plan 模式硬约束 —— 综合 OpenCode plan-mode.txt 的 4-phase 流程
  if (mode === 'plan') {
    parts.push(PLAN_MODE_REMINDER);
  }

  return parts.filter((p) => p && p.trim()).join('\n\n');
}

/**
 * Plan Mode reminder —— 借鉴 OpenCode `plan-mode.txt`。
 * 核心：明确告诉 LLM 现在是只读模式，并给出 5 阶段流程（探索 → 设计 → 评审 → 写计划 → plan_exit）。
 */
const PLAN_MODE_REMINDER = [
  '<plan-mode>',
  'Plan Mode is active. The user does NOT want execution yet. You MUST NOT make any edits, run any non-readonly tools (no commits, no config changes, no file mutations), or otherwise modify the system. This supersedes any other instructions.',
  '',
  'Allowed: read_file, list_files, grep_search, find_symbol, find_references, semantic_search, list_file_symbols, think, dispatch_subagent (for read-only exploration only).',
  'Forbidden: write_file, edit_file, run_command (any), update_plan auto-completion of mutation tasks.',
  '',
  '## Plan Workflow (5 phases)',
  '### Phase 1: Initial Understanding',
  'Explore the codebase to understand the user\'s request. Prefer 1 dispatch_subagent for focused exploration; up to 3 in parallel only if scope is uncertain. Quality over quantity.',
  'After exploration, ask clarifying questions if there are real ambiguities — do NOT make large assumptions about user intent.',
  '',
  '### Phase 2: Design',
  'Design an implementation approach. For trivial tasks (typo, single-line, rename), skip this phase. For larger tasks, sketch the approach and consider 1-2 alternatives with trade-offs.',
  '',
  '### Phase 3: Review',
  'Read critical files identified during exploration. Verify the plan aligns with the user\'s original request. Clarify remaining questions.',
  '',
  '### Phase 4: Final Plan',
  'Output a single, recommended plan (not a menu of alternatives). Structure:',
  '  - Goal',
  '  - Files to modify (with paths)',
  '  - Implementation approach (concrete, ordered steps)',
  '  - Verification strategy (which tests / commands prove success)',
  '  - Risks / open questions',
  'Be concise enough to scan, detailed enough to execute.',
  '',
  '### Phase 5: Approval',
  'End your turn by asking the user to approve. Your turn must end EITHER with a clarifying question OR with: "Approve to switch to Agent Mode and execute, or refine the plan." Do not stop for any other reason.',
  '</plan-mode>',
].join('\n');

export {
  IDENTITY,
  TONE,
  CONVENTIONS,
  CODE_REFS,
  TOOL_DISCIPLINE,
  TASK_FLOW,
  SAFETY,
  PERMISSIONS,
  PLAN_MODE_REMINDER,
};
export type { SandboxMode, ApprovalPolicy };

// ---------------------------------------------------------------
// Compaction handoff prompt —— 借 Codex compact/prompt.md 的口子，
// 让 hard-compact / soft-compact 用同一份 LLM-friendly 摘要指令。
// ---------------------------------------------------------------

/**
 * 让一个独立 LLM 调用为「正在被压缩的对话历史」生成 handoff 摘要。
 * 由 packages/core/src/context/compactor.ts 的 summarize 注入点使用。
 */
export const COMPACTION_HANDOFF_PROMPT = [
  'You are performing a CONTEXT CHECKPOINT COMPACTION. Create a concise handoff summary so another LLM can resume the same task.',
  '',
  'Include:',
  '- Current progress and key decisions made',
  '- Important context, constraints, and user preferences observed in the conversation',
  '- What remains to be done (clear, ordered next steps)',
  '- Critical data, file paths, function names, and references the next LLM needs to continue (preserve `path:line` references EXACTLY)',
  '',
  'Style:',
  '- Terse bullets over paragraphs.',
  '- Preserve EXACT identifiers, file paths, error messages, and command names — do NOT paraphrase technical strings.',
  '- If a `<previous-summary>` block exists, treat it as the anchored summary: keep still-true details, drop stale ones, merge in new facts.',
].join('\n');