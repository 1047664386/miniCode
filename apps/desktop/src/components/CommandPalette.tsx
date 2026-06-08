
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';

/**
 * P2 — VSCode 风格 QuickPick 多模式
 *
 *  默认（无前缀）  → 文件名 fuzzy search (/api/files/all)
 *  @<query>       → 符号搜索 (/api/symbols)
 *  #<query>       → 全文 / 语义片段搜索 (/api/hybrid-search)
 *  :<line>        → 跳转当前活动 tab 的行号
 *  ><query>       → 命令面板（注册的 IDE 命令）
 *
 *  快捷键约定：⌘P 默认进入文件模式；⌘⇧P 进入命令模式。
 */

interface SymbolHit {
  id: string;
  name: string;
  kind: string;
  path: string;
  startLine: number;
  signature: string;
  container?: string;
}

interface SearchHit {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  text: string;
  sources: string[];
}

interface FileHit {
  path: string;
}

type Mode = 'file' | 'symbol' | 'content' | 'line' | 'command';

interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  run: () => void | Promise<void>;
}

function detectMode(query: string): { mode: Mode; rest: string } {
  if (query.startsWith('>')) return { mode: 'command', rest: query.slice(1).trim() };
  if (query.startsWith('@')) return { mode: 'symbol', rest: query.slice(1).trim() };
  if (query.startsWith('#')) return { mode: 'content', rest: query.slice(1).trim() };
  if (query.startsWith(':')) return { mode: 'line', rest: query.slice(1).trim() };
  return { mode: 'file', rest: query.trim() };
}

const PREFIX_LABEL: Record<Mode, string> = {
  file: '📄 file',
  symbol: '@ symbol',
  content: '# content',
  line: ': line',
  command: '> command',
};

const PLACEHOLDER: Record<Mode, string> = {
  file: 'Type a file name. Use @ for symbols, # for content, : for line, > for commands.',
  symbol: 'Search functions/classes/interfaces…',
  content: 'Natural-language / full-text content search…',
  line: 'Jump to line in current file (e.g. :42)',
  command: 'Type a command name…',
};

