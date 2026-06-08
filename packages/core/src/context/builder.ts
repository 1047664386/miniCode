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
}

/**
 * buildMessages — 组装发给 LLM 的完整消息列表
 *
 * 返回的 messages 数组：
 *   [system, ...compactedHistory, user]
 *
 * system 消息包含：system prompt + autoContext + explicitContext + memory + systemExtras
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
  } = opts;

  // ---- 1. 构建 system prompt ----
  const systemBase = buildSystemPrompt({
    mode,
    cwd: meta.cwd,
    os: meta.os,
    provider: providerFlavor,
    sandbox,
    approval: approvalPolicy,
  });

  // ---- 2. 收集 context 段落 ----
  const contextParts: string[] = [];

  // 2a. autoContext（检索召回）
  if (autoContext.length) {
    const ctxLines = autoContext
      .slice(0, 6)
      .map((c) => `--- ${c.file} ---\n${c.text.slice(0, 2000)}`)
      .join('\n\n');
    contextParts.push(`<retrieved-context>\n${ctxLines}\n</retrieved-context>`);
  }

  // 2b. explicitContext（@-mentions）
  if (explicitContext.length) {
    const mentionLines = explicitContext
      .map((c) => `--- ${c.label} (${c.type}) ---\n${c.content.slice(0, 3000)}`)
      .join('\n\n');
    contextParts.push(`<explicit-context>\n${mentionLines}\n</explicit-context>`);
  }

  // 2c. memory recall
  if (memory) {
    try {
      const memItems = await memory.recall(userMessage, { topK: 5 });
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
          contextParts.push(`<memory>\n${memLines}\n</memory>`);
          onMemoryRecalled?.(filtered);
        }
      }
    } catch {
      // memory recall 失败不影响主流程
    }
  }

  // 2d. systemExtras（rules / project-memory / skills 等）
  for (const extra of systemExtras) {
    if (extra?.trim()) contextParts.push(extra);
  }

  // ---- 3. 组装 system 消息 ----
  const systemContent = [systemBase, ...contextParts]
    .filter((p) => p?.trim())
    .join('\n\n');

  const systemMsg: ChatMessage = {
    role: 'system',
    content: systemContent,
    cacheHint: 'ephemeral',
  };

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
  const messages: ChatMessage[] = [
    systemMsg,
    ...compactedHistory,
    { role: 'user', content: userMessage },
  ];

  // 挂 debug 信息（上层通过 (initial as any).__compactDebug 读取）
  (messages as any).__compactDebug = compactDebug;

  return messages;
}

