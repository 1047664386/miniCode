
/**
 * Electron 主进程
 * ---------------------------------------------------------------
 * 责任：
 *  1. 启动内嵌的 server（apps/server 的 dist/main.js），传 PORT/WORKSPACE 等环境变量
 *  2. 创建 BrowserWindow 加载 renderer（apps/desktop 的 dist/index.html）
 *  3. 接入 electron-updater：启动后 30s 检查更新，找到 → 后台下载 → 弹窗确认安装
 *  4. 退出时优雅关闭 server 子进程
 *
 * 开发模式：
 *   ELECTRON_DEV=1 → 不启动子进程，直接 loadURL('http://localhost:5173')（vite dev）
 *
 * 打包后：
 *   server 子进程从 process.resourcesPath/server/main.mjs 加载
 *   renderer 从 process.resourcesPath/renderer/index.html 加载
 *   工作区默认放 ~/MiniCodeIDE（用户可在 UI 改）
 */
const { app, BrowserWindow, dialog, ipcMain, shell, globalShortcut } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { openAgentsWindow, getAgentsWindow, isAgentsWindowOpen } = require('./agents-window.js');
const { getSpeechService, SAMPLE_RATE } = require('./speech-service.js');

// 防止 pnpm 并行进程管道断开时 console.log 导致应用崩溃
process.stdout?.on('error', (err) => {
  if (err.code === 'EPIPE') return; // 管道断开，安全忽略
});

const IS_DEV = process.env.ELECTRON_DEV === '1';
const SERVER_PORT = Number(process.env.MINI_PORT ?? 5174);
const VSCODE_PORT = Number(process.env.VSCODE_PORT ?? 8000);
const CODE_SERVER_VERSION = process.env.CODE_SERVER_VERSION || '4.122.0';
const DEFAULT_WORKSPACE = path.join(os.homedir(), 'MiniCodeIDE');
const CODE_SERVER_HOME = path.join(os.homedir(), '.minicodeide', 'code-server');

let serverProcess = null;
let codeServerProcess = null;
let mainWindow = null;

// ----- Server 子进程 -----
function startServer() {
  if (IS_DEV) {
    console.log('[electron] DEV mode — assuming server is already running on', SERVER_PORT);
    return Promise.resolve();
  }
  const serverEntry = path.join(process.resourcesPath, 'server', 'main.mjs');
  if (!fs.existsSync(serverEntry)) {
    console.error('[electron] server entry not found:', serverEntry);
    dialog.showErrorBox('Startup failed', `Server bundle missing at ${serverEntry}`);
    app.quit();
    return Promise.reject(new Error('server bundle missing'));
  }
  // 用户工作区：用户配置 > 默认
  let workspace = DEFAULT_WORKSPACE;
  try {
    const cfgPath = path.join(app.getPath('userData'), 'config.json');
    if (fs.existsSync(cfgPath)) {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
      if (cfg.workspace) workspace = cfg.workspace;
    }
  } catch {
    /* ignore */
  }
  fs.mkdirSync(workspace, { recursive: true });

  console.log('[electron] starting server, workspace:', workspace);
  serverProcess = spawn(process.execPath, [serverEntry], {
    env: {
      ...process.env,
      PORT: String(SERVER_PORT),
      WORKSPACE: workspace,
      // 默认开 json 日志（方便 Electron 主进程采集到 stdout 后转发到日志文件）
      MINI_LOG_FORMAT: process.env.MINI_LOG_FORMAT ?? 'json',
      MINI_LOG_LEVEL: process.env.MINI_LOG_LEVEL ?? 'info',
      // ELECTRON_RUN_AS_NODE=1 让 electron 二进制以 Node 模式执行
      ELECTRON_RUN_AS_NODE: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  serverProcess.stdout.on('data', (chunk) => process.stdout.write(`[server] ${chunk}`));
  serverProcess.stderr.on('data', (chunk) => process.stderr.write(`[server-err] ${chunk}`));
  serverProcess.on('exit', (code) => {
    console.warn('[electron] server exited with code', code);
    if (!app.isReady() || app.isReady()) {
      // 在主窗口已开的情况下提示用户
      if (mainWindow) {
        dialog.showMessageBox(mainWindow, {
          type: 'error',
          message: `Backend server exited (code ${code}). The app will close.`,
        }).finally(() => app.quit());
      } else {
        app.quit();
      }
    }
  });

  // 等 server ready：每 200ms 探测 /health，最多 15s
  return waitForServerReady(SERVER_PORT, 15_000);
}

function waitForServerReady(port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const tick = () => {
      const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
        if (res.statusCode === 200) return resolve();
        retry();
      });
      req.on('error', retry);
      req.setTimeout(500, () => {
        req.destroy();
        retry();
      });
    };
    const retry = () => {
      if (Date.now() > deadline) return reject(new Error('server ready timeout'));
      setTimeout(tick, 200);
    };
    tick();
  });
}

