

/**
 * Provider 管理：把 LLM 配置（baseUrl/apiKey/model）抽成可命名的 profile，
 * 持久化到 .minicodeide/providers.json。
 *
 * 三种角色（active）独立选择：
 *   - chat: agent / ask / explain 等大对话
 *   - complete: inline ghost text 补全（通常更快/便宜的 model）
 *   - embed: 向量化（embedding 接口）
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

const FILE = '.minicodeide/providers.json';

export interface ProviderProfile {
  id: string;
  name: string;
  /**
   * Provider 协议类型。决定用哪个 LLMProvider 实现。
   *   - 'openai': OpenAI 兼容（DeepSeek / Moonshot / OpenRouter / OneAPI / Ollama-OpenAI / vLLM）
   *   - 'anthropic': Anthropic 原生 messages API（Claude 直连）
   *   - 默认（未设置）：按 baseUrl 自动判定（含 anthropic.com → anthropic，否则 openai）
   */
  kind?: 'openai' | 'anthropic';
  /** OpenAI-compatible chat endpoint base URL（含 /v1）；Anthropic 时不带 /v1（SDK 自加） */
  baseUrl: string;
  /** 单 key（兼容老配置）；多 key 见 apiKeys */
  apiKey: string;
  /**
   * 多 key 池：配多个 key 可在 429/quota 时自动轮换并冷却失败 key。
   * 优先级：apiKeys 非空 → 用 rotator；否则用 apiKey 单 key 旧逻辑。
   */
  apiKeys?: string[];
  /** 用于 chat / complete 的 model id */
  model?: string;
  /** 仅 embedding 用 */
  embedModel?: string;
  /** 向量维度（部分服务支持参数化） */
  embedDim?: number;
  /** 是否是 hash 兜底（无需 apiKey） */
  hash?: boolean;
  /**
   * 模型 context window 大小（token 数）。
   * 不设置时走 MODEL_CONTEXT_WINDOWS 自动匹配（前缀模糊匹配）。
   * 设置后优先使用此值。
   */
  contextWindow?: number;
  /**
   * 是否支持多模态图片（vision）。
   * true（默认）= 支持 OpenAI vision content 数组格式
   * false = API 不支持，图片会被忽略并提示用户
   */
  supportsVision?: boolean;
}

export interface ProviderConfig {
  profiles: ProviderProfile[];
  active: {
    chat?: string;
    complete?: string;
    embed?: string;
    /** 快/便宜模型（子 Agent / 简单任务用），未配置时回退到 chat */
    fast?: string;
  };
  /**
   * 每个 role 的 fallback 链：
   *   - 主 provider 出错（429/5xx/network）时按顺序尝试下一个
   *   - 数组里是 profile id；空数组或缺省 = 无 fallback
   * 例：fallbacks.chat = ['claude-sonnet', 'deepseek-chat'] —— Claude 先，挂了切 DeepSeek
   */
  fallbacks?: {
    chat?: string[];
    complete?: string[];
    embed?: string[];
    fast?: string[];
  };
}

const DEFAULT: ProviderConfig = {
  profiles: [
    {
      id: 'hash-fallback',
      name: 'Hash Embedder (no key)',
      baseUrl: '',
      apiKey: '',
      embedModel: 'hash-fnv1a-256',
      embedDim: 256,
      hash: true,
    },
  ],
  active: { embed: 'hash-fallback' },
};

export class ProviderStore {
  private cfg: ProviderConfig = DEFAULT;
  private file: string;
  /** 切换/upsert/delete 时触发 */
  public onChange?: () => void;

  constructor(private cwd: string) {
    this.file = path.join(cwd, FILE);
  }

  async load() {
    try {
      const raw = await fs.readFile(this.file, 'utf-8');
      const parsed = JSON.parse(raw) as ProviderConfig;
      this.cfg = {
        profiles: parsed.profiles ?? [],
        active: parsed.active ?? {},
        fallbacks: parsed.fallbacks ?? {},
      };
      // 始终保留 hash fallback
      if (!this.cfg.profiles.some((p) => p.id === 'hash-fallback')) {
        this.cfg.profiles.push(DEFAULT.profiles[0]);
      }
    } catch {
      this.cfg = structuredClone(DEFAULT);
    }
    // env 注入：如果存在 LLM_API_KEY，自动建一个 profile 当 chat/complete default
    if (process.env.LLM_API_KEY) {
      const id = 'env-default';
      const exists = this.cfg.profiles.find((p) => p.id === id);
      if (!exists) {
        this.cfg.profiles.unshift({
          id,
          name: 'ENV Default',
          baseUrl: process.env.LLM_BASE_URL ?? 'https://api.deepseek.com/v1',
          apiKey: process.env.LLM_API_KEY,
          model: process.env.LLM_MODEL ?? 'deepseek-chat',
          embedModel: process.env.EMBED_MODEL,
        });
      }
      if (!this.cfg.active.chat) this.cfg.active.chat = id;
      if (!this.cfg.active.complete) this.cfg.active.complete = id;
      if (!this.cfg.active.embed && process.env.EMBED_MODEL)
        this.cfg.active.embed = id;
    }
    // 清理 stale active IDs：指向已不存在的 profile 时移除引用
    for (const role of ['chat', 'complete', 'embed', 'fast'] as const) {
      const activeId = this.cfg.active[role];
      if (activeId && !this.cfg.profiles.some((p) => p.id === activeId)) {
        delete this.cfg.active[role];
      }
    }
    // 同样清理 stale fallback IDs
    if (this.cfg.fallbacks) {
      for (const role of ['chat', 'complete', 'embed', 'fast'] as const) {
        if (this.cfg.fallbacks[role]) {
          this.cfg.fallbacks[role] = this.cfg.fallbacks[role]!.filter(
            (id) => this.cfg.profiles.some((p) => p.id === id),
          );
        }
      }
    }
    return this.cfg;
  }

