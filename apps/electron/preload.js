
/**
 * Preload：在 renderer 里通过 window.electronAPI 暴露受限 API
 *  - 只暴露 IPC handle，不暴露任何 node API
 *  - renderer 仍走 fetch('/api/xxx') —— preload 在 file:// 下重写为 http://127.0.0.1:5174/api/xxx
 */
const { contextBridge, ipcRenderer } = require('electron');

const SERVER_BASE = `http://127.0.0.1:${process.env.MINI_PORT || 5174}`;

// 在 file:// 协议下（生产打包），相对路径 /api/... 会被解析成 file:///api/...
// 这里 patch 全局 fetch + XMLHttpRequest + EventSource，把以 / 开头的 url 改为绝对 server URL
function isApiPath(input) {
  if (typeof input !== 'string') return false;
  return input.startsWith('/api/') || input === '/api' || input.startsWith('/health');
}

if (location.protocol === 'file:') {
  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    if (typeof input === 'string' && isApiPath(input)) {
      input = SERVER_BASE + input;
    } else if (input && typeof input === 'object' && 'url' in input && isApiPath(input.url)) {
      input = new Request(SERVER_BASE + input.url, input);
    }
    return origFetch.call(this, input, init);
  };

  const OrigXHR = window.XMLHttpRequest;
  function PatchedXHR() {
    const xhr = new OrigXHR();
    const origOpen = xhr.open;
    xhr.open = function (method, url, ...rest) {
      if (typeof url === 'string' && isApiPath(url)) {
        url = SERVER_BASE + url;
      }
      return origOpen.call(this, method, url, ...rest);
    };
    return xhr;
  }
  PatchedXHR.prototype = OrigXHR.prototype;
  window.XMLHttpRequest = PatchedXHR;

  // SSE：聊天用了 EventSource
  if (typeof window.EventSource === 'function') {
    const OrigES = window.EventSource;
    function PatchedES(url, opts) {
      if (typeof url === 'string' && isApiPath(url)) url = SERVER_BASE + url;
      return new OrigES(url, opts);
    }
    PatchedES.prototype = OrigES.prototype;
    PatchedES.CONNECTING = OrigES.CONNECTING;
    PatchedES.OPEN = OrigES.OPEN;
    PatchedES.CLOSED = OrigES.CLOSED;
    window.EventSource = PatchedES;
  }

  // WebSocket：lsp 用了 ws://
  if (typeof window.WebSocket === 'function') {
    const OrigWS = window.WebSocket;
    function PatchedWS(url, protocols) {
      // /lsp/xxx 之类的相对 ws 路径 → 实际 server 在 5174
      if (typeof url === 'string' && (url.startsWith('/lsp') || url.startsWith('/ws'))) {
        url = SERVER_BASE.replace('http://', 'ws://') + url;
      }
      return protocols ? new OrigWS(url, protocols) : new OrigWS(url);
    }
    PatchedWS.prototype = OrigWS.prototype;
    PatchedWS.CONNECTING = OrigWS.CONNECTING;
    PatchedWS.OPEN = OrigWS.OPEN;
    PatchedWS.CLOSING = OrigWS.CLOSING;
    PatchedWS.CLOSED = OrigWS.CLOSED;
    window.WebSocket = PatchedWS;
  }
}

contextBridge.exposeInMainWorld('electronAPI', {
  getServerUrl: () => ipcRenderer.invoke('get-server-url'),
  getConfig: () => ipcRenderer.invoke('get-config'),
  setConfig: (patch) => ipcRenderer.invoke('set-config', patch),
  openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),
  saveFileDialog: (opts) => ipcRenderer.invoke('save-file-dialog', opts ?? {}),
  relaunchApp: () => ipcRenderer.invoke('relaunch-app'),
  getCodeServerStatus: () => ipcRenderer.invoke('get-code-server-status'),
  onCodeServerStatus: (cb) => {
    const handler = (_e, status) => cb(status);
    ipcRenderer.on('code-server-status', handler);
    return () => ipcRenderer.removeListener('code-server-status', handler);
  },
  onUpdateAvailable: (cb) => {
    ipcRenderer.on('update-available', (_e, info) => cb(info));
  },
});

// Agents Window：独立 namespace，与主 IDE API 不冲突
contextBridge.exposeInMainWorld('mciAgents', {
  openWindow: () => ipcRenderer.invoke('agents-window:open'),
  closeWindow: () => ipcRenderer.invoke('agents-window:close'),
  applyToMain: (payload) => ipcRenderer.send('mci:apply-from-agents', payload),
  onApplyEdit: (cb) => {
    const handler = (_e, p) => cb(p);
    ipcRenderer.on('mci:apply-edit', handler);
    return () => ipcRenderer.removeListener('mci:apply-edit', handler);
  },
  /** 主 IDE → Agents Window：推送选区/文件（attach） */
  sendAttachSelection: (payload) => ipcRenderer.send('agents:attach-selection', payload),
  /** Agents Window：注册接收 attach 的回调 */
  onAttachSelection: (cb) => {
    const handler = (_e, p) => cb(p);
    ipcRenderer.on('agents:attach-selection', handler);
    return () => ipcRenderer.removeListener('agents:attach-selection', handler);
  },
});