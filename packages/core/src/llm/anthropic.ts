/**
 * Anthropic 原生 Provider（Claude API）
 *
 * 跟 OpenAI 协议的差异：
 *  - URL：POST {baseURL}/v1/messages（不是 /chat/completions）
 *  - Auth：header "x-api-key: <key>" 而非 "Authorization: Bearer <key>"
 *  - 必需 header：anthropic-version: 2023-06-01
 *  - 消息结构：system 不在 messages 里，是顶层字段 system: "..."
 *  - 多模态/缓存：content 是数组 [{ type: 'text', text, cache_control? }, ...]
 *  - 工具调用：tools 是顶层数组；assistant 返回 content 块里包含 { type:'tool_use', id, name, input }
 *  - 工具结果：用户消息里塞 { type:'tool_result', tool_use_id, content }
 *  - SSE 事件：event 类型多（message_start / content_block_start / content_block_delta / ...）
 *
 * 这个 Provider 把上述全部归一到 ChatChunk 接口，外层 Agent loop 完全无感。
 */
import type { ChatChunk, ChatMessage, LLMChatOptions, LLMProvider, ToolCall } from './types.js';
import { combinedSignal, readWithIdleTimeout, DEFAULT_FETCH_TIMEOUT_MS, DEFAULT_STREAM_IDLE_TIMEOUT_MS } from './types.js';

export class AnthropicProvider implements LLMProvider {
  name = 'anthropic';

  constructor(
    private opts: {
      /** 默认 https://api.anthropic.com */
      baseURL?: string;
      apiKey: string;
      defaultModel?: string;
      /** 缓存：默认 true（带 cacheHint='ephemeral' 的消息会自动加 cache_control） */
      enableCacheControl?: boolean;
      /** Claude 推荐的 max_tokens（messages API 必传），默认 4096 */
      maxTokens?: number;
      /** anthropic-version header，默认 2023-06-01 */
      apiVersion?: string;
      /** Extended Thinking：启用深度思考模式，设 budget_tokens > 0 开启。
       *  仅 Claude 3.7+ / Claude 4 支持此特性。开启后 API 返回 thinking content blocks。
       *  典型值：10000（轻度推理）~ 32000（复杂推理）
       */
      thinkingBudget?: number;
    },
  ) {}

