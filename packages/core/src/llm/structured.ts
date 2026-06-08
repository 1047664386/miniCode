/**
 * Structured LLM Output —— 统一结构化输出入口
 * ----------------------------------------------------------------
 * 解决项目里 4+ 处 "prompt 里写 JSON 格式 + 自己 try-parse + 失败 fallback" 的重复脏代码。
 *
 * 核心能力：
 *  1. 接收 zod schema，自动转 JSON Schema 传给 native JSON mode
 *  2. provider 不支持 native JSON mode → 在 prompt 里塞 schema + 强约束指令
 *  3. parse 失败 → 把错误塞回去重试 N 次（"上次输出无法解析: <err>"）
 *  4. zod safeParse 失败也走重试
 *  5. 全程非流式（结构化输出就别流了）
 *
 * 为什么不直接用 `tool_calls` 模拟？
 *  - 简单结构化抽取（auto-memory / summary）用不到工具循环，多一层概念无谓
 *  - tool_call 走 chat 也需要解析 arguments JSON，本质同一个问题
 *  - 真要严格 schema → 走 OpenAI json_schema 模式即可，比 tool_call 更直接
 */
import type { ZodType } from 'zod';
import type { ChatMessage, LLMProvider, ResponseFormat } from './types.js';

export interface CallStructuredOptions<T> {
  /** zod schema，结果会 safeParse 一次校验 */
  schema: ZodType<T>;
  /** 必传：用户/system 消息序列。建议在 system 里说明任务，user 给具体输入 */
  messages: ChatMessage[];
  model?: string;
  /** 温度。结构化抽取默认 0（确定性） */
  temperature?: number;
  /**
   * 解析失败重试次数。默认 1（第一次失败 + 1 次带错误反馈重试）
   * 注意：每次重试都是一次新的 LLM 调用，烧 token，不要设太大
   */
  maxRetries?: number;
  /**
   * 用于 json_schema mode 的 schema 名称（OpenAI 强制要求）
   * 默认 'structured_output'
   */
  schemaName?: string;
  /**
   * 强制走 prompt-only 模式（不下发 response_format）。
   * 用于：Anthropic provider、或本地兼容端点已知不支持 json_object 时。
   */
  forcePromptOnly?: boolean;
  signal?: AbortSignal;
}

export interface StructuredCallResult<T> {
  data: T;
  /** 实际跑了几次 LLM（含重试） */
  attempts: number;
  /** 原始字符串（debug 用） */
  raw: string;
}

export class StructuredCallError extends Error {
  constructor(message: string, public readonly attempts: number, public readonly lastRaw: string) {
    super(message);
    this.name = 'StructuredCallError';
  }
}

/**
 * 同步消费 stream 拼成完整字符串。
 * 结构化场景下我们要拿完整 JSON 才能 parse，没必要也不能流式。
 */
async function collectFullText(
  llm: LLMProvider,
  messages: ChatMessage[],
  opts: { model?: string; temperature?: number; responseFormat?: ResponseFormat; signal?: AbortSignal },
): Promise<string> {
  let out = '';
  for await (const chunk of llm.chatStream(messages, {
    model: opts.model,
    temperature: opts.temperature,
    responseFormat: opts.responseFormat,
    signal: opts.signal,
  })) {
    if (chunk.delta) out += chunk.delta;
    if (chunk.done || chunk.finishReason) break;
    if (out.length > 32_000) break; // 防 runaway
  }
  return out;
}

/**
 * 主入口
 */
export async function callStructured<T>(
  llm: LLMProvider,
  opts: CallStructuredOptions<T>,
): Promise<StructuredCallResult<T>> {
  const maxRetries = opts.maxRetries ?? 1;
  const schemaJson = zodToJsonSchema(opts.schema);

  // 判定走 native 还是 prompt-only：
  //   Anthropic provider 不支持 response_format → prompt-only
  //   其他情况默认尝试 json_object（兼容性最好）
  const usePromptOnly = opts.forcePromptOnly || llm.name === 'anthropic';

  const responseFormat: ResponseFormat | undefined = usePromptOnly
    ? undefined
    : { type: 'json_object' };

  // 在 messages 末尾追加 schema 提示（无论 native 与否都加 —— native 模式下也帮助模型遵守字段）
  const schemaHint = buildSchemaHint(schemaJson, opts.schemaName ?? 'output');
  const baseMessages: ChatMessage[] = [...opts.messages];
  // 把 schema hint 塞到最后一条 system / user 上：找最后一条 system，没有就插一条
  const lastSystemIdx = findLastIdx(baseMessages, (m) => m.role === 'system');
  if (lastSystemIdx >= 0) {
    baseMessages[lastSystemIdx] = {
      ...baseMessages[lastSystemIdx],
      content: baseMessages[lastSystemIdx].content + '\n\n' + schemaHint,
    };
  } else {
    baseMessages.unshift({ role: 'system', content: schemaHint });
  }

  let lastErr: string | null = null;
  let lastRaw = '';

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const messages = [...baseMessages];
    if (attempt > 0 && lastErr) {
      // 把上次错误反馈给模型，让它修
      messages.push({
        role: 'user',
        content:
          `Your previous response could not be parsed as the required JSON schema. ` +
          `Error: ${lastErr}\n` +
          `Output the corrected JSON now, nothing else. Do NOT wrap in markdown code fences.`,
      });
    }

    let raw = '';
    try {
      raw = await collectFullText(llm, messages, {
        model: opts.model,
        temperature: opts.temperature ?? 0,
        responseFormat,
        signal: opts.signal,
      });
    } catch (e: any) {
      lastErr = `LLM call failed: ${e?.message ?? e}`;
      lastRaw = '';
      continue;
    }
    lastRaw = raw;

    // 提取 JSON：兼容 markdown fence、前置散文
    const jsonText = extractJson(raw);
    if (!jsonText) {
      lastErr = 'No JSON object found in output';
      continue;
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(jsonText);
    } catch (e: any) {
      lastErr = `JSON parse error: ${e?.message ?? e}`;
      continue;
    }

    const validated = opts.schema.safeParse(parsedJson);
    if (!validated.success) {
      // zod error 转人话
      lastErr = `Schema validation failed: ${validated.error.errors
        .slice(0, 3)
        .map((e) => `${e.path.join('.') || '<root>'}: ${e.message}`)
        .join('; ')}`;
      continue;
    }

    return { data: validated.data, attempts: attempt + 1, raw };
  }

  throw new StructuredCallError(
    `callStructured failed after ${maxRetries + 1} attempts. Last error: ${lastErr ?? 'unknown'}`,
    maxRetries + 1,
    lastRaw,
  );
}

