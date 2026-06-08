

/**
 * Composer / Checkpoints 侧栏面板
 * - Pending Edits：所有未审核的修改文件，支持点击跳转 diff、Accept All / Reject All
 * - Checkpoints：历史 snapshot，支持 Revert
 */
import { useEffect, useState } from 'react';
import { useStore } from '../store';

interface PendingItem {
  id: string;
  path: string;
  tool: string;
  oldContent: string | null;
  newContent: string;
  createdAt: number;
}

interface CheckpointMeta {
  id: string;
  label: string;
  trigger: string;
  createdAt: number;
  reverted: boolean;
  fileCount: number;
  files: string[];
}

export function ComposerPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'pending' | 'checkpoints'>('pending');
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [checkpoints, setCheckpoints] = useState<CheckpointMeta[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    if (tab === 'pending') {
      const r = await fetch('/api/edits');
      setPending(await r.json());
    } else {
      const r = await fetch('/api/checkpoints');
      setCheckpoints(await r.json());
    }
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [tab]);

  const openDiff = (e: PendingItem) => {
    useStore.getState().openDiffTab({
      path: e.path,
      oldContent: e.oldContent,
      newContent: e.newContent,
      pendingEditId: e.id,
    });
  };

  const acceptAll = async () => {
    setBusy(true);
    try {
      await fetch('/api/edits/accept-all', { method: 'POST' });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const rejectAll = async () => {
    setBusy(true);
    try {
      await fetch('/api/edits/reject-all', { method: 'POST' });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const revert = async (id: string) => {
    if (!confirm('Revert this checkpoint? Files will be restored to their state before this change.')) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/checkpoints/${id}/revert`, { method: 'POST' });
      const data = await r.json();
      console.log('[revert]', data);
      // 重新拉一遍当前打开文件，触发 monaco 刷新
      const tabs = useStore.getState().tabs;
      for (const t of tabs) {
        const f = await fetch(`/api/file?path=${encodeURIComponent(t.path)}`);
        const d = await f.json();
        useStore.setState((s) => ({
          tabs: s.tabs.map((x) =>
            x.path === t.path ? { ...x, content: d.content ?? '', dirty: false } : x,
          ),
        }));
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="composer-mask" onClick={onClose}>
      <div className="composer" onClick={(e) => e.stopPropagation()}>
        <div className="composer-head">
          <div className="composer-tabs">
            <button
              className={tab === 'pending' ? 'active' : ''}
              onClick={() => setTab('pending')}
            >
              Pending ({pending.length})
            </button>
            <button
              className={tab === 'checkpoints' ? 'active' : ''}
              onClick={() => setTab('checkpoints')}
            >
              Checkpoints ({checkpoints.length})
            </button>
          </div>
          <button className="composer-close" onClick={onClose}>×</button>
        </div>

        {tab === 'pending' && (
          <>
            <div className="composer-actions">
              <button disabled={!pending.length || busy} onClick={acceptAll}>
                ✓ Accept All ({pending.length})
              </button>
              <button disabled={!pending.length || busy} onClick={rejectAll}>
                ✕ Reject All
              </button>
            </div>
            <div className="composer-list">
              {pending.length === 0 && <div className="empty-hint">No pending edits.</div>}
              {pending.map((e) => {
                const added = countAdded(e.oldContent ?? '', e.newContent);
                const removed = countRemoved(e.oldContent ?? '', e.newContent);
                return (
                  <div key={e.id} className="composer-item" onClick={() => openDiff(e)}>
                    <span className="composer-path">{e.path}</span>
                    <span className="composer-tool">{e.tool}</span>
                    <span className="composer-diff-stat">
                      <span className="add">+{added}</span>
                      <span className="del">-{removed}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {tab === 'checkpoints' && (
          <div className="composer-list">
            {checkpoints.length === 0 && <div className="empty-hint">No checkpoints yet.</div>}
            {checkpoints.map((c) => (
              <div key={c.id} className={`composer-cp ${c.reverted ? 'reverted' : ''}`}>
                <div className="cp-head">
                  <span className="cp-label">{c.label}</span>
                  <span className="cp-time">{relativeTime(c.createdAt)}</span>
                </div>
                <div className="cp-files">
                  {c.files.slice(0, 3).join('  ·  ')}
                  {c.files.length > 3 && ` …+${c.files.length - 3}`}
                </div>
                <div className="cp-actions">
                  <span className="cp-trigger">{c.trigger}</span>
                  {c.reverted ? (
                    <span className="cp-tag">reverted</span>
                  ) : (
                    <button disabled={busy} onClick={() => revert(c.id)}>
                      ⟲ Revert
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function countAdded(oldS: string, newS: string): number {
  const oldLines = new Set(oldS.split('\n'));
  let n = 0;
  for (const l of newS.split('\n')) if (!oldLines.has(l)) n++;
  return n;
}
function countRemoved(oldS: string, newS: string): number {
  const newLines = new Set(newS.split('\n'));
  let n = 0;
  for (const l of oldS.split('\n')) if (!newLines.has(l)) n++;
  return n;
}
function relativeTime(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toLocaleString();
}