function stopServer() {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill('SIGTERM');
    // 给 server 自己优雅退出 5s
    setTimeout(() => {
      if (serverProcess && !serverProcess.killed) serverProcess.kill('SIGKILL');
    }, 5_000).unref?.();
  }
  if (codeServerProcess && !codeServerProcess.killed) {
    codeServerProcess.kill('SIGTERM');
    setTimeout(() => {
      if (codeServerProcess && !codeServerProcess.killed) codeServerProcess.kill('SIGKILL');
    }, 5_000).unref?.();
  }
}

// ----- code-server 子进程（VSCode 模式后端）-----
function getCodeServerArch() {
  const platform = process.platform;
  const arch = process.arch;
  if (platform === 'darwin' && arch === 'arm64') return 'macos-arm64';
  if (platform === 'darwin' && arch === 'x64') return 'macos-amd64';
  if (platform === 'linux' && arch === 'x64') return 'linux-amd64';
  if (platform === 'linux' && arch === 'arm64') return 'linux-arm64';
  return null; // Windows code-server 用 npm，单独走另一套；暂不支持
}

function getCodeServerBin() {
  const archStr = getCodeServerArch();
  if (!archStr) return null;
  // 1) 优先：打包进 .app 的 bundled 版本（首次启动无需下载）
  //    extraResources 把 resources/code-server/<platform>-<arch>/ 拷到 process.resourcesPath/code-server/
  if (process.resourcesPath) {
    const bundled = path.join(process.resourcesPath, 'code-server', 'bin', 'code-server');
    if (fs.existsSync(bundled)) return bundled;
  }
  // 2) 降级：用户 home 缓存目录（之前下载过的）
  const dir = path.join(CODE_SERVER_HOME, `code-server-${CODE_SERVER_VERSION}-${archStr}`);
  return path.join(dir, 'bin', 'code-server');
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/`, { timeout: 1000 }, (res) => {
      res.resume();
      resolve(res.statusCode > 0); // 200/302/etc 都算
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

async function downloadCodeServer() {
  const archStr = getCodeServerArch();
  if (!archStr) throw new Error(`unsupported platform: ${process.platform}-${process.arch}`);
  const fileName = `code-server-${CODE_SERVER_VERSION}-${archStr}.tar.gz`;
  fs.mkdirSync(CODE_SERVER_HOME, { recursive: true });
  const tarPath = path.join(CODE_SERVER_HOME, fileName);

  // 多镜像源（按顺序尝试 + 指数退避）
  const ghPath = `coder/code-server/releases/download/v${CODE_SERVER_VERSION}/${fileName}`;
  const mirrors = [
    `https://github.com/${ghPath}`,
    `https://ghproxy.com/https://github.com/${ghPath}`,
    `https://mirror.ghproxy.com/https://github.com/${ghPath}`,
  ];

  emitCodeServerStatus({ phase: 'downloading', percent: 0, mirror: mirrors[0] });

  let lastErr;
  for (let i = 0; i < mirrors.length; i++) {
    const url = mirrors[i];
    console.log(`[code-server] downloading (mirror ${i + 1}/${mirrors.length}):`, url);
    emitCodeServerStatus({ phase: 'downloading', percent: 0, mirror: url, attempt: i + 1 });
    try {
      await downloadWithProgress(url, tarPath, (pct) => {
        emitCodeServerStatus({ phase: 'downloading', percent: pct, mirror: url, attempt: i + 1 });
      });
      lastErr = null;
      break;
    } catch (e) {
      console.warn(`[code-server] mirror ${i + 1} failed:`, e.message);
      lastErr = e;
      try { if (fs.existsSync(tarPath)) fs.unlinkSync(tarPath); } catch {}
      // 指数退避：失败后等 1s/2s/4s 再换下一个
      if (i < mirrors.length - 1) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
      }
    }
  }
  if (lastErr) {
    emitCodeServerStatus({ phase: 'error', error: lastErr.message });
    throw lastErr;
  }
  emitCodeServerStatus({ phase: 'extracting', percent: 100 });
  console.log('[code-server] extracting');
  execFileSync('tar', ['-xzf', tarPath, '-C', CODE_SERVER_HOME], { stdio: 'inherit' });
  fs.unlinkSync(tarPath);
  emitCodeServerStatus({ phase: 'ready' });
}

