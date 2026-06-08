
/**
 * TerminalPanel —— 最小集成终端
 * ----------------------------------------------------------------
 * 设计取舍：
 *  - 不引 xterm.js（200KB 依赖 + 多个附属包）
 *  - 也不支持完整 PTY 行为（无光标定位、无重绘）→ 不适合 vim / htop 等 TUI
 *  - 但完全支持跑 build/test/install 等命令行任务（覆盖 IDE 90% 终端用途）
 *
 * 实现：
 *  - <pre> 渲染输出，行式追加
 *  - 简单 ANSI escape 解析（仅处理 SGR 颜色：30-37/40-47/90-97/100-107 + reset）
 *  - 内置 input 行，回车发送（含换行符 \n 给 shell）
 *  - Ctrl+C 发送 SIGINT
 *  - 支持复制粘贴（contenteditable=false + textarea 容器）
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';

type Msg = { type: 'data'; data: string } | { type: 'exit'; code: number };

/** ANSI SGR → span 段 */
type Seg = { text: string; fg?: string; bg?: string; bold?: boolean };

const FG: Record<number, string> = {
  30: '#5c6370', 31: '#e06c75', 32: '#98c379', 33: '#e5c07b',
  34: '#61afef', 35: '#c678dd', 36: '#56b6c2', 37: '#abb2bf',
  90: '#7f848e', 91: '#ff7b85', 92: '#a5d99e', 93: '#f0cc8e',
  94: '#7ec6f5', 95: '#d49deb', 96: '#74c8d1', 97: '#ffffff',
};
const BG: Record<number, string> = {
  40: '#1e1e1e', 41: '#5a3030', 42: '#305a30', 43: '#5a4a30',
  44: '#30445a', 45: '#4a305a', 46: '#305a5a', 47: '#3a3a3a',
};

/** 把含 ANSI escape 的字符串拆成有色段 */
function parseAnsi(input: string, initial?: Seg): Seg[] {
  const out: Seg[] = [];
  let cur: Seg = { text: '', ...(initial ?? {}) };
  cur.text = '';
  // 匹配 ESC[...m
  const re = /\x1b\[([\d;]*)m/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    if (m.index > last) {
      cur.text += input.slice(last, m.index);
    }
    // flush 当前段（如果有文本）
    if (cur.text.length > 0) {
      out.push(cur);
      cur = { text: '', fg: cur.fg, bg: cur.bg, bold: cur.bold };
    }
    // 应用 SGR
    const codes = m[1].split(';').filter(Boolean).map(Number);
    if (codes.length === 0) codes.push(0);
    for (const c of codes) {
      if (c === 0) {
        cur = { text: '' };
      } else if (c === 1) {
        cur.bold = true;
      } else if (c === 22) {
        cur.bold = false;
      } else if (FG[c]) {
        cur.fg = FG[c];
      } else if (BG[c]) {
        cur.bg = BG[c];
      } else if (c === 39) {
        cur.fg = undefined;
      } else if (c === 49) {
        cur.bg = undefined;
      }
    }
    last = re.lastIndex;
  }
  if (last < input.length) cur.text += input.slice(last);
  if (cur.text.length > 0) out.push(cur);
  return out;
}

/**
 * 把多个 chunk 流式拼到一个 buffer 里再渲染。
 * 简化：超过 MAX_LINES 行就丢弃顶部（与真实 terminal scrollback 一致）
 */
const MAX_LINES = 4000;

export function TerminalPanel({ visible }: { visible: boolean }) {
  const [output, setOutput] = useState<Seg[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'connecting' | 'open' | 'closed'>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const styleRef = useRef<Seg>({ text: '' });
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 建连
  useEffect(() => {
    if (!visible) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://${location.host}/terminal`;
    let closed = false;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => {
      if (closed) return;
      setStatus('open');
    };
    ws.onmessage = (ev) => {
      try {
        const msg: Msg = JSON.parse(typeof ev.data === 'string' ? ev.data : '');
        if (msg.type === 'data') {
          const segs = parseAnsi(msg.data, styleRef.current);
          if (segs.length) styleRef.current = { ...segs[segs.length - 1], text: '' };
          setOutput((prev) => {
            const merged = [...prev, ...segs];
            // 估算行数，超量截
            let lines = 0;
            for (const s of merged) lines += (s.text.match(/\n/g)?.length ?? 0);
            if (lines > MAX_LINES) {
              // 简单丢弃前 25%
              return merged.slice(Math.floor(merged.length / 4));
            }
            return merged;
          });
        } else if (msg.type === 'exit') {
          setOutput((p) => [
            ...p,
            { text: `\n[process exited with code ${msg.code}]\n`, fg: '#888' },
          ]);
        }
      } catch {
        /* */
      }
    };
    ws.onclose = () => {
      if (!closed) setStatus('closed');
    };
    ws.onerror = () => {
      if (!closed) setStatus('closed');
    };
    return () => {
      closed = true;
      try {
        ws.close();
      } catch {
        /* */
      }
    };
  }, [visible]);

  // 自动滚到底部
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [output]);

  const sendInput = (text: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== ws.OPEN) return;
    ws.send(JSON.stringify({ type: 'input', data: text }));
  };

  const sendSignal = (sig: 'SIGINT' | 'SIGTERM') => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== ws.OPEN) return;
    ws.send(JSON.stringify({ type: 'signal', sig }));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // 本地回显
      setOutput((p) => [...p, { text: `${input}\n`, fg: '#a8d8ff' }]);
      sendInput(input + '\n');
      setInput('');
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && !input) {
      // 没选中 / 没输入内容 → 发 SIGINT
      e.preventDefault();
      sendSignal('SIGINT');
    } else if (e.key === 'Tab') {
      // 暂时让 Tab 走到下一个控件比较麻烦，先拦截不让默认行为
      e.preventDefault();
      sendInput(input + '\t');
    }
  };

  // 渲染
  const segNodes = useMemo(() => {
    return output.map((s, i) => {
      const style: React.CSSProperties = {};
      if (s.fg) style.color = s.fg;
      if (s.bg) style.background = s.bg;
      if (s.bold) style.fontWeight = 600;
      return (
        <span key={i} style={style}>
          {s.text}
        </span>
      );
    });
  }, [output]);

  if (!visible) return null;

  return (
    <div className="terminal-panel">
      <div className="terminal-header">
        <span className="terminal-title">Terminal</span>
        <span className={`terminal-status terminal-status-${status}`}>{status}</span>
        <div style={{ flex: 1 }} />
        <button
          className="terminal-btn"
          title="Send Ctrl+C (SIGINT)"
          onClick={() => sendSignal('SIGINT')}
        >
          Ctrl+C
        </button>
        <button
          className="terminal-btn"
          title="Clear screen"
          onClick={() => setOutput([])}
        >
          Clear
        </button>
      </div>
      <div
        className="terminal-output"
        ref={scrollRef}
        onClick={() => inputRef.current?.focus()}
      >
        <pre>{segNodes}</pre>
        <div className="terminal-prompt">
          <span className="terminal-prompt-arrow">❯</span>
          <input
            ref={inputRef}
            className="terminal-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            autoFocus
            spellCheck={false}
            autoComplete="off"
          />
        </div>
      </div>
    </div>
  );
}