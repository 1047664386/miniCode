
/**
 * PendingEditsHub —— 全局 pending edits 集线器
 * ----------------------------------------------------------------
 * 解决问题：
 *   - Agent 一次性产 N 个 pending edit 时，老 UI 只能逐个 tab 切换 accept/reject
 *   - 用户没有"全局 backlog"视野（边写边丢，最后忘了哪些没审）
 *
 * 设计：
 *   - 一个小圆 badge 常驻 titlebar，显示 pending 数量
 *   - 点击展开浮层：每条 edit 一行（文件路径 + +/- 行数 + Apply/Reject）
 *   - 头部 Apply All / Reject All（一键清空 backlog）
 *   - 行点击 → 跳到对应 diff tab（复用 store.openDiffTab）
 *   - 2s 轮询 + 监听 ev pending_edit （SSE 已有事件） refresh
 *
 * 不重复 ComposerPanel 的 pending list —— Composer 是临时面板，Hub 是常驻状态指示器。
 */
import { useEffect, useState, useCallback } from 'react';
import { useStore } from '../store';

interface PendingEdit {
  id: string;
  path: string;
  oldContent: string;
  newContent: string;
  createdAt: number;
  tool?: string;
}

export function PendingEditsHub() {
  const [edits, setEdits] = useState<PendingEdit[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const openDiffTab = useStore((s) => s.openDiffTab);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/edits');
      const list = (await r.json()) as PendingEdit[];
      setEdits(list);
    } catch {
      /* ignore */
    }
  }, []);

  // 轮询
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [refresh]);

  const acceptOne = async (id: string) => {
    setBusy(true);
    try {
      await fetch(`/api/edits/${id}/accept`, { method: 'POST' });
      await refresh();
    } finally {
      setBusy(false);
    }
  };
  const rejectOne = async (id: string) => {
    setBusy(true);
    try {
      await fetch(`/api/edits/${id}/reject`, { method: 'POST' });
      await refresh();
    } finally {
      setBusy(false);
    }
  };
  const acceptAll = async () => {
    if (!confirm(`Accept all ${edits.length} pending edits?`)) return;
    setBusy(true);
    try {
      await fetch('/api/edits/accept-all', { method: 'POST' });
      await refresh();
    } finally {
      setBusy(false);
    }
  };
  const rejectAll = async () => {
    if (!confirm(`Reject all ${edits.length} pending edits?`)) return;
    setBusy(true);
    try {
      await fetch('/api/edits/reject-all', { method: 'POST' });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const openInEditor = (e: PendingEdit) => {
    openDiffTab({
      path: e.path,
      oldContent: e.oldContent,
      newContent: e.newContent,
      pendingEditId: e.id,
    });
    setOpen(false);
  };

  // 计算 diff 行数（简易：用换行差）
  const lineDelta = (e: PendingEdit) => {
    const oldL = (e.oldContent.match(/\n/g)?.length ?? 0) + 1;
    const newL = (e.newContent.match(/\n/g)?.length ?? 0) + 1;
    return newL - oldL;
  };

  const count = edits.length;
  return (
    <div className="peh">
      <button
        className={`peh-badge ${count > 0 ? 'peh-badge-active' : ''}`}
        title={count > 0 ? `${count} pending edit(s) — click to review` : 'No pending edits'}
        onClick={() => setOpen((b) => !b)}
      >
        ◆ {count}
      </button>
      {open && (
        <>
          <div className="peh-overlay" onClick={() => setOpen(false)} />
          <div className="peh-popover" onClick={(e) => e.stopPropagation()}>
            <div className="peh-header">
              <span>Pending Edits ({count})</span>
              <div className="peh-actions">
                <button disabled={!count || busy} onClick={acceptAll} className="peh-btn-accept">
                  ✓ Accept All
                </button>
                <button disabled={!count || busy} onClick={rejectAll} className="peh-btn-reject">
                  ✕ Reject All
                </button>
              </div>
            </div>
            <div className="peh-list">
              {count === 0 && <div className="peh-empty">No pending edits.</div>}
              {edits.map((e) => {
                const d = lineDelta(e);
                return (
                  <div key={e.id} className="peh-item">
                    <div className="peh-item-main" onClick={() => openInEditor(e)}>
                      <div className="peh-item-path">{e.path}</div>
                      <div className="peh-item-meta">
                        {e.tool && <span className="peh-tag">{e.tool}</span>}
                        <span className={d >= 0 ? 'peh-add' : 'peh-del'}>
                          {d >= 0 ? `+${d}` : d} lines
                        </span>
                      </div>
                    </div>
                    <div className="peh-item-actions">
                      <button disabled={busy} onClick={() => acceptOne(e.id)} title="Apply">✓</button>
                      <button disabled={busy} onClick={() => rejectOne(e.id)} title="Reject">✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}