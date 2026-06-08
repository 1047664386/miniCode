#!/usr/bin/env node
/**
 * 重新签名 mac-arm64 的 .app（ad-hoc，无 hardened runtime）
 * ---------------------------------------------------------------
 * electron-builder 在没有 Apple Developer 证书时只做 ad-hoc 签名，
 * 但 hardenedRuntime:true 导致签名声称 "resources must be present" 却
 * 没有实际 seal resources，macOS Gatekeeper 会拒绝启动。
 *
 * 本脚本在 electron-builder 输出后执行：
 *   1. 找到 release/mac-arm64/*.app
 *   2. codesign --force --deep --sign -  （纯 ad-hoc，不带 --options runtime）
 *   3. xattr -cr 清除 quarantine / provenance 属性
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const releaseDir = resolve(__dirname, '..', 'apps', 'electron', 'release');

// 查找 arm64 .app 目录
const candidates = ['mac-arm64', 'mac'];
let appPath = null;

for (const dir of candidates) {
  const full = resolve(releaseDir, dir);
  if (!existsSync(full)) continue;
  for (const entry of readdirSync(full)) {
    if (entry.endsWith('.app')) {
      appPath = resolve(full, entry);
      break;
    }
  }
  if (appPath) break;
}

if (!appPath) {
  console.warn('[resign] No .app found in release/mac-arm64 or release/mac — skipping.');
  process.exit(0);
}

console.log('[resign] Re-signing:', appPath);

// 1. 重新签名（纯 ad-hoc，不带 hardened runtime）
try {
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });
  console.log('[resign] codesign OK');
} catch (e) {
  console.error('[resign] codesign failed:', e.message);
  process.exit(1);
}

// 2. 验证签名
try {
  execFileSync('codesign', ['--verify', '--deep', appPath], { stdio: 'inherit' });
  console.log('[resign] codesign verify OK');
} catch (e) {
  console.warn('[resign] codesign verify warning:', e.message);
}

// 3. 清除 quarantine / provenance 属性
try {
  execFileSync('xattr', ['-cr', appPath], { stdio: 'inherit' });
  console.log('[resign] xattr cleared');
} catch {
  /* ignore — xattr -cr 在没有扩展属性时也可能返回非零 */
}

console.log('[resign] Done. App is ready to launch.');
