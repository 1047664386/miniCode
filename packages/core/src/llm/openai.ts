import type { ChatChunk, ChatMessage, LLMChatOptions, LLMProvider } from './types.js';

/**
 * OpenAI 兼容 Provider（DeepSeek / Moonshot / Ollama-OpenAI 兼容接口 / OpenRouter 等都通吃）
 * 仅依赖 fetch + SSE 解析。
 *
 * Prompt Caching 处理：
 *  - 默认：依赖 OpenAI / DeepSeek / Moonshot 等的自动 prefix cache（消息前缀不变就命中）
 *  - 当 enableAnthropicCache=true 时：把带 cacheHint='ephemeral' 的消息 content 转成
 *    数组形式的 cache_control 块（兼容 Anthropic Messages API 风格），用于 Claude 端点
 */
export class OpenAICompatProvider implements LLMProvider {
  name = 'openai-compat';

  constructor(
    private opts: {
      baseURL: string; // e.g. https://api.deepseek.com/v1
      apiKey: string;
      defaultModel?: string;
      embedModel?: string;
      /** 启用 Anthropic 风格 cache_control（baseURL 指向 Claude 端点时打开） */
      enableAnthropicCache?: boolean;
      /** 是否支持多模态图片（vision）。默认 true；若 API 不支持 content 数组格式则设为 false */
      supportsVision?: boolean;
    },
  ) {}

  /** 自动推断当前模型是否支持 vision（针对 DashScope/通义千问等需要显式区分 VL 模型的端点） */
  private inferVisionSupport(): boolean {
    // 用户显式配置优先
    if (this.opts.supportsVision !== undefined) return this.opts.supportsVision;
    const baseURL = this.opts.baseURL.toLowerCase();
    const model = (this.opts.defaultModel ?? '').toLowerCase();
    // DashScope 端点：只有 qwen-vl-* / qwen2-vl-* 等视觉模型支持 image_url content 数组
    if (baseURL.includes('dashscope')) {
      return /qwen.*-vl|qwen-vl/i.test(model);
    }
    // 其他 OpenAI 兼容端点默认支持
    return true;
  }

