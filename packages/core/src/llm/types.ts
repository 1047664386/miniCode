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
   * 强制结构化输出。仅 OpenAI 兼容 Provider 生效；Anthropic 走 tool_use 替代。
   * 不传 → 自由文本输出。
   */
  responseFormat?: ResponseFormat;
}

export interface LLMProvider {
  name: string;
  chatStream(messages: ChatMessage[], opts?: LLMChatOptions): AsyncIterable<ChatChunk>;
  embed?(texts: string[]): Promise<number[][]>;
}