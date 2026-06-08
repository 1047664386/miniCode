
/**
 * LLM Judge —— 用 LLM 评估 case 的语义结果是否符合预期
 * ----------------------------------------------------------------
 * 调用方式：
 *   const r = await llmJudge({
 *     question: 'agent 的最终回答是否准确解释了 sum 函数的 bug？',
 *     answer: '<agent final answer>',
 *     context: { codeSnippet, expectedConcepts: [...] },
 *   });
 *   // → { pass: bool, score: 0-10, reasoning: string }
 *
 * 设计要点：
 *  1. judge 用一个独立 model（默认 gpt-4o-mini / claude-haiku）—— 跟被测 agent 模型解耦
 *  2. 用 callStructured 拿稳定 JSON 输出（避免老的 regex 抠取问题）
 *  3. pass 判定阈值默认 score >= 7
 *  4. 失败时 reasoning 字段写明扣分点，方便人复盘
 *
 * judge 走的是 server 暴露的 /api/judge 端点（让 server 复用已配置的 LLM provider），
 * 这样不需要 evals 进程自己加 provider 配置。
 */
import { z } from 'zod';

export const JudgeOutputSchema = z.object({
  score: z.number().min(0).max(10).describe('0=完全不符合, 10=完全符合预期'),
  pass: z.boolean().describe('判定是否通过，通常等价于 score>=7'),
  reasoning: z.string().min(1).describe('简短的判定理由（< 200 字），失败时务必给出扣分点'),
  missing: z.array(z.string()).optional().describe('如果有期望但缺失的要点，列出来'),
});
export type JudgeOutput = z.infer<typeof JudgeOutputSchema>;

export interface JudgeRequest {
  /** 评估目标问题，例如 "回答是否准确解释了 bug" */
  question: string;
  /** 被评估的回答（Agent 的 final answer） */
  answer: string;
  /** 期望覆盖的概念/关键点 */
  expectedConcepts?: string[];
  /** 额外上下文（代码片段、参考答案） */
  context?: string;
  /** 通过阈值，默认 7 */
  passThreshold?: number;
}

/**
 * 调用 server 的 judge 端点。
 * server 端实现见 main.ts /api/judge。
 */
export async function callJudge(
  serverUrl: string,
  req: JudgeRequest,
): Promise<JudgeOutput> {
  const r = await fetch(`${serverUrl}/api/judge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!r.ok) {
    throw new Error(`judge HTTP ${r.status}: ${await r.text().catch(() => '')}`);
  }
  const data = (await r.json()) as JudgeOutput | { error: string };
  if ('error' in data) throw new Error(`judge error: ${data.error}`);
  return data;
}

/** 给 judge 用的 prompt 模板（server 端会包成 messages） */
export function buildJudgePrompt(req: JudgeRequest): { system: string; user: string } {
  const system =
    'You are a strict but fair evaluator of code-assistant outputs. ' +
    'Score from 0 to 10 based on how well the answer addresses the question. ' +
    'Do NOT reward fluff or hedging. Do NOT reward correct-but-irrelevant content. ' +
    'Score >= 7 means the answer is acceptable for production use.';
  const concepts = req.expectedConcepts?.length
    ? `\n\nExpected concepts to cover (each missing concept reduces score):\n${req.expectedConcepts
        .map((c) => '  - ' + c)
        .join('\n')}`
    : '';
  const context = req.context ? `\n\nReference context:\n${req.context}` : '';
  const user =
    `Question: ${req.question}\n\n` +
    `Answer to evaluate:\n"""\n${req.answer.trim() || '(empty)'}\n"""` +
    concepts +
    context;
  return { system, user };
}