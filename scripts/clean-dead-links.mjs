#!/usr/bin/env node
/**
 * clean-dead-links.mjs
 * --------------------
 * 作用：清理 node_modules 中指向已删除 workspace 包的无效软链接（死链）
 * 解决问题：pnpm 删除 workspace 包后，node_modules/.pnpm/node_modules 会残留死链接，
 *          导致 electron-builder 打包时因 ENOENT 错误直接退出
 *
 * 典型错误：
 *  × ENOENT: no such file or directory, stat
 *    '.../node_modules/.pnpm/node_modules/@mini/server-nest'
 *
 * 用法：
 *   node scripts/clean-dead-links.mjs          # 仅清理死链
 *   node scripts/clean-dead-links.mjs --reinstall # 清理后自动执行 pnpm install 刷新依赖
 */

// 导入 Node.js 核心模块
import { lstatSync, statSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

// 获取当前脚本所在目录（ES 模块下 __dirname 需手动实现）
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 项目根目录（脚本在 scripts/ 下，所以回退一层到项目根）
const ROOT = path.resolve(__dirname, '..');

// 待扫描的目录：pnpm 存放软链接的真实位置
const SCAN_ROOTS = [
  // 根 node_modules 目录
  path.join(ROOT, 'node_modules'),
  // pnpm 虚拟存储目录（workspace 包的软链接通常在这里）
  path.join(ROOT, 'node_modules', '.pnpm', 'node_modules'),
];

// 统计变量：已删除的死链数量、已扫描的条目总数
let removed = 0;
let scanned = 0;

/**
 * 判断一个路径是否为软链接（符号链接）
 * @param {string} p - 要判断的文件/目录路径
 * @returns {boolean} true 表示是软链接，false 表示不是或路径不存在
 */
function isSymlink(p) {
  try {
    // lstatSync 不会跟随软链接，能直接判断文件本身是否为链接
    return lstatSync(p).isSymbolicLink();
  } catch {
    // 路径不存在或无权限访问时，视为非软链接
    return false;
  }
}

/**
 * 判断一个软链接是否为“死链”（指向的目标不存在）
 * @param {string} p - 要判断的文件/目录路径
 * @returns {boolean} true 表示是死链，false 表示有效链接或非链接文件
 */
function isDeadLink(p) {
  // 非软链接直接返回 false，跳过普通文件/目录
  if (!isSymlink(p)) return false;
  try {
    // statSync 会跟随软链接访问目标文件
    // 如果目标不存在，会抛出 ENOENT 错误
    statSync(p);
    return false; // 无错误抛出，说明目标存在，链接有效
  } catch {
    return true; // 捕获到错误，说明目标不存在，是死链
  }
}

/**
 * 单层级遍历目录，处理软链接和 scope 目录（如 @mini/xxx）
 * @param {string} dir - 要遍历的目录路径
 */
function walkOneLevel(dir) {
  let entries;
  try {
    // 读取目录下的所有条目，返回包含文件类型信息的对象
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    // 目录不存在或无权限访问时直接返回
    return;
  }

  // 遍历目录下的每个条目
  for (const e of entries) {
    // 拼接条目完整路径
    const full = path.join(dir, e.name);
    // 扫描计数+1
    scanned++;

    // 特殊处理 scope 目录（如 @mini、@types 等）
    // 这类目录下才是真正的包软链接，需要再深入一层扫描
    if (e.isDirectory() && e.name.startsWith('@')) {
      walkOneLevel(full);
      continue; // 处理完 scope 目录后，跳过后续逻辑
    }

    // 如果是死链，执行删除操作
    if (isDeadLink(full)) {
      // 打印日志，显示相对项目根的路径，方便定位
      console.log(`[dead-link] removing: ${path.relative(ROOT, full)}`);
      try {
        // 强制删除文件，即使它是只读或无权限
        rmSync(full, { force: true });
        removed++; // 删除成功计数+1
      } catch (err) {
        // 删除失败时打印警告，不中断整个扫描流程
        console.warn(`[dead-link] failed to remove ${full}:`, err.message);
      }
    }
  }
}

// 扫描开始日志
console.log('[clean-dead-links]: scanning...');
// 遍历所有待扫描目录，执行单层级遍历
for (const root of SCAN_ROOTS) walkOneLevel(root);
// 扫描完成日志，输出统计结果
console.log(`[clean-dead-links] scanned ${scanned} entries, removed ${removed} dead link(s).`);

// 如果命令行参数包含 --reinstall，且本次有删除操作
// 则自动执行 pnpm install 刷新依赖和 lockfile
if (process.argv.includes('--reinstall') && removed > 0) {
  console.log('[clean-dead-links] running pnpm install to refresh lockfile...');
  execSync('pnpm install', { 
    stdio: 'inherit', // 继承当前终端的输入输出，让用户看到安装日志
    cwd: ROOT // 以项目根目录为工作目录执行命令
  });
}