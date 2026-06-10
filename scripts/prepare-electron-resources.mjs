/**
 * prepare-electron-resources.mjs
 * ------------------------------
 * 作用：为 Electron 打包准备所有资源文件，包括：
 * 1. 后端服务（server-node / server）的打包产物
 * 2. 前端渲染器（desktop）的构建产物
 * 3. 后端依赖的原生模块（tree-sitter 等）
 * 4. VSCode Bridge 扩展和 code-server
 *
 * 关键逻辑：
 * - 使用裸 Node 版后端（apps/server-node），打包后体积 564KB，启动快
 * - 可通过环境变量 `SERVER_TARGET=server` 切换为 Express 版后端
 * - 只复制后端 bundle、sourcemap 和必要的原生模块，大幅减小打包体积
 * - 自动同步 Electron 应用版本号
 */

// 导入 Node.js 核心模块
import { execSync } from 'node:child_process';
import {
  existsSync, mkdirSync, rmSync, cpSync,
  writeFileSync, readFileSync, readdirSync
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ES 模块下获取当前文件路径和目录的标准写法
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// 项目根目录（脚本在 scripts/ 下，所以回退一层到项目根）
const ROOT = path.resolve(__dirname, '..');

// Electron 相关目录路径
const ELECTRON_DIR = path.join(ROOT, 'apps', 'electron');
const RESOURCES = path.join(ELECTRON_DIR, 'resources');

// ===================== 配置：后端服务目标 =====================
// 使用 server-node（裸 Node 实现），打包后体积小，启动快
// 注意：apps/server (Express 版) 已废弃并删除，不再支持切换
const SERVER_TARGET = 'server-node';
const SERVER_PKG_NAME = '@mini/server-node';

// 后端和前端构建产物路径
const SERVER_SRC = path.join(ROOT, 'apps', SERVER_TARGET);
const SERVER_DIST = path.join(SERVER_SRC, 'dist');
const RENDERER_DIST = path.join(ROOT, 'apps', 'desktop', 'dist');

// ===================== 工具函数 =====================
/**
 * 日志打印函数，统一加上 `[prepare]` 前缀
 * @param {string} msg - 要打印的日志信息
 */
function log(msg) {
  console.log(`[prepare] ${msg}`);
}

/**
 * 安全删除/清理目标文件/目录
 * 先尝试修改权限，再强制递归删除，避免因权限问题导致打包失败
 * @param {string} target - 要清理的文件/目录路径
 */
function safeRm(target) {
  if (!existsSync(target)) return;
  try { execSync(`chmod -R u+w ${JSON.stringify(target)}`, { stdio: 'pipe' }); } catch {}
  try { execSync(`xattr -rc ${JSON.stringify(target)}`, { stdio: 'pipe' }); } catch {}
  try { rmSync(target, { recursive: true, force: true }); } catch {}
  try { execSync(`rm -rf ${JSON.stringify(target)}`, { stdio: 'pipe' }); } catch {}
}

/**
 * 确保后端和前端已经构建，如果没有构建则自动执行构建命令
 */
function ensureBuilt() {
  // 检查后端构建产物是否存在
  if (!existsSync(path.join(SERVER_DIST, 'main.mjs'))) {
    log(`server (${SERVER_TARGET}) not built - running build...`);
    execSync(`pnpm --filter ${SERVER_PKG_NAME} run build`, { stdio: 'inherit', cwd: ROOT });
  }
  // 检查前端构建产物是否存在
  if (!existsSync(RENDERER_DIST)) {
    log('renderer not built - running build...');
    execSync(`pnpm --filter @mini/desktop run build`, { stdio: 'inherit', cwd: ROOT });
  }
}

/**
 * 从 pnpm 的虚拟存储中复制原生模块到后端 node_modules
 * 解决 pnpm 虚拟依赖在 Electron 打包时无法被正确包含的问题
 * @param {string} name - 要复制的包名
 * @param {string} targetNm - 目标目录路径
 * @returns {boolean} 是否复制成功
 */
function copyNativePackage(name, targetNm) {
  const pnpmRoot = path.join(ROOT, 'node_modules', '.pnpm');
  if (!existsSync(pnpmRoot)) return false;

  const entries = readdirSync(pnpmRoot);
  // 处理 scope 包名（如 @tree-sitter/javasctipt），替换 / 为 +
  const safeName = name.replace('/', '+');
  // 在 pnpm 虚拟存储中找到对应的包目录（支持带版本号的格式，如 tree-sitter@0.21.0）
  const candidate = entries.find(e =>
    e === safeName || e.startsWith(`${safeName}@`)
  );
  if (!candidate) {
    log(`warning: ${name} not found in .pnpm store - skip`);
    return false;
  }

  // 源文件路径：虚拟存储中的包真实路径
  const realPath = path.join(pnpmRoot, candidate, 'node_modules', name);
  if (!existsSync(realPath)) return false;

  // 目标路径：resources/server/node_modules 下的包路径
  const dest = path.join(targetNm, name);
  mkdirSync(path.dirname(dest), { recursive: true });

  // 复制文件，使用 cp -RL 保留软链接并跟随源文件
  execSync(`cp -RL ${JSON.stringify(realPath)} ${JSON.stringify(dest)}`, { stdio: 'pipe' });
  return true;
}

// ===================== 原生模块配置 =====================
// 必须打包进后端的原生模块，这些模块无法被单文件 bundle 包含
const RUNTIME_NATIVE_DEPS = [
  'tree-sitter',
  'tree-sitter-javascript',
  'tree-sitter-typescript',
  'node-gyp-build',
  'node-addon-api',
  'bufferutil',
  'utf-8-validate',
  'fsevents',
];

/**
 * 处理后端的原生依赖，复制到打包目录
 */
function stageServerNativeDeps() {
  const targetNm = path.join(RESOURCES, 'server', 'node_modules');
  mkdirSync(targetNm, { recursive: true });
  let copied = 0;

  // 复制所有需要的原生模块
  for (const name of RUNTIME_NATIVE_DEPS) {
    if (copyNativePackage(name, targetNm)) copied++;
  }

  log(`staged ${copied}/${RUNTIME_NATIVE_DEPS.length} native packages → server/node_modules`);

  // 写入一个空的 package.json，标记 server 目录为 CommonJS/ESM 包
  writeFileSync(
    path.join(RESOURCES, 'server', 'package.json'),
    JSON.stringify({
      name: '@mini/server-bundle',
      version: '0.0.1',
      type: 'module',
      private: true,
    }, null, 2)
  );
}

/**
 * 复制所有核心资源文件到 Electron 的 resources 目录
 */
function copyResources() {
  log(`server target: ${SERVER_TARGET} (${SERVER_PKG_NAME})`);
  log('cleaning resources/ (preserving code-server and vscode-bridge-ext)');

  // 清理旧资源，保留 code-server 和扩展目录
  for (const sub of ['server', 'renderer', 'server-deploy']) {
    safeRm(path.join(RESOURCES, sub));
  }
  mkdirSync(RESOURCES, { recursive: true });

  // 1. 复制后端服务 bundle（main.mjs 和 sourcemap）
  log('copying server bundle (main.mjs + sourcemap) → resources/server');
  mkdirSync(path.join(RESOURCES, 'server'), { recursive: true });
  cpSync(
    path.join(SERVER_DIST, 'main.mjs'),
    path.join(RESOURCES, 'server', 'main.mjs'),
  );
  // 复制 sourcemap（如果存在）
  if (existsSync(path.join(SERVER_DIST, 'main.mjs.map'))) {
    cpSync(
      path.join(SERVER_DIST, 'main.mjs.map'),
      path.join(RESOURCES, 'server', 'main.mjs.map'),
    );
  }

  // 2. 复制前端渲染器构建产物
  log('copying renderer dist → resources/renderer');
  cpSync(RENDERER_DIST, path.join(RESOURCES, 'renderer'), { recursive: true });

  // 3. 处理后端原生依赖
  log('staging native deps (tree-sitter / ws accel / fsevents)');
  stageServerNativeDeps();

  // 4. 检查 VSCode Bridge 扩展是否存在
  ensureVscodeBridgeExt();
}

/**
 * 检查 VSCode Bridge 扩展文件是否完整
 */
function ensureVscodeBridgeExt() {
  const BRIDGE_EXT_SRC = path.join(ROOT, 'apps', 'electron', 'resources', 'vscode-bridge-ext');
  if (!existsSync(BRIDGE_EXT_SRC)) {
    log('warning: vscode-bridge-ext missing - try `git checkout apps/electron/resources/vscode-bridge-ext`');
    return;
  }

  // 检查扩展的关键文件是否存在
  const pkg = path.join(BRIDGE_EXT_SRC, 'package.json');
  const ext = path.join(BRIDGE_EXT_SRC, 'extension.js');
  if (!existsSync(pkg) || !existsSync(ext)) {
    log('warning: vscode-bridge-ext incomplete (missing package.json or extension.js)');
  }
}

/**
 * 同步 Electron 应用的版本号，与项目根 package.json 保持一致
 */
function writeVersionFile() {
  const rootPkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
  const electronPkg = JSON.parse(readFileSync(path.join(ELECTRON_DIR, 'package.json'), 'utf-8'));
  electronPkg.version = rootPkg.version;
  writeFileSync(path.join(ELECTRON_DIR, 'package.json'), JSON.stringify(electronPkg, null, 2));
  log(`electron app version synced to ${rootPkg.version}`);
}

/**
 * 准备 code-server 资源（如果需要）
 * 可通过环境变量 SKIP_STAGE_CODE_SERVER=1 跳过此步骤
 */
function ensureCodeServerStaged() {
  if (process.env.SKIP_STAGE_CODE_SERVER === '1') {
    log('SKIP_STAGE_CODE_SERVER=1 - skip code-server stage step');
    return;
  }
  try {
    // 执行 code-server 准备脚本（假设存在 scripts/stage-code-server.mjs）
    execSync(`node ${JSON.stringify(path.join(ROOT, 'scripts', 'stage-code-server.mjs'))}`, {
      stdio: 'inherit', cwd: ROOT,
    });
  } catch (e) {
    log(`warning: code-server stage failed (${e.message}); app will fall back to runtime download`);
  }
}

// ===================== 主流程 =====================
// 1. 确保前后端已经构建
ensureBuilt();
// 2. 复制所有资源文件
copyResources();
// 3. 准备 code-server
ensureCodeServerStaged();
// 4. 同步版本号
writeVersionFile();

log('done.');