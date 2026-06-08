
/**
 * AgentsSidebar — 全局会话侧栏（按工作区分组）
 *
 * 设计：
 *  - 顶部「＋ 新对话」（当前 workspaceRoot 下建一个新会话）
 *  - 「工作区」section：列出所有已知工作区（按最近活跃排序）
 *    - 当前工作区默认展开；其它工作区折叠
 *    - 每个工作区下面 = 该工作区下的所有会话（按 updatedAt 倒序）
 *    - 点击会话 → setActiveSession（如果会话属于别的工作区会自动切 workspace）
 *  - 「未绑定」分组（workspaceRoot 为空的旧会话）
 */
import { useMemo, useState } from 'react';
import { useAgentsStore, type SessionMeta } from './store';

const UNBOUND = '__unbound__';

export function AgentsSidebar() {
  const sessions = useAgentsStore((s) => s.sessions);
  const activeId = useAgentsStore((s) => s.activeSessionId);
  const setActive = useAgentsStore((s) => s.setActiveSession);
  const createSession = useAgentsStore((s) => s.createSession);
  const deleteSession = useAgentsStore((s) => s.deleteSession);
  const mode = useAgentsStore((s) => s.mode);
  const workspace = useAgentsStore((s) => s.workspaceRoot);

  // ws path → 会话数组
  const groups = useMemo(() => {
    const map = new Map<string, SessionMeta[]>();
    for (const s of sessions) {
      const key = s.workspaceRoot || UNBOUND;
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    // 每组内按 updatedAt 倒序
    for (const arr of map.values()) {
      arr.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    // group 排序：当前 workspace 优先 → 然后按最新活跃时间
    const entries = [...map.entries()];
    entries.sort((a, b) => {
      if (a[0] === workspace) return -1;
      if (b[0] === workspace) return 1;
      if (a[0] === UNBOUND) return 1;
      if (b[0] === UNBOUND) return -1;
      const ta = a[1][0]?.updatedAt ?? 0;
      const tb = b[1][0]?.updatedAt ?? 0;
      return tb - ta;
    });
    return entries;
  }, [sessions, workspace]);

  // 默认只有"当前 workspace"展开
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const isCollapsed = (key: string) => {
    if (key in collapsed) return collapsed[key];
    return key !== workspace;
  };
  const toggleGroup = (key: string) =>
    setCollapsed((c) => ({ ...c, [key]: !isCollapsed(key) }));

  return (
    <aside className="agents-sidebar">
      <div className="agents-sidebar-header">MyFlicker</div>
      <button
        type="button"
        className="agents-new-chat"
        onClick={() => void createSession()}
        title="在当前工作区新建对话"
      >
        ＋ 新对话
      </button>

      <div className="agents-section">
        <div className="agents-section-title">
          工作区{groups.length > 0 ? ` (${groups.length})` : ''}
        </div>

        {groups.length === 0 ? (
          <div className="agents-empty">暂无会话</div>
        ) : (
          <ul className="agents-ws-groups">
            {groups.map(([key, arr]) => {
              const isCurrent = key === workspace;
              const name =
                key === UNBOUND
                  ? '未绑定工作区'
                  : key.split('/').pop() || key;
              const open = !isCollapsed(key);
              return (
                <li key={key} className={`agents-ws-group${isCurrent ? ' is-current' : ''}`}>
                  <div
                    className="agents-ws-group-head"
                    onClick={() => toggleGroup(key)}
                    title={key === UNBOUND ? '没有绑定工作区的旧会话' : key}
                  >
                    <span className="agents-ws-group-caret">{open ? '▾' : '▸'}</span>
                    <span className="agents-ws-group-icon">
                      {key === UNBOUND ? '📦' : '📁'}
                    </span>
                    <span className="agents-ws-group-name">{name}</span>
                    <span className="agents-ws-group-count">{arr.length}</span>
                  </div>

                  {open && (
                    <ul className="agents-session-list">
                      {arr.map((s) => (
                        <li
                          key={s.id}
                          className={`agents-session-item${s.id === activeId ? ' active' : ''}`}
                          onClick={() => setActive(s.id)}
                          title={s.title}
                        >
                          <span className="agents-session-title">
                            {s.title || '未命名对话'}
                          </span>
                          <button
                            type="button"
                            className="agents-session-del"
                            title="删除"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`删除会话 "${s.title}"？`)) void deleteSession(s.id);
                            }}
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {mode === 'code' && !workspace && (
        <div className="agents-empty agents-empty-sub" style={{ padding: '8px 12px' }}>
          请在中间选择一个工作区
        </div>
      )}
    </aside>
  );
}