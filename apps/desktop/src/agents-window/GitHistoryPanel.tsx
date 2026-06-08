
/**
 * GitHistoryPanel — 右栏「历史」tab
 *
 * GET /api/agents/git/log → commits[]
 * 点击 commit → GET /api/agents/git/show?hash=xxx → 展示 diff
 */
import { useEffect, useState } from 'react';
import { useAgentsStore } from './store';

interface Commit {
  hash: string;
  short: string;
  author: string;
  email: string;
  ts: number;
  subject: string;
  isAi: boolean;
}

export function GitHistoryPanel() {
  const ws = useAgentsStore((s) => s.workspaceRoot);
  const sandboxDirty = useAgentsStore((s) => s.sandboxDirty);
  const [loading, setLoading] = useState(false);
  const [isRepo, setIsRepo] = useState<boolean | null>(null);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [diff, setDiff] = useState<string>('');
  const [diffLoading, setDiffLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/agents/git/log?limit=80');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setIsRepo(!!j.isRepo);
      setCommits(Array.isArray(j.commits) ? j.commits : []);
    } catch {
      setIsRepo(false);
      setCommits([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!ws) return;
    void refresh();
  }, [ws, sandboxDirty]);

  const onPick = async (hash: string) => {
    setSelected(hash);
    setDiff('');
    setDiffLoading(true);
    try {
      const r = await fetch(`/api/agents/git/show?hash=${encodeURIComponent(hash)}`);
      const j = await r.json();
      setDiff(j?.diff ?? '');
    } finally {
      setDiffLoading(false);
    }
  };

  if (!ws) return null;

  return (
    <div className="git-panel">
      <div className="git-panel-toolbar">
        <span className="git-panel-title">📜 历史</span>
        <span className="git-panel-count">
          {isRepo === false ? '非 git 仓库' : loading ? '…' : `${commits.length} 条提交`}
        </span>
        <button
          type="button"
          className="tree-cloud-btn"
          onClick={() => void refresh()}
          disabled={loading}
          title="重新读取 git log"
        >↻</button>
      </div>

      {isRepo === false ? (
        <div className="agents-empty">
          <div>当前沙箱不是 git 仓库</div>
        </div>
      ) : commits.length === 0 && !loading ? (
        <div className="agents-empty">
          <div>没有提交历史</div>
          <div className="agents-empty-sub">让 AI 改文件 → 在变更面板点 ✓ 接受 → 这里就会出现一条记录</div>
        </div>
      ) : (
        <>
          <div className="git-changes-list">
            {commits.map((c) => {
              const ago = relativeTime(c.ts);
              return (
                <div
                  key={c.hash}
                  className={`git-change-row${selected === c.hash ? ' active' : ''}`}
                  onClick={() => onPick(c.hash)}
                  title={`${c.author} <${c.email}>\n${new Date(c.ts).toLocaleString()}\n${c.subject}`}
                >
                  <span className={`git-status-badge ${c.isAi ? 'commit-ai' : 'commit-human'}`}>
                    {c.isAi ? '✦' : '👤'}
                  </span>
                  <span className="commit-short">{c.short}</span>
                  <span className="commit-subject">{c.subject || '(no message)'}</span>
                  <span className="commit-ago">{ago}</span>
                </div>
              );
            })}
          </div>
          {selected && (
            <div className="git-diff-panel">
              <div className="git-diff-header">
                <span>🔖 {selected.slice(0, 7)}</span>
                <button
                  type="button"
                  className="tree-cloud-btn"
                  onClick={() => { setSelected(null); setDiff(''); }}
                  title="关闭"
                >×</button>
              </div>
              {diffLoading ? (
                <div className="agents-empty">加载 diff…</div>
              ) : diff ? (
                <DiffView text={diff} />
              ) : (
                <div className="agents-empty">空 diff</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s} 秒前`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  return new Date(ms).toLocaleDateString();
}

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
        else if (ln.startsWith('commit ') || ln.startsWith('Author:') || ln.startsWith('Date:') || ln.startsWith('diff ') || ln.startsWith('index ')) cls += ' diff-meta';
        return <div key={i} className={cls}>{ln || '\u00A0'}</div>;
      })}
    </pre>
  );
}