/**
 * 把 zod schema 转成 prompt 里可读的指令片段。
 * 比直接 JSON Schema dump 更适合给 LLM 看（保留字段说明 + 强调输出格式）
 */
function buildSchemaHint(schema: Record<string, unknown>, name: string): string {
  return (
    `OUTPUT REQUIREMENT — your response MUST be a valid JSON object matching this schema (no markdown fences, no commentary):\n` +
    `<json_schema name="${name}">\n` +
    JSON.stringify(schema, null, 2) +
    `\n</json_schema>`
  );
}

/**
 * 从 LLM 输出里提取 JSON 文本：
 *  - 优先匹配 ```json ... ``` fence
 *  - 否则找第一个 { 到对应的 } / 第一个 [ 到对应的 ]
 *  - 都没有 → null
 */
function extractJson(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // fence
  const fenceMatch = trimmed.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // 整体就是 JSON
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    return trimmed;
  }

  // 找第一个对象/数组（括号匹配，处理嵌套）
  const startObj = trimmed.indexOf('{');
  const startArr = trimmed.indexOf('[');
  let start = -1;
  let openCh = '';
  let closeCh = '';
  if (startObj >= 0 && (startArr < 0 || startObj < startArr)) {
    start = startObj;
    openCh = '{';
    closeCh = '}';
  } else if (startArr >= 0) {
    start = startArr;
    openCh = '[';
    closeCh = ']';
  } else {
    return null;
  }

  let depth = 0;
  let inStr = false;
  let escape = false;
  for (let i = start; i < trimmed.length; i++) {
    const c = trimmed[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === '\\' && inStr) {
      escape = true;
      continue;
    }
    if (c === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (c === openCh) depth++;
    else if (c === closeCh) {
      depth--;
      if (depth === 0) return trimmed.slice(start, i + 1);
    }
  }
  return null;
}

function findLastIdx<T>(arr: T[], pred: (x: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (pred(arr[i])) return i;
  }
  return -1;
}

/**
 * 简易 zod → JSON Schema 转换（结构化输出版，比 tool-registry 那版多一点：支持 nullable / array of objects）
 * 不追求完美兼容 —— 给 LLM 看的，宽容度高。
 */
function zodToJsonSchema(schema: ZodType): Record<string, unknown> {
  const def: any = (schema as any)._def;
  if (!def) return { type: 'string' };
  switch (def.typeName) {
    case 'ZodObject': {
      const shape = typeof def.shape === 'function' ? def.shape() : def.shape;
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [k, v] of Object.entries<any>(shape)) {
        properties[k] = zodToJsonSchema(v);
        if (!v.isOptional?.()) required.push(k);
      }
      return { type: 'object', properties, required, additionalProperties: false };
    }
    case 'ZodString':
      return { type: 'string', ...(def.description ? { description: def.description } : {}) };
    case 'ZodNumber':
      return { type: 'number', ...(def.description ? { description: def.description } : {}) };
    case 'ZodBoolean':
      return { type: 'boolean' };
    case 'ZodArray':
      return { type: 'array', items: zodToJsonSchema(def.type) };
    case 'ZodOptional':
      return zodToJsonSchema(def.innerType);
    case 'ZodNullable': {
      const inner = zodToJsonSchema(def.innerType);
      return { ...inner, nullable: true };
    }
    case 'ZodDefault':
      return zodToJsonSchema(def.innerType);
    case 'ZodEnum':
      return { type: 'string', enum: def.values };
    case 'ZodLiteral':
      return { const: def.value };
    case 'ZodUnion':
      return { anyOf: def.options.map((o: ZodType) => zodToJsonSchema(o)) };
    case 'ZodRecord':
      return { type: 'object', additionalProperties: zodToJsonSchema(def.valueType) };
    default:
      return { type: 'string' };
  }
}