function downloadWithProgress(url, dest, onPct) {
  return new Promise((resolve, reject) => {
    const fetchUrl = (u, depth = 0) => {
      if (depth > 6) return reject(new Error('too many redirects'));
      const req = https.get(u, { timeout: 30_000 }, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          res.resume();
          return fetchUrl(res.headers.location, depth + 1);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        const total = Number(res.headers['content-length'] || 0);
        let got = 0;
        let lastPct = -1;
        const file = fs.createWriteStream(dest);
        res.on('data', (chunk) => {
          got += chunk.length;
          if (total && onPct) {
            const pct = Math.floor((got / total) * 100);
            if (pct !== lastPct) {
              lastPct = pct;
              onPct(pct);
            }
          }
        });
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve()));
        file.on('error', reject);
      });
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy(new Error('request timeout'));
      });
    };
    fetchUrl(url);
  });
}

// 把 code-server 启动状态推送给 renderer（progress / error / ready）
let lastCodeServerStatus = { phase: 'idle' };
function emitCodeServerStatus(s) {
  lastCodeServerStatus = { ...s, ts: Date.now() };
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.send('code-server-status', lastCodeServerStatus);
    } catch {}
  }
}

async function startCodeServer() {
  // DEV 模式：以前直接 return，要求开发者手动跑 `pnpm vscode`，常被忘记导致
  // 切到 VSCode 模式一直转圈。现在改成：如果 8000 已经有进程就复用，否则
  // 用 ~/.minicodeide/code-server/ 下的缓存二进制启起来（不下载，没缓存就报错）。
  if (IS_DEV) {
    if (await isPortOpen(VSCODE_PORT)) {
      console.log('[code-server] DEV: external instance on', VSCODE_PORT, '— reuse');
      emitCodeServerStatus({ phase: 'ready', source: 'external' });
      return;
    }
    const devBin = getCodeServerBin();
    if (!devBin || !fs.existsSync(devBin)) {
      console.warn('[code-server] DEV: no cached binary; run `pnpm vscode` manually or build once with `pnpm dist:mac:fast`');
      emitCodeServerStatus({ phase: 'error', error: 'no cached code-server binary in DEV mode' });
      return;
    }
    console.log('[code-server] DEV: starting cached binary', devBin);
    // 落到下面的常规启动流程
  }
  // 已有外部 code-server 跑着就复用
  if (await isPortOpen(VSCODE_PORT)) {
    console.log('[code-server] external instance detected on port', VSCODE_PORT);
    emitCodeServerStatus({ phase: 'ready', source: 'external' });
    return;
  }
  let bin = getCodeServerBin();
  if (!bin) {
    console.warn('[code-server] platform not supported, vscode mode disabled');
    emitCodeServerStatus({ phase: 'unsupported' });
    return;
  }
  // 判断 binary 是否已存在 + 是否来自 bundled
  const bundledPath = process.resourcesPath
    ? path.join(process.resourcesPath, 'code-server', 'bin', 'code-server')
    : null;
  const isBundled = bundledPath && bin === bundledPath && fs.existsSync(bin);

  if (!fs.existsSync(bin)) {
    // 首次启动且没有 bundled：下载 + 解压
    emitCodeServerStatus({ phase: 'preparing' });
    try {
      await downloadCodeServer();
    } catch (e) {
      console.warn('[code-server] download failed:', e.message);
      emitCodeServerStatus({ phase: 'error', error: e.message });
      return;
    }
    bin = getCodeServerBin();
    if (!bin || !fs.existsSync(bin)) {
      console.warn('[code-server] binary still missing after download');
      emitCodeServerStatus({ phase: 'error', error: 'binary missing after download' });
      return;
    }
  } else {
    emitCodeServerStatus({
      phase: 'starting',
      source: isBundled ? 'bundled' : 'cached',
    });
  }
  // 工作区与 server 子进程共享
  let workspace = DEFAULT_WORKSPACE;
  try {
    const cfgPath = path.join(app.getPath('userData'), 'config.json');
    if (fs.existsSync(cfgPath)) {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
      if (cfg.workspace) workspace = cfg.workspace;
    }
  } catch { /* ignore */ }
  fs.mkdirSync(workspace, { recursive: true });

  console.log('[code-server] starting on port', VSCODE_PORT, 'workspace:', workspace);
  installBridgeExtension();
  ensureCodeServerSettings();
  codeServerProcess = spawn(bin, [
    '--bind-addr', `127.0.0.1:${VSCODE_PORT}`,
    '--auth', 'none',
    '--disable-telemetry',
    '--disable-update-check',
    '--user-data-dir', path.join(CODE_SERVER_HOME, 'user-data'),
    '--extensions-dir', path.join(CODE_SERVER_HOME, 'extensions'),
    workspace,
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  codeServerProcess.stdout.on('data', (c) => process.stdout.write(`[code-server] ${c}`));
  codeServerProcess.stderr.on('data', (c) => process.stderr.write(`[code-server-err] ${c}`));
  codeServerProcess.on('exit', (code) => {
    console.warn('[code-server] exited with code', code);
    codeServerProcess = null;
    emitCodeServerStatus({ phase: 'exited', code });
  });
  // 探测端口起来后通知 renderer
  pollPortReady(VSCODE_PORT, 30_000).then((ok) => {
    if (ok) emitCodeServerStatus({ phase: 'ready', source: isBundled ? 'bundled' : 'cached' });
  });
}

function pollPortReady(port, timeoutMs) {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const tick = async () => {
      if (await isPortOpen(port)) return resolve(true);
      if (Date.now() > deadline) return resolve(false);
      setTimeout(tick, 500);
    };
    tick();
  });
}

