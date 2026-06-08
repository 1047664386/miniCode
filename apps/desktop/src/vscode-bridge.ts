
/**
 * vscode-bridge.ts
 * -----------------------------------------------------------------------------
 * 跨进程通信桥：外层 React (mainWindow) ↔ iframe 里的 code-server (vscode-host)
 *
 * 设计动机
 * --------
 * 当前架构下，VSCode 编辑器跑在一个独立的 code-server HTTP 进程里，通过 iframe
 * 嵌入到我们自研的 React 壳。两者属于不同的 origin（file:// vs http://localhost:8000）
 * 且不是同一个 Electron 进程，所以无法直接共享 JS 状态。
 *
 * 我们用 window.postMessage 做最小可用桥（类似 RPC）：
 *
 *   ┌──────────────┐  postMessage  ┌────────────────┐
 *   │ React 主框架 │ ────────────▶ │  iframe (VSCode)│
 *   │ (Chat / AI)  │ ◀──────────── │  (code-server) │
 *   └──────────────┘   postMessage └────────────────┘
 *
 * 协议（约定俗成的 envelope 格式）：
 *   { __mci: 1, type: '<event>', payload: any }
 *
 * 现阶段支持的事件：
 *   - host → iframe: 'ai.insert-text'     在当前光标位置插入文本
 *   - host → iframe: 'ai.request-context' 请求当前编辑器选中内容 / 当前文件
 *   - iframe → host: 'editor.context'     上报当前 selection / file path
 *   - iframe → host: 'editor.ready'       iframe 内桥准备好了（heartbeat）
 *
 * 注意
 * ----
 *   code-server 内部 VSCode 默认不会向外层 postMessage —— 要真正打通需要在
 *   code-server 的 extension 里注入一段 webview-bridge 代码。这里先把宿主侧
 *   实现做完整，等下一步在 stage 时把 bridge.js 自动拷进 code-server 的
 *   --extensions-dir，就能联通。
 */

type BridgeEnvelope<T = any> = {
  __mci: 1;
  type: string;
  payload?: T;
  reqId?: string;
};

type EditorContext = {
  filePath?: string;
  language?: string;
  selectionText?: string;
  selection?: { startLine: number; endLine: number };
};

const PROTOCOL_KEY = '__mci';

class VsBridge {
  private iframe: HTMLIFrameElement | null = null;
  private listeners = new Map<string, Set<(payload: any) => void>>();
  private pending = new Map<string, (payload: any) => void>();
  private lastContext: EditorContext = {};
  private ready = false;

  attach(iframe: HTMLIFrameElement) {
    this.iframe = iframe;
    if (!this._installed) {
      window.addEventListener('message', this._onMessage);
      this._installed = true;
    }
  }

  detach() {
    this.iframe = null;
    this.ready = false;
  }

  /**
   * 向 iframe 发送一条消息。
   * 由于 iframe 是 http://localhost:8000，我们用 '*' 作为 targetOrigin（仅本地）。
   */
  send<T>(type: string, payload?: T): void {
    if (!this.iframe?.contentWindow) return;
    const env: BridgeEnvelope<T> = { __mci: 1, type, payload };
    try {
      this.iframe.contentWindow.postMessage(env, '*');
    } catch {
      /* ignore */
    }
  }

  /** 请求 iframe 返回一份 editor context（带 reqId 等待回执） */
  requestContext(timeoutMs = 500): Promise<EditorContext> {
    return new Promise((resolve) => {
      if (!this.iframe?.contentWindow) return resolve(this.lastContext);
      const reqId = `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const timer = setTimeout(() => {
        this.pending.delete(reqId);
        // 超时就返回最后已知的（可能是 stale 但总比空好）
        resolve(this.lastContext);
      }, timeoutMs);
      this.pending.set(reqId, (payload) => {
        clearTimeout(timer);
        resolve(payload as EditorContext);
      });
      const env: BridgeEnvelope = { __mci: 1, type: 'ai.request-context', reqId };
      this.iframe.contentWindow.postMessage(env, '*');
    });
  }

  on(type: string, cb: (payload: any) => void): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(cb);
    return () => set!.delete(cb);
  }

  /** 当前是否真的与 iframe 桥连通（要等 'editor.ready' 心跳） */
  isReady() {
    return this.ready;
  }

  getLastContext(): EditorContext {
    return { ...this.lastContext };
  }

  // --- internals ---
  private _installed = false;
  private _onMessage = (e: MessageEvent) => {
    const data: any = e.data;
    if (!data || typeof data !== 'object' || data[PROTOCOL_KEY] !== 1) return;
    const env = data as BridgeEnvelope;
    // 回执
    if (env.reqId && this.pending.has(env.reqId)) {
      const cb = this.pending.get(env.reqId)!;
      this.pending.delete(env.reqId);
      cb(env.payload);
      return;
    }
    switch (env.type) {
      case 'editor.ready':
        this.ready = true;
        this._emit('ready', env.payload);
        break;
      case 'editor.context':
        this.lastContext = (env.payload ?? {}) as EditorContext;
        this._emit('context', this.lastContext);
        break;
      default:
        this._emit(env.type, env.payload);
    }
  };

  private _emit(type: string, payload: any) {
    const set = this.listeners.get(type);
    if (!set) return;
    set.forEach((cb) => {
      try {
        cb(payload);
      } catch {
        /* ignore */
      }
    });
  }
}

export const vsBridge = new VsBridge();
export type { EditorContext };