/**
 * Token Estimator —— 启发式 token 估算 + per-provider tokenizer 接口预留
 * ----------------------------------------------------------------
 *
 * 设计参考：CodeFlicker / Claude Code / pi-coding-agent。
 *
 * 核心权衡（重要）：
 *   生产里 chars/4 + CJK 1.35 + safety_margin 1.2 已经够用。
 *   tiktoken / @anthropic-ai/tokenizer 是 Rust/Node native addon：
 *     - 容器/CI 跨平台 pain（musl vs glibc / arm64 vs x86）
 *     - js-tiktoken 纯 JS 但每个 BPE 表 ~10MB 内存，启动慢
 *     - 真实 token 数最终从 provider 的 `usage.input_tokens` 拿
 *     - 启发式只用于"何时触发压缩"决策，决策对精度容忍度 ±15%
 *   所以默认走启发式，只在确实需要精度时（如计费）注入 tokenizer。
 *
 * 启发式公式：
 *   tokens = ceil(cjk_chars / 1.35 + other_chars / 4) × safety_margin
 *
 * 经验值：
 *   - cjkCharsPerToken = 1.35  （中日韩字符密度高）
 *   - otherCharsPerToken = 4   （英文/代码/数字）
 *   - safetyMargin = 1.2       （吸收 BPE 切分、特殊 token、code 边界等误差）
 */

export type TokenizerFn = (text: string) => number;

export interface TokenEstimateOptions {
  cjkCharsPerToken?: number;
  otherCharsPerToken?: number;
  /** 估算结果再乘的安全裕度，吸收 BPE 误差。默认 1.2 = 多估 20% */
  safetyMargin?: number;
  /** 可选：注入真实 tokenizer（如 tiktoken）。优先级高于启发式 */
  tokenizer?: TokenizerFn;
  /** Context Window 大小覆盖（来自 ProviderProfile.contextWindow）。
   *  设置后，resolveCompactionThresholds 会优先使用此值而非 MODEL_CONTEXT_WINDOWS 注册表。*/
  contextWindowOverride?: number;
}

export const DEFAULT_TOKEN_ESTIMATE: Required<Omit<TokenEstimateOptions, 'tokenizer' | 'contextWindowOverride'>> = {
  cjkCharsPerToken: 1.35,
  otherCharsPerToken: 4,
  safetyMargin: 1.2,
};

/**
 * 把文本切成 (cjk 字符数, 其他字符数) 两类。
 *  - 中日韩统一表意文字：U+4E00 – U+9FFF
 *  - 中日韩扩展 A：U+3400 – U+4DBF
 *  - 平假名：U+3040 – U+309F
 *  - 片假名：U+30A0 – U+30FF
 *  - 韩文：U+AC00 – U+D7AF
 */
export function splitScriptCharCounts(text: string): { cjk: number; other: number } {
  let cjk = 0;
  let other = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (
      (cp >= 0x4e00 && cp <= 0x9fff) ||
      (cp >= 0x3400 && cp <= 0x4dbf) ||
      (cp >= 0x3040 && cp <= 0x309f) ||
      (cp >= 0x30a0 && cp <= 0x30ff) ||
      (cp >= 0xac00 && cp <= 0xd7af)
    ) {
      cjk++;
    } else {
      other++;
    }
  }
  return { cjk, other };
}

/** 估算单段文本 token 数 */
export function estimateTextTokens(text: string | undefined | null, opts: TokenEstimateOptions = {}): number {
  if (!text) return 0;
  if (opts.tokenizer) {
    // 走真实 tokenizer，不再叠 safety margin（真实值不需要兜底）
    return opts.tokenizer(text);
  }
  const cjkCharsPerToken = opts.cjkCharsPerToken ?? DEFAULT_TOKEN_ESTIMATE.cjkCharsPerToken;
  const otherCharsPerToken = opts.otherCharsPerToken ?? DEFAULT_TOKEN_ESTIMATE.otherCharsPerToken;
  const safetyMargin = opts.safetyMargin ?? DEFAULT_TOKEN_ESTIMATE.safetyMargin;
  const { cjk, other } = splitScriptCharCounts(text);
  const raw = cjk / cjkCharsPerToken + other / otherCharsPerToken;
  return Math.ceil(raw * safetyMargin);
}

/**
 * 估算一条 ChatMessage 的 token（含角色开销）。
 *  - 每条消息固定加 ~4 token 表示 role+separator（OpenAI 经验值）
 *  - tool_calls 的 arguments 也要计入
 *  - tool 消息 content 通常是 JSON.stringified 输出，等同普通文本
 */
