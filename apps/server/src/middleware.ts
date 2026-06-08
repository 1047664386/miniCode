
/**
 * Server middleware：Auth + RateLimit + 结构化日志 + Health check
 * ---------------------------------------------------------------
 * 设计目标：
 *   - 本地开发零配置（默认 disable，行为与之前一致）
 *   - 团队/云部署时通过环境变量启用（不改代码）
 *   - 零外部依赖：只用 express + node 标准库（pino 是可选 dep）
 *
 * 启用方式（环境变量）：
 *   MINI_AUTH_TOKEN=xxxxx           启用 Bearer Token 鉴权
 *   MINI_AUTH_TOKENS=k1,k2,k3       多 token 支持（团队场景每人一个）
 *   MINI_RATE_LIMIT=60              每分钟最多请求数（按 IP）；0=disable
 *   MINI_RATE_LIMIT_CHAT=20         /api/chat 单独限流（LLM 调用更贵）
 *   MINI_LOG_LEVEL=info             debug|info|warn|error
 *   MINI_LOG_FORMAT=json|text       默认 text（本地），生产建议 json
 *   MINI_TRUST_PROXY=1              部署在 nginx/cloudflare 后面时 set，让 IP 取 X-Forwarded-For
 */
import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';

// ----- Auth -------------------------------------------------------

interface AuthState {
  enabled: boolean;
  tokens: Set<string>;
  /** /health /api/health 等无需鉴权的路径 */
  bypassPaths: Set<string>;
}

let authState: AuthState | null = null;

function getAuthState(): AuthState {
  if (authState) return authState;
  const tokens = new Set<string>();
  const single = process.env.MINI_AUTH_TOKEN?.trim();
  if (single) tokens.add(single);
  const multi = process.env.MINI_AUTH_TOKENS?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  for (const t of multi) tokens.add(t);
  authState = {
    enabled: tokens.size > 0,
    tokens,
    bypassPaths: new Set(['/health', '/api/health', '/api/version']),
  };
  return authState;
}

/**
 * Bearer Token 鉴权。
 *   Authorization: Bearer <token>
 * 兼容 X-Mini-Token: <token>（不方便加 Authorization 头的场景）。
 * 用 timingSafeEqual 防 timing attack。
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const s = getAuthState();
  if (!s.enabled) return next();
  if (s.bypassPaths.has(req.path)) return next();

  const auth = req.header('authorization') ?? '';
  const fromBearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const fromHeader = req.header('x-mini-token') ?? '';
  const provided = fromBearer || fromHeader;

  if (!provided) {
    return res.status(401).json({ error: 'unauthorized', hint: 'Missing Bearer token' });
  }
  if (!constTimeMatchAny(provided, s.tokens)) {
    return res.status(401).json({ error: 'unauthorized', hint: 'Invalid token' });
  }
  next();
}

function constTimeMatchAny(input: string, valid: Set<string>): boolean {
  const inputBuf = Buffer.from(input);
  for (const v of valid) {
    const vBuf = Buffer.from(v);
    if (vBuf.length !== inputBuf.length) continue;
    try {
      if (crypto.timingSafeEqual(inputBuf, vBuf)) return true;
    } catch {
      /* length mismatch, ignore */
    }
  }
  return false;
}

// ----- Rate Limit -------------------------------------------------

interface Bucket {
  tokens: number;
  lastRefill: number;
}

class TokenBucketLimiter {
  private buckets = new Map<string, Bucket>();
  constructor(private capacity: number, private windowMs: number = 60_000) {}

  /** 返回 true 表示放行；false 表示拒绝（超额） */
  take(key: string): boolean {
    if (this.capacity <= 0) return true; // disabled
    const now = Date.now();
    let b = this.buckets.get(key);
    if (!b) {
      b = { tokens: this.capacity, lastRefill: now };
      this.buckets.set(key, b);
    }
    // 按窗口比例补充 token
    const elapsed = now - b.lastRefill;
    if (elapsed > 0) {
      const refill = (elapsed / this.windowMs) * this.capacity;
      b.tokens = Math.min(this.capacity, b.tokens + refill);
      b.lastRefill = now;
    }
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    return true;
  }

  /** 简单 GC：删除 token 满 + 闲置 > 10min 的 bucket */
  cleanup() {
    const now = Date.now();
    for (const [k, b] of this.buckets) {
      if (b.tokens >= this.capacity - 0.01 && now - b.lastRefill > 10 * 60_000) {
        this.buckets.delete(k);
      }
    }
  }

  size() {
    return this.buckets.size;
  }
}

const globalLimit = parseInt(process.env.MINI_RATE_LIMIT ?? '0', 10);
const chatLimit = parseInt(process.env.MINI_RATE_LIMIT_CHAT ?? '0', 10);
const globalLimiter = new TokenBucketLimiter(globalLimit);
const chatLimiter = new TokenBucketLimiter(chatLimit);

// 每 60s 清一次空 bucket
setInterval(() => {
  globalLimiter.cleanup();
  chatLimiter.cleanup();
}, 60_000).unref?.();

