
/**
 * SandboxModal — Web 沙箱入口（替代桌面端"选目录"的 prompt）
 *
 * 三种方式进入沙箱：
 *  ① 上传本地文件夹 —— <input webkitdirectory>，把整个目录读进沙箱
 *  ② Clone Git 仓库 —— git URL → /api/agents/git/clone
 *  ③ 空沙箱 —— 直接进入，自己 touch 文件
 */
import { useEffect, useRef, useState } from 'react';
import { chunkedUpload, listResumableUploads, abortUpload, type UploadProgress } from './chunkedUpload';
import { useAgentsStore } from './store';

interface Props {
  open: boolean;
  onClose: () => void;
  /** 操作完成后被调用，传入用作 ws 标签的字符串（通常是仓库名） */
  onReady: (label: string) => void;
}

const COMMON_REPOS = [
  { name: 'sindresorhus/is', url: 'https://github.com/sindresorhus/is.git' },
  { name: 'expressjs/express', url: 'https://github.com/expressjs/express.git' },
  { name: 'lodash/lodash', url: 'https://github.com/lodash/lodash.git' },
];

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', '.next', '.turbo', 'build', '.cache']);
const MAX_FILE_BYTES = 200 * 1024 * 1024; // 单文件 200MB（>2MB 走分块）
const LARGE_FILE_THRESHOLD = 2 * 1024 * 1024;
const MAX_TOTAL_FILES = 5000;

type Tab = 'upload' | 'git' | 'empty';

