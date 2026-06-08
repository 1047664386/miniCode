
/**
 * 网页版 LLM Provider 工厂
 *
 * 策略（与 Roadmap Q3 决策一致）：
 *   1. 用户配了 BYOK（User.llmKeyEnc）→ 优先用，无 quota 限制
 *   2. 否则用平台 key（OPENAI_API_KEY / ANTHROPIC_API_KEY）→ 受 freeQuota 约束
 *
 * 当前 M2/A 阶段：单 provider（OpenAI 兼容），后续可扩展 routing。
 * 这里有意不抽象成 LLMRouter（apps/server 那个）—— 网页端用例更简单：
 *   - 桌面端：用户在 settings 里配多个 profile，自动 fallback
 *   - 网页端：平台兜底，用户只配自己一个 key（DeepSeek / OpenAI 二选一）
 */
import { OpenAICompatProvider, AnthropicProvider, isAnthropicEndpoint } from '@mini/core';
import type { LLMProvider } from '@mini/core';
import { decryptApiKey } from './crypto.js';

export interface UserLLMConfig {
  llmKeyEnc?: string | null;
  llmBaseUrl?: string | null;
  llmModel?: string | null;
  llmKind?: string | null;
}

export interface ProviderResult {
  provider: LLMProvider;
  model: string;
  /** 是否用了用户自带 key（不计 quota） */
  byok: boolean;
}

/**
 * 选 provider：用户 BYOK 优先，否则平台 key
 */
export function pickProvider(user: UserLLMConfig): ProviderResult {
  // 1. 用户 BYOK
  if (user.llmKeyEnc) {
    const apiKey = decryptApiKey(user.llmKeyEnc);
    const baseURL = user.llmBaseUrl || 'https://api.deepseek.com/v1';
    const model = user.llmModel || 'deepseek-chat';
    const kind = user.llmKind ?? (isAnthropicEndpoint(baseURL) ? 'anthropic' : 'openai');
    return {
      provider: kind === 'anthropic'
        ? new AnthropicProvider({ baseURL, apiKey })
        : new OpenAICompatProvider({ baseURL, apiKey }),
      model,
      byok: true,
    };
  }

  // 2. 平台 key
  const platformKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!platformKey) {
    throw new Error(
      'No LLM key configured. Set OPENAI_API_KEY/ANTHROPIC_API_KEY in env, ' +
      'or have user configure BYOK via PATCH /api/me/api-key',
    );
  }
  const baseURL = process.env.LLM_BASE_URL || 'https://api.deepseek.com/v1';
  const model = process.env.LLM_MODEL || 'deepseek-chat';
  const kind = process.env.LLM_KIND ?? (isAnthropicEndpoint(baseURL) ? 'anthropic' : 'openai');
  return {
    provider: kind === 'anthropic'
      ? new AnthropicProvider({ baseURL, apiKey: platformKey })
      : new OpenAICompatProvider({ baseURL, apiKey: platformKey }),
    model,
    byok: false,
  };
}