  private async save() {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, JSON.stringify(this.cfg, null, 2), 'utf-8');
  }

  list(): ProviderConfig {
    // 不返回 apiKey/apiKeys 原文（避免泄露）
    return {
      profiles: this.cfg.profiles.map((p) => ({
        ...p,
        apiKey: p.apiKey ? '***' + p.apiKey.slice(-4) : '',
        apiKeys: p.apiKeys?.length
          ? p.apiKeys.map((k) => (k ? '***' + k.slice(-4) : ''))
          : undefined,
      })),
      active: this.cfg.active,
    };
  }

  /** 内部用：返回完整配置（含明文 apiKey），仅供本地 syncToCloud 等内部调用 */
  getConfig(): ProviderConfig {
    return structuredClone(this.cfg);
  }

  /** 内部用：拿真实 apiKey */
  get(id: string): ProviderProfile | undefined {
    return this.cfg.profiles.find((p) => p.id === id);
  }

  getActive(role: 'chat' | 'complete' | 'embed' | 'fast'): ProviderProfile | undefined {
    const id = this.cfg.active[role];
    if (!id) return undefined;
    return this.get(id);
  }

  async upsert(p: Partial<ProviderProfile> & { id?: string; name: string; baseUrl: string }) {
    const id = p.id ?? `p_${Date.now()}`;
    const existing = this.cfg.profiles.findIndex((x) => x.id === id);
    const next: ProviderProfile = {
      id,
      name: p.name,
      kind: p.kind, // 'openai' | 'anthropic' | undefined (auto)
      baseUrl: p.baseUrl,
      apiKey: p.apiKey ?? (existing >= 0 ? this.cfg.profiles[existing].apiKey : ''),
      apiKeys: p.apiKeys ?? (existing >= 0 ? this.cfg.profiles[existing].apiKeys : undefined),
      model: p.model,
      embedModel: p.embedModel,
      embedDim: p.embedDim,
      hash: !!p.hash,
      supportsVision: p.supportsVision,
    };
    if (existing >= 0) this.cfg.profiles[existing] = next;
    else this.cfg.profiles.push(next);

    // 如果是首个非 hash 真实 provider 且没有 active chat/complete，自动激活
    if (!next.hash) {
      if (!this.cfg.active.chat && this.cfg.profiles.filter((p) => !p.hash).length <= 1) {
        this.cfg.active.chat = id;
      }
      if (!this.cfg.active.complete && this.cfg.profiles.filter((p) => !p.hash).length <= 1) {
        this.cfg.active.complete = id;
      }
    }

    await this.save();
    this.onChange?.();
    return next;
  }

  /** 返回某 role 的 fallback 链（按 [primary, ...fallbacks] 顺序） */
  getRoleChain(role: 'chat' | 'complete' | 'embed' | 'fast'): ProviderProfile[] {
    const chain: ProviderProfile[] = [];
    const seen = new Set<string>();
    const push = (id?: string) => {
      if (!id || seen.has(id)) return;
      const p = this.get(id);
      if (p) {
        chain.push(p);
        seen.add(id);
      }
    };
    push(this.cfg.active[role]);
    for (const id of this.cfg.fallbacks?.[role] ?? []) push(id);
    // fast 没配 → 也补 chat 链当兜底
    if (role === 'fast') {
      push(this.cfg.active.chat);
      for (const id of this.cfg.fallbacks?.chat ?? []) push(id);
    }
    return chain;
  }

  async setFallbacks(role: 'chat' | 'complete' | 'embed' | 'fast', ids: string[]) {
    if (!this.cfg.fallbacks) this.cfg.fallbacks = {};
    // 过滤无效 id
    const clean = ids.filter((id) => this.get(id));
    this.cfg.fallbacks[role] = clean;
    await this.save();
    this.onChange?.();
  }

  async remove(id: string) {
    if (id === 'hash-fallback') throw new Error('cannot remove fallback');
    this.cfg.profiles = this.cfg.profiles.filter((p) => p.id !== id);
    for (const k of ['chat', 'complete', 'embed', 'fast'] as const) {
      if (this.cfg.active[k] === id) delete this.cfg.active[k];
    }
    await this.save();
    this.onChange?.();
  }

  async setActive(role: 'chat' | 'complete' | 'embed' | 'fast', id: string | null) {
    if (id && !this.get(id)) throw new Error('profile not found');
    if (id) this.cfg.active[role] = id;
    else delete this.cfg.active[role];
    await this.save();
    this.onChange?.();
  }
}
