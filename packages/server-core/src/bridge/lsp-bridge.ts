
/**
 * LSP-over-WebSocket 代理：
 * - 每个 WS 连接 spawn 一个 `typescript-language-server --stdio`
 * - 把 WS 文本帧 ↔ LSP stdio（带 Content-Length 头）的格式互转
 * - 前端可用 monaco-languageclient 接它（路径：ws://host/lsp/ts）
 *
 * 启动条件：要装好 `typescript-language-server`（全局或 npx 都行）
 *   npm i -g typescript typescript-language-server
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { WebSocketServer, type WebSocket } from 'ws';
import type { Server } from 'node:http';

export interface LspBridgeOptions {
  /** WS path 前缀，例如 '/lsp' */
  path?: string;
  /** 工作区根，写入 initialize 参数 */
  cwd: string;
}

export function attachLspBridge(httpServer: Server, opts: LspBridgeOptions) {
  const path = opts.path ?? '/lsp';
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    const url = req.url ?? '';
    if (!url.startsWith(path)) return;
    wss.handleUpgrade(req, socket as any, head, (ws) => {
      const lang = url.slice(path.length).replace(/^\//, '') || 'ts';
      handleConnection(ws, lang, opts.cwd);
    });
  });

  console.log(`[lsp] bridge ready on ws://host${path}/<lang>`);
}

function handleConnection(ws: WebSocket, lang: string, cwd: string) {
  let child: ChildProcessWithoutNullStreams | null = null;
  try {
    child = spawnLsp(lang, cwd);
  } catch (e) {
    console.error('[lsp] spawn failed', e);
    ws.close(1011, `LSP for ${lang} not available`);
    return;
  }
  // 关键：catch child 自己的 'error' 事件，避免 unhandled error 让进程退出
  child.on('error', (err) => {
    console.warn(`[lsp] ${lang} child error: ${err.message}. Hint: npm i -g typescript typescript-language-server`);
    try {
      ws.close(1011, 'LSP backend not installed');
    } catch {
      /* */
    }
  });
  console.log(`[lsp] ws connected for ${lang} (pid=${child.pid})`);

  // ----- WS → child stdin (加 LSP headers) -----
  ws.on('message', (data) => {
    if (!child || !child.stdin.writable) return;
    const text = typeof data === 'string' ? data : data.toString('utf-8');
    const payload = `Content-Length: ${Buffer.byteLength(text, 'utf8')}\r\n\r\n${text}`;
    try {
      child.stdin.write(payload);
    } catch {
      /* child died */
    }
  });

  // ----- child stdout → WS (剥 LSP headers) -----
  let buf = Buffer.alloc(0);
  child.stdout.on('data', (chunk: Buffer) => {
    buf = Buffer.concat([buf, chunk]);
    while (true) {
      const headerEnd = buf.indexOf('\r\n\r\n');
      if (headerEnd === -1) return;
      const header = buf.slice(0, headerEnd).toString('utf8');
      const m = /Content-Length: (\d+)/i.exec(header);
      if (!m) {
        buf = buf.slice(headerEnd + 4);
        continue;
      }
      const len = Number(m[1]);
      const total = headerEnd + 4 + len;
      if (buf.length < total) return;
      const body = buf.slice(headerEnd + 4, total).toString('utf8');
      buf = buf.slice(total);
      try {
        ws.send(body);
      } catch {
        /* ws closed */
      }
    }
  });

  child.stderr.on('data', (c) => {
    process.stderr.write(`[lsp/${lang}] ${c}`);
  });
  child.on('exit', (code) => {
    console.log(`[lsp] ${lang} child exited code=${code}`);
    try {
      ws.close();
    } catch {
      /* */
    }
  });

  ws.on('close', () => {
    console.log(`[lsp] ws closed for ${lang}`);
    child?.kill();
  });
  ws.on('error', () => child?.kill());
}

function spawnLsp(lang: string, cwd: string): ChildProcessWithoutNullStreams {
  switch (lang) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'typescript':
    case 'javascript':
      return spawn('typescript-language-server', ['--stdio'], { cwd });
    default:
      throw new Error(`Unsupported lang for LSP: ${lang}`);
  }
}