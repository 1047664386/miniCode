#!/usr/bin/env node
/**
 * stage-code-server.mjs
 * ---------------------
 * 作用：打包前下载 code-server 到 `apps/electron/resources/code-server/<platform-arch>/`
 * 让最终的 .app/.exe/.AppImage 直接包含 code-server 二进制，首次启动无需下载。
 *
 * 设计要点：
 *  1. 多源镜像 + 自动降级：GitHub → ghproxy → 用户自定义 mirror（环境变量）
 *  2. 校验：如果本地已有同版本同 arch 且目录结构完整，跳过下载
 *  3. 多 arch 支持：可通过环境变量 `ARCHS` 控制（默认按当前 host 平台）
 *  4. electron-builder 打 dmg 时，`extraResources` 配置会把这个目录连同 server/renderer 一起拷进 .app/Contents/Resources/code-server/
 *
 * 用法：
 *   node scripts/stage-code-server.mjs                # 当前平台单 arch
 *   ARCHS=darwin-arm64,darwin-amd64 node scripts/stage-code-server.mjs
 *   CODE_SERVER_VERSION=4.122.0 node scripts/stage-code-server.mjs
 */

import { execSync } from 'node:child_process';
import {
  existsSync, mkdirSync, rmSync, createWriteStream,
  statSync, readdirSync
} from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

// ES 模块下获取当前文件路径和目录的标准写法
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// 项目根目录（脚本在 scripts/ 下，回退一层）
const ROOT = path.resolve(__dirname, '..');

// 可配置参数：版本号、目标目录
const VERSION = process.env.CODE_SERVER_VERSION || '4.122.0';
const STAGE_DIR = path.join(ROOT, 'apps', 'electron', 'resources', 'code-server');

// arch label 对照表：映射 Node 平台架构到 code-server 发布包的命名
const ARCH_MAP = {
  'darwin-arm64': 'macos-arm64',
  'darwin-x64': 'macos-amd64',
  'darwin-amd64': 'macos-amd64',
  'linux-x64': 'linux-amd64',
  'linux-amd64': 'linux-amd64',
  'linux-arm64': 'linux-arm64',
};

/**
 * 获取当前主机的平台架构（格式如 darwin-arm64）
 * @returns {string} 当前平台架构
 */
function currentHostArch() {
  const p = process.platform; // 'darwin' / 'linux' / 'win32'
  const a = process.arch;     // 'arm64' / 'x64'
  return `${p}-${a}`;
}

/**
 * 解析目标平台架构列表，支持通过环境变量 ARCHS 指定
 * @returns {string[]} 目标架构列表
 */
function parseTargets() {
  const env = process.env.ARCHS;
  if (env) {
    return env
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }
  // 默认使用当前主机架构
  return [currentHostArch()];
}

/**
 * 统一日志函数，加上脚本标识前缀
 * @param {string} msg - 日志内容
 */
function log(msg) {
  console.log(`[stage-code-server] ${msg}`);
}

/**
 * 构建下载镜像列表，支持多源自动降级
 * 顺序：用户自定义 mirror → GitHub 官方 → ghproxy 镜像
 * @param {string} fileName - 要下载的文件名
 * @returns {string[]} 镜像 URL 列表
 */
function buildMirrorList(fileName) {
  const githubPath = `coder/code-server/releases/download/v${VERSION}/${fileName}`;
  const mirrors = [
    `https://github.com/${githubPath}`,
    `https://ghproxy.com/https://github.com/${githubPath}`,
    `https://mirror.ghproxy.com/https://github.com/${githubPath}`,
  ];
  // 如果用户自定义了镜像，插入到列表最前面
  if (process.env.CODE_SERVER_MIRROR) {
    mirrors.unshift(
      process.env.CODE_SERVER_MIRROR.replace(/\/$/, '') + '/' + fileName
    );
  }
  return mirrors;
}

/**
 * 单次下载函数，支持重定向跟随、超时和进度回调
 * @param {string} url - 下载地址
 * @param {string} dest - 目标文件路径
 * @param {Function} onProgress - 进度回调函数
 * @returns {Promise<void>}
 */
function downloadOne(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    // 递归处理重定向（最多 6 次）
    const fetchUrl = (u, depth = 0) => {
      if (depth > 6) return reject(new Error('too many redirects'));
      https.get(u, { timeout: 30_000 }, (res) => {
        // 处理 3xx 重定向
        if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
          res.resume();
          return fetchUrl(res.headers.location, depth + 1);
        }
        // 非 200 状态码视为失败
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }

        const total = Number(res.headers['content-length'] || 0);
        let downloaded = 0;
        const file = createWriteStream(dest);

        // 数据接收回调，更新进度
        res.on('data', (chunk) => {
          downloaded += chunk.length;
          if (onProgress && total) onProgress(downloaded, total);
        });

        // 管道写入文件
        res.pipe(file);

        // 写入完成/错误处理
        file.on('finish', () => file.close(() => resolve()));
        file.on('error', (e) => reject(e));
      })
      .on('error', reject)
      .on('timeout', function () {
        this.destroy(new Error('request timeout'));
      });
  });
  fetchUrl(url);
}

