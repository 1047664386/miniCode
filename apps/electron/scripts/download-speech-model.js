#!/usr/bin/env node

/**
 * 语音模型预下载脚本（postinstall 钩子）
 * ---------------------------------------------------------------
 * 在 pnpm install 时自动下载 sherpa-onnx 语音模型到用户目录
 * 模型大小 ~84MB，一次下载终身复用
 *
 * 目标路径：~/.minicodeide/speech-model/<model-id>/
 *
 * 环境变量：
 *   SKIP_SPEECH_MODEL=1     跳过下载（CI/离线环境）
 *   SPEECH_MODEL_MIRROR=1   强制使用 HuggingFace 镜像（国内加速）
 */

const path = require('node:path');
const fs = require('node:fs');
const https = require('node:https');
const http = require('node:http');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

// ─── 模型配置（与 speech-service.js 保持一致）────────────────

const MODEL_CONFIG = {
  id: 'sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20',
  url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20.tar.bz2',
  mirrorUrl: 'https://hf-mirror.com/csukuangfj/sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20/resolve/main/sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20.tar.bz2',
  estimatedSize: 88_000_000,
  tokens: 'tokens.txt',
};

// ─── 工具函数 ─────────────────────────────────────────────────

function log(msg) {
  console.log(`[speech-model] ${msg}`);
}

function warn(msg) {
  console.warn(`[speech-model] ${msg}`);
}

function getModelRoot() {
  return path.join(os.homedir(), '.minicodeide', 'speech-model');
}

function getModelDir() {
  return path.join(getModelRoot(), MODEL_CONFIG.id);
}

function isModelDownloaded() {
  const dir = getModelDir();
  return fs.existsSync(path.join(dir, MODEL_CONFIG.tokens));
}

function downloadFile(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const doGet = (u, depth = 0) => {
      if (depth > 8) return reject(new Error('too many redirects'));
      const client = u.startsWith('https') ? https : http;
      client.get(u, { timeout: 30_000 }, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          res.resume();
          return doGet(res.headers.location, depth + 1);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        const total = Number(res.headers['content-length'] || MODEL_CONFIG.estimatedSize);
        let got = 0;
        let lastPct = -1;
        const file = fs.createWriteStream(dest);
        res.on('data', (chunk) => {
          got += chunk.length;
          if (total && onProgress) {
            const pct = Math.min(99, Math.floor((got / total) * 100));
            if (pct !== lastPct && pct % 10 === 0) { // 每 10% 输出一次
              lastPct = pct;
              onProgress(pct);
            }
          }
        });
        res.on('error', reject);
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve()));
        file.on('error', reject);
      }).on('error', reject)
        .on('timeout', function () { this.destroy(new Error('request timeout')); });
    };
    doGet(url);
  });
}

async function downloadAndExtract() {
  const root = getModelRoot();
  fs.mkdirSync(root, { recursive: true });

  const archivePath = path.join(root, `${MODEL_CONFIG.id}.tar.bz2`);

  // 检查是否使用镜像
  const useMirror = process.env.SPEECH_MODEL_MIRROR === '1';
  const primaryUrl = useMirror ? MODEL_CONFIG.mirrorUrl : MODEL_CONFIG.url;
  const fallbackUrl = useMirror ? MODEL_CONFIG.url : MODEL_CONFIG.mirrorUrl;

  // 下载
  log(`downloading from ${useMirror ? 'HuggingFace mirror' : 'GitHub'}...`);
  try {
    await downloadFile(primaryUrl, archivePath, (pct) => {
      process.stdout.write(`\r[speech-model] downloading: ${pct}%`);
    });
    process.stdout.write('\n');
  } catch (e) {
    warn(`primary download failed: ${e.message}, trying fallback...`);
    try {
      await downloadFile(fallbackUrl, archivePath, (pct) => {
        process.stdout.write(`\r[speech-model] downloading (mirror): ${pct}%`);
      });
      process.stdout.write('\n');
    } catch (e2) {
      throw new Error(`all download attempts failed: ${e2.message}`);
    }
  }

  // 解压
  log('extracting model...');
  try {
    execFileSync('tar', ['-xjf', archivePath, '-C', root], {
      timeout: 120_000,
      stdio: 'pipe',
    });
  } catch (e) {
    if (process.platform === 'win32') {
      execFileSync('powershell', [
        '-Command',
        `tar -xjf "${archivePath}" -C "${root}"`,
      ], { timeout: 120_000, stdio: 'pipe' });
    } else {
      throw e;
    }
  }

  // 清理
  try { fs.unlinkSync(archivePath); } catch { /* ignore */ }

  if (!isModelDownloaded()) {
    throw new Error('extraction completed but model files not found');
  }

  log(`model ready at: ${getModelDir()}`);
}

// ─── 主流程 ───────────────────────────────────────────────────

async function main() {
  // 跳过条件
  if (process.env.SKIP_SPEECH_MODEL === '1') {
    log('skipped (SKIP_SPEECH_MODEL=1)');
    return;
  }

  if (isModelDownloaded()) {
    log('model already downloaded, skipping');
    return;
  }

  try {
    await downloadAndExtract();
  } catch (e) {
    warn(`download failed: ${e.message}`);
    warn('you can manually download later, or set SPEECH_MODEL_MIRROR=1 for China mirror');
    warn('to skip this step: SKIP_SPEECH_MODEL=1 pnpm install');
    // 不抛出异常，避免阻断整个 install 流程
  }
}

main();
