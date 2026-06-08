
/**
 * 轻量 LSP 客户端：仅 completion 一项作为示例 / 验证。
 * - 用 WS 直连 /lsp/ts
 * - 跟 monaco TS 内置 worker 并存：作为 "LSP" provider 注入
 *
 * 默认不启用；调用 connectLspIfAvailable() 来启动。
 */
import * as monaco from 'monaco-editor';

interface JsonRpcReq {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: any;
}
interface JsonRpcResp {
  jsonrpc: '2.0';
  id: number;
  result?: any;
  error?: { message: string };
}

let nextId = 1;
const pending = new Map<number, (r: JsonRpcResp) => void>();
let ws: WebSocket | null = null;

function send(method: string, params: any): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return reject(new Error('LSP not connected'));
    const id = nextId++;
    pending.set(id, (r) => (r.error ? reject(new Error(r.error.message)) : resolve(r.result)));
    const req: JsonRpcReq = { jsonrpc: '2.0', id, method, params };
    ws.send(JSON.stringify(req));
  });
}

function notify(method: string, params: any) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ jsonrpc: '2.0', method, params }));
}

async function initialize(rootUri: string) {
  await send('initialize', {
    processId: null,
    rootUri,
    capabilities: {
      textDocument: {
        completion: { completionItem: { snippetSupport: false } },
        hover: {},
        synchronization: { didSave: true },
      },
    },
  });
  notify('initialized', {});
}

const openedDocs = new Set<string>();

export function notifyDocOpen(uri: string, language: string, version: number, text: string) {
  if (openedDocs.has(uri)) {
    notify('textDocument/didChange', {
      textDocument: { uri, version },
      contentChanges: [{ text }],
    });
    return;
  }
  openedDocs.add(uri);
  notify('textDocument/didOpen', {
    textDocument: { uri, languageId: language, version, text },
  });
}

export async function connectLspIfAvailable(opts: { wsUrl: string; rootUri: string }): Promise<boolean> {
  try {
    await new Promise<void>((resolve, reject) => {
      const sock = new WebSocket(opts.wsUrl);
      const timer = setTimeout(() => {
        sock.close();
        reject(new Error('LSP connect timeout'));
      }, 3000);
      sock.onopen = () => {
        clearTimeout(timer);
        ws = sock;
        resolve();
      };
      sock.onerror = () => {
        clearTimeout(timer);
        reject(new Error('LSP connect failed'));
      };
    });

    ws!.onmessage = (e) => {
      try {
        const msg: JsonRpcResp = JSON.parse(e.data);
        if (typeof msg.id === 'number') {
          const cb = pending.get(msg.id);
          if (cb) {
            pending.delete(msg.id);
            cb(msg);
          }
        }
        // 忽略 server-initiated notifications（diagnostics 等），后续扩展
      } catch {
        /* */
      }
    };
    ws!.onclose = () => {
      ws = null;
      openedDocs.clear();
    };

    await initialize(opts.rootUri);
    registerCompletionProvider();
    console.log('[lsp] connected & initialized');
    return true;
  } catch (e) {
    console.warn('[lsp] not available, fallback to monaco built-in:', (e as Error).message);
    return false;
  }
}

function registerCompletionProvider() {
  const langs = ['typescript', 'javascript'];
  for (const lang of langs) {
    monaco.languages.registerCompletionItemProvider(lang, {
      triggerCharacters: ['.', '(', '"', "'", '/', '@', '<'],
      async provideCompletionItems(model, position) {
        try {
          const uri = model.uri.toString();
          notifyDocOpen(uri, lang, model.getVersionId(), model.getValue());
          const res = await send('textDocument/completion', {
            textDocument: { uri },
            position: { line: position.lineNumber - 1, character: position.column - 1 },
          });
          const items = (res?.items ?? res ?? []) as any[];
          const word = model.getWordUntilPosition(position);
          const range = new monaco.Range(
            position.lineNumber,
            word.startColumn,
            position.lineNumber,
            word.endColumn,
          );
          return {
            suggestions: items.slice(0, 100).map((it) => ({
              label: it.label,
              kind: mapKind(it.kind),
              insertText: it.insertText ?? it.label,
              detail: it.detail,
              documentation: it.documentation?.value ?? it.documentation,
              range,
            })),
          };
        } catch {
          return { suggestions: [] };
        }
      },
    });
  }
}

function mapKind(k?: number): monaco.languages.CompletionItemKind {
  // 不严格映射，简单兜底
  return (
    k ? (k as unknown as monaco.languages.CompletionItemKind) : monaco.languages.CompletionItemKind.Text
  );
}