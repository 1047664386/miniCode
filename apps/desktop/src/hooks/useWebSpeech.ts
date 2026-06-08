
/**
 * useWebSpeech — 浏览器原生语音识别 hook
 *
 * 设计：
 *  - 直接走 Web Speech API（webkitSpeechRecognition）
 *  - 不依赖后端 ASR（零运维成本）
 *  - 实时返回 interim 中间结果 + final 最终结果
 *
 * 兼容性：
 *  - Chrome / Edge / Safari ✅（包括 Electron）
 *  - Firefox ❌（fallback 到不可用状态，UI 隐藏按钮）
 */
import { useCallback, useEffect, useRef, useState } from 'react';

type SpeechRecognitionLike = any;

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export interface UseWebSpeechOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
}

export interface UseWebSpeechResult {
  supported: boolean;
  isListening: boolean;
  transcript: string;          // 已确认的最终文本（持续累加）
  interim: string;             // 当前未定的中间文本
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

export function useWebSpeech(opts: UseWebSpeechOptions = {}): UseWebSpeechResult {
  const { lang = 'zh-CN', continuous = true, interimResults = true } = opts;

  const SpeechRecognition =
    typeof window !== 'undefined'
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;
  const supported = !!SpeechRecognition;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const finalBufRef = useRef('');
  const wantListenRef = useRef(false);

  const ensureRecognition = useCallback((): SpeechRecognitionLike | null => {
    if (!supported) return null;
    if (recRef.current) return recRef.current;
    const r = new SpeechRecognition();
    r.continuous = continuous;
    r.interimResults = interimResults;
    r.lang = lang;
    r.maxAlternatives = 1;

    r.onresult = (event: any) => {
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const text = res[0]?.transcript ?? '';
        if (res.isFinal) {
          finalBufRef.current += text;
        } else {
          interimText += text;
        }
      }
      setTranscript(finalBufRef.current);
      setInterim(interimText);
    };

    r.onerror = (ev: any) => {
      const err = String(ev?.error ?? 'unknown');
      // 'no-speech' 是常见的非致命错误（用户长时间没说话），不暴露给用户
      if (err !== 'no-speech' && err !== 'aborted') {
        setError(err);
      }
    };

    r.onend = () => {
      // 在 continuous 模式下，浏览器仍可能自动结束 → 想继续就重启
      if (wantListenRef.current) {
        try {
          r.start();
          return;
        } catch {
          /* 已经在跑了，忽略 */
        }
      }
      setIsListening(false);
      setInterim('');
    };

    recRef.current = r;
    return r;
  }, [SpeechRecognition, supported, continuous, interimResults, lang]);

  const startListening = useCallback(() => {
    const r = ensureRecognition();
    if (!r) {
      setError('not-supported');
      return;
    }
    setError(null);
    wantListenRef.current = true;
    try {
      r.start();
      setIsListening(true);
    } catch {
      // 已在跑则忽略
      setIsListening(true);
    }
  }, [ensureRecognition]);

  const stopListening = useCallback(() => {
    wantListenRef.current = false;
    const r = recRef.current;
    if (r) {
      try { r.stop(); } catch { /* ignore */ }
    }
    setIsListening(false);
    setInterim('');
  }, []);

  const resetTranscript = useCallback(() => {
    finalBufRef.current = '';
    setTranscript('');
    setInterim('');
  }, []);

  useEffect(() => {
    return () => {
      wantListenRef.current = false;
      const r = recRef.current;
      if (r) {
        try { r.abort?.(); } catch { /* ignore */ }
      }
    };
  }, []);

  return {
    supported,
    isListening,
    transcript,
    interim,
    error,
    startListening,
    stopListening,
    resetTranscript,
  };
}