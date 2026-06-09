// 通用类型
export type Role = 'system' | 'user' | 'assistant' | 'tool';

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ChatMessage {
  role: Role;
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
  /**
   * Prompt cache 提示。
   *  - 'ephemeral': 让 provider（Anthropic / 兼容端点）把这条消息及之前所有消息标记为 cache 边界
   *  - undefined: 默认行为（OpenAI 等 prefix cache 自动）
   * 仅在第 0 条 stable system 上设置。
   */
  cacheHint?: 'ephemeral';
}

export interface ChatChunk {
  /** 增量文本 */
  delta?: string;
  /** 增量工具调用 */
  toolCallDelta?: Partial<ToolCall> & { index: number };
  /** 是否结束 */
  done?: boolean;
  /** 完整 finish_reason */
  finishReason?: 'stop' | 'tool_calls' | 'length' | 'error';
  /** 用量信息（最后一帧才有） */
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    /** 命中 prompt cache 的 token 数（OpenAI / Anthropic 字段名不同已归一） */
    cachedPromptTokens?: number;
  };
}

export interface ToolSchema {
  name: string;
  description: string;
  /** JSON Schema */
  parameters: Record<string, unknown>;
}

/**
 * 结构化输出约束：
 *  - 'json_object': OpenAI/DeepSeek 等标准 JSON mode，要求 prompt 里出现 "json" 字样
 *  - 'json_schema': 严格按 schema 输出（OpenAI 2024-08 后、DeepSeek/Qwen 部分支持）
 *  - Anthropic 端：上层应改走 tool_use 模拟，不走该字段
 */
export type ResponseFormat =
  | { type: 'json_object' }
  | {
      type: 'json_schema';
      json_schema: {
        name: string;
        strict?: boolean;
        schema: Record<string, unknown>;
      };
    };

export interface LLMChatOptions {
  model?: string;
  temperature?: number;
  tools?: ToolSchema[];
  signal?: AbortSignal;
  /**
   * 首帧等待超时（毫秒）：从发起 fetch 到收到 HTTP response headers。
   * 超过此时间说明 API 无响应，触发 abort → 分类为 timeout → 走 backoff/fallback。
   * 默认 300_000（5 分钟）。
   * 设为 0 或 Infinity 可完全禁用（适合本地模型、批量预处理等极端慢场景）。
   */
  fetchTimeoutMs?: number;
  /**
   * 流中途 idle 超时（毫秒）：两个 chunk 之间的最大等待时间。
   * 一旦流开始，每次收到 chunk 重置计时器；超时说明连接断了。
   * 默认 120_000（2 分钟）。
   * 设为 0 或 Infinity 可完全禁用。
   */
  streamIdleTimeoutMs?: number;
  /**
   * 强制结构化输出。仅 OpenAI 兼容 Provider 生效；Anthropic 走 tool_use 替代。
   * 不传 → 自由文本输出。
   */
  responseFormat?: ResponseFormat;
}

/** 默认首帧等待超时：5 分钟（宁可多等，不误杀正常慢请求） */
export const DEFAULT_FETCH_TIMEOUT_MS = 300_000;
/** 默认流中途 idle 超时：2 分钟 */
export const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 120_000;

/**
 * 将外部 AbortSignal 与 timeout 合并为一个新的 AbortSignal。
 * 任一触发都会 abort。用于 fetch 阶段的首帧等待超时。
 * timeoutMs 为 0 或 Infinity 时不设超时，仅透传外部 signal。
 */
export function combinedSignal(
  external: AbortSignal | undefined,
  timeoutMs: number,
): AbortSignal {
  // timeoutMs 为 0 / Infinity / NaN → 不设超时，直接透传外部 signal
  if (!timeoutMs || !Number.isFinite(timeoutMs)) {
    if (external) return external;
    const ctrl = new AbortController();
    return ctrl.signal;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`LLM fetch timeout after ${timeoutMs}ms`)), timeoutMs);
  if (typeof (timer as any).unref === 'function') (timer as any).unref();
  if (external) {
    if (external.aborted) {
      clearTimeout(timer);
      controller.abort(external.reason);
      return controller.signal;
    }
    external.addEventListener('abort', () => {
      clearTimeout(timer);
      controller.abort(external.reason);
    });
  }
  controller.signal.addEventListener('abort', () => clearTimeout(timer));
  return controller.signal;
}

/**
 * 带 idle 超时的 stream reader.read() 包装。
 * 每次成功读到 chunk 后重置计时器；如果 idleMs 内没有新 chunk，reject。
 * idleMs 为 0 或 Infinity 时不设超时，等价于裸 reader.read()。
 */
export function readWithIdleTimeout<T>(
  reader: ReadableStreamDefaultReader<T>,
  idleMs: number,
): Promise<ReadableStreamReadResult<T>> {
  // idleMs 为 0 / Infinity / NaN → 不设超时
  if (!idleMs || !Number.isFinite(idleMs)) {
    return reader.read();
  }
  return new Promise<ReadableStreamReadResult<T>>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      timer = null;
      reader.cancel().catch(() => {});
      reject(new Error(`Stream idle timeout: no data for ${idleMs}ms`));
    }, idleMs);
    if (typeof (timer as any).unref === 'function') (timer as any).unref();

    reader.read().then(
      (result) => {
        if (timer) clearTimeout(timer);
        resolve(result);
      },
      (err) => {
        if (timer) clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export interface LLMProvider {
  name: string;
  chatStream(messages: ChatMessage[], opts?: LLMChatOptions): AsyncIterable<ChatChunk>;
  embed?(texts: string[]): Promise<number[][]>;
}