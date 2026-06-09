
/**
 * Agents Window — 第二个 BrowserWindow 的多实例管理
 * ---------------------------------------------------------------
 * 设计：
 *  - 与主 IDE 共享 server 进程（不重启 server）
 *  - URL 加 ?window=agents 让 renderer 走 AgentsApp 根组件
 *  - **多实例**：每次点击「Open Agents Window」都新建一个独立窗口
 *    每个 Agents Window 自己持有 zustand store（renderer 实例隔离）
 *  - getAgentsWindow() / isAgentsWindowOpen() 仍返回最新一个，给 globalShortcut 用
 */
const { BrowserWindow } = require('electron');

/** 所有打开的 agents window */
const agentsWins = new Set();

function openAgentsWindow({ devUrl, indexHtml, preload }) {
  const idx = agentsWins.size;
  // 用窗口数量给标题加序号；窗口位置错开 30px 避免完全重叠
  const offset = idx * 30;

  const win = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    x: undefined,
    y: undefined,
    title: idx === 0 ? 'MyWorker' : `MyWorker (${idx + 1})`,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload,
      webSecurity: false,
    },
  });

  // 错开位置，否则用户看不到新窗口
  if (offset > 0) {
    const [x, y] = win.getPosition();
    win.setPosition(x + offset, y + offset);
  }

  if (devUrl) {
    win.loadURL(`${devUrl}?window=agents&n=${Date.now()}`);
  } else {
    win.loadFile(indexHtml, { search: `window=agents&n=${Date.now()}` });
  }

  agentsWins.add(win);
  win.on('closed', () => {
    agentsWins.delete(win);
  });

  return win;
}

/** 返回最近一个 agents window，主要给 globalShortcut 切换/聚焦用 */
function getAgentsWindow() {
  let last = null;
  for (const w of agentsWins) {
    if (w && !w.isDestroyed()) last = w;
  }
  return last;
}

function isAgentsWindowOpen() {
  for (const w of agentsWins) {
    if (w && !w.isDestroyed()) return true;
  }
  return false;
}

function closeAllAgentsWindows() {
  for (const w of agentsWins) {
    try { if (w && !w.isDestroyed()) w.close(); } catch (_) { /* ignore */ }
  }
  agentsWins.clear();
}

module.exports = {
  openAgentsWindow,
  getAgentsWindow,
  isAgentsWindowOpen,
  closeAllAgentsWindows,
};