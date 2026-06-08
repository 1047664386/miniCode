
/**
 * SessionsDrawer — 历史会话侧抽屉（左滑出现）
 *
 * 功能：
 *  - 列出所有会话（按更新时间倒序）
 *  - 点击切换 session（拉取历史消息）
 *  - 新建 / 重命名 / 删除
 *  - 高亮当前 active session
 */
import { useEffect, useState } from 'react';
import { useStore } from '../store';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SessionsDrawer({ open, onClose }: Props) {
  const {
    sessionList,
    sessionId,
    loadSessions,
    createSession,
    switchSession,
    deleteSession,
    renameSession,
    resumeSession,
    discardResume,
  } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  useEffect(() => {
    if (open) loadSessions();
  }, [open, loadSessions]);

  if (!open) return null;

  return (
    <div className="sessions-drawer-overlay" onClick={onClose}>
      <div className="sessions-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="sd-header">
          <h3>Sessions</h3>
          <button
            className="sd-new"
            onClick={async () => {
              await createSession();
              onClose();
            }}
          >
            + New
          </button>
        </div>
        <div className="sd-list">
          {sessionList.length === 0 && (
            <div className="sd-empty">No sessions yet. Click + New to start.</div>
          )}
          {sessionList.map((s) => (
            <div
              key={s.id}
              className={`sd-item ${s.id === sessionId ? 'active' : ''}`}
              onClick={() => {
                if (editingId === s.id) return;
                switchSession(s.id);
                onClose();
              }}
            >
              {editingId === s.id ? (
                <input
                  autoFocus
                  className="sd-edit"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={async () => {
                    if (editTitle.trim()) await renameSession(s.id, editTitle.trim());
                    setEditingId(null);
                  }}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      if (editTitle.trim()) await renameSession(s.id, editTitle.trim());
                      setEditingId(null);
                    } else if (e.key === 'Escape') {
                      setEditingId(null);
                    }
                  }}
                />
              ) : (
                <>
                  <div className="sd-title">
                    {s.interruptedTurn && <span title="interrupted" style={{ color: '#e67e22', marginRight: 6 }}>⏸</span>}
                    {s.title}
                  </div>
                  <div className="sd-meta">
                    <span>{s.messageCount} msgs</span>
                    <span>·</span>
                    <span>{formatTime(s.updatedAt)}</span>
                  </div>
                </>
              )}
              <div className="sd-actions">
                {s.interruptedTurn && (
                  <>
                    <button
                      title="Continue (resume the interrupted turn)"
                      style={{ color: '#27ae60', fontWeight: 600 }}
                      onClick={async (e) => {
                        e.stopPropagation();
                        await resumeSession(s.id);
                        onClose();
                      }}
                    >
                      ⏵
                    </button>
                    <button
                      title="Discard interrupted turn"
                      onClick={async (e) => {
                        e.stopPropagation();
                        await discardResume(s.id);
                        await loadSessions();
                      }}
                    >
                      ⨯
                    </button>
                  </>
                )}
                <button
                  title="Rename"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingId(s.id);
                    setEditTitle(s.title);
                  }}
                >
                  ✎
                </button>
                <button
                  title="Delete"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (confirm(`Delete session "${s.title}"?`)) {
                      await deleteSession(s.id);
                    }
                  }}
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString();
}