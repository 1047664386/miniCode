
/**
 * GitPanel — 简版 Git Source Control。
 *
 * 功能：
 *  - 显示当前分支 + 所有 Modified/Added/Deleted/Untracked 文件
 *  - 点击文件 → 在右侧 textarea 显示 unified diff
 *  - Generate Commit Message：把 diff 喂给 LLM，5~10 秒内返回 conventional commit
 *  - Commit：用 message 提交所有改动（git add -A 然后 commit）
 *  - 提交后自动 refresh
 *
 * 体验上接近 VSCode SCM 但极简：单文件预览 + 一键 commit，足够日常用。
 */
import { useEffect, useState } from 'react';

interface GitFile {
  status: string;
  path: string;
  staged: boolean;
}

export function GitPanel() {
  const [isRepo, setIsRepo] = useState<boolean | null>(null);
  const [branch, setBranch] = useState('');
  const [files, setFiles] = useState<GitFile[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [diff, setDiff] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<'gen' | 'commit' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const r = await fetch('/api/git/status');
      const data = await r.json();
      if (!data.isRepo) {
        setIsRepo(false);
        return;
      }
      setIsRepo(true);
      setBranch(data.branch ?? '');
      // 同 path + status 去重
      const seen = new Set<string>();
      const dedup = (data.files as GitFile[]).filter((f) => {
        const k = f.path + ':' + f.status;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      setFiles(dedup);
      if (selectedPath && !dedup.find((f) => f.path === selectedPath)) {
        setSelectedPath(null);
        setDiff('');
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };

  const loadDiff = async (path: string) => {
    setSelectedPath(path);
    try {
      const r = await fetch(`/api/git/diff?path=${encodeURIComponent(path)}`);
      const text = await r.text();
      setDiff(text || '(no diff — likely a new untracked file)');
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };

  const generateMessage = async () => {
    setBusy('gen');
    setError(null);
    try {
      const r = await fetch('/api/git/generate-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setMessage(data.message ?? '');
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  };

  const commit = async () => {
    if (!message.trim()) return;
    setBusy('commit');
    setError(null);
    try {
      const r = await fetch('/api/git/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setMessage('');
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  if (isRepo === null) return <div className="git-panel">Loading…</div>;
  if (isRepo === false)
    return (
      <div className="git-panel">
        <div className="gp-empty">Not a git repository</div>
      </div>
    );

  return (
    <div className="git-panel">
      <div className="gp-header">
        <span className="gp-branch">⎇ {branch}</span>
        <button className="gp-refresh" onClick={refresh} title="Refresh">
          ↻
        </button>
      </div>

      <div className="gp-files">
        {files.length === 0 && <div className="gp-empty">Working tree clean</div>}
        {files.map((f) => (
          <div
            key={f.path + f.status + f.staged}
            className={`gp-file gp-status-${f.status} ${f.path === selectedPath ? 'selected' : ''}`}
            onClick={() => loadDiff(f.path)}
          >
            <span className="gp-status">{f.status}</span>
            <span className="gp-path">{f.path}</span>
            {f.staged && <span className="gp-staged">●</span>}
          </div>
        ))}
      </div>

      {selectedPath && (
        <div className="gp-diff">
          <div className="gp-diff-header">
            <code>{selectedPath}</code>
          </div>
          <pre>{diff}</pre>
        </div>
      )}

      <div className="gp-commit">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Commit message (or click ✨ to generate)"
          rows={3}
        />
        <div className="gp-commit-actions">
          <button
            className="gp-gen"
            disabled={busy !== null || files.length === 0}
            onClick={generateMessage}
            title="Generate commit message from diff using LLM"
          >
            {busy === 'gen' ? '…' : '✨ Generate'}
          </button>
          <button
            className="gp-commit-btn"
            disabled={busy !== null || !message.trim() || files.length === 0}
            onClick={commit}
          >
            {busy === 'commit' ? '…' : '✓ Commit'}
          </button>
        </div>
        {error && <div className="gp-error">⚠ {error}</div>}
      </div>
    </div>
  );
}