
/**
 * useSpeechRecognition — 统一语音识别 hook
 *
 * 自动检测运行环境，选择最优方案：
 *  - Electron 桌面端 → Vosk（离线、无网络依赖、流式识别）
 *  - Web 浏览器端 → Web Speech API（浏览器原生、无需安装模型）
 *
 * 接口完全一致，上层组件无需关心底层实现。
 *
 * 环境检测策略：
 *  - 检测 window.electronAPI?.speech 或 window.mciAgents?.speech
 *  - 有 → Electron 环境，使用 useVoskSpeech
 *  - 无 → Web 环境，降级使用 useWebSpeech
 */
import { useVoskSpeech, type UseVoskSpeechResult } from './useVoskSpeech';
import { useWebSpeech, type UseWebSpeechResult } from './useWebSpeech';

export interface UseSpeechRecognitionOptions {
  lang?: string;
}

// 统一接口（合并两边的字段，modelLoading 在 Web 端始终为 false）
export interface UseSpeechRecognitionResult {
  supported: boolean;
  isListening: boolean;
  modelLoading: boolean;
  transcript: string;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

function isElectronEnv(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as any;
  return !!(w.electronAPI?.speech || w.mciAgents?.speech);
}

export function useSpeechRecognition(
  opts: UseSpeechRecognitionOptions = {},
): UseSpeechRecognitionResult {
  const inElectron = isElectronEnv();
  const { lang = 'zh-CN' } = opts;

  // Electron → Vosk
  const voskResult = useVoskSpeech(inElectron ? { lang } : {});
  // Web → Web Speech API
  const webResult = useWebSpeech(!inElectron ? { lang } : {});

  const active = inElectron ? voskResult : webResult;

  return {
    supported: active.supported,
    isListening: active.isListening,
    modelLoading: inElectron ? (active as UseVoskSpeechResult).modelLoading : false,
    transcript: active.transcript,
    error: active.error,
    startListening: active.startListening,
    stopListening: active.stopListening,
    resetTranscript: active.resetTranscript,
  };
}
