/**
 * 检测用户消息是否暗示多步骤/多文件操作。
 * 如果是，返回一段提示文本，引导 Agent 先 update_plan 再逐步执行。
 * 返回 null 表示无多步暗示。
 */
export function detectMultiStepHint(userMessage: string): string | null {
  const patterns = [
    /\b(all|every|each)\b.*\b(file|function|class|method)\b/i,
    /(\d+[.)]\s+.+){2,}/,           // "1. xxx  2. xxx"
    /\b(then|and then|after that|next)\b/i,
    /先.{2,20}再.{2,20}/,           // 先…再…
    /分别|并行|同时|批量|全部|所有/,
    /parallel|simultaneously/i,
  ];
  const isMultiStep = patterns.some((p) => p.test(userMessage));
  // 文件路径数量（出现 3+ 个 .ext 形式的文件引用）
  const pathMatches = userMessage.match(/\b[\w\/.-]+\.\w{1,6}\b/g) ?? [];
  const uniquePaths = new Set(pathMatches);
  const hasMultiFile = uniquePaths.size >= 3;

  if (!isMultiStep && !hasMultiFile) return null;

  return (
    '\n[context] This user message appears to involve multiple steps or files. ' +
    'IMPORTANT: Before executing, call `update_plan` to list all steps with status=pending, ' +
    'set the first step to in_progress, then execute. ' +
    'Update after each step. This improves transparency and prevents drift.'
  );
}
