/**
 * Auto-Memory —— turn 结束后自动从对话里抽取 "值得长期记住的事"
 * ---------------------------------------------------------------
 * 设计：
 *  - 在每个 turn 结束后调用 considerAutoMemory()
 *  - 让 LLM 判断这轮里用户是否表达了：偏好（preference）/ 项目知识（project_knowledge）/ 经验（experience）
 *  - 是 → 输出严格 JSON 的 memory 条目列表 → 调 memory.upsert 写入 'auto' source
 *  - 否 → 返回空数组，零 token 消耗（用 fast 模型 + 紧凑 prompt 控制成本）
 *
 * 设计取舍：
 *  - 不每轮都跑：要满足触发条件（用户消息含偏好信号词 / 长度足够 / 距离上次 > N 轮）
 *  - 写入 importance 默认 = 4（auto 来源比默认 user 略高一点，因为是 LLM 判定的）
 *  - 全程 best-effort：失败不影响主流程
 *  - 限流：单 session 最多每 5 turn 跑一次（避免连续短消息触发）
 */
import type { LLMProvider } from '../llm/types.js';
import { callStructured } from '../llm/structured.js';
import { z } from 'zod';
import type { MemoryStore, MemoryCategory } from './store.js';

export interface AutoMemoryContext {
  llm: LLMProvider;
  memory: MemoryStore;
  /** 本 turn 的用户消息 */
  userMessage: string;
  /** 本 turn assistant 最终的可见回复（不含 tool_calls 内部细节） */
  assistantReply: string;
  /** 用于限流的 session id */
  sessionId?: string;
  /** 用于推断 fast 模型名（可选） */
  model?: string;
  /** 上层日志/sse hook */
  onSaved?: (item: { title: string; category: MemoryCategory; scope: 'user' | 'project' }) => void;
  /** workspace 路径 → project_knowledge 类型自动归到 'project' scope */
  workspace?: string;
}

const lastRunBySession = new Map<string, number>();
const MIN_TURNS_BETWEEN_RUNS = 5;
const MIN_USER_LEN = 20;

/**
 * 简易触发判定：用户消息里含明确的偏好/约束/事实陈述关键词 → 才跑。
 * 这样 80% 普通 "帮我修 bug" 的请求不会触发，省成本。
 */
function shouldRun(userMessage: string): boolean {
  if (userMessage.length < MIN_USER_LEN) return false;
  const signals = [
    /\b(prefer|like|don'?t like|hate|always|never|please|stop|remember|note that)\b/i,
    /我(希望|喜欢|不喜欢|讨厌|总是|从不|不要|要求|偏好|习惯)/,
    /(以后|今后|下次|always|永远|每次|每个|all|every)/i,
    /\b(rule|convention|standard|coding style)\b/i,
    /(规范|约定|惯例|风格|要求|强制)/,
    /\b(use|don'?t use|switch to)\b.*\b(library|framework|tool|version)\b/i,
    /(用|不用|改用|换成).*(库|框架|版本|工具|API)/,
    /\b(deprecated|legacy|migrate|deprecat)/i,
  ];
  return signals.some((re) => re.test(userMessage));
}

/**
 * 计数器递增，决定是否该跑：每 N 个 turn 至多 1 次
 */
function rateLimitOk(sessionId: string | undefined): boolean {
  if (!sessionId) return true;
  const last = lastRunBySession.get(sessionId) ?? 0;
  return Date.now() - last > MIN_TURNS_BETWEEN_RUNS * 1000;
  // 用秒级粗粒度即可（一个 turn 通常 > 5s）
}

/**
 * 主入口：决定是否运行 + 调用 LLM + 解析 + 写入。
 * best-effort：所有错误吞掉返回空数组。
 */
export async function considerAutoMemory(ctx: AutoMemoryContext): Promise<number> {
  try {
    if (!shouldRun(ctx.userMessage)) return 0;
    if (!rateLimitOk(ctx.sessionId)) return 0;
    if (ctx.sessionId) lastRunBySession.set(ctx.sessionId, Date.now());

    const items = await extractMemoriesViaLLM(ctx);
    if (!items.length) return 0;

    let saved = 0;
    for (const it of items) {
      // 项目知识 → project scope；偏好/经验 → user scope
      const scope: 'user' | 'project' = it.category === 'project_knowledge' ? 'project' : 'user';
      try {
        await ctx.memory.upsert(scope, {
          title: it.title.slice(0, 100),
          content: it.content.slice(0, 1000),
          category: it.category,
          keywords: (it.keywords ?? []).slice(0, 8),
          importance: Math.max(1, Math.min(5, it.importance ?? 4)),
          source: 'auto',
        });
        saved++;
        ctx.onSaved?.({ title: it.title, category: it.category, scope });
      } catch {
        /* ignore single failure */
      }
    }
    return saved;
  } catch {
    return 0;
  }
}

interface AutoMemoryItem {
  title: string;
  content: string;
  category: MemoryCategory;
  keywords?: string[];
  importance?: number;
}

/**
 * 严格 schema：让 LLM 输出我们要的形状，少量字段必填。
 * 注意：category 用 enum 限定四个值，避免 LLM 自创类目。
 */
const AutoMemorySchema = z.object({
  items: z.array(
    z.object({
      title: z.string().min(1).max(120),
      content: z.string().min(1).max(1200),
      category: z.enum(['user_preference', 'project_knowledge', 'experience', 'task_pattern']),
      keywords: z.array(z.string()).optional(),
      importance: z.number().min(1).max(5).optional(),
    }),
  ),
});

const PROMPT_SYS = `You are a memory extraction agent. Read the user message and the assistant's reply, and decide if the user has revealed any LONG-TERM-USEFUL information worth remembering.

Output JSON with shape {"items":[...]} (empty array if nothing worth remembering).

Rules:
- If nothing worth remembering, output {"items":[]}.
- Be CONSERVATIVE: prefer empty over false positives.
- NEVER record one-off task details (e.g. "fix bug in foo.ts" - that's not memory-worthy).
- DO record stable facts: coding style preferences, tech stack decisions, project conventions, recurring pain points.
- importance: 5=core convention/policy, 4=stable preference, 3=useful note, 2=mild hint, 1=trivia.
- category must be one of: user_preference | project_knowledge | experience | task_pattern.`;

async function extractMemoriesViaLLM(ctx: AutoMemoryContext): Promise<AutoMemoryItem[]> {
  // 截断输入：避免长 turn 烧 token
  const userMsg = ctx.userMessage.slice(0, 2000);
  const reply = (ctx.assistantReply ?? '').slice(0, 800);
  const userBlock = `<user-msg>\n${userMsg}\n</user-msg>\n<assistant-reply>\n${reply}\n</assistant-reply>`;

  try {
    const { data } = await callStructured(ctx.llm, {
      schema: AutoMemorySchema,
      messages: [
        { role: 'system', content: PROMPT_SYS },
        { role: 'user', content: userBlock },
      ],
      model: ctx.model,
      temperature: 0,
      // 失败 1 次重试就够：auto-memory 是 best-effort 后台任务，不值得烧多次 token
      maxRetries: 1,
      schemaName: 'auto_memory_items',
    });
    return data.items;
  } catch {
    // callStructured 失败 → best-effort 返回空
    return [];
  }
}