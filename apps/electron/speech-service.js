
/**
 * SpeechService — 主进程语音识别服务（基于 sherpa-onnx）
 * ---------------------------------------------------------------
 * 职责：
 *  1. 管理 sherpa-onnx 流式模型的生命周期（下载 / 解压 / 加载）
 *  2. 接收渲染进程发来的 Float32 PCM 音频数据，送入 OnlineRecognizer
 *  3. 将识别结果（实时中间结果 + 最终结果）通过 IPC 回传给对应窗口
 *
 * 模型选择：
 *  - sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20
 *  - 中英双语流式模型，~84MB tar.bz2 压缩包
 *  - 流式识别延迟低，适合语音输入场景
 *
 * 缓存策略：
 *  - 模型下载到 ~/.minicodeide/speech-model/，一次下载终身复用
 *  - app 启动时后台预下载+预加载，用户首次点击麦克风时零等待
 */

const path = require('node:path');
const fs = require('node:fs');
const https = require('node:https');
const http = require('node:http');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

// ─── 模型配置 ────────────────────────────────────────────────

const MODEL_CONFIG = {
  id: 'sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20',
  url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20.tar.bz2',
  // HuggingFace 镜像（国内加速）
  mirrorUrl: 'https://hf-mirror.com/csukuangfj/sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20/resolve/main/sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20.tar.bz2',
  estimatedSize: 88_000_000, // ~84MB，用于进度估算
  // 模型内部文件
  encoder: 'encoder-epoch-99-avg-1.int8.onnx',
  decoder: 'decoder-epoch-99-avg-1.int8.onnx',
  joiner: 'joiner-epoch-99-avg-1.int8.onnx',
  tokens: 'tokens.txt',
};

const SAMPLE_RATE = 16000;

class SpeechService {
  constructor() {
    /** @type {import('sherpa-onnx-node') | null} */
    this.sherpaOnnx = null;
    /** @type {any} OnlineRecognizer instance */
    this.recognizer = null;
    /** @type {any} current OnlineStream */
    this.stream = null;
    /** @type {string} 已确认的文本（跨 segment 累积） */
    this.confirmedText = '';
    /** @type {string} 模型目录的绝对路径 */
    this.modelDir = '';
    this.modelReady = false;
    /** @type {Promise<void> | null} 防止并发下载/加载 */
    this._downloadPromise = null;
    this._loadPromise = null;
  }

  // ─── 路径 ────────────────────────────────────────────────

  _getModelRoot() {
    return path.join(os.homedir(), '.minicodeide', 'speech-model');
  }

  _getModelDir() {
    return path.join(this._getModelRoot(), MODEL_CONFIG.id);
  }

  _isModelDownloaded() {
    const dir = this._getModelDir();
    return fs.existsSync(path.join(dir, MODEL_CONFIG.tokens));
  }

  // ─── 下载 & 解压 ─────────────────────────────────────────

  /**
   * 确保模型已下载并解压。幂等操作，多次调用安全。
   * @param {(status: { phase: string; percent?: number }) => void} onStatus
   */
  async ensureModel(onStatus = () => {}) {
    if (this._isModelDownloaded()) {
      onStatus({ phase: 'ready' });
      return;
    }
    // 复用正在进行的下载
    if (this._downloadPromise) return this._downloadPromise;

    this._downloadPromise = this._downloadAndExtract(onStatus)
      .finally(() => { this._downloadPromise = null; });

    return this._downloadPromise;
  }

  async _downloadAndExtract(onStatus) {
    const root = this._getModelRoot();
    fs.mkdirSync(root, { recursive: true });

    const archivePath = path.join(root, `${MODEL_CONFIG.id}.tar.bz2`);

    // 下载（先尝试 GitHub，失败后尝试 HuggingFace 镜像）
    onStatus({ phase: 'downloading', percent: 0 });
    try {
      await this._downloadFile(MODEL_CONFIG.url, archivePath, (pct) => {
        onStatus({ phase: 'downloading', percent: pct });
      });
    } catch (e) {
      console.warn('[speech] GitHub download failed, trying mirror:', e.message);
      await this._downloadFile(MODEL_CONFIG.mirrorUrl, archivePath, (pct) => {
        onStatus({ phase: 'downloading', percent: pct });
      });
    }

    // 解压 tar.bz2（使用系统 tar，macOS/Linux/Windows10+ 均自带）
    onStatus({ phase: 'extracting', percent: 100 });
    console.log('[speech] extracting model...');
    try {
      execFileSync('tar', ['-xjf', archivePath, '-C', root], {
        timeout: 120_000,
        stdio: 'pipe',
      });
    } catch (e) {
      // tar 失败时尝试用 PowerShell（Windows fallback）
      if (process.platform === 'win32') {
        execFileSync('powershell', [
          '-Command',
          `tar -xjf "${archivePath}" -C "${root}"`,
        ], { timeout: 120_000, stdio: 'pipe' });
      } else {
        throw e;
      }
    }

    // 清理压缩包
    try { fs.unlinkSync(archivePath); } catch { /* ignore */ }

    if (!this._isModelDownloaded()) {
      throw new Error('模型解压后未找到预期文件，请检查磁盘空间');
    }

    onStatus({ phase: 'ready' });
    console.log('[speech] model extracted to:', this._getModelDir());
  }

