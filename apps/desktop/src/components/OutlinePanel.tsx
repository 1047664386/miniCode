
/**
 * OutlinePanel —— 当前文件大纲（符号树）
 * ----------------------------------------------------------------
 * 走 GET /api/symbols?path=<relative>，拿当前 active tab 文件的符号列表，
 * 点击跳到对应行。
 *
 * 与 LSP DocumentSymbol 的区别：
 *  - LSP 提供更精准（包含 class 内部嵌套结构、deprecated 标记等）
 *  - 我们的 SymbolGraph 是项目预索引的，比 LSP 启动快；但精度略低
 *  - 这里走索引：免依赖 typescript-language-server 也能跑
 */
import { useEffect, useState } from 'react';
import { useStore } from '../store';

interface Symbol {
  id: string;
  name: string;
  kind: string;
  path: string;
  startLine: number;
  endLine: number;
  container?: string;
  exported: boolean;
  signature?: string;
}

interface Props {
  activePath?: string | null;
  onJumpTo?: (path: string, line: number) => void;
}

const KIND_ICON: Record<string, string> = {
  function: 'ƒ',
  arrow_function: 'ƒ',
  method: 'ƒ',
  class: 'C',
  interface: 'I',
  type: 'T',
  enum: 'E',
  variable: 'v',
};

const KIND_COLOR: Record<string, string> = {
  function: '#dcdcaa',
  arrow_function: '#dcdcaa',
  method: '#dcdcaa',
  class: '#4ec9b0',
  interface: '#4ec9b0',
  type: '#4ec9b0',
  enum: '#b8d7a3',
  variable: '#9cdcfe',
};

export function OutlinePanel({ activePath: activePathProp, onJumpTo }: Props = {}) {
  // 兜底走 store，不需要外面接线
  const activeTabFromStore = useStore((s) => s.activeTab);
  const revealLineStore = useStore((s) => s.revealLine);
  const activePath = activePathProp ?? activeTabFromStore;
  const jump = (p: string, l: number) => {
    if (onJumpTo) onJumpTo(p, l);
    else revealLineStore(p, l);
  };
  const [symbols, setSymbols] = useState<Symbol[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (!activePath) {
      setSymbols([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/symbols?path=${encodeURIComponent(activePath)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.ready === false) {
          setError('Index not ready yet');
          setSymbols([]);
        } else {
          setSymbols(data.symbols ?? []);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message ?? String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activePath]);

  const filtered = filter.trim()
    ? symbols.filter((s) =>
        s.name.toLowerCase().includes(filter.toLowerCase()) ||
        (s.container && s.container.toLowerCase().includes(filter.toLowerCase())),
      )
    : symbols;

  return (
    <div className="outline-panel">
      <div className="outline-header">
        <div className="outline-title">Outline</div>
        <input
          className="outline-filter"
          placeholder="Filter symbols…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <div className="outline-body">
        {!activePath && <div className="outline-empty">Open a file to see its outline</div>}
        {activePath && loading && <div className="outline-empty">Loading…</div>}
        {activePath && !loading && error && (
          <div className="outline-empty" style={{ color: '#e06c75' }}>
            {error}
          </div>
        )}
        {activePath && !loading && !error && filtered.length === 0 && (
          <div className="outline-empty">No symbols</div>
        )}
        {filtered.map((s) => (
          <div
            key={s.id}
            className="outline-item"
            style={{ paddingLeft: s.container ? 24 : 8 }}
            onClick={() => jump(s.path, s.startLine)}
            title={`${s.kind} · line ${s.startLine}-${s.endLine}`}
          >
            <span className="outline-icon" style={{ color: KIND_COLOR[s.kind] ?? '#888' }}>
              {KIND_ICON[s.kind] ?? '·'}
            </span>
            <span className="outline-name">{s.name}</span>
            {s.exported && <span className="outline-tag">export</span>}
            <span className="outline-line">L{s.startLine}</span>
          </div>
        ))}
      </div>
    </div>
  );
}