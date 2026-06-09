
/**
 * LLMRouter —— 多 Provider 自动 fallback 调度器
 *
 * 行为：
 *  1. 按 profiles 顺序（primary + fallbacks）依次尝试
 *  2. 每个 profile 创建对应的 Provider（openai-compat 或 anthropic 原生）
 *  3. chatStream 第一帧产生前如果出错（HTTP 429/5xx/network/超时）→ 切下一个
 *  4. 已经开始流式输出后再断 → 不重试（用户已看到内容，重试会重复）
 *  5. 每次切换都通过 onSwitch 回调通知（用于 SSE 推前端）
 *
 * 为什么不开始输出后不重试？
 *  因为 LLM stream 是 stateful，token 已经吐到前端，再切就会产生重复/拼接错乱。
 *  这是 trade-off：可用性 vs 一致性，我们选一致性（用户能看到错误并手动 retry）。
 */
import {
  AnthropicProvider,
  OpenAICompatProvider,
  isAnthropicEndpoint,
  type ChatChunk,
  type ChatMessage,
  type LLMChatOptions,
  type LLMProvider,
} from '@mini/core';
import type { ProviderProfile } from './providers.js';
import { getOrCreateRotator, AllKeysCooldownError } from './key-rotator.js';

export interface RouterSwitchInfo {
  fromProfileId: string;
  toProfileId: string;
  error: string;
  errorKind: 'network' | 'http_429' | 'http_5xx' | 'timeout' | 'unknown';
}

export interface LLMRouterOpts {
  /** 已排序：[primary, ...fallbacks] */
  profiles: ProviderProfile[];
  /** 默认 model：每个 profile 没指定 model 时用这个；空就用 profile.model */
  modelOverride?: string;
  /** 切换通知（用于 SSE 推前端） */
  onSwitch?: (info: RouterSwitchInfo) => void;
}

export class LLMRouter implements LLMProvider {
  name = 'router';

  constructor(private opts: LLMRouterOpts) {}

  async *chatStream(messages: ChatMessage[], opts: LLMChatOptions = {}): AsyncIterable<ChatChunk> {
    if (this.opts.profiles.length === 0) {
      throw new Error('LLMRouter: no profiles configured');
    }
    let lastErr: unknown = null;
    for (let i = 0; i < this.opts.profiles.length; i++) {
      const profile = this.opts.profiles[i];

      // 多 key 内部轮换：每个 profile 最多重试 keys.length 次
      const keys = (profile.apiKeys && profile.apiKeys.length > 0)
        ? profile.apiKeys
        : [profile.apiKey];
      const rotator = getOrCreateRotator(profile.id, keys);
      const innerMaxTries = keys.length;
      let keyChosen: string | null = null;
      let providerStarted = false;

      for (let attempt = 0; attempt < innerMaxTries; attempt++) {
        let keyState;
        try {
          keyState = rotator.pick();
        } catch (e) {
          // 所有 key 都在冷却 → 跳到下一个 profile
          lastErr = e;
          break;
        }
        keyChosen = keyState.key;
        const provider = createProvider({ ...profile, apiKey: keyChosen });
        const model = opts.model ?? profile.model;

        let started = false;
        try {
          const stream = provider.chatStream(messages, { ...opts, model });
          for await (const chunk of stream) {
            if (!started) started = true;
            providerStarted = true;
            yield chunk;
          }
          rotator.markSuccess(keyChosen);
          return;
        } catch (e) {
          lastErr = e;
          const kind = classifyError(e);
          rotator.markFailure(keyChosen, kind === 'unknown' ? 'unknown' : kind as any);
          if (started) {
            // 已经吐过 token → 不重试
            throw e;
          }
          // 同 profile 内可换 key 重试（429/网络/5xx）
          const retryableInner = kind === 'http_429' || kind === 'http_5xx' || kind === 'timeout' || kind === 'network';
          if (retryableInner && attempt + 1 < innerMaxTries) {
            // 静默切下一个 key，不广播 onSwitch（onSwitch 是 profile 切换才广播）
            continue;
          }
          // 本 profile 失败 → break 外层 for 切 profile
          break;
        }
      }

      if (providerStarted) return; // 不应到这里

      // 本 profile 全失败 → 切下一个 profile（广播）
      const nextProfile = this.opts.profiles[i + 1];
      if (nextProfile) {
        const kind = classifyError(lastErr);
        this.opts.onSwitch?.({
          fromProfileId: profile.id,
          toProfileId: nextProfile.id,
          error: stringifyError(lastErr),
          errorKind: kind,
        });
        continue;
      }
      throw lastErr ?? new Error(`LLMRouter: profile '${profile.id}' exhausted, no fallback`);
    }
    throw lastErr ?? new Error('LLMRouter: no providers succeeded');
  }