/**
 * 把 vscode-bridge-ext（postMessage 桥扩展）安装到 code-server 的 extensions-dir。
 * 每次启动都强制覆盖，保证扩展和宿主版本同步。
 *
 * VSCode 扩展系统要求：
 *   1. 目录名必须是 `publisher.name-version`（带版本号）
 *   2. 在 extensions.json 里登记
 *   3. .obsolete 里不能有这个 id
 * 否则会被标记成 "removed" 而不激活（log: "Marked extension as removed ..."）。
 */
function installBridgeExtension() {
  try {
    const candidates = [
      path.join(process.resourcesPath || '', 'vscode-bridge-ext'),
      path.join(__dirname, 'resources', 'vscode-bridge-ext'),
    ];
    const src = candidates.find((p) => p && fs.existsSync(p));
    if (!src) {
      console.warn('[code-server] vscode-bridge-ext not found, bridge disabled');
      return;
    }
    // 读 package.json 拿 publisher / name / version
    const pkg = JSON.parse(fs.readFileSync(path.join(src, 'package.json'), 'utf8'));
    const publisher = pkg.publisher || 'minicodeide';
    const name = pkg.name || 'minicodeide-bridge';
    const version = pkg.version || '0.0.0';
    const extId = `${publisher}.${name}`;          // minicodeide.minicodeide-bridge
    const dirName = `${extId}-${version}`;          // minicodeide.minicodeide-bridge-0.0.3

    const extsRoot = path.join(CODE_SERVER_HOME, 'extensions');
    fs.mkdirSync(extsRoot, { recursive: true });

    // 1. 清理旧版本（不同 version 的目录）和无版本号目录
    for (const entry of fs.readdirSync(extsRoot)) {
      if (entry === extId || entry.startsWith(`${extId}-`)) {
        fs.rmSync(path.join(extsRoot, entry), { recursive: true, force: true });
      }
    }

    // 2. 拷贝到新版本目录
    const extDir = path.join(extsRoot, dirName);
    fs.mkdirSync(extDir, { recursive: true });
    for (const f of fs.readdirSync(src)) {
      const srcFile = path.join(src, f);
      const stat = fs.statSync(srcFile);
      if (stat.isDirectory()) {
        // 简单复制单层目录
        const destDir = path.join(extDir, f);
        fs.mkdirSync(destDir, { recursive: true });
        for (const sub of fs.readdirSync(srcFile)) {
          fs.copyFileSync(path.join(srcFile, sub), path.join(destDir, sub));
        }
      } else {
        fs.copyFileSync(srcFile, path.join(extDir, f));
      }
    }

    // 3. 从 .obsolete 里把这个扩展剔掉（VSCode 看到 obsolete 就跳过激活）
    const obsoletePath = path.join(extsRoot, '.obsolete');
    if (fs.existsSync(obsoletePath)) {
      let obs = {};
      try { obs = JSON.parse(fs.readFileSync(obsoletePath, 'utf8')); } catch { obs = {}; }
      let changed = false;
      for (const k of Object.keys(obs)) {
        if (k === extId || k.startsWith(`${extId}-`)) {
          delete obs[k];
          changed = true;
        }
      }
      if (changed) fs.writeFileSync(obsoletePath, JSON.stringify(obs), 'utf8');
    }

    // 4. 在 extensions.json 里登记（VSCode 启动时按这里扫描激活用户扩展）
    const manifestPath = path.join(extsRoot, 'extensions.json');
    let manifest = [];
    if (fs.existsSync(manifestPath)) {
      try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch { manifest = []; }
      if (!Array.isArray(manifest)) manifest = [];
    }
    // 移除同 id 的旧条目
    manifest = manifest.filter((e) => {
      const id = e && e.identifier && e.identifier.id;
      return id && id.toLowerCase() !== extId.toLowerCase();
    });
    manifest.push({
      identifier: { id: extId, uuid: '00000000-0000-4000-8000-mci-bridge001' },
      version,
      location: { $mid: 1, fsPath: extDir, path: extDir, scheme: 'file' },
      relativeLocation: dirName,
      metadata: {
        installedTimestamp: Date.now(),
        source: 'resource',
        isBuiltin: false,
        isSystem: false,
        isApplicationScoped: false,
        isMachineScoped: false,
        targetPlatform: 'undefined',
        pinned: true,
        preRelease: false,
      },
    });
    fs.writeFileSync(manifestPath, JSON.stringify(manifest), 'utf8');

    console.log('[code-server] bridge extension installed at', extDir);
    console.log('[code-server] extensions.json updated, total entries =', manifest.length);
  } catch (e) {
    console.warn('[code-server] failed to install bridge extension:', e.message);
  }
}

