
/**
 * SearchPanel —— 全局文本搜索 / 替换面板
 * ----------------------------------------------------------------
 * 走 /api/grep，按文件分组展示命中 + 1 行上下文，
 * 点击行项直接打开对应文件并跳到该行（通过 openTab + setActiveLine prop）。
 *
 * 设计：纯只读 + 跳转。"批量替换"先不做（写入逻辑要全 pendingEdit 化），
 * 评估 80% 用户场景下"找到 → 跳过去手动改"足够。
 */
import { useEffect, useState, useRef } from 'react';
import { useStore } from '../store';

interface GrepHit {
  file: string;
  line: number;
  text: string;
  before?: string;
  after?: string;
}

interface Props {
  onOpenFile?: (path: string, line?: number) => void;
}

export function SearchPanel({ onOpenFile }: Props) {
  // 兜底走 store（不需要外面传 onOpenFile）
  const openFile = useStore((s) => s.openFile);
  const revealLine = useStore((s) => s.revealLine);
  const openHit = async (path: string, line?: number) => {
    if (onOpenFile) {
      onOpenFile(path, line);
      return;
    }
    await openFile(path);
    if (typeof line === 'number') setTimeout(() => revealLine(path, line), 30);
  };
  const [pattern, setPattern] = useState('');
  const [include, setInclude] = useState('');
  const [ci, setCi] = useState(true);
  const [hits, setHits] = useState<GrepHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<{ scanned?: number; truncated?: boolean; error?: string }>({});
  const abortRef = useRef<AbortController | null>(null);

  // 节流：用户停止输入 300ms 后才发请求
  useEffect(() => {
    if (!pattern.trim()) {
      setHits([]);
      setMeta({});
      return;
    }
    const t = setTimeout(() => {
      runSearch();
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pattern, include, ci]);

  const runSearch = async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set('pattern', pattern);
      if (include) qs.set('include', include);
      if (ci) qs.set('ci', '1');
      const r = await fetch(`/api/grep?${qs.toString()}`, { signal: ac.signal });
      if (!r.ok) {
        const e = await r.json().catch(() => ({ error: r.statusText }));
        setMeta({ error: e.error ?? r.statusText });
        setHits([]);
        return;
      }
      const data = await r.json();
      setHits(data.hits ?? []);
      setMeta({ scanned: data.scanned, truncated: data.truncated });
    } catch (e: any) {
      if (e?.name !== 'AbortError') setMeta({ error: e?.message ?? String(e) });
    } finally {
      setLoading(false);
    }
  };

  // 按 file 分组
  const grouped: Record<string, GrepHit[]> = {};
  for (const h of hits) {
    (grouped[h.file] ??= []).push(h);
  }
  const files = Object.keys(grouped);

  return (
    <div className="search-panel">
      <div className="search-header">
        <div className="search-title">Search</div>
        <input
          className="search-input"
          placeholder="Pattern (regex)"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          autoFocus
        />
        <input
          className="search-input"
          placeholder='files: e.g. "*.ts" / "*.{md,mdx}"'
          value={include}
          onChange={(e) => setInclude(e.target.value)}
        />
        <label className="search-toggle">
          <input type="checkbox" checked={ci} onChange={(e) => setCi(e.target.checked)} /> case-insensitive
        </label>
        <div className="search-stats">
          {loading
            ? 'Searching…'
            : meta.error
              ? <span style={{ color: '#e06c75' }}>{meta.error}</span>
              : pattern
                ? `${hits.length} hits in ${files.length} files${meta.truncated ? ' (truncated)' : ''}`
                : 'Type a pattern to search'}
        </div>
      </div>
      <div className="search-body">
        {files.map((f) => (
          <div key={f} className="search-file">
            <div className="search-file-name" onClick={() => openHit(f)}>
              {f} <span className="search-file-count">({grouped[f].length})</span>
            </div>
            {grouped[f].slice(0, 50).map((h, i) => (
              <div
                key={i}
                className="search-hit"
                onClick={() => openHit(h.file, h.line)}
                title="Open at this line"
              >
                <span className="search-hit-line">{h.line}:</span>
                <span className="search-hit-text">{h.text}</span>
              </div>
            ))}
            {grouped[f].length > 50 && (
              <div className="search-hit-more">+ {grouped[f].length - 50} more hits</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}