  _downloadFile(url, dest, onProgress) {
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
              if (pct !== lastPct) { lastPct = pct; onProgress(pct); }
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

  // ─── 模型加载 ─────────────────────────────────────────────

  async loadModel() {
    if (this.modelReady && this.recognizer) return;
    // 串行化并发加载
    if (this._loadPromise) return this._loadPromise;
    this._loadPromise = this._doLoadModel().finally(() => { this._loadPromise = null; });
    return this._loadPromise;
  }

  async _doLoadModel() {
    if (!this.sherpaOnnx) {
      try {
        this.sherpaOnnx = require('sherpa-onnx-node');
      } catch (e) {
        throw new Error(
          `sherpa-onnx-node 加载失败，请确认已安装平台对应的预编译包\n${e.message}`
        );
      }
    }

    this.modelDir = this._getModelDir();
    const tokensPath = path.join(this.modelDir, MODEL_CONFIG.tokens);
    if (!fs.existsSync(tokensPath)) {
      throw new Error(`模型文件缺失: ${tokensPath}`);
    }

    console.log('[speech] loading model:', this.modelDir);

    const recognizerConfig = {
      featConfig: { sampleRate: SAMPLE_RATE, featureDim: 80 },
      modelConfig: {
        transducer: {
          encoder: path.join(this.modelDir, MODEL_CONFIG.encoder),
          decoder: path.join(this.modelDir, MODEL_CONFIG.decoder),
          joiner: path.join(this.modelDir, MODEL_CONFIG.joiner),
        },
        tokens: tokensPath,
        numThreads: 2,
        debug: false,
      },
      decodingMethod: 'greedy_search',
      enableEndpoint: 1,
      rule1MinTrailingSilence: 2.4,  // 长句后 2.4s 静音触发端点
      rule2MinTrailingSilence: 1.2,  // 有识别结果后 1.2s 静音触发
      rule3MinUtteranceLength: 20,   // 超过 20s 强制分句
    };

    this.recognizer = new this.sherpaOnnx.OnlineRecognizer(recognizerConfig);
    this.modelReady = true;
    console.log('[speech] model loaded, recognizer ready');
  }

  // ─── 识别 ─────────────────────────────────────────────────

  /**
   * 开始一次新的识别会话。
   * @param {(result: { text: string; partial: string; isFinal: boolean }) => void} onResult
   */
  startRecognition(onResult) {
    if (!this.recognizer) throw new Error('Model not loaded');

    // 清理上一次的状态
    this.stopRecognition();

    this.stream = this.recognizer.createStream();
    this.confirmedText = '';
    this._onResult = onResult;
  }

  /**
   * 送入 Float32 PCM 音频数据（16kHz，单声道，[-1,1] 范围）。
   * @param {Float32Array} samples
   */
  feedAudio(samples) {
    if (!this.recognizer || !this.stream) return;

    this.stream.acceptWaveform({ samples, sampleRate: SAMPLE_RATE });

    while (this.recognizer.isReady(this.stream)) {
      this.recognizer.decode(this.stream);
    }

    const result = this.recognizer.getResult(this.stream);
    const isEndpoint = this.recognizer.isEndpoint(this.stream);

    if (isEndpoint && result.text && result.text.trim()) {
      // 端点检测触发：当前 segment 结束
      this.confirmedText += result.text.trim() + ' ';
      this._onResult?.({ text: this.confirmedText.trim(), partial: '', isFinal: true });
      // 重置 stream，开始下一个 segment
      this.recognizer.reset(this.stream);
    } else if (result.text && result.text.trim()) {
      // 中间结果（partial）
      this._onResult?.({
        text: '',
        partial: (this.confirmedText + result.text.trim()).trim(),
        isFinal: false,
      });
    }
  }

  /**
   * 停止识别，返回最终结果。
   * @returns {{ text: string } | null}
   */
  stopRecognition() {
    if (!this.stream) return null;

    // 处理剩余音频
    this.stream.inputFinished();
    while (this.recognizer && this.recognizer.isReady(this.stream)) {
      this.recognizer.decode(this.stream);
    }

    let finalText = this.confirmedText.trim();
    if (this.recognizer) {
      const lastResult = this.recognizer.getResult(this.stream);
      if (lastResult && lastResult.text && lastResult.text.trim()) {
        finalText += (finalText ? ' ' : '') + lastResult.text.trim();
      }
    }

    this.stream = null;
    this._onResult = null;

    return finalText ? { text: finalText } : null;
  }

  // ─── 清理 ─────────────────────────────────────────────────

  destroy() {
    this.stream = null;
    this._onResult = null;
    this.recognizer = null;
    this.modelReady = false;
  }
}

// ─── 单例 ────────────────────────────────────────────────────

let _instance = null;

/** @returns {SpeechService} */
function getSpeechService() {
  if (!_instance) _instance = new SpeechService();
  return _instance;
}

module.exports = { getSpeechService, MODEL_CONFIG, SAMPLE_RATE };
