
import { useEffect, useRef, useState } from 'react';
import { useStore, type FileEntry } from '../store';
import { FolderPickerModal } from './FolderPickerModal';

/* ----------------------- Inline rename input ----------------------- */

function InlineRenameInput({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string;
  onCommit: (v: string) => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const dot = initial.lastIndexOf('.');
    if (dot > 0) ref.current?.setSelectionRange(0, dot);
    else ref.current?.select();
  }, []);
  return (
    <input
      ref={ref}
      className="file-tree-inline-input"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onBlur={() => onCommit(v.trim())}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onCommit(v.trim());
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
    />
  );
}

/* ----------------------- Tree node ----------------------- */

interface TreeNodeProps {
  entry: FileEntry;
  depth: number;
  onContextMenu: (e: React.MouseEvent, entry: FileEntry, refreshParent: () => void) => void;
}

function TreeNode({ entry, depth, onContextMenu }: TreeNodeProps) {
  const { openFile, activeTab, renameTarget, setRenameTarget, treeVersion } = useStore();
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<FileEntry[]>([]);
  const [newDraft, setNewDraft] = useState<'file' | 'folder' | null>(null);

  const refreshChildren = async () => {
    const r = await fetch(`/api/files?path=${encodeURIComponent(entry.path)}`);
    setChildren(await r.json());
  };

  // 当 treeVersion 变化时，已展开的节点刷新子节点
  useEffect(() => {
    if (expanded) {
      refreshChildren();
    }
    // 故意不把 expanded 加入 deps：treeVersion 每次变化都刷新已展开节点
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeVersion]);

  const toggle = async () => {
    if (entry.isDir) {
      if (!expanded && children.length === 0) await refreshChildren();
      setExpanded((v) => !v);
    } else {
      openFile(entry.path);
    }
  };

  const handleContext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, entry, async () => {
      if (entry.isDir) {
        await refreshChildren();
        setExpanded(true);
      }
    });
  };

  // Listen to global "newInsideRequest" for this folder via a custom hook
  useEffect(() => {
    const handler = (ev: any) => {
      if (ev.detail?.parent === entry.path) {
        setExpanded(true);
        refreshChildren().then(() => setNewDraft(ev.detail.kind));
      }
    };
    window.addEventListener('mci:new-inside', handler);
    return () => window.removeEventListener('mci:new-inside', handler);
  }, [entry.path]);

  const isActive = !entry.isDir && activeTab === entry.path;
  const isRenaming = renameTarget === entry.path;

  return (
    <>
      <div
        className={`file-tree-item ${isActive ? 'active' : ''}`}
        style={{ paddingLeft: 12 + depth * 14 }}
        onClick={isRenaming ? undefined : toggle}
        onContextMenu={handleContext}
        title={entry.path}
      >
        {entry.isDir ? (expanded ? '\u25be ' : '\u25b8 ') : '  '}
        {isRenaming ? (
          <InlineRenameInput
            initial={entry.name}
            onCancel={() => setRenameTarget(null)}
            onCommit={async (newName) => {
              if (!newName || newName === entry.name) {
                setRenameTarget(null);
                return;
              }
              const parent = entry.path.includes('/')
                ? entry.path.slice(0, entry.path.lastIndexOf('/'))
                : '';
              const target = parent ? `${parent}/${newName}` : newName;
              const r = await fetch('/api/file/rename', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ from: entry.path, to: target }),
              });
              if (!r.ok) {
                const err = await r.json().catch(() => ({}));
                alert(`Rename failed: ${err.error ?? r.statusText}`);
              }
              setRenameTarget(null);
              useStore.getState().loadTree('.');
            }}
          />
        ) : (
          entry.name
        )}
      </div>
      {expanded && newDraft && (
        <div
          className="file-tree-item"
          style={{ paddingLeft: 12 + (depth + 1) * 14 }}
        >
          {newDraft === 'folder' ? '\u25b8 ' : '  '}
          <InlineRenameInput
            initial={newDraft === 'file' ? 'untitled.ts' : 'new-folder'}
            onCancel={() => setNewDraft(null)}
            onCommit={async (name) => {
              const draftKind = newDraft;
              setNewDraft(null);
              if (!name) return;
              const target = `${entry.path}/${name}`;
              const url = draftKind === 'file' ? '/api/file' : '/api/folder';
              const body =
                draftKind === 'file'
                  ? JSON.stringify({ path: target, content: '' })
                  : JSON.stringify({ path: target });
              const r = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
              });
              if (!r.ok) {
                const err = await r.json().catch(() => ({}));
                alert(`Create failed: ${err.error ?? r.statusText}`);
                return;
              }
              await refreshChildren();
              if (draftKind === 'file') await useStore.getState().openFile(target);
            }}
          />
        </div>
      )}
      {expanded &&
        children.map((c) => (
          <TreeNode key={c.path} entry={c} depth={depth + 1} onContextMenu={onContextMenu} />
        ))}
    </>
  );
}