  async embed(texts: string[]): Promise<number[][]> {
    let lastErr: unknown = null;
    for (let i = 0; i < this.opts.profiles.length; i++) {
      const profile = this.opts.profiles[i];
      const provider = createProvider(profile);
      if (!provider.embed) {
        lastErr = new Error(`provider ${profile.id} (${profile.kind ?? 'auto'}) has no embed()`);
        continue;
      }
      try {
        return await provider.embed(texts);
      } catch (e) {
        lastErr = e;
        const next = this.opts.profiles[i + 1];
        if (next) {
          this.opts.onSwitch?.({
            fromProfileId: profile.id,
            toProfileId: next.id,
            error: stringifyError(e),
            errorKind: classifyError(e),
          });
          continue;
        }
        throw e;
      }
    }
    throw lastErr ?? new Error('LLMRouter.embed: no providers succeeded');
  }
}

/* -------------------- factory -------------------- */

/**
 * 根据 profile.kind 选择 Provider 实现。
 * kind 缺失时按 baseUrl 自动 detect：anthropic.com → anthropic，否则 openai-compat。
 */
export function createProvider(profile: ProviderProfile): LLMProvider {
  const kind = profile.kind ?? (isAnthropicEndpoint(profile.baseUrl) ? 'anthropic' : 'openai');

  if (kind === 'anthropic') {
    return new AnthropicProvider({
      baseURL: profile.baseUrl || 'https://api.anthropic.com',
      apiKey: profile.apiKey,
      defaultModel: profile.model || 'claude-3-5-sonnet-20241022',
      enableCacheControl: true,
    });
  }
  // openai 兼容
  return new OpenAICompatProvider({
    baseURL: profile.baseUrl || 'https://api.deepseek.com/v1',
    apiKey: profile.apiKey || 'sk-mock',
    defaultModel: profile.model || 'deepseek-chat',
    embedModel: profile.embedModel || 'text-embedding-3-small',
    // 走 OpenAI 兼容代理调 Claude 也支持 cache_control
    enableAnthropicCache: /claude|anthropic/i.test(profile.model ?? ''),
    // 多模态 vision 支持：默认 true；用户可在 profile 里设为 false
    supportsVision: profile.supportsVision !== false,
  });
}

/* -------------------- error classification -------------------- */

function classifyError(e: unknown): RouterSwitchInfo['errorKind'] {
  const s = stringifyError(e);
  if (/HTTP 401|unauthorized|invalid.?api.?key/i.test(s)) return 'unknown'; // 401 我们用 unknown 上抛但 rotator 自己识别
  if (/HTTP 429/.test(s) || /rate.?limit/i.test(s)) return 'http_429';
  if (/HTTP 5\d\d/.test(s)) return 'http_5xx';
  if (/timeout|ETIMEDOUT|ESOCKETTIMEDOUT/i.test(s)) return 'timeout';
  if (/ECONNREFUSED|ENOTFOUND|ECONNRESET|fetch failed|network/i.test(s)) return 'network';
  return 'unknown';
}

function stringifyError(e: unknown): string {
  if (!e) return '';
  if (typeof e === 'string') return e;
  const any = e as any;
  return any?.message ?? String(e);
}