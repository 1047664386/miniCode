
/**
 * useWebSpeech — 浏览器原生语音识别 hook
 *
 * 设计（参照 Ai-bot 的可靠模式 + 持续监听增强）：
 *  - 每次 startListening 创建新实例，避免旧实例状态残留
 *  - transcript 同时包含 final + interim 文本，组件直接拼接即可
 *  - continuous 模式下浏览器自动停止后会自动重启（延迟 300ms，直到用户手动 stop）
 *  - stopListening 销毁实例，干净利落
 *
 * 兼容性：
 *  - Chrome / Edge / Safari ✅（包括 Electron）
 *  - Firefox ❌（fallback 到不可用状态，UI 隐藏按钮）
 */
import { useState, useRef, useCallback, useEffect } from 'react';

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export interface UseWebSpeechOptions {
  lang?: string;
}

export interface UseWebSpeechResult {
  supported: boolean;
  isListening: boolean;
  /** final + interim 拼接文本（组件直接用） */
  transcript: string;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

export function useWebSpeech(opts: UseWebSpeechOptions = {}): UseWebSpeechResult {
  const { lang = 'zh-CN' } = opts;

  const isSupported =
    typeof window !== 'undefined' &&
    (!!window.SpeechRecognition || !!window.webkitSpeechRecognition);
   // 2. 补充缺失的 ref，和state同步
  const isListeningRef = useRef<boolean>(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  /** 用户是否期望持续监听（用于 onend 自动重启） */
  const wantListenRef = useRef(false);
  /** 累积的 final 文本（跨 restart 保持） */
  const finalTextRef = useRef('');

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError('当前浏览器不支持语音识别，请使用 Chrome / Edge');
      return;
    }
    // 先停掉旧实例
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setError('当前浏览器不支持语音识别');
      return;
    }

    // 重置累积文本
    finalTextRef.current = '';
    setError(null);
    setTranscript('');
    wantListenRef.current = true;

    /** 创建一个新的 SpeechRecognition 实例并启动 */
    const createAndStart = (): boolean => {
      try {
        const recognition = new SR();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = lang;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event: any) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const t = event.results[i][0]?.transcript ?? '';
            if (event.results[i].isFinal) {
              finalTextRef.current += t;
            } else {
              interim += t;
            }
          }
          // transcript = final + interim（组件直接拼接到 input）
          setTranscript(finalTextRef.current + interim);
        };

        recognition.onerror = (event: any) => {
          const err = String(event?.error ?? 'unknown');
          console.error('[WebSpeech Error]:', err);
          if (err === 'not-allowed') {
            setError('麦克风权限被拒绝，请在系统设置中允许麦克风');
            wantListenRef.current = false;
            isListeningRef.current = false;
            setIsListening(false);
          } else if (err === 'network') {
            // 网络错误不立即停止，让 onend 自动重启尝试恢复
            console.warn('[WebSpeech] network error, will auto-restart');
          } else if (err === 'no-speech') {
            // 没有检测到语音，不中断监听，让 onend 自动重启
            console.log('[WebSpeech] no-speech detected, will auto-restart');
          } else if (err === 'aborted') {
            // 用户主动停止，不处理
          } else if (err === 'audio-capture') {
            setError('未检测到麦克风，请检查设备');
            wantListenRef.current = false;
            isListeningRef.current = false;
            setIsListening(false);
          } else {
            // 其他非致命错误，保持监听状态让 onend 自动重启
            console.warn('[WebSpeech] non-fatal error:', err);
          }
        };

        recognition.onend = () => {
          console.log('[WebSpeech] recognition ended, wantListen:', wantListenRef.current);
          // 在 continuous 模式下浏览器仍可能自动结束（如长时间静默）
          // 如果用户仍期望监听 → 延迟后自动重启（Electron/Chromium 需要延迟）
          if (wantListenRef.current) {
            setTimeout(() => {
              if (wantListenRef.current) {
                console.log('[WebSpeech] auto-restarting...');
                const ok = createAndStart();
                if (!ok) {
                  setIsListening(false);
                }
              } else {
                setIsListening(false);
              }
            }, 300);
            return;
          }
          setIsListening(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
        setIsListening(true);
        return true;
      } catch (e: any) {
        console.warn('[WebSpeech] createAndStart failed:', e);
        setError(`启动语音识别失败: ${e?.message ?? e}`);
        setIsListening(false);
        wantListenRef.current = false;
        return false;
      }
    };

    createAndStart();
  }, [isSupported, lang]);

  const stopListening = useCallback(() => {
    console.log('[WebSpeech] stopListening called');
    wantListenRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    finalTextRef.current = '';
    setTranscript('');
  }, []);

  // 组件卸载时关闭麦克风
  useEffect(() => {
    return () => {
      wantListenRef.current = false;
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch { /* ignore */ }
        recognitionRef.current = null;
      }
    };
  }, []);

  return {
    supported: isSupported,
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    resetTranscript,
  };
}
