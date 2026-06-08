
import { useEffect, useState } from 'react';

interface DirEntry {
  name: string;
  path: string;
}
interface ListResp {
  path: string;
  parent: string | null;
  home: string;
  dirs: DirEntry[];
  error?: string;
}

interface Props {
  initialPath?: string;
  onPick: (absPath: string) => void;
  onClose: () => void;
}

/** VSCode-like 目录选择 modal（web 模式 fallback）
 *  - 走 GET /api/fs/list-abs?path=...
 *  - 左侧 Quick Access（Home / Desktop / Documents / Downloads）
 *  - 顶部面包屑 + 上一级
 *  - 主体：当前目录的子文件夹列表（双击进入，单击选中）
 *  - 底部：当前路径 input（可手敲） + Cancel / Open
 */
export function FolderPickerModal({ initialPath, onPick, onClose }: Props) {
  const [cur, setCur] = useState<ListResp | null>(null);
  const [editPath, setEditPath] = useState(initialPath ?? '');
  const [selected, setSelected] = useState<string | null>(null);

  const load = async (p?: string) => {
    const url = p ? `/api/fs/list-abs?path=${encodeURIComponent(p)}` : '/api/fs/list-abs';
    const r = await fetch(url);
    const data: ListResp = await r.json();
    if (data.error) {
      alert(`Failed: ${data.error}`);
      return;
    }
    setCur(data);
    setEditPath(data.path);
    setSelected(null);
  };

  useEffect(() => {
    load(initialPath || undefined);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!cur) {
    return (
      <div className="fpm-backdrop" onClick={onClose}>
        <div className="fpm" onClick={(e) => e.stopPropagation()}>
          <div className="fpm-loading">Loading…</div>
        </div>
      </div>
    );
  }

  // 面包屑
  const segs = cur.path.split('/').filter(Boolean);
  const crumbs = [{ name: '/', path: '/' }, ...segs.map((s, i) => ({
    name: s,
    path: '/' + segs.slice(0, i + 1).join('/'),
  }))];

  const quick = [
    { name: 'Home', path: cur.home },
    { name: 'Desktop', path: `${cur.home}/Desktop` },
    { name: 'Documents', path: `${cur.home}/Documents` },
    { name: 'Downloads', path: `${cur.home}/Downloads` },
    { name: 'MiniCodeIDE', path: `${cur.home}/MiniCodeIDE` },
  ];

  const pick = (p: string) => {
    onPick(p);
  };

  return (
    <div className="fpm-backdrop" onClick={onClose}>
      <div className="fpm" onClick={(e) => e.stopPropagation()}>
        <div className="fpm-header">
          <div className="fpm-title">Open Folder</div>
          <button className="fpm-x" onClick={onClose}>×</button>
        </div>

        {/* breadcrumbs */}
        <div className="fpm-crumbs">
          <button
            className="fpm-crumb fpm-crumb--up"
            disabled={!cur.parent}
            onClick={() => cur.parent && load(cur.parent)}
            title="Up"
          >
            ↑
          </button>
          {crumbs.map((c, i) => (
            <span key={c.path}>
              <button className="fpm-crumb" onClick={() => load(c.path)}>
                {c.name}
              </button>
              {i < crumbs.length - 1 && <span className="fpm-crumb-sep">/</span>}
            </span>
          ))}
        </div>

        <div className="fpm-body">
          {/* sidebar */}
          <div className="fpm-side">
            <div className="fpm-side-title">Quick Access</div>
            {quick.map((q) => (
              <div key={q.path} className="fpm-side-item" onClick={() => load(q.path)}>
                📁 {q.name}
              </div>
            ))}
          </div>

          {/* directory list */}
          <div className="fpm-list">
            {cur.dirs.length === 0 && (
              <div className="fpm-empty">No subfolders. Use the path input below.</div>
            )}
            {cur.dirs.map((d) => (
              <div
                key={d.path}
                className={`fpm-row ${selected === d.path ? 'is-selected' : ''}`}
                onClick={() => setSelected(d.path)}
                onDoubleClick={() => load(d.path)}
              >
                <span className="fpm-row-icon">📁</span>
                <span className="fpm-row-name">{d.name}</span>
                <span className="fpm-row-go" onClick={(e) => { e.stopPropagation(); load(d.path); }}>
                  →
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* path input + actions */}
        <div className="fpm-footer">
          <input
            className="fpm-path-input"
            value={editPath}
            onChange={(e) => setEditPath(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                load(editPath);
              }
            }}
            placeholder="/absolute/path/to/folder (Enter to navigate)"
          />
          <div className="fpm-actions">
            <button className="fpm-btn" onClick={onClose}>Cancel</button>
            <button
              className="fpm-btn fpm-btn--primary"
              onClick={() => pick(selected ?? cur.path)}
            >
              Open {selected ? `"${selected.split('/').pop()}"` : 'this folder'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}