/**
 * 把禁用 code-server 自带 Chat / Copilot 的设置写到 user-data 里。
 * 用户首次启动会被 staged，之后保留用户自己的修改（merge 而非 overwrite）。
 */
function ensureCodeServerSettings() {
  try {
    const settingsPath = path.join(CODE_SERVER_HOME, 'user-data', 'User', 'settings.json');
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    let existing = {};
    if (fs.existsSync(settingsPath)) {
      try { existing = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch { existing = {}; }
    }
    const desired = {
      // 禁用 VSCode 内置 Chat / Copilot Chat 视图，避免和 MCI AI 重复
      'chat.commandCenter.enabled': false,
      'chat.experimental.offerWelcomeMessage': false,
      'chat.editing.confirmEditRequestRetry': false,
      'workbench.experimental.chat.enabled': false,
      'github.copilot.enable': { '*': false },
      // 隐藏 ActivityBar 上的 Chat / Copilot 图标
      'workbench.activityBar.location': 'default',
      // 禁用首次启动 Welcome / Walkthrough
      'workbench.startupEditor': 'none',
      'workbench.welcomePage.walkthroughs.openOnInstall': false,
      // 关闭 Telemetry
      'telemetry.telemetryLevel': 'off',
    };
    const merged = { ...desired, ...existing }; // 用户已有 key 优先
    // 但禁用 chat 这几条强制覆盖（即便用户改回也再改回去）
    merged['chat.commandCenter.enabled'] = false;
    merged['workbench.experimental.chat.enabled'] = false;
    merged['github.copilot.enable'] = { '*': false };
    fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2), 'utf8');
    console.log('[code-server] settings.json written:', settingsPath);
  } catch (e) {
    console.warn('[code-server] failed to write settings:', e.message);
  }
}

