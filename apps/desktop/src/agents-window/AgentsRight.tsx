
/**
 * AgentsRight — 右栏：资产 / 变更 / 文件
 *
 * 文件 tab：当 mode='code' 且 workspaceRoot 已设时，渲染懒加载文件树。
 *  - 点击文件 → store.openFile() → 中间出现可关闭预览面板
 *  - 点击文件夹 → 展开/折叠
 *
 * 修复：
 *  - 用 useReducer 管理树状态，setRoot 改成函数式更新（避免闭包丢更新）
 *  - 所有 onClick 显式 preventDefault + stopPropagation，避免冒泡触发外层 drag/navigate
 *  - 按钮显式 type="button"
 */
import { useCallback, useEffect, useState } from 'react';
import { useAgentsStore } from './store';
import { CtxMenu, type CtxMenuItem } from './CtxMenu';
import { SandboxModal } from './SandboxModal';
import { GitChangesPanel } from './GitChangesPanel';
import { GitHistoryPanel } from './GitHistoryPanel';
import { chunkedUpload } from './chunkedUpload';

type Tab = 'assets' | 'changes' | 'files' | 'history';

interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
}

interface TreeNode extends FileEntry {
  children?: TreeNode[];
  expanded?: boolean;
  loading?: boolean;
}

/** 不可变更新：在 root 数组里找到 path 对应的节点，返回新的节点对象，并同步父链拷贝 */
function updateNode(nodes: TreeNode[], targetPath: string, patch: Partial<TreeNode>): TreeNode[] {
  return nodes.map((n) => {
    if (n.path === targetPath) {
      return { ...n, ...patch };
    }
    if (n.children && targetPath.startsWith(n.path + '/')) {
      return { ...n, children: updateNode(n.children, targetPath, patch) };
    }
    return n;
  });
}

