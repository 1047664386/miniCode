
/**
 * useVoskSpeech — Electron 端离线语音识别 hook（通过 IPC 调用主进程 sherpa-onnx）
 *
 * 设计：
 *  - 渲染进程负责：麦克风采集（getUserMedia）+ PCM 转换（Web Audio API）
 *  - 主进程负责：sherpa-onnx 模型加载 + 流式语音识别推理
 *  - 通过 preload 暴露的 IPC API 桥接两端
 *  - 接口与 useWebSpeech 保持一致，便于上层无缝切换
 *
 * 音频流程：
 *  getUserMedia → AudioContext → ScriptProcessorNode → Float32 PCM → IPC → sherpa-onnx
 *
 * 注意：
 *  - 模型首次使用需下载（~84MB），主进程会在 app 启动时后台预下载
 *  - 若预下载未完成，startListening 会等待下载（modelLoading=true）
 */
import { useState, useRef, useCallback, useEffect } from 'react';

// ─── Types ─────────────────────────────────────────────────

interface SpeechAPI {
  getStatus: () => Promise<{ available: boolean; modelReady: boolean; sampleRate: number }>;
  ensureModel: () => Promise<{ ok: boolean }>;
  start: () => Promise<{ ok: boolean }>;
  sendAudio: (buffer: ArrayBuffer) => void;
  stop: () => Promise<{ ok: boolean; finalResult: { text: string } | null }>;
  onResult: (cb: (r: { text: string; partial: string; isFinal: boolean }) => void) => () => void;
  onModelStatus: (cb: (s: { phase: string; percent?: number }) => void) => () => void;
}

interface ElectronWindow {
  electronAPI?: { speech?: SpeechAPI };
  mciAgents?: { speech?: SpeechAPI };
}

export interface UseVoskSpeechOptions {
  lang?: string; // 保留接口一致性，模型已固定为中英双语
}

export interface UseVoskSpeechResult {
  supported: boolean;
  isListening: boolean;
  /** 模型是否在加载中（下载 / 初始化） */
  modelLoading: boolean;
  /** final + partial 拼接文本 */
  transcript: string;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

// ─── Helpers ───────────────────────────────────────────────

function getSpeechAPI(): SpeechAPI | null {
  const w = window as unknown as ElectronWindow;
  return w.electronAPI?.speech ?? w.mciAgents?.speech ?? null;
}

// ─── Hook ──────────────────────────────────────────────────

export function useVoskSpeech(_opts: UseVoskSpeechOptions = {}): UseVoskSpeechResult {
  const speechAPI = useRef<SpeechAPI | null>(null);
  const [supported, setSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  // 音频采集相关
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptNodeRef = useRef<ScriptProcessorNode | null>(null);

  // 文本累积（跨 segment 保持）
  const finalTextRef = useRef('');
  const listeningRef = useRef(false);

  // 初始化：检测 IPC API 可用性
  useEffect(() => {
    const api = getSpeechAPI();
    speechAPI.current = api;
    setSupported(!!api);
  }, []);

  // 订阅 IPC 事件
  useEffect(() => {
    const api = speechAPI.current;
    if (!api) return;

    const unsubResult = api.onResult((r) => {
      if (r.isFinal && r.text) {
        // 主进程已经累积了 confirmedText，直接用
        setTranscript(r.text);
        finalTextRef.current = r.text;
      } else if (r.partial) {
        setTranscript(r.partial);
      }
    });

    const unsubModel = api.onModelStatus((s) => {
      if (s.phase === 'downloading' || s.phase === 'extracting') {
        setModelLoading(true);
      } else if (s.phase === 'ready') {
        setModelLoading(false);
      }
    });

    return () => {
      unsubResult();
      unsubModel();
    };
  }, []);

  const startListening = useCallback(async () => {
    const api = speechAPI.current;
    if (!api) {
      setError('语音识别 API 不可用（需要在 Electron 环境中运行）');
      return;
    }

    setError(null);
    finalTextRef.current = '';
    setTranscript('');

    try {
      // 1. 确保模型已下载 + 加载（若已预加载则瞬间返回）
      setModelLoading(true);
      await api.ensureModel();
      setModelLoading(false);

      // 2. 请求麦克风权限并采集音频
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;

      // 3. 创建音频处理链
      const audioCtx = new AudioContext(); // 使用硬件原生采样率
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const scriptNode = audioCtx.createScriptProcessor(4096, 1, 1);
      scriptNodeRef.current = scriptNode;

      const hardwareRate = audioCtx.sampleRate;

      scriptNode.onaudioprocess = (e: AudioProcessingEvent) => {
        if (!listeningRef.current) return;

        const float32 = e.inputBuffer.getChannelData(0);

        // 如果硬件采样率不是 16kHz，需要线性插值重采样
        let resampled: Float32Array;
        if (Math.abs(hardwareRate - 16000) > 100) {
          const ratio = 16000 / hardwareRate;
          const newLen = Math.round(float32.length * ratio);
          resampled = new Float32Array(newLen);
          for (let i = 0; i < newLen; i++) {
            const srcIdx = i / ratio;
            const lo = Math.floor(srcIdx);
            const hi = Math.min(lo + 1, float32.length - 1);
            const frac = srcIdx - lo;
            resampled[i] = float32[lo] * (1 - frac) + float32[hi] * frac;
          }
        } else {
          resampled = float32;
        }

        // 直接发送 Float32 PCM 数据（sherpa-onnx 原生格式）
        // 复制一份避免 ArrayBuffer 被 transfer 后失效
        api.sendAudio(new Float32Array(resampled).buffer as ArrayBuffer);
      };

      source.connect(scriptNode);
      // ScriptProcessorNode 必须连接到 destination 才能触发 onaudioprocess，
      // 插入 GainNode(gain=0) 静音，避免麦克风音频回放到扬声器
      const silentGain = audioCtx.createGain();
      silentGain.gain.value = 0;
      scriptNode.connect(silentGain);
      silentGain.connect(audioCtx.destination);

      // 4. 启动主进程识别器
      await api.start();
      listeningRef.current = true;
      setIsListening(true);
    } catch (e: any) {
      console.error('[Speech] start failed:', e);
      if (e?.name === 'NotAllowedError') {
        setError('麦克风权限被拒绝，请在系统设置中允许麦克风');
      } else if (e?.name === 'NotFoundError') {
        setError('未检测到麦克风设备');
      } else {
        setError(`语音识别启动失败: ${e?.message ?? e}`);
      }
      setModelLoading(false);
      cleanupAudio();
    }
  }, []);

  const stopListening = useCallback(async () => {
    const api = speechAPI.current;
    listeningRef.current = false;

    // 停止主进程识别器
    if (api) {
      try {
        const result = await api.stop();
        if (result?.finalResult?.text) {
          setTranscript(result.finalResult.text);
          finalTextRef.current = result.finalResult.text;
        }
      } catch { /* ignore */ }
    }

    // 停止音频采集
    cleanupAudio();
    setIsListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    finalTextRef.current = '';
    setTranscript('');
  }, []);

  // 清理音频资源
  function cleanupAudio() {
    if (scriptNodeRef.current) {
      try { scriptNodeRef.current.disconnect(); } catch { /* */ }
      scriptNodeRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch { /* */ }
      audioContextRef.current = null;
    }
  }

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      listeningRef.current = false;
      cleanupAudio();
      // 异步停止主进程识别器（best effort）
      speechAPI.current?.stop().catch(() => {});
    };
  }, []);

  return {
    supported,
    isListening,
    modelLoading,
    transcript,
    error,
    startListening,
    stopListening,
    resetTranscript,
  };
}