  async *chatStream(messages: ChatMessage[], opts: LLMChatOptions = {}): AsyncIterable<ChatChunk> {
    // 1. 拆 system / messages
    //    Anthropic 不接受 messages 里有 role:'system'，统一拼接到顶层 system 字段
    const systemParts: string[] = [];
    const convMsgs: ChatMessage[] = [];
    for (const m of messages) {
      if (m.role === 'system') {
        systemParts.push(m.content);
      } else {
        convMsgs.push(m);
      }
    }
    const systemText = systemParts.join('\n\n');

    // 2. messages 数组转换
    //    role 只接受 'user' | 'assistant'；tool result 用 user 包 tool_result 块
    const useCache = this.opts.enableCacheControl !== false;
    const anthroMessages = transformMessages(convMsgs, useCache);

    // 3. tools 转换（OpenAI function → Anthropic tool）
    const anthroTools = opts.tools?.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));

    const body: any = {
      model: opts.model ?? this.opts.defaultModel ?? 'claude-3-5-sonnet-20241022',
      max_tokens: this.opts.maxTokens ?? 4096,
      stream: true,
      temperature: opts.temperature ?? 0.2,
      messages: anthroMessages,
    };

    // Extended Thinking：当 thinkingBudget > 0 且模型支持时启用
    // 参见 https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking
    const thinkingBudget = this.opts.thinkingBudget ?? 0;
    if (thinkingBudget > 0) {
      body.thinking = {
        type: 'enabled',
        budget_tokens: thinkingBudget,
      };
      // Extended Thinking 要求 temperature=1 且不支持自定义
      body.temperature = 1;
      // 必须加 beta header
      if (useCache) {
        (body as any)._betaHeaders = ['prompt-caching-2024-07-31', 'extended-thinking-2025-01-24'];
      }
    }
    if (systemText) {
      // system 也可以是数组（支持 cache_control），简单起见用字符串
      body.system = useCache
        ? [{ type: 'text', text: systemText, cache_control: { type: 'ephemeral' } }]
        : systemText;
    }
    if (anthroTools && anthroTools.length) {
      // [PROMPT CACHE breakpoint #3] 给 tools 数组的最后一个工具打 cache_control，
      // Anthropic 会把"system + tools"整体当作 cache 前缀。tools 定义是 STABLE
      // 的大块文本（~3-5K tokens），缓存后下一轮免费。
      if (useCache) {
        const lastIdx = anthroTools.length - 1;
        (anthroTools as any)[lastIdx] = {
          ...anthroTools[lastIdx],
          cache_control: { type: 'ephemeral' },
        };
      }
      body.tools = anthroTools;
    }

    const url = `${(this.opts.baseURL ?? 'https://api.anthropic.com').replace(/\/$/, '')}/v1/messages`;
    // 两段式超时：Phase 1 — fetch 首帧等待超时（默认 60s）
    const fetchTimeout = opts.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
    const idleTimeout = opts.streamIdleTimeoutMs ?? DEFAULT_STREAM_IDLE_TIMEOUT_MS;
    const fetchSig = combinedSignal(opts.signal, fetchTimeout);

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': this.opts.apiKey,
        'anthropic-version': this.opts.apiVersion ?? '2023-06-01',
        'content-type': 'application/json',
        // 让 prompt caching 工作（beta header 可选；2024-09 之后已 GA，但加上更稳）
        ...(useCache ? { 'anthropic-beta': 'prompt-caching-2024-07-31' } : {}),
        // Extended Thinking beta header
        ...((body as any)._betaHeaders?.length
          ? { 'anthropic-beta': (body as any)._betaHeaders.join(',') }
          : {}),
      },
      body: JSON.stringify(body),
      signal: fetchSig,
    });

    if (!resp.ok || !resp.body) {
      const text = await resp.text().catch(() => '');
      throw new Error(`Anthropic HTTP ${resp.status}: ${text}`);
    }

    // 4. SSE 解析（Anthropic 事件类型多，逐一映射）
    const reader = resp.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buf = '';

    // 状态：tool_use 块按 content_block index 累积 partial JSON
    const toolUseAcc = new Map<
      number,
      { id?: string; name?: string; jsonBuf: string }
    >();
    let usagePrompt = 0;
    let usageCachedRead = 0;
    let usageCompletion = 0;

    while (true) {
      // Phase 2 — 流中途 idle 超时：每次 read 独立计时，收到 chunk 即重置
      const { value, done } = await readWithIdleTimeout(reader, idleTimeout);
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const events = buf.split(/\n\n/);
      buf = events.pop() ?? '';
      for (const block of events) {
        // 每个 SSE event 块是 "event: foo\ndata: {...}"
        const lines = block.split('\n');
        let evType = '';
        let data = '';
        for (const ln of lines) {
          if (ln.startsWith('event:')) evType = ln.slice(6).trim();
          else if (ln.startsWith('data:')) data = ln.slice(5).trim();
        }
        if (!data) continue;
        let json: any;
        try {
          json = JSON.parse(data);
        } catch {
          continue;
        }

        switch (evType) {
          case 'message_start': {
            const u = json.message?.usage;
            if (u) {
              usagePrompt = u.input_tokens ?? 0;
              usageCachedRead = u.cache_read_input_tokens ?? 0;
            }
            break;
          }
          case 'content_block_start': {
            const idx = json.index ?? 0;
            const cb = json.content_block;
            if (cb?.type === 'tool_use') {
              toolUseAcc.set(idx, { id: cb.id, name: cb.name, jsonBuf: '' });
              yield {
                toolCallDelta: { index: idx, id: cb.id, name: cb.name, arguments: '' as any },
              };
            }
            // Extended Thinking: thinking block start — emit special event
            if (cb?.type === 'thinking') {
              yield { thinkingStart: true } as any;
            }
            break;
          }
          case 'content_block_delta': {
            const idx = json.index ?? 0;
            const d = json.delta;
            if (!d) break;
            if (d.type === 'text_delta' && typeof d.text === 'string') {
              yield { delta: d.text };
            } else if (d.type === 'thinking_delta' && typeof d.thinking === 'string') {
              // Extended Thinking: thinking content delta
              yield { thinkingDelta: d.thinking } as any;
            } else if (d.type === 'input_json_delta' && typeof d.partial_json === 'string') {
              // tool_use 的参数是流式 JSON 片段，累计后由 agent loop 解析
              const acc = toolUseAcc.get(idx);
              if (acc) acc.jsonBuf += d.partial_json;
              yield {
                toolCallDelta: {
                  index: idx,
                  arguments: d.partial_json as any,
                },
              };
            }
            break;
          }
          case 'content_block_stop': {
            // 不需要特别处理：tool args 由 agent loop 累积
            break;
          }
          case 'message_delta': {
            // stop_reason 在这里
            const reason = json.delta?.stop_reason;
            const u = json.usage;
            if (u) {
              usageCompletion = u.output_tokens ?? usageCompletion;
            }
            if (reason) {
              yield { finishReason: mapStopReason(reason) };
            }
            break;
          }
          case 'message_stop': {
            // 推 usage（合并 message_start + message_delta）
            yield {
              usage: {
                promptTokens: usagePrompt,
                completionTokens: usageCompletion,
                cachedPromptTokens: usageCachedRead || undefined,
              },
            };
            yield { done: true };
            return;
          }
          case 'ping':
          case 'error':
          default:
            // ignore
            break;
        }
      }
    }
  }

  // Anthropic 也提供 embeddings，但目前不普及，且 OpenAI/Voyage 是主流 —— 不实现
}