export function AgentsRight() {
  const [tab, setTab] = useState<Tab>('files');
  const ws = useAgentsStore((s) => s.workspaceRoot);
  const mode = useAgentsStore((s) => s.mode);
  const previewFile = useAgentsStore((s) => s.previewFile);
  const openFile = useAgentsStore((s) => s.openFile);
  const attachWorkspaceFile = useAgentsStore((s) => s.attachWorkspaceFile);
  const pendingAttachments = useAgentsStore((s) => s.pendingAttachments);
  const gitStatus = useAgentsStore((s) => s.gitStatus);
  const refreshGitStatus = useAgentsStore((s) => s.refreshGitStatus);
  const sandboxDirty = useAgentsStore((s) => s.sandboxDirty);

  const [filter, setFilter] = useState('');
  const [root, setRoot] = useState<TreeNode[]>([]);
  const [rootLoading, setRootLoading] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  // 右键菜单状态
  const [ctx, setCtx] = useState<{ x: number; y: number; node: TreeNode } | null>(null);

  // 加载根目录：依赖 ws / mode / tab；切换工作区 → 重置树
  useEffect(() => {
    if (tab !== 'files' || !ws || mode !== 'ask') return;
    let cancelled = false;
    setRootLoading(true);
    setLoadErr(null);
    void fetch(`/api/agents/files?ws=${encodeURIComponent(ws)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as FileEntry[];
      })
      .then((j) => {
        if (cancelled) return;
        setRoot(j.map((e) => ({ ...e })));
        setRootLoading(false);
      })
      .catch((e: any) => {
        if (cancelled) return;
        setLoadErr(String(e?.message ?? e));
        setRootLoading(false);
      });
    return () => { cancelled = true; };
  }, [tab, ws, mode]);

  // 拉 git status：当 ws 改变 / 沙箱被工具改写 / 切回 files tab 时
  useEffect(() => {
    if (!ws || mode !== 'ask') return;
    void refreshGitStatus();
  }, [ws, mode, sandboxDirty, tab, refreshGitStatus]);

  // 监听跨组件 tab 切换请求（来自工具气泡的"→ diff"按钮）
  useEffect(() => {
    const sync = () => {
      try {
        const t = localStorage.getItem('mci.agents.rightTab') as Tab | null;
        if (t && t !== tab) setTab(t);
      } catch { /* ignore */ }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [tab]);

  // === 云沙箱专用：克隆仓库 / 刷新（在 web 上常用） ===
  const isWeb = typeof window !== 'undefined' && !(window as any).electronAPI;
  const [sandboxOpen, setSandboxOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);  const reloadRoot = useCallback(async () => {
    if (!ws) return;
    setRootLoading(true);
    try {
      const r = await fetch(`/api/agents/files?ws=${encodeURIComponent(ws)}`);
      const data: FileEntry[] = r.ok ? await r.json() : [];
      setRoot(data.map((e) => ({ ...e })));
      setLoadErr(null);
    } finally {
      setRootLoading(false);
    }
  }, [ws]);
  const cloning = false; // 已迁到 SandboxModal 内部维护

  const toggleDir = useCallback(
    async (node: TreeNode) => {
      if (!ws) return;
      // 先翻转 expanded，立刻给 UI 反馈
      setRoot((prev) => updateNode(prev, node.path, { expanded: !node.expanded }));
      if (!node.expanded && !node.children) {
        // 第一次展开 → 拉子节点
        setRoot((prev) => updateNode(prev, node.path, { loading: true }));
        try {
          const r = await fetch(
            `/api/agents/files?ws=${encodeURIComponent(ws)}&path=${encodeURIComponent(node.path)}`,
          );
          const data: FileEntry[] = r.ok ? await r.json() : [];
          setRoot((prev) =>
            updateNode(prev, node.path, {
              loading: false,
              children: data.map((e) => ({ ...e })),
            }),
          );
        } catch {
          setRoot((prev) => updateNode(prev, node.path, { loading: false, children: [] }));
        }
      }
    },
    [ws],
  );

  const buildTreeMenu = useCallback((n: TreeNode): (CtxMenuItem | 'divider')[] => {
    if (n.isDir) {
      return [
        {
          icon: n.expanded ? '▾' : '▸',
          label: n.expanded ? '折叠文件夹' : '展开文件夹',
          onClick: () => void toggleDir(n),
        },
        {
          icon: '📋',
          label: '复制路径',
          onClick: () => void navigator.clipboard?.writeText(n.path).catch(() => undefined),
        },
      ];
    }
    const attached = pendingAttachments.some((a) => a.wsPath === n.path && !a.line1);
    return [
      {
        icon: '📄',
        label: '打开预览',
        onClick: () => openFile(n.path),
      },
      {
        icon: '➕',
        label: attached ? '已加入对话' : '添加整文件到对话',
        variant: 'primary',
        disabled: attached,
        onClick: () => void attachWorkspaceFile(n.path),
      },
      'divider',
      {
        icon: '📋',
        label: '复制路径',
        onClick: () => void navigator.clipboard?.writeText(n.path).catch(() => undefined),
      },
    ];
  }, [attachWorkspaceFile, openFile, pendingAttachments, toggleDir]);

  function renderNodes(nodes: TreeNode[], depth = 0): JSX.Element[] {
    const filtered = filter
      ? nodes.filter((n) => n.name.toLowerCase().includes(filter.toLowerCase()) || n.children)
      : nodes;
    return filtered.flatMap((n) => {
      const isActive = !n.isDir && previewFile === n.path;
      const isAttached = !n.isDir && pendingAttachments.some((a) => a.wsPath === n.path);
      // 文件树徽章：从 gitStatus 里拿（path 是 "/src/x.ts" 形式，git 是 "src/x.ts"）
      const cleanPath = n.path.replace(/^\/+/, '');
      const gs = !n.isDir && gitStatus ? gitStatus[cleanPath] : undefined;
      const items: JSX.Element[] = [
        <div
          key={n.path}
          role="button"
          tabIndex={0}
          className={`tree-row${isActive ? ' active' : ''}${isAttached ? ' attached' : ''}${gs ? ` tree-row-git tree-row-git-${gs === '??' ? 'U' : gs}` : ''}`}
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (n.isDir) void toggleDir(n);
            else openFile(n.path);
          }}
          title={gs ? `${n.path} · ${gs === '??' ? '未跟踪' : gs === 'M' ? '已修改' : gs === 'A' ? '新增' : gs === 'D' ? '已删除' : gs}` : n.path}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setCtx({ x: e.clientX, y: e.clientY, node: n });
          }}
        >
          <span className="tree-icon">
            {n.isDir ? (n.loading ? '…' : n.expanded ? '▾' : '▸') : ''}
          </span>
          <span className="tree-emoji">{n.isDir ? '📁' : fileEmoji(n.name)}</span>
          <span className="tree-name">{n.name}</span>
          {gs && (
            <span className={`tree-git-badge tree-git-${gs === '??' ? 'U' : gs}`} title={gs}>
              {gs === '??' ? 'U' : gs[0]}
            </span>
          )}
          {!n.isDir && (
            <button
              type="button"
              className={`tree-attach${isAttached ? ' attached' : ''}`}
              title={isAttached ? '已在附件列表' : '添加到对话'}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!isAttached) void attachWorkspaceFile(n.path);
              }}
            >
              {isAttached ? '✓' : '+'}
            </button>
          )}
        </div>,
      ];
      if (n.isDir && n.expanded && n.children) {
        items.push(...renderNodes(n.children, depth + 1));
      }
      return items;
    });
  }

  return (
    <aside className="agents-right">
      <div className="agents-right-tabs">
        <button
          type="button"
          className={`agents-tab${tab === 'assets' ? ' active' : ''}`}
          onClick={(e) => { e.preventDefault(); setTab('assets'); }}
        >资产</button>
        <button
          type="button"
          className={`agents-tab${tab === 'changes' ? ' active' : ''}`}
          onClick={(e) => { e.preventDefault(); setTab('changes'); }}
        >变更</button>
        <button
          type="button"
          className={`agents-tab${tab === 'files' ? ' active' : ''}`}
          onClick={(e) => { e.preventDefault(); setTab('files'); }}
        >文件</button>
        <button
          type="button"
          className={`agents-tab${tab === 'history' ? ' active' : ''}`}
          onClick={(e) => { e.preventDefault(); setTab('history'); }}
        >历史</button>
      </div>
      <div className="agents-right-body">
        {tab === 'assets' && <div className="agents-empty">暂无资产</div>}
        {tab === 'changes' && (
          mode !== 'ask' ? (
            <div className="agents-empty">
              <div>切换到 智能体模式查看变更</div>
            </div>
          ) : !ws ? (
            <div className="agents-empty">
              <div>未选择工作区</div>
            </div>
          ) : (
            <GitChangesPanel />
          )
        )}
        {tab === 'history' && (
          mode !== 'ask' ? (
            <div className="agents-empty"><div>切换到 智能体模式查看历史</div></div>
          ) : !ws ? (
            <div className="agents-empty"><div>未选择工作区</div></div>
          ) : (
            <GitHistoryPanel />
          )
        )}
        {tab === 'files' && (
          mode !== 'ask' ? (
            <div className="agents-empty">
              <div>切换到 智能体模式查看文件</div>
            </div>
          ) : !ws ? (
            <div className="agents-empty">
              <div>未选择工作区</div>
              <div className="agents-empty-sub">在中间对话框上方选择一个工作区</div>
            </div>
          ) : (
            <div className="tree-wrap">
              <div className="tree-search">
                <input
                  className="tree-search-input"
                  placeholder="🔍 搜索文件…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </div>
              {isWeb && (
                <div className="tree-cloud-actions">
                  <button
                    type="button"
                    className="tree-cloud-btn"
                    onClick={() => setSandboxOpen(true)}
                    title="进入沙箱：克隆 git 仓库或空沙箱"
                  >⇣ 进入沙箱</button>
                  <button
                    type="button"
                    className="tree-cloud-btn"
                    onClick={() => {
                      // 直接走浏览器下载（让浏览器自己处理 stream / 大文件）
                      const a = document.createElement('a');
                      a.href = '/api/agents/export';
                      a.download = '';
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      // 导出后清掉 dirty 标记（用户已拿到本地副本）
                      useAgentsStore.getState().setSandboxDirty(false);
                    }}
                    disabled={rootLoading || root.length === 0}
                    title="把当前沙箱所有文件打包为 zip 下载到本地"
                  >⤓ 导出 ZIP</button>
                  <button
                    type="button"
                    className="tree-cloud-btn"
                    onClick={reloadRoot}
                    disabled={rootLoading}
                    title="重新读取沙箱文件树"
                  >↻</button>
                </div>
              )}
              <div
                className={`tree-list${dragOver ? ' tree-list-dragover' : ''}`}
                onDragOver={(e) => {
                  if (!isWeb || !ws) return;
                  if (e.dataTransfer?.types?.includes('Files')) {
                    e.preventDefault();
                    setDragOver(true);
                  }
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={async (e) => {
                  if (!isWeb || !ws) return;
                  e.preventDefault();
                  setDragOver(false);
                  const files = Array.from(e.dataTransfer?.files ?? []);
                  if (files.length === 0) return;
                  setUploadMsg(`上传 0/${files.length}…`);
                  try {
                    let done = 0;
                    for (const f of files) {
                      const dest = '/' + f.name; // 拖到根目录
                      if (f.size > 2 * 1024 * 1024) {
                        await chunkedUpload(f, dest, {
                          onProgress: (p) => setUploadMsg(`${f.name} ${(p.ratio * 100) | 0}%（${done + 1}/${files.length}）`),
                        });
                      } else {
                        const buf = await f.arrayBuffer();
                        const b64 = arrayBufferToBase64(buf);
                        await fetch('/api/agents/upload', {
                          method: 'POST',
                          headers: { 'content-type': 'application/json' },
                          body: JSON.stringify({ files: [{ path: dest, content: b64, encoding: 'base64' }] }),
                        });
                      }
                      done += 1;
                    }
                    setUploadMsg(`✓ 上传 ${done} 个文件`);
                    useAgentsStore.getState().setSandboxDirty(true);
                    await reloadRoot();
                    setTimeout(() => setUploadMsg(null), 2000);
                  } catch (err: any) {
                    setUploadMsg(`✗ 上传失败: ${err?.message ?? err}`);
                  }
                }}
              >
                {uploadMsg && <div className="tree-upload-toast">{uploadMsg}</div>}
                {rootLoading ? (
                  <div className="agents-empty">加载中…</div>
                ) : loadErr ? (
                  <div className="agents-empty agents-empty-error">⚠ {loadErr}</div>
                ) : root.length === 0 ? (
                  isWeb ? (
                    <div className="agents-empty">
                      <div>沙箱为空</div>
                      <div className="agents-empty-sub">点击上面 “进入沙箱” 克隆一个仓库</div>
                    </div>
                  ) : (
                    <div className="agents-empty">空目录</div>
                  )
                ) : (
                  renderNodes(root)
                )}
              </div>
            </div>
          )
        )}
      </div>
      {ctx && (
        <CtxMenu
          x={ctx.x}
          y={ctx.y}
          items={buildTreeMenu(ctx.node)}
          onClose={() => setCtx(null)}
        />
      )}
      <SandboxModal
        open={sandboxOpen}
        onClose={() => setSandboxOpen(false)}
        onReady={async (label) => {
          // 如果当前还没有 ws，顺手设个走起 UI；Clone 后刷新树
          const store = useAgentsStore.getState();
          if (!store.workspaceRoot) await store.setWorkspace(`/${label}`);
          await reloadRoot();
        }}
      />
    </aside>
  );
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)) as any);
  }
  return btoa(bin);
}

function fileEmoji(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts': case 'tsx': return '🟦';
    case 'js': case 'jsx': case 'mjs': case 'cjs': return '🟨';
    case 'json': return '📦';
    case 'md': case 'mdx': return '📝';
    case 'css': case 'scss': return '🎨';
    case 'html': return '🌐';
    case 'py': return '🐍';
    case 'go': return '🐹';
    case 'rs': return '🦀';
    case 'png': case 'jpg': case 'jpeg': case 'gif': case 'webp': case 'svg': return '🖼️';
    default: return '📄';
  }
}