/* ----------------------- Context menu state ----------------------- */

interface CtxMenuState {
  x: number;
  y: number;
  entry: FileEntry;
  refreshParent: () => void;
}

declare global {
  interface Window {
    electronAPI?: {
      openFolderDialog?: () => Promise<string | null>;
      setConfig?: (p: { workspace?: string }) => Promise<any>;
      relaunchApp?: () => Promise<void>;
    };
  }
}

/* ----------------------- Main FileTree ----------------------- */

export function FileTree() {
  const { tree, loadTree, openFile, appendChatInput, closeTab, tabs, setRenameTarget, bumpTree } =
    useStore();
  const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null);
  const [rootDraft, setRootDraft] = useState<'file' | 'folder' | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    loadTree('.');
  }, []);

  // 监听后端文件变更 SSE → 刷新文件树
  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      try {
        es = new EventSource('/api/fs/events');
        es.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data);
            if (data.type === 'fs_change') {
              // 文件变更事件 → 递增 treeVersion，触发所有已展开 TreeNode 刷新
              bumpTree();
              // 同时刷新根目录列表（处理新增/删除的顶层文件）
              loadTree('.');
            }
            // fs_heartbeat 忽略
          } catch { /* parse error, ignore */ }
        };
        es.onerror = () => {
          // 连接断开，清理后延迟重连
          es?.close();
          es = null;
          reconnectTimer = setTimeout(connect, 5000);
        };
      } catch {
        // EventSource 不可用（极老浏览器），静默降级
      }
    };

    connect();
    return () => {
      es?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [bumpTree, loadTree]);

  useEffect(() => {
    if (!ctxMenu) return;
    const onClick = () => setCtxMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCtxMenu(null);
    };
    window.addEventListener('click', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [ctxMenu]);

  const commitRootDraft = async (name: string) => {
    const kind = rootDraft;
    setRootDraft(null);
    if (!kind || !name) return;
    if (kind === 'file') {
      await fetch('/api/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: name, content: '' }),
      });
      await loadTree('.');
      await openFile(name);
    } else {
      await fetch('/api/folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: name }),
      });
      await loadTree('.');
    }
  };

  const refresh = () => loadTree('.');
  const copyText = (s: string) => navigator.clipboard?.writeText(s).catch(() => {});

  // Expose to global command palette via custom event
  useEffect(() => {
    const onEvent = () => openFolder();
    window.addEventListener('mci:open-folder', onEvent);
    return () => window.removeEventListener('mci:open-folder', onEvent);
  });

  const openFolder = async () => {
    // Desktop (Electron) — show native dialog
    if (window.electronAPI?.openFolderDialog) {
      try {
        const picked = await window.electronAPI.openFolderDialog();
        if (!picked) return;
        await window.electronAPI.setConfig?.({ workspace: picked });
        // 热切换 server workspace，无需重启
        await handlePickedFolder(picked);
      } catch (e: any) {
        alert(`Failed: ${e?.message ?? e}`);
      }
      return;
    }
    // Web fallback — open in-app folder browser modal
    setPickerOpen(true);
  };

  const handlePickedFolder = async (absPath: string) => {
    setPickerOpen(false);
    try {
      const r = await fetch('/api/workspace/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: absPath }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        alert(`Switch failed: ${err.error ?? r.statusText}`);
        return;
      }
      // 关掉所有打开的 tabs（属于旧 workspace）→ 重新加载文件树
      for (const t of useStore.getState().tabs) closeTab(t.path);
      await loadTree('.');
    } catch (e: any) {
      alert(`Switch failed: ${e?.message ?? e}`);
    }
  };

  const onItemContext = (e: React.MouseEvent, entry: FileEntry, refreshParent: () => void) => {
    setCtxMenu({ x: e.clientX, y: e.clientY, entry, refreshParent });
  };

  const handleDelete = async (entry: FileEntry, refreshParent: () => void) => {
    const ok = window.confirm(
      `Delete "${entry.path}"?\n${entry.isDir ? 'All contents will be removed.' : ''}`,
    );
    if (!ok) return;
    const r = await fetch(`/api/file?path=${encodeURIComponent(entry.path)}`, {
      method: 'DELETE',
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      alert(`Delete failed: ${err.error ?? r.statusText}`);
      return;
    }
    for (const t of tabs) {
      if (t.path === entry.path || t.path.startsWith(entry.path + '/')) closeTab(t.path);
    }
    if (!entry.path.includes('/')) await loadTree('.');
    else refreshParent();
  };

  const handleNewInside = (parent: FileEntry, kind: 'file' | 'folder') => {
    window.dispatchEvent(
      new CustomEvent('mci:new-inside', { detail: { parent: parent.path, kind } }),
    );
  };

  const revealInFinder = (entry: FileEntry) =>
    fetch('/api/file/reveal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: entry.path }),
    });

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h3>Explorer</h3>
        <div className="sidebar-actions">
          <button className="sidebar-action" title="New file" onClick={() => setRootDraft('file')}>
            {'\uff0b'}
          </button>
          <button
            className="sidebar-action"
            title="New folder"
            onClick={() => setRootDraft('folder')}
          >
            {'\u229e'}
          </button>
          <button className="sidebar-action" title="Refresh" onClick={refresh}>
            {'\u21bb'}
          </button>
          <button className="sidebar-action" title="Open folder\u2026" onClick={openFolder}>
            {'\u{1F4C2}'}
          </button>
        </div>
      </div>
      <div className="file-tree-body">
        {rootDraft && (
          <div className="file-tree-item" style={{ paddingLeft: 12 }}>
            {rootDraft === 'folder' ? '\u25b8 ' : '  '}
            <InlineRenameInput
              initial={rootDraft === 'file' ? 'untitled.ts' : 'new-folder'}
              onCancel={() => setRootDraft(null)}
              onCommit={commitRootDraft}
            />
          </div>
        )}
        {tree.map((e) => (
          <TreeNode key={e.path} entry={e} depth={0} onContextMenu={onItemContext} />
        ))}
      </div>
      <div className="sidebar-hint">
        click to open · right-click for menu · ⌘P to search
      </div>

      {pickerOpen && (
        <FolderPickerModal
          initialPath={useStore.getState().workspace || undefined}
          onPick={handlePickedFolder}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {ctxMenu && (
        <div
          className="ctx-menu"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {!ctxMenu.entry.isDir && (
            <div
              className="ctx-item"
              onClick={() => {
                openFile(ctxMenu.entry.path);
                setCtxMenu(null);
              }}
            >
              Open
            </div>
          )}
          {ctxMenu.entry.isDir && (
            <>
              <div
                className="ctx-item"
                onClick={() => {
                  handleNewInside(ctxMenu.entry, 'file');
                  setCtxMenu(null);
                }}
              >
                New File…
              </div>
              <div
                className="ctx-item"
                onClick={() => {
                  handleNewInside(ctxMenu.entry, 'folder');
                  setCtxMenu(null);
                }}
              >
                New Folder…
              </div>
            </>
          )}
          <div className="ctx-sep" />
          <div
            className="ctx-item"
            onClick={() => {
              appendChatInput(
                ctxMenu.entry.isDir
                  ? `@folder:${ctxMenu.entry.path} `
                  : `@file:${ctxMenu.entry.path} `,
              );
              setCtxMenu(null);
            }}
          >
            Add to Chat
          </div>
          <div className="ctx-sep" />
          <div
            className="ctx-item"
            onClick={() => {
              copyText(ctxMenu.entry.path);
              setCtxMenu(null);
            }}
          >
            Copy Relative Path
          </div>
          <div
            className="ctx-item"
            onClick={() => {
              const ws = useStore.getState().workspace;
              copyText(ws ? `${ws}/${ctxMenu.entry.path}` : ctxMenu.entry.path);
              setCtxMenu(null);
            }}
          >
            Copy Path
          </div>
          <div
            className="ctx-item"
            onClick={() => {
              revealInFinder(ctxMenu.entry);
              setCtxMenu(null);
            }}
          >
            Reveal in Finder
          </div>
          <div className="ctx-sep" />
          <div
            className="ctx-item"
            onClick={() => {
              setRenameTarget(ctxMenu.entry.path);
              setCtxMenu(null);
            }}
          >
            Rename… (F2)
          </div>
          <div
            className="ctx-item"
            onClick={() => {
              const entry = ctxMenu.entry;
              const refreshParent = ctxMenu.refreshParent;
              setCtxMenu(null);
              handleDelete(entry, refreshParent);
            }}
          >
            Delete
          </div>
        </div>
      )}
    </div>
  );
}