/* -------------------- helpers -------------------- */

function mapStopReason(r: string): 'stop' | 'tool_calls' | 'length' | 'error' {
  if (r === 'tool_use') return 'tool_calls';
  if (r === 'end_turn' || r === 'stop_sequence') return 'stop';
  if (r === 'max_tokens') return 'length';
  return 'stop';
}

/**
 * 把通用 ChatMessage[] 转成 Anthropic messages 数组。
 *
 * 规则：
 *  - 'user'：直接转
 *  - 'assistant'：text + tool_calls 两种内容合并成 content 块数组
 *  - 'tool'：合并到下一个/上一个 user 消息里（Anthropic 用 user 角色装 tool_result）
 *
 * 简化：连续的 tool 消息会合并成一个 user 消息（内含多个 tool_result 块），
 *      并且要求顺序为：assistant(含 tool_use) → user(含 tool_result) → assistant ...
 */
function transformMessages(messages: ChatMessage[], useCache: boolean): any[] {
  const out: any[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === 'user') {
      // 多模态：当 user message 携带 _multimodal（来自 buildMessages 的 images 字段）时，
      // 直接使用 Anthropic 原生 content block 格式：[{type:'text',...}, {type:'image',...}]
      const multimodal = (m as any)._multimodal as any[] | undefined;
      if (multimodal) {
        const blocks = multimodal.map((b: any) => {
          if (b.type === 'text') {
            const block: any = { type: 'text', text: b.text };
            if (useCache && m.cacheHint === 'ephemeral') {
              block.cache_control = { type: 'ephemeral' };
            }
            return block;
          }
          if (b.type === 'image') return { type: 'image', source: b.source };
          return b;
        });
        out.push({ role: 'user', content: blocks });
      } else {
        const block: any = { type: 'text', text: m.content };
        if (useCache && m.cacheHint === 'ephemeral') {
          block.cache_control = { type: 'ephemeral' };
        }
        out.push({ role: 'user', content: [block] });
      }
    } else if (m.role === 'assistant') {
      const blocks: any[] = [];
      if (m.content) blocks.push({ type: 'text', text: m.content });
      if (m.tool_calls?.length) {
        for (const t of m.tool_calls) {
          blocks.push({
            type: 'tool_use',
            id: t.id,
            name: t.name,
            input: t.arguments,
          });
        }
      }
      if (blocks.length === 0) blocks.push({ type: 'text', text: '' });
      out.push({ role: 'assistant', content: blocks });
    } else if (m.role === 'tool') {
      // tool result：要装进一个 user 消息里
      // 支持 multimodal：如果 tool message 有 _multimodal 字段（来自 read_image / screenshot），
      // 使用 Anthropic content block 格式：[{type:'text',...}, {type:'image',...}]
      const multimodal = (m as any)._multimodal;
      const block: any = {
        type: 'tool_result',
        tool_use_id: m.tool_call_id ?? '',
        content: multimodal
          ? multimodal // 直接用 multimodal content blocks（含 text + image）
          : m.content,
      };
      // 如果上一条是 user 且最后一个块是 tool_result，merge 进去
      const prev = out[out.length - 1];
      if (prev?.role === 'user' && Array.isArray(prev.content)) {
        const hasOnlyToolResults = prev.content.every((b: any) => b.type === 'tool_result');
        if (hasOnlyToolResults) {
          prev.content.push(block);
          continue;
        }
      }
      out.push({ role: 'user', content: [block] });
    }
    // system 已在外层剔除
  }
  return out;
}

/**
 * 已知 Anthropic 兼容端点列表（用于 kind auto-detect）。
 */
export function isAnthropicEndpoint(baseUrl: string): boolean {
  return /\banthropic\.com\b/.test(baseUrl);
}