export interface MessageLike {
  role: string;
  content?: string;
  name?: string;
  tool_calls?: Array<{ name?: string; arguments?: any }>;
}

export function estimateMessageTokens(msg: MessageLike, opts: TokenEstimateOptions = {}): number {
  const PER_MESSAGE_OVERHEAD = 4;
  let total = PER_MESSAGE_OVERHEAD;
  if (msg.content) total += estimateTextTokens(msg.content, opts);
  if (msg.name) total += estimateTextTokens(msg.name, opts);
  if (msg.tool_calls) {
    for (const tc of msg.tool_calls) {
      if (tc.name) total += estimateTextTokens(tc.name, opts);
      if (tc.arguments !== undefined) {
        const s = typeof tc.arguments === 'string' ? tc.arguments : JSON.stringify(tc.arguments);
        total += estimateTextTokens(s, opts);
      }
    }
  }
  return total;
}

export function estimateMessagesTokens(msgs: MessageLike[], opts: TokenEstimateOptions = {}): number {
  let s = 0;
  for (const m of msgs) s += estimateMessageTokens(m, opts);
  return s;
}

/**
 * 模型 contextWindow 注册表 —— 不同模型不同 token budget。
 * 没匹配的 fallback 到 default 的 contextWindow。
 *
 * 实际生产里这个表应该来自 ProviderStore 配置（用户填）。
 */
export const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  'gpt-4o': 128_000,
  'gpt-4o-mini': 128_000,
  'gpt-4-turbo': 128_000,
  'o1': 200_000,
  'o1-mini': 128_000,
  'claude-3-5-sonnet': 200_000,
  'claude-3-5-sonnet-latest': 200_000,
  'claude-sonnet-4': 200_000,
  'claude-3-7-sonnet': 200_000,
  'deepseek-chat': 128_000,
  'deepseek-coder': 128_000,
  'moonshot-v1-128k': 128_000,
  'moonshot-v1-32k': 32_000,
  'moonshot-v1-8k': 8_000,
  default: 32_000,
};

export function getContextWindow(model?: string): number {
  if (!model) return MODEL_CONTEXT_WINDOWS.default;
  // 精确匹配优先
  if (MODEL_CONTEXT_WINDOWS[model]) return MODEL_CONTEXT_WINDOWS[model];
  // 前缀模糊匹配（gpt-4o-2024-xx → gpt-4o）
  for (const k of Object.keys(MODEL_CONTEXT_WINDOWS)) {
    if (k !== 'default' && model.startsWith(k)) return MODEL_CONTEXT_WINDOWS[k];
  }
  return MODEL_CONTEXT_WINDOWS.default;
}

/**
 * 根据模型 contextWindow 算压缩相关阈值。
 * 默认参数对齐 Claude Code / CodeFlicker：
 *   - triggerRatio = 0.9：上下文用到 90% 触发压缩
 *   - targetRatio = 0.5：压缩后保留 50% 给后续轮次（CodeFlicker 是 0.2 更激进；本项目场景偏轻量调到 0.5）
 *   - triggerMaxTokens：硬上限，避免大模型 budget 算出 180k 这种过大值（首 token 慢）
 */
export interface CompactionThresholds {
  contextWindow: number;
  /** 超过这个值就触发压缩 */
  triggerTokens: number;
  /** 压缩目标：head + middle 摘要 + tail 总和不超过这个值 */
  targetTokens: number;
}

export function resolveCompactionThresholds(
  model?: string,
  override?: { triggerRatio?: number; targetRatio?: number; triggerMaxTokens?: number },
  tokenOpts?: TokenEstimateOptions,
): CompactionThresholds {
  // 优先使用 tokenOpts 里的 contextWindowOverride（来自 ProviderProfile 配置）
  const contextWindow = tokenOpts?.contextWindowOverride ?? getContextWindow(model);
  const triggerRatio = override?.triggerRatio ?? 0.9;
  const targetRatio = override?.targetRatio ?? 0.5;
  const triggerMaxTokens = override?.triggerMaxTokens ?? 165_000;
  const triggerTokens = Math.min(Math.floor(contextWindow * triggerRatio), triggerMaxTokens);
  const targetTokens = Math.floor(contextWindow * targetRatio);
  return { contextWindow, triggerTokens, targetTokens };
}