// ----- 主窗口 -----
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      // 允许 file:// 页面 fetch http://localhost (CORS 由 server 控制)
      webSecurity: false,
    },
  });

  // 把 /api/* 请求代理到 SERVER_PORT —— vite dev 已经做了，生产用 webRequest 转发
  const sess = mainWindow.webContents.session;
  sess.webRequest.onBeforeRequest({ urls: ['*://app.local/*'] }, (details, cb) => {
    const url = new URL(details.url);
    cb({ redirectURL: `http://127.0.0.1:${SERVER_PORT}${url.pathname}${url.search}` });
  });

  // 授权麦克风权限（语音输入需要）
  sess.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true);
    } else {
      callback(false);
    }
  });

  if (IS_DEV) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'right' });
  } else {
    const indexHtml = path.join(process.resourcesPath, 'renderer', 'index.html');
    mainWindow.loadFile(indexHtml);
  }

  // 链接在外部浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ----- IPC：让 renderer 拿到 server URL / 改 workspace 等 -----
ipcMain.handle('get-server-url', () => `http://127.0.0.1:${SERVER_PORT}`);
ipcMain.handle('get-code-server-status', () => lastCodeServerStatus);
ipcMain.handle('open-folder-dialog', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender) ?? BrowserWindow.getFocusedWindow() ?? mainWindow;
  const r = await dialog.showOpenDialog(win, {
    title: 'Open Folder',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (r.canceled || !r.filePaths?.length) return null;
  return r.filePaths[0];
});
ipcMain.handle('save-file-dialog', async (e, opts = {}) => {
  const win = BrowserWindow.fromWebContents(e.sender) ?? BrowserWindow.getFocusedWindow() ?? mainWindow;
  const r = await dialog.showSaveDialog(win, {
    title: opts.title ?? 'Save As',
    defaultPath: opts.defaultPath,
    filters: opts.filters,
  });
  if (r.canceled || !r.filePath) return null;
  return r.filePath;
});
ipcMain.handle('relaunch-app', () => {
  app.relaunch();
  app.exit(0);
});
ipcMain.handle('get-config', () => {
  const cfgPath = path.join(app.getPath('userData'), 'config.json');
  if (!fs.existsSync(cfgPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
  } catch {
    return {};
  }
});
ipcMain.handle('set-config', (_e, patch) => {
  const cfgPath = path.join(app.getPath('userData'), 'config.json');
  let cur = {};
  try {
    cur = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
  } catch {
    /* ignore */
  }
  const next = { ...cur, ...patch };
  fs.writeFileSync(cfgPath, JSON.stringify(next, null, 2));
  return next;
});

// ----- 语音识别 IPC (sherpa-onnx) -----
ipcMain.handle('speech:get-status', () => {
  const svc = getSpeechService();
  return {
    available: true,
    modelReady: svc.modelReady,
    sampleRate: SAMPLE_RATE,
  };
});

ipcMain.handle('speech:ensure-model', async (event) => {
  const svc = getSpeechService();
  const win = BrowserWindow.fromWebContents(event.sender);
  await svc.ensureModel((status) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('speech:model-status', status);
    }
  });
  // 确保模型加载到内存
  await svc.loadModel();
  return { ok: true };
});

