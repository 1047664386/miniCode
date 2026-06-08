
/**
 * GitChangesPanel — 右栏「变更」tab
 *
 * 功能：
 *  - 列表展示 git status 变更，按状态着色
 *  - 点击文件 → 加载 diff 并展示在下半区
 *  - "接受"按钮（git add + commit，让 HEAD 前进）
 *  - "撤回"按钮（git checkout HEAD / rm 未跟踪 / git rm 已 staged）
 *  - 监听全局 'mci.jumpToDiff' 事件（来自工具气泡点击）
 */
import { useEffect, useState } from 'react';
import { useAgentsStore } from './store';

interface GitChange {
  path: string;
  status: string;
  raw?: string;
}

const STATUS_LABEL: Record<string, { label: string; cls: string; icon: string }> = {
  M: { label: '已修改', cls: 'status-M', icon: 'M' },
  A: { label: '已新增', cls: 'status-A', icon: 'A' },
  D: { label: '已删除', cls: 'status-D', icon: 'D' },
  R: { label: '重命名', cls: 'status-R', icon: 'R' },
  '??': { label: '未跟踪', cls: 'status-U', icon: 'U' },
};

export function GitChangesPanel() {
  const ws = useAgentsStore((s) => s.workspaceRoot);
  const sandboxDirty = useAgentsStore((s) => s.sandboxDirty);
  const refreshGitStatus = useAgentsStore((s) => s.refreshGitStatus);
  const [loading, setLoading] = useState(false);
  const [isRepo, setIsRepo] = useState<boolean | null>(null);
  const [changes, setChanges] = useState<GitChange[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [diff, setDiff] = useState<string>('');
  const [diffLoading, setDiffLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch('/api/agents/git/status');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setIsRepo(!!j.isRepo);
      setChanges(Array.isArray(j.changes) ? j.changes : []);
      // 同步到全局 store（让文件树徽章共用）
      void refreshGitStatus();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const loadDiff = async (p: string) => {
    setSelected(p);
    setDiff('');
    setDiffLoading(true);
    try {
      const r = await fetch(`/api/agents/git/diff?path=${encodeURIComponent(p)}`);
      const j = await r.json();
      setDiff(j?.diff ?? '');
    } finally {
      setDiffLoading(false);
    }
  };

  useEffect(() => {
    if (!ws) return;
    void refresh();
  }, [ws, sandboxDirty]);

  // 监听工具气泡的 "跳转到 diff" 事件
  useEffect(() => {
    const handler = (ev: Event) => {
      const e = ev as CustomEvent<{ path: string }>;
      const p = e.detail?.path;
      if (!p) return;
      const cleaned = p.replace(/^\/+/, '');
      // 切回我们这边后就拉 diff（即使该文件不在 changes 列表里也强行加载——可能尚未刷到）
      void loadDiff(cleaned);
    };
    window.addEventListener('mci.jumpToDiff', handler as EventListener);
    return () => window.removeEventListener('mci.jumpToDiff', handler as EventListener);
  }, []);

  const onRevert = async (path: string, status: string) => {
    if (!confirm(`撤回 ${path} 的改动？此操作不可逆。`)) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/agents/git/revert', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path, status }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.stderr || j.error || 'revert failed');
      if (selected === path) { setSelected(null); setDiff(''); }
      await refresh();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const onAccept = async (path: string) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/agents/git/accept', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path, message: `ai: ${path}` }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.stderr || j.error || 'commit failed');
      if (selected === path) { setSelected(null); setDiff(''); }
      await refresh();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!ws) return null;

  return (
    <div className="git-panel">
      <div className="git-panel-toolbar">
        <span className="git-panel-title">📝 变更</span>
        <span className="git-panel-count">
          {isRepo === false ? '非 git 仓库' : loading ? '…' : `${changes.length} 个文件`}
        </span>
        <button
          type="button"
          className="tree-cloud-btn"
          onClick={() => void refresh()}
          disabled={loading || busy}
          title="重新读取 git status"
        >↻</button>
      </div>

      {err && <div className="git-panel-error">⚠ {err}</div>}

      {isRepo === false ? (
        <div className="agents-empty">
          <div>当前沙箱不是 git 仓库</div>
          <div className="agents-empty-sub">克隆一个仓库或在沙箱里 git init</div>
        </div>
      ) : changes.length === 0 && !loading ? (
        <div className="agents-empty">
          <div>暂无变更</div>
          <div className="agents-empty-sub">让 AI 改点东西，然后回来看 diff</div>
        </div>
      ) : (
        <>
          <div className="git-changes-list">
            {changes.map((c) => {
              const meta = STATUS_LABEL[c.status] ?? { label: c.status, cls: 'status-other', icon: c.status[0] || '?' };
              const isActive = selected === c.path;
              return (
                <div
                  key={c.path}
                  className={`git-change-row${isActive ? ' active' : ''}`}
                  onClick={() => loadDiff(c.path)}
                  title={`${meta.label} · ${c.path}`}
                >
                  <span className={`git-status-badge ${meta.cls}`}>{meta.icon}</span>
                  <span className="git-change-path">{c.path}</span>
                  <button
                    type="button"
                    className="git-action-btn git-action-accept"
                    onClick={(e) => { e.stopPropagation(); void onAccept(c.path); }}
                    disabled={busy}
                    title="接受改动（git add + commit）"
                  >✓</button>
                  <button
                    type="button"
                    className="git-action-btn git-action-revert"
                    onClick={(e) => { e.stopPropagation(); void onRevert(c.path, c.status); }}
                    disabled={busy}
                    title="撤回改动"
                  >↶</button>
                </div>
              );
            })}
          </div>
          {selected && (
            <div className="git-diff-panel">
              <div className="git-diff-header">
                <span>📄 {selected}</span>
                <button
                  type="button"
                  className="tree-cloud-btn"
                  onClick={() => void onAccept(selected)}
                  disabled={busy}
                  title="接受这个文件的改动"
                >✓ 接受</button>
                <button
                  type="button"
                  className="tree-cloud-btn"
                  onClick={() => {
                    const c = changes.find((x) => x.path === selected);
                    void onRevert(selected, c?.status ?? 'M');
                  }}
                  disabled={busy}
                  title="撤回这个文件的改动"
                >↶ 撤回</button>
                <button
                  type="button"
                  className="tree-cloud-btn"
                  onClick={() => { setSelected(null); setDiff(''); }}
                  title="关闭 diff"
                >×</button>
              </div>
              {diffLoading ? (
                <div className="agents-empty">加载 diff…</div>
              ) : diff ? (
                <DiffView text={diff} />
              ) : (
                <div className="agents-empty">没有 diff（可能是空文件或二进制）</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * DiffView — 把 unified diff 文本渲染成带颜色的行
 */
function DiffView({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <pre className="diff-pre">
      {lines.map((ln, i) => {
        let cls = 'diff-line';
        if (ln.startsWith('+++') || ln.startsWith('---')) cls += ' diff-meta';
        else if (ln.startsWith('@@')) cls += ' diff-hunk';
        else if (ln.startsWith('+')) cls += ' diff-add';
        else if (ln.startsWith('-')) cls += ' diff-del';
        else if (ln.startsWith('diff ') || ln.startsWith('index ')) cls += ' diff-meta';
        return <div key={i} className={cls}>{ln || '\u00A0'}</div>;
      })}
    </pre>
  );
}