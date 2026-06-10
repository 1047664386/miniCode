/**
 * minicodeide-bridge: code-server 内的扩展。
 *
 * 责任：
 *   1) 把 VSCode 当前编辑器状态（活动文件、selection、语言）通过 server-node
 *      转发到外层 React 主壳。
 *   2) 注册命令 / 右键菜单「MCI: Add Selection to Composer」「MCI: Add File to Composer」
 *      「MCI: Open Agents Window」，让用户在 VSCode 模式下也能把选区/整文件喂给我们
 *      自研的 AI 模块（而不是 code-server 自带的 chat）。
 *
 * 工作原理
 * ----
 * 扩展跑在 Extension Host（Node.js）进程里，没有直接的 DOM `window`。
 * 通信走 HTTP：扩展 fetch → server-node 的 /api/composer/forward → server-node 再
 * 通过 SSE /api/composer/events 广播给外层 React 主壳。
 */
const vscode = require('vscode');
const http = require('http');

const MCI_SERVER_PORT = Number(process.env.MINI_PORT || 5174);

/** 通过 server-node 的转发接口把"加入对话"事件发给外层 React 主壳 */
function postToShellViaServer(event, payload) {
  try {
    const body = JSON.stringify({ event, payload });
    const req = http.request({
      host: '127.0.0.1',
      port: MCI_SERVER_PORT,
      path: '/api/composer/forward',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => res.resume());
    req.on('error', (e) => console.warn('[mci-bridge] forward error:', e.message));
    req.write(body);
    req.end();
  } catch (e) {
    console.warn('[mci-bridge] forward exception:', e && e.message);
  }
}

function snapshotContext() {
  const ed = vscode.window.activeTextEditor;
  if (!ed) return {};
  const doc = ed.document;
  const sel = ed.selection;
  return {
    filePath: doc.uri.fsPath,
    language: doc.languageId,
    selectionText: doc.getText(sel),
    fullText: sel.isEmpty ? doc.getText() : undefined,
    selection: {
      startLine: sel.start.line + 1,
      endLine: sel.end.line + 1,
    },
  };
}

function notifyCurrentWorkspace() {
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    postToShellViaServer('workspace.current', { path: folders[0].uri.fsPath });
  }
}

function activate(context) {
  console.log('[mci-bridge] activated, server port =', MCI_SERVER_PORT);

  // 上报当前 workspace，并在变化时同步
  notifyCurrentWorkspace();
  const wsDisposable = vscode.workspace.onDidChangeWorkspaceFolders(() => {
    notifyCurrentWorkspace();
  });
  context.subscriptions.push(wsDisposable);

  // ---- 命令：Add Selection to MCI Composer ----
  const addToComposer = vscode.commands.registerCommand('mci.addToComposer', () => {
    const ctx = snapshotContext();
    if (!ctx.filePath) {
      vscode.window.showInformationMessage('No active editor.');
      return;
    }
    postToShellViaServer('composer.attach', {
      wsPath: ctx.filePath,
      line1: ctx.selection && ctx.selection.startLine,
      line2: ctx.selection && ctx.selection.endLine,
      text: ctx.selectionText || '',
      fileName: ctx.filePath.split('/').pop(),
      language: ctx.language,
    });
    vscode.window.setStatusBarMessage('✦ Sent to MCI Composer', 2000);
  });

  // ---- 命令：Add File to MCI Composer ----
  const addFileToComposer = vscode.commands.registerCommand('mci.addFileToComposer', (uri) => {
    let filePath, fileName, language, text;
    if (uri && uri.fsPath) {
      filePath = uri.fsPath;
      fileName = filePath.split('/').pop();
      try {
        text = require('fs').readFileSync(filePath, 'utf8');
      } catch (e) {
        vscode.window.showWarningMessage('Read file failed: ' + e.message);
        return;
      }
    } else {
      const ctx = snapshotContext();
      if (!ctx.filePath) {
        vscode.window.showInformationMessage('No active editor or file.');
        return;
      }
      filePath = ctx.filePath;
      fileName = filePath.split('/').pop();
      language = ctx.language;
      text = ctx.fullText || ctx.selectionText || '';
    }
    postToShellViaServer('composer.attach', {
      wsPath: filePath,
      text,
      fileName,
      language,
      whole: true,
    });
    vscode.window.setStatusBarMessage('✦ File sent to MCI Composer', 2000);
  });

  // ---- 命令：Open MCI Agents Window ----
  const openAgents = vscode.commands.registerCommand('mci.openAgents', () => {
    postToShellViaServer('agents.open', {});
  });

  context.subscriptions.push(addToComposer, addFileToComposer, openAgents);

  // 心跳：让外层知道 bridge 活了
  postToShellViaServer('bridge.ready', { version: '0.0.3' });
}

function deactivate() {}

module.exports = { activate, deactivate };