ipcMain.handle('speech:start', (event) => {
  const svc = getSpeechService();
  if (!svc.modelReady) {
    throw new Error('Model not loaded, call speech:ensure-model first');
  }
  svc.startRecognition((result) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
      win.webContents.send('speech:result', result);
    }
  });
  return { ok: true };
});

ipcMain.on('speech:audio', (_event, buffer) => {
  const svc = getSpeechService();
  // IPC 传来的 ArrayBuffer → Float32Array（sherpa-onnx 原生格式）
  svc.feedAudio(new Float32Array(buffer));
});

ipcMain.handle('speech:stop', () => {
  const svc = getSpeechService();
  const result = svc.stopRecognition();
  return { ok: true, finalResult: result };
});

// ----- Agents Window IPC -----
function getAgentsWindowOpts() {
  return {
    devUrl: IS_DEV ? 'http://localhost:5173' : null,
    indexHtml: IS_DEV ? null : path.join(process.resourcesPath, 'renderer', 'index.html'),
    preload: path.join(__dirname, 'preload.js'),
  };
}
ipcMain.handle('agents-window:open', () => {
  openAgentsWindow(getAgentsWindowOpts());
  return { ok: true };
});
ipcMain.handle('agents-window:close', () => {
  const w = getAgentsWindow();
  if (w && !w.isDestroyed()) w.close();
  return { ok: true };
});
// Agents Window → 主 IDE 转发：让主 IDE 打开某个 pending edit
ipcMain.on('mci:apply-from-agents', (_e, payload) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.send('mci:apply-edit', payload);
      mainWindow.focus();
    } catch (e) {
      console.warn('[agents-window] failed to forward apply-edit:', e?.message ?? e);
    }
  }
});

/**
 * 主 IDE → Agents Window 转发：把选区 / 整文件 attach 到 Agents Window 的输入框
 * payload: { wsPath, line1?, line2?, text, fileName? }
 * 策略：发给「最近一个 Agents Window」，没有就先打开一个。
 */
ipcMain.on('agents:attach-selection', (_e, payload) => {
  try {
    let target = getAgentsWindow();
    if (!target || target.isDestroyed()) {
      target = openAgentsWindow(getAgentsWindowOpts());
      // 新开的窗口要等 dom-ready 再 send，否则 listener 还没注册
      target.webContents.once('did-finish-load', () => {
        try { target.webContents.send('agents:attach-selection', payload); } catch {}
      });
    } else {
      target.webContents.send('agents:attach-selection', payload);
      if (target.isMinimized()) target.restore();
      target.focus();
    }
  } catch (e) {
    console.warn('[agents-window] failed to forward attach-selection:', e?.message ?? e);
  }
});