/**
 * 带镜像降级的下载函数，逐个尝试镜像直到成功
 * @param {string} fileName - 要下载的文件名
 * @param {string} dest - 目标文件路径
 * @returns {Promise<void>}
 */
async function downloadWithFallback(fileName, dest) {
  const mirrors = buildMirrorList(fileName);
  let lastErr;

  for (const url of mirrors) {
    log(`trying ${url}`);
    const start = Date.now();
    let lastPct = -1;

    try {
      // 执行下载，带进度打印
      await downloadOne(url, dest, (got, total) => {
        const pct = Math.floor((got / total) * 10) * 10; // 每 10% 打印一次
        if (pct !== lastPct) {
          lastPct = pct;
          const mb = (got / 1024 / 1024).toFixed(1);
          const totalMb = (total / 1024 / 1024).toFixed(1);
          process.stdout.write(
            `\r[stage-code-server] ${pct}% (${mb}MB / ${totalMb}MB)`
          );
        }
      });
      // 下载成功，打印耗时
      process.stdout.write('\n');
      log(`download OK in ${((Date.now() - start) / 1000).toFixed(1)}s`);
      return;
    } catch (e) {
      // 单个镜像失败，记录错误并尝试下一个
      process.stdout.write('\n');
      log(`mirror failed: ${e.message}`);
      lastErr = e;
      // 清理不完整的文件
      try { if (existsSync(dest)) rmSync(dest); } catch {}
    }
  }

  // 所有镜像都失败，抛出错误
  throw lastErr || new Error('all mirrors failed');
}

/**
 * 校验目标目录是否已完成 stage（简单完整性校验）
 * @param {string} targetDir - 目标目录路径
 * @returns {boolean} 是否已完成 stage
 */
function isStageComplete(targetDir) {
  // 检查关键文件是否存在：bin/code-server 和 lib/node
  const bin = path.join(targetDir, 'bin', 'code-server');
  const node = path.join(targetDir, 'lib', 'node');
  return existsSync(bin) && existsSync(node);
}

/**
 * 为单个平台架构执行 stage 流程
 * @param {string} target - 目标架构（如 darwin-arm64）
 * @returns {Promise<void>}
 */
async function stageOne(target) {
  // 映射到 code-server 发布包的架构标签
  const archLabel = ARCH_MAP[target];
  if (!archLabel) {
    log(`unsupported target: ${target} - skip`);
    return;
  }

  // Windows 平台使用 npm 包方式，跳过预下载
  if (target.startsWith('win32')) {
    log('windows code-server uses npm packaging - skip stage step');
    return;
  }

  // 目标目录路径
  const targetDir = path.join(STAGE_DIR, target);
  // 如果已经 stage 完成，直接跳过
  if (isStageComplete(targetDir)) {
    log(`✓ ${target} already staged (skip)`);
    return;
  }

  // 构建下载文件名和缓存路径
  const fileName = `code-server-${VERSION}-${archLabel}.tar.gz`;
  const cacheDir = path.join(STAGE_DIR, '.cache');
  mkdirSync(cacheDir, { recursive: true });
  const tarPath = path.join(cacheDir, fileName);

  // 下载：文件不存在或大小小于 10MB 时重新下载
  if (!existsSync(tarPath) || statSync(tarPath).size < 10_000_000) {
    await downloadWithFallback(fileName, tarPath);
  } else {
    log(`using cached tar: ${tarPath}`);
  }

  // 解压 tar.gz 包，--strip-components=1 直接展开到目标目录
  log(`extracting → ${targetDir}`);
  rmSync(targetDir, { recursive: true, force: true });
  mkdirSync(targetDir, { recursive: true });
  execSync(
    `tar -xzf ${JSON.stringify(tarPath)} -C ${JSON.stringify(targetDir)} --strip-components=1`,
    { stdio: 'inherit' }
  );

  // 解压后再次校验完整性
  if (!isStageComplete(targetDir)) {
    throw new Error(`stage incomplete for ${target}: ${targetDir}`);
  }
  log(`✓ ${target} staged at ${targetDir}`);
}

/**
 * 主函数：遍历所有目标架构，执行 stage 流程
 */
async function main() {
  const targets = parseTargets();
  log(`targets: ${targets.join(', ')} | version: ${VERSION} | output: ${STAGE_DIR}`);
  mkdirSync(STAGE_DIR, { recursive: true });

  // 逐个处理目标架构
  for (const t of targets) {
    try {
      await stageOne(t);
    } catch (e) {
      log(`× failed to stage ${t}: ${e.message}`);
      log(`~ app will still build, but first launch will fall back to download`);
    }
  }

  log('done.');
}

// 执行主函数，捕获错误并设置非零退出码
main().catch((e) => {
  console.error('[stage-code-server] fatal:', e);
  process.exit(1);
});