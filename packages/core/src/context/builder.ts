/**
 * Context Builder — 组装发给 LLM 的完整消息列表
 * ---------------------------------------------------------------
 * buildMessages() 是 chat 请求的核心入口：
 *   1. 构建 system prompt（identity / tone / conventions / ...）
 *   2. 注入 autoContext（检索召回）+ explicitContext（@-mentions）+ memory
 *   3. 按 token budget 压缩 history
 *   4. 拼接 [system, ...history, user] 返回
 *
 * compactHistory() 按 token budget 切 head/middle/tail，对应 CodeFlicker L1 Window 思想。
 */
import type { ChatMessage } from '../llm/types.js';
import type { MemoryStore, MemoryItem } from '../memory/store.js';
import type { InjectionCache } from './injection-cache.js';
import {
  type TokenEstimateOptions,
} from './token-estimator.js';
import { compactHistory, type Summarizer } from './compactor.js';
import { buildSystemPrompt, type AgentMode, type ProviderFlavor } from '../prompts/index.js';
import type { SandboxMode, ApprovalPolicy } from '../prompts/index.js';

// ---- 多模态图片附件 ----
export interface ImageAttachment {
  type: 'image';
  media_type: string;  // e.g. 'image/png'
  data: string;        // base64 (no data URL prefix)
}

// ---- ExplicitContextItem（@-mentions 解析结果） ----
export interface ExplicitContextItem {
  type: 'file' | 'symbol' | 'docs' | 'web';
  label: string;
  content: string;
}

// ---- AutoContextItem（检索召回结果） ----
export interface AutoContextItem {
  file: string;
  text: string;
}

// ---- buildMessages 选项 ----
export interface BuildMessagesOptions {
  /** 本轮用户消息 */
  userMessage: string;
  /** 历史对话（不含本轮 user message） */
  history: ChatMessage[];
  /** 自动检索召回的上下文 */
  autoContext?: AutoContextItem[];
  /** @-mentions 显式注入的上下文 */
  explicitContext?: ExplicitContextItem[];
  /** MemoryStore 实例（用于 recall） */
  memory?: MemoryStore;
  /** 元信息 */
  meta?: { cwd?: string; os?: string };
  /** Agent 模式 */
  mode?: AgentMode;
  /** Provider 风味 */
  providerFlavor?: ProviderFlavor;
  /** Sandbox 模式 */
  sandbox?: SandboxMode;
  /** Approval 策略 */
  approvalPolicy?: ApprovalPolicy;
  /** 额外 system 段落（rules / project-memory / skills 等） */
  systemExtras?: string[];
  /** 跨轮注入去重缓存 */
  injectionCache?: InjectionCache;
  /** 会话 ID（用于 injectionCache 分桶） */
  sessionId?: string;
  /** 压缩选项 */
  compaction?: {
    model?: string;
    tokenOpts?: TokenEstimateOptions;
    summarize?: Summarizer;
  };
  /** Memory 召回回调 */
  onMemoryRecalled?: (items: MemoryItem[]) => void;
  /** 前端粘贴/拖拽的图片（多模态 content blocks） */
  images?: ImageAttachment[];
}

/**
 * buildMessages — 组装发给 LLM 的完整消息列表
 *
 * 返回的 messages 数组：
 *   [system, ...compactedHistory, user]
 *   或对于支持多 system 的 provider：[system_stable, system_dynamic, ...compactedHistory, user]
 *
 * system 消息按稳定性分层：
 *   - 稳定层（cacheHint: ephemeral）：system prompt + rules + skills overview
 *   - 动态层（无 cacheHint）：autoContext + memory + explicitContext
 *
 * 这样 Anthropic 的 Prompt Cache 按前缀匹配时，稳定部分跨轮不变，命中率高。
 */