  async *chatStream(messages: ChatMessage[], opts: LLMChatOptions = {}): AsyncIterable<ChatChunk> {
    const useAnthropicCache = !!this.opts.enableAnthropicCache;
    const supportsVision = this.inferVisionSupport();
    const buildBody = (stripImages: boolean) => ({
      model: opts.model ?? this.opts.defaultModel ?? 'gpt-4o-mini',
      messages: messages.map((m) => {
        // 多模态 content blocks 转换（_multimodal 来自 buildMessages 的 images 或 agent loop 的 __image）
        const multimodal = (m as any)._multimodal as any[] | undefined;
        let content: any;
        if (multimodal && supportsVision && !stripImages) {
          // 把内部 _multimodal 格式转成 OpenAI content 数组格式
          content = multimodal.map((block: any) => {
            if (block.type === 'text') return { type: 'text', text: block.text };
            if (block.type === 'image' && block.source) {
              return {
                type: 'image_url',
                image_url: {
                  url: `data:${block.source.media_type};base64,${block.source.data}`,
                },
              };
            }
            return block;
          });
        } else if (multimodal && (!supportsVision || stripImages)) {
          // API 不支持 vision 或 重试时剥离图片 → 降级为纯文本，附带图片说明
          const textBlock = multimodal.find((b: any) => b.type === 'text');
          const imageCount = multimodal.filter((b: any) => b.type === 'image').length;
          content = (textBlock?.text ?? m.content) + (imageCount > 0 ? `\n[用户附带了 ${imageCount} 张图片，但当前模型不支持图片识别]` : '');
        } else if (useAnthropicCache && m.cacheHint === 'ephemeral') {
          content = [{ type: 'text', text: m.content, cache_control: { type: 'ephemeral' } }];
        } else {
          content = m.content;
        }

        const base: any = {
          role: m.role,
          content,
        };
        // 仅在字段有值时才添加（避免 undefined 序列化为 null，部分 API 如 DashScope/Qwen 不接受）
        if (m.tool_calls?.length) {
          base.tool_calls = m.tool_calls.map((t) => ({
            id: t.id,
            type: 'function',
            function: { name: t.name, arguments: JSON.stringify(t.arguments) },
          }));
        }
        if (m.tool_call_id) base.tool_call_id = m.tool_call_id;
        if (m.name) base.name = m.name;
        return base;
      }),
      stream: true,
      temperature: opts.temperature ?? 0.2,
      tools: opts.tools?.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      })),
    });

    // 结构化输出：仅当用户显式传入 responseFormat 时启用（json_object 需 prompt 含 'json'，
    // 否则 OpenAI 会报 400；调用方应自行保证）。
    const applyResponseFormat = (body: Record<string, unknown>) => {
      if (opts.responseFormat) {
        body.response_format = opts.responseFormat;
      }
    };

    let body: Record<string, unknown> = buildBody(false) as any;
    applyResponseFormat(body);

    let resp = await fetch(`${this.opts.baseURL.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.opts.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    });

    // 400 错误 + 消息中包含图片 → 自动剥离图片重试（部分 API 如 DashScope qwen-max 不支持 image_url）
    if (resp.status === 400) {
      const errBody = await resp.text().catch(() => '');
      const hasImages = messages.some((m) => !!(m as any)._multimodal);
      if (hasImages) {
        console.warn('[OpenAI Provider] 400 error with images, retrying without images...', errBody);
        body = buildBody(true) as any;
        applyResponseFormat(body);
        resp = await fetch(`${this.opts.baseURL.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.opts.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: opts.signal,
        });
        // 重试成功时，先发送一条提示文本
        if (resp.ok && resp.body) {
          yield { delta: '\n\n> ⚠️ 当前模型不支持图片识别，已自动剥离图片继续对话。如需图片识别，请在模型设置中切换到支持视觉的模型（如 qwen-vl-max）。\n\n' };
        } else if (!resp.ok) {
          // 重试也失败了，抛出详细错误
          const retryErrBody = await resp.text().catch(() => '');
          throw new Error(`LLM HTTP 400 (重试剥离图片后仍失败): 原始错误=${errBody}; 重试错误=HTTP ${resp.status}: ${retryErrBody}`);
        }
      } else {
        // 400 但没有图片 → 直接抛出详细错误
        throw new Error(`LLM HTTP 400: ${errBody}`);
      }
    }

    if (!resp.ok || !resp.body) {
      const text = await resp.text().catch(() => '');
      throw new Error(`LLM HTTP ${resp.status}: ${text}`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buf = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') {
          yield { done: true };
          return;
        }
        try {
          const json = JSON.parse(data);
          // OpenAI / Anthropic / DeepSeek 都可能把 usage 放在最后一帧或 .usage 里
          if (json.usage) {
            yield {
              usage: {
                promptTokens: json.usage.prompt_tokens ?? json.usage.input_tokens,
                completionTokens: json.usage.completion_tokens ?? json.usage.output_tokens,
                cachedPromptTokens:
                  json.usage.prompt_tokens_details?.cached_tokens ??
                  json.usage.cache_read_input_tokens,
              },
            } as any;
          }
          const choice = json.choices?.[0];
          if (!choice) continue;
          const delta = choice.delta ?? {};
          if (typeof delta.content === 'string' && delta.content.length) {
            yield { delta: delta.content };
          }
          if (Array.isArray(delta.tool_calls)) {
            for (const tc of delta.tool_calls) {
              yield {
                toolCallDelta: {
                  index: tc.index ?? 0,
                  id: tc.id,
                  name: tc.function?.name,
                  arguments: tc.function?.arguments,
                } as any,
              };
            }
          }
          if (choice.finish_reason) {
            yield { finishReason: choice.finish_reason };
          }
        } catch {
          // ignore broken SSE line
        }
      }
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    const resp = await fetch(`${this.opts.baseURL.replace(/\/$/, '')}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.opts.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.opts.embedModel ?? 'text-embedding-3-small',
        input: texts,
      }),
    });
    if (!resp.ok) throw new Error(`Embed HTTP ${resp.status}`);
    const json = await resp.json();
    return json.data.map((d: any) => d.embedding as number[]);
  }
}