function clientKey(req: Request): string {
  // MINI_TRUST_PROXY=1 时优先信 X-Forwarded-For 首个 IP
  if (process.env.MINI_TRUST_PROXY === '1') {
    const xff = req.header('x-forwarded-for');
    if (xff) return xff.split(',')[0].trim();
  }
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

/**
 * 全局限流（默认按 IP）。会跳过 health/version 端点。
 */
export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  if (globalLimit <= 0) return next();
  if (req.path.startsWith('/health') || req.path === '/api/version') return next();
  const key = clientKey(req);
  if (!globalLimiter.take(key)) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'rate_limited', scope: 'global', hint: 'Try later' });
  }
  next();
}

/**
 * /api/chat 单独限流（LLM 调用更贵）。
 */
export function chatRateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  if (chatLimit <= 0) return next();
  const key = clientKey(req);
  if (!chatLimiter.take(key)) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'rate_limited', scope: 'chat', hint: 'LLM cost protected' });
  }
  next();
}

// ----- Health & Metrics -------------------------------------------

interface MetricsSnapshot {
  uptimeSec: number;
  rss: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  /** 累计请求数 */
  requests: number;
  /** 4xx 总数 */
  errors4xx: number;
  /** 5xx 总数 */
  errors5xx: number;
  /** 当前活跃 SSE 连接 */
  sseActive: number;
  /** rate limit 已记忆 IP 数 */
  rlBuckets: { global: number; chat: number };
}

const metrics = {
  requests: 0,
  errors4xx: 0,
  errors5xx: 0,
  sseActive: 0,
  startedAt: Date.now(),
};

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  metrics.requests += 1;
  res.on('finish', () => {
    const code = res.statusCode;
    if (code >= 500) metrics.errors5xx += 1;
    else if (code >= 400) metrics.errors4xx += 1;
  });
  next();
}

/** 给 SSE 路由手动调用（开始时 +1，close 时 -1） */
export const sseTrack = {
  inc() { metrics.sseActive += 1; },
  dec() { metrics.sseActive = Math.max(0, metrics.sseActive - 1); },
};

export function snapshot(): MetricsSnapshot {
  const mem = process.memoryUsage();
  return {
    uptimeSec: Math.round((Date.now() - metrics.startedAt) / 1000),
    rss: mem.rss,
    heapUsed: mem.heapUsed,
    heapTotal: mem.heapTotal,
    external: mem.external,
    requests: metrics.requests,
    errors4xx: metrics.errors4xx,
    errors5xx: metrics.errors5xx,
    sseActive: metrics.sseActive,
    rlBuckets: { global: globalLimiter.size(), chat: chatLimiter.size() },
  };
}

// ----- 结构化日志 --------------------------------------------------

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const cfgLevel: LogLevel =
  (process.env.MINI_LOG_LEVEL as LogLevel) in LEVEL_ORDER
    ? (process.env.MINI_LOG_LEVEL as LogLevel)
    : 'info';

const useJson = process.env.MINI_LOG_FORMAT === 'json';

function emit(level: LogLevel, msg: string, fields?: Record<string, any>) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[cfgLevel]) return;
  const ts = new Date().toISOString();
  if (useJson) {
    const record = { ts, level, msg, ...fields };
    // 故意用 console；electron stdout / docker 都能采集
    (level === 'error' ? console.error : console.log)(JSON.stringify(record));
  } else {
    const fieldStr = fields && Object.keys(fields).length
      ? ' ' + Object.entries(fields).map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`).join(' ')
      : '';
    (level === 'error' ? console.error : console.log)(`${ts} [${level.toUpperCase()}] ${msg}${fieldStr}`);
  }
}

export const logger = {
  debug: (msg: string, fields?: Record<string, any>) => emit('debug', msg, fields),
  info: (msg: string, fields?: Record<string, any>) => emit('info', msg, fields),
  warn: (msg: string, fields?: Record<string, any>) => emit('warn', msg, fields),
  error: (msg: string, fields?: Record<string, any>) => emit('error', msg, fields),
};

/**
 * 请求日志 middleware：method path status durMs。
 * 仅在 LOG_LEVEL ≤ debug 或非健康检查时打印，避免每秒一条 /health 噪音。
 */
export function requestLogMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on('finish', () => {
    const dur = Date.now() - start;
    const level: LogLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    if (req.path === '/health' || req.path === '/api/health') {
      if (cfgLevel !== 'debug') return;
    }
    logger[level](`${req.method} ${req.path}`, {
      status: res.statusCode,
      durMs: dur,
      ip: clientKey(req),
    });
  });
  next();
}

/** 启动时打印一次配置摘要（让运维一眼看到 Auth/RL 是否启用） */
export function printStartupBanner(port: number, workspace: string) {
  const s = getAuthState();
  logger.info('miniCodeIDE server starting', {
    port,
    workspace,
    auth: s.enabled ? `enabled (${s.tokens.size} token(s))` : 'disabled',
    rateLimit: globalLimit > 0 ? `${globalLimit}/min` : 'disabled',
    rateLimitChat: chatLimit > 0 ? `${chatLimit}/min` : 'disabled',
    logFormat: useJson ? 'json' : 'text',
    logLevel: cfgLevel,
  });
}