export function CommandPalette({
  onClose,
  initialQuery = '',
}: {
  onClose: () => void;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<FileHit[]>([]);
  const [symbols, setSymbols] = useState<SymbolHit[]>([]);
  const [contentHits, setContentHits] = useState<SearchHit[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const { mode, rest } = useMemo(() => detectMode(query), [query]);

  // ---- registered commands (built-in) ----
  const commands: CommandItem[] = useMemo(() => {
    const st = useStore.getState();
    return [
      {
        id: 'workspace.openFolder',
        label: 'Workspace: Open Folder…',
        hint: 'Pick a folder to open as workspace',
        run: () => {
          // 直接走 FileTree 顶部按钮的逻辑：触发自定义事件
          window.dispatchEvent(new CustomEvent('mci:open-folder'));
        },
      },
      {
        id: 'view.refreshTree',
        label: 'Workspace: Refresh File Tree',
        run: () => st.loadTree('.'),
      },
      {
        id: 'view.toggleSidebar',
        label: 'View: Toggle Sidebar',
        run: () => window.dispatchEvent(new CustomEvent('mci:toggle-sidebar')),
      },
      {
        id: 'view.toggleTerminal',
        label: 'View: Toggle Terminal',
        run: () => window.dispatchEvent(new CustomEvent('mci:toggle-terminal')),
      },
      {
        id: 'chat.reset',
        label: 'Chat: New Conversation',
        run: () => st.resetChat?.(),
      },
      {
        id: 'chat.toggleMode',
        label: 'Chat: Toggle Ask / Agent Mode',
        run: () => st.setMode(st.mode === 'agent' ? 'ask' : 'agent'),
      },
      {
        id: 'editor.save',
        label: 'File: Save Active',
        run: () => st.saveActive(),
      },
      {
        id: 'editor.closeTab',
        label: 'File: Close Active Tab',
        run: () => st.activeTab && st.closeTab(st.activeTab),
      },
      {
        id: 'go.symbol',
        label: 'Go to Symbol… (@)',
        run: () => setQuery('@'),
      },
      {
        id: 'go.line',
        label: 'Go to Line… (:)',
        run: () => setQuery(':'),
      },
      {
        id: 'search.content',
        label: 'Search Content (#)',
        run: () => setQuery('#'),
      },
    ];
  }, []);

  const filteredCommands = useMemo(() => {
    if (mode !== 'command') return [];
    if (!rest) return commands;
    const q = rest.toLowerCase();
    return commands
      .map((c) => {
        const lbl = c.label.toLowerCase();
        const hit = lbl.includes(q);
        return { c, score: hit ? 1000 - lbl.length : -1 };
      })
      .filter((x) => x.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.c);
  }, [commands, mode, rest]);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    setActive(0);
  }, [query]);

  // ---- async fetchers (debounced) ----
  useEffect(() => {
    if (mode === 'command' || mode === 'line') return;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        if (mode === 'file') {
          const r = await fetch(`/api/files/all?q=${encodeURIComponent(rest)}`);
          const data = await r.json();
          setFiles((data.files ?? []).map((p: string) => ({ path: p })));
        } else if (mode === 'symbol') {
          if (!rest) { setSymbols([]); return; }
          const r = await fetch(`/api/symbols?q=${encodeURIComponent(rest)}`);
          const data = await r.json();
          setSymbols(data.symbols ?? []);
        } else if (mode === 'content') {
          if (!rest) { setContentHits([]); return; }
          const r = await fetch(`/api/hybrid-search?q=${encodeURIComponent(rest)}&k=12`);
          const data = await r.json();
          setContentHits(data.hits ?? []);
        }
      } finally {
        setLoading(false);
      }
    }, 160);
    return () => clearTimeout(t);
  }, [mode, rest]);

  // ---- result list per mode ----
  const items: Array<
    | { kind: 'file'; data: FileHit }
    | { kind: 'symbol'; data: SymbolHit }
    | { kind: 'content'; data: SearchHit }
    | { kind: 'command'; data: CommandItem }
    | { kind: 'line'; data: { line: number } }
  > = useMemo(() => {
    if (mode === 'file') return files.map((d) => ({ kind: 'file' as const, data: d }));
    if (mode === 'symbol') return symbols.map((d) => ({ kind: 'symbol' as const, data: d }));
    if (mode === 'content') return contentHits.map((d) => ({ kind: 'content' as const, data: d }));
    if (mode === 'command') return filteredCommands.map((d) => ({ kind: 'command' as const, data: d }));
    if (mode === 'line') {
      const n = Number(rest);
      if (!Number.isFinite(n) || n <= 0) return [];
      return [{ kind: 'line' as const, data: { line: Math.floor(n) } }];
    }
    return [];
  }, [mode, files, symbols, contentHits, filteredCommands, rest]);

  const total = items.length;

  const open = async (idx: number) => {
    const it = items[idx];
    if (!it) return;
    const st = useStore.getState();
    switch (it.kind) {
      case 'file':
        await st.openFile(it.data.path);
        break;
      case 'symbol':
        await st.openFile(it.data.path);
        st.revealLine(it.data.path, it.data.startLine);
        break;
      case 'content':
        await st.openFile(it.data.path);
        st.revealLine(it.data.path, it.data.startLine);
        break;
      case 'line': {
        if (st.activeTab) st.revealLine(st.activeTab, it.data.line);
        break;
      }
      case 'command':
        await it.data.run();
        break;
    }
    onClose();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') return onClose();
    if (e.key === 'ArrowDown') { setActive((a) => Math.min(total - 1, a + 1)); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { setActive((a) => Math.max(0, a - 1)); e.preventDefault(); }
    else if (e.key === 'Enter') { open(active); e.preventDefault(); }
    else if (e.key === 'Tab' && total > 0 && mode === 'file') {
      const f = items[active];
      if (f && f.kind === 'file') setQuery(`@`);
      e.preventDefault();
    }
  };

  return (
    <div className="palette-mask" onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <div className="palette-input">
          <span className="palette-prefix">{PREFIX_LABEL[mode]}</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder={PLACEHOLDER[mode]}
          />
          {loading && <span className="palette-loading">…</span>}
        </div>
        <div className="palette-list">
          {items.map((it, i) => {
            const cls = `palette-item ${i === active ? 'active' : ''}`;
            if (it.kind === 'file') {
              const base = it.data.path.split('/').pop() ?? it.data.path;
              const dir = it.data.path.slice(0, it.data.path.length - base.length).replace(/\/$/, '');
              return (
                <div
                  key={it.data.path}
                  className={cls}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => open(i)}
                >
                  <span className="kind kind-file">📄</span>
                  <span className="sym-name">{base}</span>
                  {dir && <span className="sym-path">{dir}</span>}
                </div>
              );
            }
            if (it.kind === 'symbol') {
              const s = it.data;
              return (
                <div
                  key={s.id}
                  className={cls}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => open(i)}
                >
                  <span className={`kind kind-${s.kind}`}>{kindIcon(s.kind)}</span>
                  <span className="sym-name">{s.name}</span>
                  {s.container && <span className="sym-container">.{s.container}</span>}
                  <span className="sym-path">{s.path}:{s.startLine}</span>
                </div>
              );
            }
            if (it.kind === 'content') {
              const h = it.data;
              return (
                <div
                  key={h.id}
                  className={`${cls} palette-hit`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => open(i)}
                >
                  <div className="hit-head">
                    <span className="sym-path">{h.path}:{h.startLine}-{h.endLine}</span>
                    <span className="hit-source">{h.sources.join('+')}</span>
                  </div>
                  <pre className="hit-snippet">{h.text.slice(0, 200)}</pre>
                </div>
              );
            }
            if (it.kind === 'command') {
              return (
                <div
                  key={it.data.id}
                  className={cls}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => open(i)}
                >
                  <span className="kind kind-command">⚙</span>
                  <span className="sym-name">{it.data.label}</span>
                  {it.data.hint && <span className="sym-path">{it.data.hint}</span>}
                </div>
              );
            }
            if (it.kind === 'line') {
              const st = useStore.getState();
              return (
                <div key="line" className={cls} onClick={() => open(i)}>
                  <span className="kind kind-line">→</span>
                  <span className="sym-name">Go to line {it.data.line}</span>
                  <span className="sym-path">{st.activeTab ?? '(no active file)'}</span>
                </div>
              );
            }
            return null;
          })}
          {!loading && total === 0 && (
            <div className="palette-empty">
              {mode === 'line' && rest
                ? `Invalid line number: ${rest}`
                : query
                  ? 'No results'
                  : 'Start typing…'}
            </div>
          )}
        </div>
        <div className="palette-foot">
          <span><b>↵</b> open</span>
          <span><b>↑↓</b> navigate</span>
          <span><b>esc</b> close</span>
          <span className="palette-foot-hint">prefix: <code>@</code> symbol · <code>#</code> content · <code>:</code> line · <code>&gt;</code> command</span>
        </div>
      </div>
    </div>
  );
}

function kindIcon(kind: string): string {
  switch (kind) {
    case 'function': return 'ƒ';
    case 'arrow_function': return '⇒';
    case 'class': return 'C';
    case 'interface': return 'I';
    case 'type': return 'T';
    case 'enum': return 'E';
    case 'method': return 'm';
    case 'variable': return 'v';
    default: return '?';
  }
}