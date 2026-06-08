
/**
 * http-utils.ts —— HTTP req/res 辅助函数
 * ---------------------------------------------------------------
 * 不用 Express 后，这些工具替代 res.json() / req.body / res.sse() 等便利方法
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Mini-Token',
  'Access-Control-Max-Age': '86400',
};

export function sendJson(res: ServerResponse, status: number, body: any) {
  if (res.writableEnded) return;
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...CORS_HEADERS,
  });
  res.end(JSON.stringify(body));
}

export function sendText(res: ServerResponse, status: number, body: string, contentType = 'text/plain; charset=utf-8') {
  if (res.writableEnded) return;
  res.writeHead(status, { 'Content-Type': contentType, ...CORS_HEADERS });
  res.end(body);
}

export function send404(res: ServerResponse, msg = 'not found') {
  sendJson(res, 404, { error: msg });
}

export function send400(res: ServerResponse, msg: string) {
  sendJson(res, 400, { error: msg });
}

export function send500(res: ServerResponse, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  sendJson(res, 500, { error: msg });
}

/** 异步读 body（默认 4MB 上限，chat 路由覆写到 10MB） */
export async function readBody(req: IncomingMessage, opts?: { limit?: number }): Promise<any> {
  const limit = opts?.limit ?? 4 * 1024 * 1024;
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const c of req as AsyncIterable<Buffer>) {
    total += c.length;
    if (total > limit) {
      throw new Error(`request body too large (${total} > ${limit})`);
    }
    chunks.push(c);
  }
  if (total === 0) return undefined;
  const raw = Buffer.concat(chunks).toString('utf-8');
  const ct = (req.headers['content-type'] ?? '').toLowerCase();
  if (ct.includes('application/json')) {
    try { return JSON.parse(raw); }
    catch (e) { throw new Error(`invalid JSON body: ${(e as Error).message}`); }
  }
  return raw;
}

/** SSE 通道：写 chat stream 用 */
export interface SseChannel {
  send(data: any): void;
  end(): void;
  readonly aborted: boolean;
  readonly signal: AbortSignal;
}

export function openSse(req: IncomingMessage, res: ServerResponse): SseChannel {
  if (!res.headersSent) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      ...CORS_HEADERS,
    });
  }
  const ac = new AbortController();
  let ended = false;
  const cleanup = () => {
    if (ended) return;
    ended = true;
    ac.abort();
  };
  req.once('close', cleanup);
  res.once('close', cleanup);
  res.once('error', cleanup);

  // 周期 keepalive，避免代理切断
  const keepalive = setInterval(() => {
    if (ended || res.writableEnded) return;
    try { res.write(':\n\n'); } catch { cleanup(); }
  }, 15_000);
  keepalive.unref?.();

  return {
    send(data) {
      if (ended || res.writableEnded) return;
      try {
        const payload = typeof data === 'string' ? data : JSON.stringify(data);
        res.write(`data: ${payload}\n\n`);
      } catch { cleanup(); }
    },
    end() {
      if (ended) return;
      clearInterval(keepalive);
      try { res.end(); } catch { /* */ }
      cleanup();
    },
    get aborted() { return ac.signal.aborted; },
    get signal() { return ac.signal; },
  };
}

/** 把 query string 拍平为 Record（重复 key 取最后一个） */
export function queryToObject(url: URL): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of url.searchParams) out[k] = v;
  return out;
}