// ----- auto-update（electron-updater）-----
function setupAutoUpdate() {
  if (IS_DEV) {
    console.log('[updater] disabled in DEV mode');
    return;
  }
  try {
    // require lazily — 让没装 electron-updater 时主进程仍能跑
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-available', (info) => {
      console.log('[updater] update available', info.version);
      if (mainWindow) {
        mainWindow.webContents.send('update-available', { version: info.version });
      }
    });
    autoUpdater.on('update-downloaded', async (info) => {
      console.log('[updater] update downloaded', info.version);
      if (!mainWindow) return;
      const r = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Ready',
        message: `MiniCodeIDE ${info.version} is ready to install.`,
        detail: 'The app will restart to apply the update.',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
      });
      if (r.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
    autoUpdater.on('error', (err) => {
      console.warn('[updater] error', err?.message ?? err);
    });
    // 启动 30s 后第一次检查，然后每 4h 一次
    setTimeout(() => autoUpdater.checkForUpdatesAndNotify().catch(() => {}), 30_000);
    setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 4 * 60 * 60_000);
  } catch (e) {
    console.warn('[updater] electron-updater not available:', e?.message ?? e);
  }
}

// ----- dev: 等待 Vite dev server 就绪 -----
async function waitForVite(maxWaitMs = 30_000) {
  const url = 'http://localhost:5173';
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return true;
    } catch { /* 还没就绪 */ }
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error('Vite dev server not ready on port 5173 after 30s');
}

// ----- app lifecycle -----
app.whenReady().then(async () => {
  try {
    await startServer();
  } catch (e) {
    dialog.showErrorBox('Startup failed', `Server failed to start: ${e?.message ?? e}`);
    app.quit();
    return;
  }

  // 开发模式下等待 Vite 就绪后再创建窗口，避免白屏
  if (IS_DEV) {
    try {
      await waitForVite();
      console.log('[electron] Vite dev server ready');
    } catch (e) {
      console.warn('[electron]', e.message, '- creating window anyway');
    }
  }

  createWindow();
  setupAutoUpdate();

  // 语音模型预加载（postinstall 已下载好，直接加载到内存）
  const safeLog = (...args) => { try { console.log(...args); } catch {} };
  const speechService = getSpeechService();

  // 检查模型是否已下载（postinstall 应该已完成）
  if (speechService._isModelDownloaded()) {
    // 模型存在，后台加载到内存（~1-2秒，不阻塞 UI）
    setImmediate(() => {
      speechService.loadModel()
        .then(() => safeLog('[speech] model preloaded'))
        .catch((e) => {
          try { console.warn('[speech] model preload failed:', e?.message ?? e); } catch {}
        });
    });
  } else {
    // 模型不存在（可能是 SKIP_SPEECH_MODEL=1 安装的），跳过
    safeLog('[speech] model not found, voice input disabled until next install');
  }

  // VSCode 模式后端：异步起，不阻塞主窗口（首次启动可能要下载 80MB）
  startCodeServer().catch((e) => {
    console.warn('[code-server] startup failed (vscode mode may be unavailable):', e?.message ?? e);
  });

  // 全局快捷键：⌘⇧A 唤起 / 关闭 Agents Window
  try {
    globalShortcut.register('CommandOrControl+Shift+A', () => {
      const w = getAgentsWindow();
      if (w && !w.isDestroyed() && w.isFocused()) {
        // 已聚焦 → 关闭（来回切换）
        w.close();
      } else {
        openAgentsWindow(getAgentsWindowOpts());
      }
    });
  } catch (e) {
    console.warn('[agents-window] shortcut register failed:', e?.message ?? e);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  try {
    globalShortcut.unregisterAll();
  } catch {}
  stopServer();
});