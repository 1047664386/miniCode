
/**
 * MentionInput — 带 @-mention 补全的 chat textarea。
 *
 * 触发逻辑：
 *  1. 光标前最近的 token 形如 `@` → 显示 kind 选择（file/symbol/docs）
 *  2. 形如 `@file:src/m` → 调用 /api/mentions/suggest 获取候选
 *  3. ↑↓ 切换、Tab/Enter 选中、Esc 关闭
 *
 * 不打扰用户：popup 跟着光标，候选少时压低高度，没匹配自动关闭。
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

interface MentionItem {
  kind: string;
  label: string;
  insert: string;
  hint?: string;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onDrop?: (e: React.DragEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
}

const KIND_PRESETS: MentionItem[] = [
  { kind: 'file', label: '@file:<path>', insert: '@file:', hint: 'inject a file' },
  { kind: 'symbol', label: '@symbol:<name>', insert: '@symbol:', hint: 'inject a symbol definition' },
  { kind: 'docs', label: '@docs:<name>', insert: '@docs:', hint: 'inject a doc from docs/' },
  { kind: 'selection', label: '@selection:<path>:N-M', insert: '@selection:', hint: 'inject a line range' },
];

export const MentionInput = forwardRef<HTMLTextAreaElement, Props>(function MentionInput(
  { value, onChange, onKeyDown, onPaste, onDrop, placeholder, rows = 3 },
  ref,
) {
  const innerRef = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => innerRef.current!);

  const [suggestions, setSuggestions] = useState<MentionItem[]>([]);
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState<string | null>(null); // null = no popup

  // 解析光标前最近的 @token
  const detectMention = (text: string, caret: number): string | null => {
    const slice = text.slice(0, caret);
    const m = slice.match(/(?:^|\s)@([a-z]*(?::[^\s]*)?)$/i);
    return m ? m[1] : null;
  };

  // 拉取补全
  useEffect(() => {
    if (query === null) {
      setSuggestions([]);
      return;
    }
    if (!query.includes(':')) {
      // 还没选定 kind → 显示预设
      const q = query.toLowerCase();
      setSuggestions(KIND_PRESETS.filter((k) => k.kind.startsWith(q)));
      return;
    }
    let aborted = false;
    fetch(`/api/mentions/suggest?q=${encodeURIComponent(query)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!aborted) setSuggestions(d.items ?? []);
      })
      .catch(() => {
        if (!aborted) setSuggestions([]);
      });
    return () => {
      aborted = true;
    };
  }, [query]);

  useEffect(() => setActive(0), [suggestions.length]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    onChange(next);
    const q = detectMention(next, e.target.selectionStart ?? next.length);
    setQuery(q);
  };

  const insertSuggestion = (item: MentionItem) => {
    const ta = innerRef.current;
    if (!ta) return;
    const caret = ta.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const after = value.slice(caret);
    const m = before.match(/(?:^|\s)(@[a-z]*(?::[^\s]*)?)$/i);
    if (!m) return;
    const replaceStart = caret - m[1].length;
    const newBefore = before.slice(0, replaceStart) + item.insert;
    const next = newBefore + after;
    onChange(next);
    // 若 insert 以 ":" 结尾（kind 选择），保持 popup 让用户继续输 query
    setQuery(item.insert.endsWith(':') ? item.insert.slice(1, -1) + ':' : null);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(newBefore.length, newBefore.length);
    }, 0);
  };

  const popupOpen = query !== null && suggestions.length > 0;

  return (
    <div className="mention-wrap">
      {popupOpen && (
        <div className="mention-popup">
          {suggestions.map((item, i) => (
            <div
              key={`${item.kind}:${item.insert}:${item.label}`}
              className={`mention-item ${i === active ? 'active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => insertSuggestion(item)}
            >
              <span className="mention-kind">{item.kind}</span>
              <span className="mention-label">{item.label}</span>
              {item.hint && <span className="mention-hint">{item.hint}</span>}
            </div>
          ))}
        </div>
      )}
      <textarea
        ref={innerRef}
        value={value}
        onChange={handleChange}
        onPaste={onPaste}
        onDrop={onDrop}
        onKeyDown={(e) => {
          if (popupOpen) {
            if (e.key === 'ArrowDown') {
              setActive((a) => Math.min(suggestions.length - 1, a + 1));
              e.preventDefault();
              return;
            }
            if (e.key === 'ArrowUp') {
              setActive((a) => Math.max(0, a - 1));
              e.preventDefault();
              return;
            }
            if (e.key === 'Tab' || (e.key === 'Enter' && !(e.metaKey || e.ctrlKey))) {
              e.preventDefault();
              insertSuggestion(suggestions[active]);
              return;
            }
            if (e.key === 'Escape') {
              setQuery(null);
              e.preventDefault();
              return;
            }
          }
          onKeyDown?.(e);
        }}
        placeholder={placeholder}
        rows={rows}
      />
    </div>
  );
});