
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';

/**
 * P3 — Composer "Add Context" popover
 *
 *  点击 + 打开一个分类选择器：
 *    - File        (从 /api/files/all)
 *    - Folder      (后端复用 /api/files 列出 dir)
 *    - Symbol      (/api/symbols)
 *    - Current Selection / Current File (来自 active editor)
 *    - Docs        (从 /api/docs/list)
 *    - Web         (占位)
 *
 *  选中后调 store.addAttachment 直接生成 chip，不再让用户手敲 @ 语法。
 */

type Category = 'file' | 'folder' | 'symbol' | 'current' | 'docs' | 'web';

const CATS: { key: Category; label: string; icon: string; hint: string }[] = [
  { key: 'current', label: 'Current Editor', icon: '📍', hint: 'active file or selection' },
  { key: 'file', label: 'File', icon: '📄', hint: 'pick a file from workspace' },
  { key: 'folder', label: 'Folder', icon: '📁', hint: 'inject a folder structure' },
  { key: 'symbol', label: 'Symbol', icon: 'ƒ', hint: 'function / class / interface' },
  { key: 'docs', label: 'Docs', icon: '📚', hint: 'project doc files' },
  { key: 'web', label: 'Web', icon: '🌐', hint: 'web search (coming soon)' },
];

export function AddContextPopover({
  anchorRef,
  onClose,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
}) {
  const [cat, setCat] = useState<Category | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 计算锚点位置 (popover 显示在 button 上方)
  useEffect(() => {
    if (!anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    setPos({ left: r.left, bottom: window.innerHeight - r.top + 6 });
  }, [anchorRef]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [cat]);

  // ESC / 点外面 关
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (!el.closest('.add-ctx-pop') && !el.closest('.composer-chip')) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // ---- search per category ----
  useEffect(() => {
    if (!cat) return;
    setActive(0);
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        if (cat === 'file') {
          const r = await fetch(`/api/files/all?q=${encodeURIComponent(query)}`);
          const d = await r.json();
          setResults((d.files ?? []).slice(0, 30).map((p: string) => ({ kind: 'file', path: p })));
        } else if (cat === 'folder') {
          // 用根目录 listing 简单代替（点 row 后会 expand）
          const r = await fetch(`/api/files?path=${encodeURIComponent('.')}`);
          const d = await r.json();
          const dirs = (d ?? []).filter((e: any) => e.isDir);
          const filtered = query
            ? dirs.filter((e: any) => e.path.toLowerCase().includes(query.toLowerCase()))
            : dirs;
          setResults(filtered.map((e: any) => ({ kind: 'folder', path: e.path })));
        } else if (cat === 'symbol') {
          const r = await fetch(`/api/symbols?q=${encodeURIComponent(query)}`);
          const d = await r.json();
          setResults((d.symbols ?? []).slice(0, 30).map((s: any) => ({
            kind: 'symbol',
            label: s.name,
            path: s.path,
            line1: s.startLine,
            sub: `${s.path}:${s.startLine}`,
            container: s.container,
          })));
        } else if (cat === 'current') {
          const st = useStore.getState();
          const items: any[] = [];
          if (st.activeTab) {
            items.push({
              kind: 'file',
              path: st.activeTab,
              label: `Current file — ${st.activeTab}`,
            });
          }
          // 选区由编辑器侧 ⌘L 推送，这里 fallback 不强求
          setResults(items);
        } else if (cat === 'docs') {
          const r = await fetch('/api/docs/list').catch(() => null);
          if (r && r.ok) {
            const d = await r.json();
            setResults(((d.docs ?? d) as any[]).slice(0, 30).map((x) => ({
              kind: 'file',
              path: x.path ?? x,
              label: x.name ?? x.path ?? x,
            })));
          } else {
            setResults([]);
          }
        } else if (cat === 'web') {
          setResults([{ kind: 'note', label: '🌐 Web search not yet enabled' }]);
        }
      } finally {
        setLoading(false);
      }
    }, 140);
    return () => clearTimeout(t);
  }, [cat, query]);

  const choose = (idx: number) => {
    const r = results[idx];
    if (!r) return;
    if (r.kind === 'note') return;
    const st = useStore.getState();
    st.addAttachment({
      kind: r.kind,
      path: r.path,
      label: r.label ?? r.path.split('/').pop() ?? r.path,
      line1: r.line1,
      line2: r.line2,
    });
    onClose();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') return onClose();
    if (e.key === 'ArrowDown') { setActive((a) => Math.min(results.length - 1, a + 1)); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { setActive((a) => Math.max(0, a - 1)); e.preventDefault(); }
    else if (e.key === 'Enter') { choose(active); e.preventDefault(); }
    else if (e.key === 'Backspace' && !query && cat) { setCat(null); }
  };

  const hint = useMemo(() => {
    if (!cat) return 'Choose a category, then search.';
    return CATS.find((c) => c.key === cat)?.hint ?? '';
  }, [cat]);

  if (!pos) return null;

  return (
    <div
      className="add-ctx-pop"
      style={{ left: pos.left, bottom: pos.bottom, position: 'fixed' }}
    >
      <div className="add-ctx-head">
        <span className="add-ctx-title">{cat ? `${CATS.find((c) => c.key === cat)?.label}` : 'Add Context'}</span>
        {cat && (
          <button className="add-ctx-back" onClick={() => { setCat(null); setQuery(''); }}>
            ← back
          </button>
        )}
      </div>

      {!cat ? (
        <div className="add-ctx-cats">
          {CATS.map((c) => (
            <button
              key={c.key}
              className="add-ctx-cat"
              onClick={() => { setCat(c.key); setQuery(''); }}
            >
              <span className="add-ctx-cat__icon">{c.icon}</span>
              <span className="add-ctx-cat__label">{c.label}</span>
              <span className="add-ctx-cat__hint">{c.hint}</span>
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="add-ctx-search">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKey}
              placeholder={hint}
            />
            {loading && <span className="add-ctx-loading">…</span>}
          </div>
          <div className="add-ctx-list">
            {results.length === 0 && !loading && (
              <div className="add-ctx-empty">No results</div>
            )}
            {results.map((r, i) => (
              <div
                key={i}
                className={`add-ctx-item ${i === active ? 'active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(i)}
              >
                <span className="add-ctx-item__icon">
                  {r.kind === 'file' ? '📄' : r.kind === 'folder' ? '📁' : r.kind === 'symbol' ? 'ƒ' : '•'}
                </span>
                <span className="add-ctx-item__label">{r.label ?? r.path}</span>
                {r.sub && <span className="add-ctx-item__sub">{r.sub}</span>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}