export function SandboxModal({ open, onClose, onReady }: Props) {
  const [tab, setTab] = useState<Tab>('upload');
  const [repo, setRepo] = useState('');
  const [branch, setBranch] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setErr(null);
      setRepo('');
      setBranch('');
      setProgress(null);
      setTab('upload');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, loading]);

  if (!open) return null;

  const repoNameOf = (url: string) => {
    const m = url.match(/[\\/:]([^\\/]+?)(?:\.git)?\/?$/);
    return m?.[1] ?? 'sandbox';
  };

  // === ① 上传本地文件夹 ===
  const onPickFolder = () => fileInputRef.current?.click();
  const onFolderChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fl = e.target.files;
    if (!fl || fl.length === 0) return;

    setLoading(true);
    setErr(null);
    setProgress('扫描文件…');
    try {
      const rootName = (fl[0] as any).webkitRelativePath?.split('/')[0] || 'project';
      const small: File[] = [];
      const large: File[] = [];
      for (let i = 0; i < fl.length; i++) {
        const f = fl[i];
        const rel = (f as any).webkitRelativePath as string;
        if (!rel) continue;
        const parts = rel.split('/');
        if (parts.some((p) => IGNORE_DIRS.has(p))) continue;
        if (f.size > MAX_FILE_BYTES) continue; // 超过 200MB 实在太大，跳过
        if (f.size > LARGE_FILE_THRESHOLD) large.push(f);
        else small.push(f);
        if (small.length + large.length > MAX_TOTAL_FILES) break;
      }
      if (small.length === 0 && large.length === 0) {
        setErr('该目录里没有可上传的文件（可能全被过滤了）');
        return;
      }

      // ===== 小文件：批量 JSON 上传 =====
      if (small.length) {
        setProgress(`读取 ${small.length} 个小文件…`);
        const payload: { path: string; content: string; encoding: 'utf-8' | 'base64' }[] = [];
        const isLikelyText = (name: string) =>
          /\.(ts|tsx|js|jsx|mjs|cjs|json|md|mdx|css|scss|html|yml|yaml|txt|sh|py|go|rs|toml|env|gitignore|prettierrc|eslintrc|lock)$|^README|^Dockerfile/i.test(name);
        const BATCH = 100;
        for (let i = 0; i < small.length; i += BATCH) {
          const slice = small.slice(i, i + BATCH);
          await Promise.all(
            slice.map(async (f) => {
              const rel = ((f as any).webkitRelativePath as string).slice(rootName.length + 1);
              if (!rel) return;
              if (isLikelyText(f.name)) {
                payload.push({ path: rel, content: await f.text(), encoding: 'utf-8' });
              } else {
                const buf = new Uint8Array(await f.arrayBuffer());
                let bin = '';
                for (let k = 0; k < buf.length; k++) bin += String.fromCharCode(buf[k]);
                payload.push({ path: rel, content: btoa(bin), encoding: 'base64' });
              }
            }),
          );
          setProgress(`读取 ${Math.min(i + BATCH, small.length)} / ${small.length}…`);
        }
        const UPLOAD_BATCH = 200;
        for (let i = 0; i < payload.length; i += UPLOAD_BATCH) {
          const chunk = payload.slice(i, i + UPLOAD_BATCH);
          setProgress(`上传小文件 ${Math.min(i + UPLOAD_BATCH, payload.length)} / ${payload.length}…`);
          const r = await fetch('/api/agents/upload', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ files: chunk }),
          });
          if (!r.ok) {
            const t = await r.text().catch(() => '');
            throw new Error(`upload failed: ${r.status} ${t.slice(0, 200)}`);
          }
        }
      }

      // ===== 大文件：分块 + 断点续传 =====
      for (let i = 0; i < large.length; i++) {
        const f = large[i];
        const rel = ((f as any).webkitRelativePath as string).slice(rootName.length + 1);
        if (!rel) continue;
        const label = `[大文件 ${i + 1}/${large.length}] ${f.name}`;
        await chunkedUpload(f, rel, {
          onProgress: (p: UploadProgress) => {
            const pct = Math.round(p.ratio * 100);
            const speedMB = (p.speed / 1024 / 1024).toFixed(1);
            const tag = p.resumed ? ' · 续传' : '';
            setProgress(
              p.phase === 'completing'
                ? `${label} 拼接中…`
                : p.phase === 'done'
                  ? `${label} 完成`
                  : `${label} ${pct}% (${p.done}/${p.total} 块, ${speedMB} MB/s)${tag}`,
            );
          },
        });
      }

      setProgress(null);
      // 上传后沙箱内容来自用户本地，不算 AI 改动；不设 dirty
      onReady(rootName);
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // === ② Clone Git 仓库 ===
  const submitClone = async () => {
    const url = repo.trim();
    if (!url) { setErr('请填写仓库 URL'); return; }
    setLoading(true);
    setErr(null);
    setProgress('git clone…（首次可能需要数十秒）');
    try {
      const r = await fetch('/api/agents/git/clone', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ws: '/sandbox', repo: url, branch: branch.trim() || undefined }),
      });
      const j = await r.json().catch(() => ({}));
      if (!j.ok) { setErr(j.stderr || j.error || '克隆失败'); return; }
      onReady(repoNameOf(url));
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  // === ③ 空沙箱 ===
  const submitEmpty = () => {
    onReady('sandbox');
    onClose();
  };

  return (
    <div className="sandbox-modal-mask" onClick={() => !loading && onClose()}>
      <div className="sandbox-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sandbox-modal-title">
          <span>📦 进入沙箱</span>
          <button type="button" className="sandbox-modal-close" onClick={onClose} disabled={loading}>×</button>
        </div>

        <div className="sandbox-tabs">
          <button
            type="button"
            className={`sandbox-tab${tab === 'upload' ? ' active' : ''}`}
            onClick={() => !loading && setTab('upload')}
          >📁 上传本地文件夹</button>
          <button
            type="button"
            className={`sandbox-tab${tab === 'git' ? ' active' : ''}`}
            onClick={() => !loading && setTab('git')}
          >⇣ Clone Git</button>
          <button
            type="button"
            className={`sandbox-tab${tab === 'empty' ? ' active' : ''}`}
            onClick={() => !loading && setTab('empty')}
          >＋ 空沙箱</button>
        </div>

        <div className="sandbox-modal-body">
          {tab === 'upload' && (
            <>
              <div className="sandbox-upload-hint">
                选中你电脑上的项目文件夹，会读取所有源代码文件传到云沙箱。
                <br />
                <span style={{ color: '#888', fontSize: 11 }}>
                  自动跳过 node_modules / .git / dist / build 等；单文件 ≤ 200MB（&gt;2MB 走分块续传）；总数最多 5000 文件。
                </span>
              </div>
              <ResumeQueue onClear={() => { /* refresh internal state */ }} />
              <button
                type="button"
                className="sandbox-btn sandbox-btn--primary sandbox-btn--big"
                onClick={onPickFolder}
                disabled={loading}
              >
                {loading ? (progress ?? '处理中…') : '📁 选择文件夹…'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: 'none' }}
                /* webkitdirectory 是 Chrome/Edge/Safari 的非标特性，TS 不识别 */
                {...({ webkitdirectory: '', directory: '' } as any)}
                multiple
                onChange={onFolderChosen}
              />
            </>
          )}

          {tab === 'git' && (
            <>
              <div className="sandbox-section-title">从 Git 仓库克隆</div>
              <input
                ref={inputRef}
                className="sandbox-input"
                type="text"
                placeholder="https://github.com/user/repo.git"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !loading) void submitClone(); }}
                disabled={loading}
                autoFocus
              />
              <input
                className="sandbox-input sandbox-input--small"
                type="text"
                placeholder="分支（可选，默认主分支）"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                disabled={loading}
              />
              <div className="sandbox-presets">
                <span className="sandbox-presets-label">示例：</span>
                {COMMON_REPOS.map((r) => (
                  <button
                    key={r.url}
                    type="button"
                    className="sandbox-preset"
                    onClick={() => setRepo(r.url)}
                    disabled={loading}
                  >{r.name}</button>
                ))}
              </div>
              <div className="sandbox-actions">
                <button
                  type="button"
                  className="sandbox-btn sandbox-btn--primary"
                  onClick={submitClone}
                  disabled={loading || !repo.trim()}
                >{loading ? (progress ?? '克隆中…') : '⇣ Clone'}</button>
              </div>
            </>
          )}

          {tab === 'empty' && (
            <>
              <div className="sandbox-upload-hint">
                进入一个空沙箱目录，可以让 AI 帮你 scaffold 一个新项目，或自己 touch 文件。
              </div>
              <div className="sandbox-actions">
                <button
                  type="button"
                  className="sandbox-btn sandbox-btn--primary"
                  onClick={submitEmpty}
                  disabled={loading}
                >＋ 进入空沙箱</button>
              </div>
            </>
          )}

          {progress && tab === 'upload' && (
            <div className="sandbox-progress">{progress}</div>
          )}
          {err && <div className="sandbox-error">⚠ {err}</div>}
        </div>
      </div>
    </div>
  );
}

