
/**
 * InlineEditWidget — Cmd+K 内联编辑浮窗
 *
 * 工作流：
 *  1. 用户在编辑器选中一段代码 → 按 Cmd+K
 *  2. EditorArea 弹出本组件，定位到 selection 起始行的下方
 *  3. 用户输入指令（如 "rename to handleClick / extract to function"）→ 回车
 *  4. /api/inline-edit SSE：流式接收新代码片段，在面板内实时显示 diff 预览
 *  5. 用户点 ✓ Apply：用 PendingEdit 走 server，编辑器切到 diff tab
 *     用户点 ✗ Cancel：不做任何写入
 *
 * 设计：弹窗本身不直接改 monaco model，所有写盘走 PendingEdit → 用户能在 DiffEditor 里复审。
 */
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';

interface Props {
  path: string;
  selection: string;
  language: string;
  contextBefore: string;
  contextAfter: string;
  fullText: string;
  startLine: number;
  onClose: () => void;
}

export function InlineEditWidget(props: Props) {
  const [instruction, setInstruction] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [generated, setGenerated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const openDiffTab = useStore((s) => s.openDiffTab);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 0);
    return () => abortRef.current?.abort();
  }, []);

  const submit = async (apply = false) => {
    if (!instruction.trim() || streaming) return;
    setStreaming(true);
    setGenerated('');
    setError(null);
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const resp = await fetch('/api/inline-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: props.path,
          selection: props.selection,
          instruction: instruction.trim(),
          language: props.language,
          contextBefore: props.contextBefore,
          contextAfter: props.contextAfter,
          apply,
          fullText: apply ? props.fullText : undefined,
        }),
        signal: abortRef.current.signal,
      });
      if (!resp.body) throw new Error('No response body');
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let acc = '';
      let pendingEditId: string | null = null;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          try {
            const ev = JSON.parse(line.slice(5).trim());
            if (ev.type === 'text') {
              acc += ev.text;
              setGenerated(acc);
            } else if (ev.type === 'done') {
              if (ev.newSelection) acc = ev.newSelection;
              setGenerated(acc);
              if (ev.pendingEditId) pendingEditId = ev.pendingEditId;
            } else if (ev.type === 'error') {
              setError(ev.error);
            }
          } catch {
            /* */
          }
        }
      }
      if (apply && pendingEditId) {
        // 服务器已经创建 PendingEdit 并替换了 selection；前端打开 diff tab
        const r = await fetch(`/api/edits/${pendingEditId}`);
        if (r.ok) {
          const edit = await r.json();
          openDiffTab({
            path: edit.path,
            oldContent: edit.oldContent,
            newContent: edit.newContent,
            pendingEditId: edit.id,
          });
        }
        props.onClose();
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        setError(e?.message ?? String(e));
      }
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div
      className="inline-edit-widget"
      style={{ top: `${(props.startLine - 1) * 20 + 30}px` }}
    >
      <div className="iew-header">
        <span className="iew-title">⚡ Cmd+K Inline Edit</span>
        <span className="iew-meta">
          {props.path} · {props.selection.split('\n').length} lines
        </span>
        <button className="iew-close" onClick={props.onClose} title="Esc">
          ×
        </button>
      </div>
      <div className="iew-body">
        <textarea
          ref={inputRef}
          className="iew-input"
          rows={2}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              props.onClose();
            } else if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (generated && !streaming) submit(true);
              else submit(false);
            }
          }}
          placeholder="Describe the edit... (Enter to preview, Enter again to apply, Esc to cancel)"
          disabled={streaming}
        />
        {generated !== null && (
          <div className="iew-diff">
            <div className="iew-diff-side iew-diff-old">
              <div className="iew-diff-label">Original</div>
              <pre>{props.selection}</pre>
            </div>
            <div className="iew-diff-side iew-diff-new">
              <div className="iew-diff-label">
                Proposed
                {streaming && <span className="iew-streaming">streaming…</span>}
              </div>
              <pre>{generated}</pre>
            </div>
          </div>
        )}
        {error && <div className="iew-error">⚠ {error}</div>}
        {generated !== null && !streaming && (
          <div className="iew-actions">
            <button className="iew-apply" onClick={() => submit(true)}>
              ✓ Apply
            </button>
            <button className="iew-retry" onClick={() => submit(false)}>
              ↺ Retry
            </button>
            <button className="iew-cancel" onClick={props.onClose}>
              ✗ Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}