export async function buildMessages(opts: BuildMessagesOptions): Promise<ChatMessage[]> {
  const {
    userMessage,
    history,
    autoContext = [],
    explicitContext = [],
    memory,
    meta = {},
    mode = 'agent',
    providerFlavor = 'generic',
    sandbox,
    approvalPolicy,
    systemExtras = [],
    injectionCache,
    sessionId,
    compaction,
    onMemoryRecalled,
    images,
  } = opts;

  // ---- 1. 构建 system prompt（稳定层：跨轮不变） ----
  const systemBase = buildSystemPrompt({
    mode,
    cwd: meta.cwd,
    os: meta.os,
    provider: providerFlavor,
    sandbox,
    approval: approvalPolicy,
  });

  // ---- 2. 按稳定性分层收集 context 段落 ----
  // 稳定层：rules / project-memory / skills overview（跨轮基本不变）
  const stableParts: string[] = [];
  // 动态层：autoContext / memory / explicitContext（每轮变化）
  const dynamicParts: string[] = [];

  // 2a. systemExtras（rules / project-memory / skills 等）→ 稳定层
  for (const extra of systemExtras) {
    if (extra?.trim()) stableParts.push(extra);
  }

  // 2b. autoContext（检索召回）→ 动态层
  if (autoContext.length) {
    const ctxLines = autoContext
      .slice(0, 6)
      .map((c) => `--- ${c.file} ---\n${c.text.slice(0, 2000)}`)
      .join('\n\n');
    dynamicParts.push(`<retrieved-context>\n${ctxLines}\n</retrieved-context>`);
  }

  // 2c. explicitContext（@-mentions）→ 动态层
  if (explicitContext.length) {
    const mentionLines = explicitContext
      .map((c) => `--- ${c.label} (${c.type}) ---\n${c.content.slice(0, 3000)}`)
      .join('\n\n');
    dynamicParts.push(`<explicit-context>\n${mentionLines}\n</explicit-context>`);
  }

  // 2d. memory recall → 动态层
  if (memory) {
    try {
      // 构造增强 query：融合用户消息 + 最近 2 轮对话摘要，提升指代消解能力
      // 例如用户说"帮我改一下那个函数"，纯 query 搜不到，但加上上轮对话的
      // "parseFrontmatter 函数" 就能命中相关记忆
      const enrichedQuery = buildEnrichedRecallQuery(userMessage, history);
      const memItems = await memory.recall(enrichedQuery, { topK: 5 });
      if (memItems.length) {
        // 去重：通过 injectionCache 避免同一 session 里重复注入
        let filtered = memItems;
        if (injectionCache && sessionId) {
          const result = injectionCache.filter(sessionId, memItems.map((m) => ({
            uri: `memory://${m.id}`,
            content: `${m.title}: ${m.content}`,
          })));
          const keptUris = new Set(result.kept.map((c) => c.uri));
          filtered = memItems.filter((m) => keptUris.has(`memory://${m.id}`));
        }
        if (filtered.length) {
          const memLines = filtered
            .map((m) => `- [${m.category}] ${m.title}: ${m.content.slice(0, 500)}`)
            .join('\n');
          dynamicParts.push(`<memory>\n${memLines}\n</memory>`);
          onMemoryRecalled?.(filtered);
        }
      }
    } catch {
      // memory recall 失败不影响主流程
    }
  }

  // ---- 3. 组装 system 消息（按 provider 分层策略） ----
  const systemMessages: ChatMessage[] = [];

  // Anthropic 只接受一个 system 参数 → 拼成单条但按稳定性排序
  // 其他 provider（OpenAI 等）→ 拆成多条 system 消息
  const isAnthropic = providerFlavor === 'anthropic';

  if (isAnthropic || dynamicParts.length === 0) {
    // 单条 system：稳定部分在前 + 动态部分在后
    // 稳定前缀不变 → Anthropic 的 prefix cache 可以命中
    const systemContent = [systemBase, ...stableParts, ...dynamicParts]
      .filter((p) => p?.trim())
      .join('\n\n');

    systemMessages.push({
      role: 'system',
      content: systemContent,
      cacheHint: 'ephemeral',
    });
  } else {
    // 多条 system：稳定部分带 cacheHint，动态部分不带
    const stableContent = [systemBase, ...stableParts]
      .filter((p) => p?.trim())
      .join('\n\n');

    systemMessages.push({
      role: 'system',
      content: stableContent,
      cacheHint: 'ephemeral',
    });

    const dynamicContent = dynamicParts
      .filter((p) => p?.trim())
      .join('\n\n');

    if (dynamicContent.trim()) {
      systemMessages.push({
        role: 'system',
        content: dynamicContent,
      });
    }
  }

  // ---- 4. 压缩 history ----
  let compactedHistory = history;
  let compactDebug: any = undefined;

  if (compaction) {
    const result = await compactHistory(history, {
      model: compaction.model,
      tokenOpts: compaction.tokenOpts,
      summarize: compaction.summarize,
    });
    compactedHistory = result.messages;
    if (result.compacted) {
      compactDebug = {
        beforeTokens: result.beforeTokens,
        afterTokens: result.afterTokens,
        compacted: result.compacted,
        summaryLength: result.summaryText?.length ?? 0,
      };
    }
  }

  // ---- 5. 拼接最终消息列表 ----
  const userMsg: ChatMessage = { role: 'user', content: userMessage };
  // 多模态图片：前端粘贴的图片 → _multimodal content blocks（provider 适配层负责转换格式）
  if (images?.length) {
    (userMsg as any)._multimodal = [
      { type: 'text', text: userMessage },
      ...images.map((img) => ({
        type: 'image',
        source: { type: 'base64', media_type: img.media_type, data: img.data },
      })),
    ];
  }

  const messages: ChatMessage[] = [
    ...systemMessages,
    ...compactedHistory,
    userMsg,
  ];

  // 挂 debug 信息（上层通过 (initial as any).__compactDebug 读取）
  (messages as any).__compactDebug = compactDebug;

  return messages;
}

/**
 * 构造增强版 memory recall query：融合用户消息 + 最近对话上下文。
 *
 * 问题场景：用户说"帮我改一下那个函数"，纯 userMessage 搜"那个函数"啥也找不到；
 * 但如果上轮对话提到 "parseFrontmatter"，融合后 query = "帮我改一下那个函数 parseFrontmatter"
 * 就能命中相关记忆。
 *
 * 策略：取最近 2 轮 assistant 消息的关键词（截断到 200 字），拼接到 userMessage 后。
 * 不用 LLM 摘要（避免额外调用），简单截取即可——词法召回对关键词覆盖度要求高，精确度靠 RRF 融合兜底。
 */
function buildEnrichedRecallQuery(userMessage: string, history: ChatMessage[]): string {
  // 取最近 2 条 assistant 消息
  const recentAssistant: string[] = [];
  for (let i = history.length - 1; i >= 0 && recentAssistant.length < 2; i--) {
    const msg = history[i];
    if (msg.role === 'assistant' && typeof msg.content === 'string' && msg.content.trim()) {
      recentAssistant.push(msg.content.trim());
    }
  }
  if (!recentAssistant.length) return userMessage;

  // 每条截断到 200 字，拼接在 userMessage 后
  const contextSnippet = recentAssistant
    .map((s) => s.slice(0, 200))
    .join(' ');
  // 限制总 query 长度，避免词法召回被长上下文淹没
  const maxLen = 600;
  const combined = `${userMessage} ${contextSnippet}`;
  return combined.length > maxLen ? combined.slice(0, maxLen) : combined;
}