/**
 * ResumeQueue — modal 里展示「上次没传完的文件」
 *  - 从 localStorage 读取 chunkedUpload 写入的 entries
 *  - 用户可以一键 abort（清掉服务端临时目录 + 本地记录）
 *  - 实际续传发生在用户重新选文件夹时（fingerprint 自动匹配）
 */
function ResumeQueue({ onClear }: { onClear: () => void }) {
  const [items, setItems] = useState(() => listResumableUploads());
  const [busy, setBusy] = useState(false);

  if (items.length === 0) return null;

  const onAbort = async (uploadId: string, fingerprint: string) => {
    setBusy(true);
    try {
      await abortUpload(uploadId);
      // 也清 localStorage
      try {
        const raw = localStorage.getItem('mci.upload.resumes');
        if (raw) {
          const obj = JSON.parse(raw);
          delete obj[fingerprint];
          localStorage.setItem('mci.upload.resumes', JSON.stringify(obj));
        }
      } catch { /* ignore */ }
      setItems(listResumableUploads());
      onClear();
    } finally {
      setBusy(false);
    }
  };

  const onAbortAll = async () => {
    if (!confirm('放弃所有未完成上传？已上传 chunk 会被清掉。')) return;
    setBusy(true);
    try {
      for (const it of items) await abortUpload(it.uploadId);
      try { localStorage.removeItem('mci.upload.resumes'); } catch { /* ignore */ }
      setItems([]);
      onClear();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="resume-queue">
      <div className="resume-queue-title">
        <span>⏸ {items.length} 个未完成上传</span>
        <button type="button" className="sandbox-btn sandbox-btn--ghost" onClick={onAbortAll} disabled={busy}>
          全部放弃
        </button>
      </div>
      <ul className="resume-queue-list">
        {items.map((it) => {
          const sizeMB = (it.size / 1024 / 1024).toFixed(1);
          const ago = Math.round((Date.now() - it.ts) / 60000);
          return (
            <li key={it.uploadId} className="resume-queue-item">
              <span className="resume-queue-name" title={it.path}>📄 {it.path.split('/').pop()}</span>
              <span className="resume-queue-meta">{sizeMB} MB · {ago < 1 ? '刚才' : `${ago} 分钟前`}</span>
              <button
                type="button"
                className="sandbox-btn sandbox-btn--ghost"
                onClick={() => void onAbort(it.uploadId, it.fingerprint)}
                disabled={busy}
                title="放弃这个文件的上传"
              >×</button>
            </li>
          );
        })}
      </ul>
      <div className="resume-queue-hint">
        提示：再次选择同一个文件夹时会自动续传未完成的部分。
      </div>
    </div>
  );
}