
/**
 * main.ts —— @mini/server-node 入口（裸 Node 实现）
 * ---------------------------------------------------------------
 * 参考 CodeFlicker gateway/server.impl.ts 的模式：
 *
 *   const httpServer = http.createServer(handler)
 *   handler(req, res):
 *     1. CORS preflight
 *     2. auth + rateLimit + log + metrics
 *     3. router.match(method, path) → handler({req,res,params,query})
 *     4. fallback 404
 *
 *   const wss = new WebSocketServer({ noServer: true })
 *   httpServer.on('upgrade') → 按 path 分发：
 *     /lsp/*       → existing lsp-bridge（典型 LSP-over-WS）
 *     /terminal/*  → existing terminal-bridge（pty）
 *
 *   httpServer.listen(PORT) → done.
 *
 * 没有 Express，没有 NestJS，没有装饰器，没有 reflect-metadata。
 * 1 个 http.createServer + 1 个 ws.WebSocketServer + 1 个手写 Router.
 */
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { Services } from './services.js';
import { env } from './env.js';
import { Router } from './router/router.js';
import { CORS_HEADERS, queryToObject, sendJson } from './router/http-utils.js';
import { registerHandlers } from './handlers/register.js';
import { attachLspBridge } from '../../server/src/lsp-bridge.js';
import { attachTerminalBridge } from '../../server/src/terminal-bridge.js';

// ----- 简单 token bucket（per-IP rate limit）-----
const buckets = new Map<string, { tokens: number; lastRefill: number }>();
function takeToken(ip: string, capacity: number, windowMs = 60_000): boolean {
  if (capacity <= 0) return true;
  const now = Date.now();
  let b = buckets.get(ip);
  if (!b) { b = { tokens: capacity, lastRefill: now }; buckets.set(ip, b); }
  const elapsed = now - b.lastRefill;
  if (elapsed > windowMs) {
    b.tokens = capacity; b.lastRefill = now;
  } else {
    const refill = (elapsed / windowMs) * capacity;
    b.tokens = Math.min(capacity, b.tokens + refill);
    b.lastRefill = now;
  }
  if (b.tokens >= 1) { b.tokens -= 1; return true; }
  return false;
}

// ----- auth -----
const authTokens = new Set<string>();
if (env.AUTH_TOKEN) authTokens.add(env.AUTH_TOKEN);
for (const t of env.AUTH_TOKENS) authTokens.add(t);
const authBypass = new Set(['/health', '/api/health', '/api/version']);
function checkAuth(req: IncomingMessage, pathname: string): boolean {
  if (authTokens.size === 0) return true;
  if (authBypass.has(pathname)) return true;
  const auth = (req.headers['authorization'] as string) ?? '';
  const fromBearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const fromHeader = (req.headers['x-mini-token'] as string) ?? '';
  const provided = fromBearer || fromHeader;
  return !!provided && authTokens.has(provided);
}

async function main() {
  console.log(`[server-node] workspace = ${env.WORKSPACE}`);
  console.log('[server-node] initializing services...');
  const t0 = performance.now();
  const services = new Services(env.WORKSPACE);
  await services.init();
  console.log(`[server-node] services ready (${(performance.now() - t0).toFixed(1)}ms)`);

  const router = new Router();
  registerHandlers(router, services);
  console.log(`[server-node] ${router.snapshot().length} routes registered`);

  // ----- request handler -----
  const handler = async (req: IncomingMessage, res: ServerResponse) => {
    const start = Date.now();
    const reqIp =
      ((req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()) ||
      req.socket.remoteAddress || 'unknown';

    // 解析 URL（取 host 占位，host 真值无所谓，只用 pathname/search）
    let url: URL;
    try {
      url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    } catch {
      res.writeHead(400, CORS_HEADERS).end('Bad Request');
      return;
    }
    const pathname = url.pathname;
    const method = (req.method ?? 'GET').toUpperCase();

    // CORS preflight
    if (method === 'OPTIONS') {
      res.writeHead(204, CORS_HEADERS).end();
      return;
    }

    // auth
    if (!checkAuth(req, pathname)) {
      return sendJson(res, 401, { error: 'unauthorized', hint: 'Missing/invalid token' });
    }

    // rate limit（全局 + /api/chat 单独）
    if (!takeToken(reqIp, env.RATE_LIMIT)) {
      return sendJson(res, 429, { error: 'rate limit exceeded' });
    }
    if (pathname === '/api/chat' && !takeToken(`chat:${reqIp}`, env.RATE_LIMIT_CHAT)) {
      return sendJson(res, 429, { error: 'chat rate limit exceeded' });
    }

    // route match
    const match = router.match(method, pathname);
    if (!match) {
      return sendJson(res, 404, { error: 'not found', method, path: pathname });
    }

    try {
      await match.route.handler({
        req, res, url,
        params: match.params,
        query: queryToObject(url),
      });
    } catch (e: any) {
      console.error(`[server-node] handler error on ${method} ${pathname}`, e);
      if (!res.headersSent) sendJson(res, 500, { error: e?.message ?? String(e) });
      else { try { res.end(); } catch { /* */ } }
    } finally {
      const dur = Date.now() - start;
      // 简洁 access log（避开高频 SSE）
      if (pathname !== '/api/chat' && pathname !== '/api/inline-edit') {
        console.log(`[http] ${method} ${pathname} ${res.statusCode} ${dur}ms`);
      }
    }
  };

  const httpServer = http.createServer(handler);

  // WebSocket：复用 express 版的 bridge，它们都接 (httpServer, opts)，
  // 自己挂 'upgrade' listener 并通过 path 前缀分发
  attachLspBridge(httpServer, { path: '/lsp', cwd: env.WORKSPACE });
  attachTerminalBridge(httpServer, { path: '/terminal', cwd: env.WORKSPACE });

  httpServer.listen(env.PORT, () => {
    console.log(`[server-node] 🚀 listening on http://127.0.0.1:${env.PORT}`);
    console.log(`[server-node] startup total ${(performance.now() - t0).toFixed(1)}ms`);
  });

  // graceful shutdown
  const shutdown = (sig: string) => {
    console.log(`[server-node] ${sig} received, closing...`);
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref?.();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((e) => {
  console.error('[server-node] fatal', e);
  process.exit(1);
});