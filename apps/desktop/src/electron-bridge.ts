

/**
 * Electron file:// adapter
 * -----------------------------------------------------------------------------
 * 问题：renderer 在打包后从 file:// 加载，所有 fetch('/api/xxx') 会被解析成
 *       file:///api/xxx → "Failed to fetch"。
 *
 * 之前在 preload.js 里 patch 过 window.fetch，但 contextIsolation=true 的情况下，
 * preload 在 isolated world，patch 不到 main world 的真实 fetch。
 *
 * 这个文件在 renderer 入口（main.tsx）最早被 import，patch 真实的
 * window.fetch / XMLHttpRequest / EventSource / WebSocket，把以 / 开头的
 * /api、/health、/lsp、/ws 改写到 server 绝对地址。
 *
 * server 端口：默认 5174，可被 VITE_SERVER_PORT 覆盖（dev 用）。
 */

const SERVER_PORT =
  (import.meta as any).env?.VITE_SERVER_PORT ?? '5174';
const SERVER_BASE = `http://127.0.0.1:${SERVER_PORT}`;
const WS_BASE = `ws://127.0.0.1:${SERVER_PORT}`;
const CLOUD_PORT =
  (import.meta as any).env?.VITE_CLOUD_PORT ?? '4000';
const CLOUD_BASE = `http://127.0.0.1:${CLOUD_PORT}`;

function isApiPath(p: string): boolean {
  return (
    p.startsWith('/api/') ||
    p === '/api' ||
    p.startsWith('/health') ||
    p === '/health'
  );
}

function isCloudPath(p: string): boolean {
  return (
    p.startsWith('/cloud-api/') ||
    p === '/cloud-api'
  );
}

function isWsPath(p: string): boolean {
  return p.startsWith('/lsp') || p.startsWith('/ws');
}

function rewriteCloudPath(p: string): string {
  // /cloud-api/api/auth/login → /api/auth/login
  const stripped = p.replace(/^\/cloud-api/, '');
  return CLOUD_BASE + stripped;
}

// 只在 file:// 协议（打包后）启用 patch；http://（vite dev）走 vite proxy 即可
if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
  // ---- fetch ----
  const origFetch = window.fetch.bind(window);
  window.fetch = function patchedFetch(input: RequestInfo | URL, init?: RequestInit) {
    if (typeof input === 'string') {
      if (isCloudPath(input)) {
        input = rewriteCloudPath(input);
      } else if (isApiPath(input)) {
        input = SERVER_BASE + input;
      }
    } else if (input instanceof Request) {
      const origUrl = input.url;
      // 从完整 URL 中提取 pathname 再判断，而非对整个 URL 做 startsWith
      const urlObj = new URL(origUrl, window.location.origin);
      const pathname = urlObj.pathname;
      if (isCloudPath(pathname)) {
        const newUrl = rewriteCloudPath(pathname) + urlObj.search;
        input = new Request(newUrl, input);
      } else if (isApiPath(pathname)) {
        const newUrl = SERVER_BASE + pathname + urlObj.search;
        input = new Request(newUrl, input);
      }
    } else if (input instanceof URL) {
      if (isCloudPath(input.pathname)) {
        input = rewriteCloudPath(input.pathname) + input.search;
      } else if (isApiPath(input.pathname)) {
        input = SERVER_BASE + input.pathname + input.search;
      }
    }
    return origFetch(input as any, init);
  } as typeof window.fetch;

  // ---- XMLHttpRequest ----
  const OrigXHR = window.XMLHttpRequest;
  class PatchedXHR extends OrigXHR {
    open(
      method: string,
      url: string | URL,
      async: boolean = true,
      user?: string | null,
      password?: string | null,
    ): void {
      let u = typeof url === 'string' ? url : url.toString();
      if (u.startsWith('/') && isCloudPath(u)) {
        u = rewriteCloudPath(u);
      } else if (u.startsWith('/') && isApiPath(u)) {
        u = SERVER_BASE + u;
      }
      // @ts-ignore — overload signature
      return super.open(method, u, async, user, password);
    }
  }
  window.XMLHttpRequest = PatchedXHR as any;

  // ---- EventSource (SSE) ----
  if (typeof window.EventSource === 'function') {
    const OrigES = window.EventSource;
    function PatchedES(url: string | URL, opts?: EventSourceInit) {
      let u = typeof url === 'string' ? url : url.toString();
      if (u.startsWith('/') && isCloudPath(u)) {
        u = rewriteCloudPath(u);
      } else if (u.startsWith('/') && isApiPath(u)) {
        u = SERVER_BASE + u;
      }
      return new OrigES(u, opts);
    }
    PatchedES.prototype = OrigES.prototype;
    (PatchedES as any).CONNECTING = OrigES.CONNECTING;
    (PatchedES as any).OPEN = OrigES.OPEN;
    (PatchedES as any).CLOSED = OrigES.CLOSED;
    window.EventSource = PatchedES as any;
  }

  // ---- WebSocket ----
  if (typeof window.WebSocket === 'function') {
    const OrigWS = window.WebSocket;
    function PatchedWS(url: string | URL, protocols?: string | string[]) {
      let u = typeof url === 'string' ? url : url.toString();
      if (u.startsWith('/') && isWsPath(u)) {
        u = WS_BASE + u;
      }
      return protocols ? new OrigWS(u, protocols) : new OrigWS(u);
    }
    PatchedWS.prototype = OrigWS.prototype;
    (PatchedWS as any).CONNECTING = OrigWS.CONNECTING;
    (PatchedWS as any).OPEN = OrigWS.OPEN;
    (PatchedWS as any).CLOSING = OrigWS.CLOSING;
    (PatchedWS as any).CLOSED = OrigWS.CLOSED;
    window.WebSocket = PatchedWS as any;
  }

  // eslint-disable-next-line no-console
  console.log('[electron-bridge] patched fetch/XHR/SSE/WS → ' + SERVER_BASE);
}

export const ELECTRON_SERVER_BASE = SERVER_BASE;