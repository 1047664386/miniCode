
import { useEffect, useState } from 'react';
import { FileTree } from './components/FileTree';
import { EditorArea } from './components/EditorArea';
import { ChatPanel } from './components/ChatPanel';
import { VSCodeFrame } from './components/VSCodeFrame';
import { CommandPalette } from './components/CommandPalette';
import { ComposerPanel } from './components/ComposerPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { AuthModal } from './components/AuthModal';
import { GitPanel } from './components/GitPanel';
import { TerminalPanel } from './components/TerminalPanel';
import { SearchPanel } from './components/SearchPanel';
import { OutlinePanel } from './components/OutlinePanel';
import { ProblemsPanel } from './components/ProblemsPanel';
import { PendingEditsHub } from './components/PendingEditsHub';
import { ActivityBar } from './components/ActivityBar';
import { setupMonaco } from './monaco-setup';
import { isInlineCompletionEnabled, setInlineCompletionEnabled } from './inline-completion';
import { useStore } from './store';

interface Health {
  workspace?: string;
  indexReady?: boolean;
  indexing?: boolean;
  fileCount?: number;
  chunkCount?: number;
  symbolCount?: number;
  vectorCount?: number;
  embedder?: string;
}

type Mode = 'monaco' | 'vscode';
const DEFAULT_VSCODE_URL = (import.meta as any).env?.VITE_VSCODE_URL ?? 'http://localhost:8000';

const SIDEBAR_TITLES: Record<NonNullable<ReturnType<typeof useStore.getState>['sidebarView']>, string> = {
  explorer: 'EXPLORER',
  search: 'SEARCH',
  git: 'SOURCE CONTROL',
  outline: 'OUTLINE',
  problems: 'PROBLEMS',
};

export function App() {
  const [health, setHealth] = useState<Health>({});
  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem('mci.mode') as Mode) || 'monaco');
  const [vscodeReady, setVscodeReady] = useState(false);
  const [vscodeUrl, setVscodeUrl] = useState<string>(DEFAULT_VSCODE_URL);
  const paletteOpen = useStore((s) => s.paletteOpen);
  const togglePalette = useStore((s) => s.togglePalette);
  const sidebarView = useStore((s) => s.sidebarView);
  const setSidebarView = useStore((s) => s.setSidebarView);
  const pushRecent = useStore((s) => s.pushRecentWorkspace);
  const [ghost, setGhost] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const authModalOpen = useStore((s) => s.authModalOpen);
  const setAuthModalOpen = useStore((s) => s.setAuthModalOpen);
  const checkAuth = useStore((s) => s.checkAuth);

  // 启动时检查登录状态
  useEffect(() => { checkAuth(); }, [checkAuth]);

  // 全局快捷键：⌘P palette；⌘J terminal；⌘⇧F search；⌘⇧O outline；⌘⇧M problems；⌘⇧E explorer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === 'p' && !e.shiftKey) {
        e.preventDefault();
        togglePalette(true);
      } else if (meta && e.key.toLowerCase() === 'p' && e.shiftKey) {
        e.preventDefault();
        togglePalette(true, '>');
      } else if (e.key === 'Escape' && paletteOpen) {
        togglePalette(false);
      } else if (meta && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setTerminalOpen((b) => !b);
      } else if (meta && e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setSidebarView(sidebarView === 'explorer' ? null : 'explorer');
      } else if (meta && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setSidebarView(sidebarView === 'search' ? null : 'search');
      } else if (meta && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        setSidebarView(sidebarView === 'outline' ? null : 'outline');
      } else if (meta && e.shiftKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        setSidebarView(sidebarView === 'problems' ? null : 'problems');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paletteOpen, togglePalette, sidebarView, setSidebarView]);

  useEffect(() => {
    setupMonaco();
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch('/api/health');
        const data = await r.json();
        setHealth(data);
        // 当前 workspace 入最近列表
        if (data.workspace) pushRecent(data.workspace);
        if (data.workspace) useStore.setState({ workspace: data.workspace, indexReady: !!data.indexReady });
      } catch {
        /* */
      }
      if (!stop) setTimeout(tick, 3000);
    };
    tick();
    return () => {
      stop = true;
    };
  }, [pushRecent]);

  // 探测 VSCode 模式是否可用
  const [vscodeError, setVscodeError] = useState<string | null>(null);
  const [vscodeProbeCount, setVscodeProbeCount] = useState(0);
  const [csStatus, setCsStatus] = useState<{
    phase?: string;
    percent?: number;
    source?: string;
    mirror?: string;
    attempt?: number;
    error?: string;
    code?: number;
  }>({});
  useEffect(() => {
    if (mode !== 'vscode') return;
    let cancelled = false;
    const probe = async () => {
      try {
        const r = await fetch('/api/vscode/health');
        const data = await r.json();
        if (cancelled) return;
        setVscodeReady(!!data.ok);
        setVscodeError(data.ok ? null : data.error ?? null);
        if (data.url) setVscodeUrl(data.url);
      } catch (e: any) {
        if (!cancelled) {
          setVscodeReady(false);
          setVscodeError(e?.message ?? String(e));
        }
      } finally {
        if (!cancelled) setVscodeProbeCount((c) => c + 1);
      }
    };
    probe();
    const t = setInterval(probe, 4000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [mode]);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.onCodeServerStatus) return;
    api.getCodeServerStatus?.().then((s: any) => s && setCsStatus(s));
    const off = api.onCodeServerStatus((s: any) => setCsStatus(s));
    return () => {
      if (typeof off === 'function') off();
    };
  }, []);

  // ---- SSE event bridge: 后端文件变更 + skill 变更 + VSCode composer 转发 ----
  // 监听 /api/fs/events：文件变更 (fs_change)、skill 变更 (skills.changed) 等
  // 监听 /api/composer/events：VSCode 模式的 composer 转发事件
  useEffect(() => {
    // ── /api/fs/events：后端 chokidar 检测到的所有变更 ──
    let fsEs: EventSource | null = null;
    let fsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
    const connectFs = () => {
      try {
        fsEs = new EventSource('/api/fs/events');
        fsEs.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data);
            // skill 文件变更事件（由 SkillStore.onChange 通过 fsEventClients 推送）
            if (data.event === 'skills.changed') {
              useStore.getState().bumpSkills();
            }
          } catch { /* ignore */ }
        };
        fsEs.onerror = () => {
          fsEs?.close();
          fsEs = null;
          fsReconnectTimer = setTimeout(connectFs, 5000);
        };
      } catch { /* EventSource not available */ }
    };
    connectFs();

    // ── /api/composer/events：VSCode code-server 转发的事件 ──
    const compEs = new EventSource('/api/composer/events');
    compEs.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (!data?.event) return;
        const st = useStore.getState();
        if (data.event === 'composer.attach') {
          const p = data.payload || {};
          const wsPath: string = p.wsPath || '';
          const workspace = st.workspace || '';
          const rel = workspace && wsPath.startsWith(workspace)
            ? wsPath.slice(workspace.length + 1)
            : wsPath;
          st.addAttachment({
            kind: p.whole ? 'file' : 'selection',
            path: rel || wsPath,
            line1: p.line1,
            line2: p.line2,
            label: p.fileName ?? rel,
          });
          setComposerOpen(true);
        } else if (data.event === 'agents.open') {
          const api = (window as any).mciAgents;
          if (api?.openWindow) void api.openWindow();
        } else if (data.event === 'workspace.current') {
          const incomingWs = data.payload?.path;
          if (incomingWs && incomingWs !== useStore.getState().workspace) {
            useStore.setState({ workspace: incomingWs });
            pushRecent(incomingWs);
          }
        } else if (data.event === 'skills.changed') {
          // 兼容：如果后端通过 composer 通道推送 skills 变更，也处理
          useStore.getState().bumpSkills();
        }
      } catch { /* ignore */ }
    };
    compEs.onerror = () => { /* server-node not ready yet, EventSource will auto-retry */ };

    return () => {
      fsEs?.close();
      if (fsReconnectTimer) clearTimeout(fsReconnectTimer);
      compEs.close();
    };
  }, []);

  const switchMode = (m: Mode) => {
    setMode(m);
    localStorage.setItem('mci.mode', m);
  };

  const sidebarOpen = mode === 'monaco' && sidebarView !== null;

  return (
    <div
      className={`app ${mode === 'vscode' ? 'app-vscode' : ''} ${sidebarOpen ? '' : 'app-sidebar-collapsed'}`}
    >
      <div className="titlebar">
        <div>
          <strong>MiniCodeIDE</strong>
          <span style={{ marginLeft: 12, color: '#666' }}>{health.workspace ?? ''}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="ghost-toggle" onClick={() => setTerminalOpen((b) => !b)} title="Toggle terminal (⌘J)">
            ▣ Terminal
          </button>
          <PendingEditsHub />
          <button className="ghost-toggle" onClick={() => setComposerOpen(true)}>
            ◇ Composer
          </button>
          <button
            className="ghost-toggle"
            title="Open Agents Window (⌘⇧A)"
            onClick={() => {
              const api = (window as any).mciAgents;
              if (api?.openWindow) {
                void api.openWindow();
              } else {
                window.open(`${window.location.origin}/?window=agents`, '_blank');
              }
            }}
          >
            ✦ Agents
          </button>
          <button
            className="ghost-toggle"
            title="Toggle AI inline completion (ghost text)"
            onClick={() => {
              setInlineCompletionEnabled(!isInlineCompletionEnabled());
              setGhost(isInlineCompletionEnabled());
            }}
          >
            {ghost ? '✦ Ghost ON' : '◌ Ghost OFF'}
          </button>
          <div className="mode-switch">
            <button className={mode === 'monaco' ? 'active' : ''} onClick={() => switchMode('monaco')}>
              Monaco
            </button>
            <button className={mode === 'vscode' ? 'active' : ''} onClick={() => switchMode('vscode')}>
              VSCode
            </button>
          </div>
          <div className="status">
            {health.indexing
              ? '⏳ indexing...'
              : health.indexReady
              ? `✓ ${health.fileCount}f / ${health.symbolCount ?? 0}sym / ${health.vectorCount ?? 0}vec`
              : '— index not ready'}
          </div>
        </div>
      </div>

      {mode === 'monaco' ? (
        <>
          <ActivityBar onOpenSettings={() => setSettingsOpen(true)} />
          {sidebarOpen && (
            <div className="sidebar sidebar--activity">
              <div className="sidebar__header">{SIDEBAR_TITLES[sidebarView!]}</div>
              <div className="sidebar__body">
                {sidebarView === 'explorer' && <FileTree />}
                {sidebarView === 'search' && <SearchPanel />}
                {sidebarView === 'git' && <GitPanel />}
                {sidebarView === 'outline' && <OutlinePanel />}
                {sidebarView === 'problems' && <ProblemsPanel />}
              </div>
            </div>
          )}
          <EditorArea />
        </>
      ) : (
        <>
          <ActivityBar onOpenSettings={() => setSettingsOpen(true)} />
          <div className="vscode-area">
            {vscodeReady ? (
              <VSCodeFrame url={vscodeUrl} />
            ) : (
              <div className="empty" style={{ flexDirection: 'column', padding: 20, textAlign: 'center' }}>
                <div style={{ fontSize: 16, marginBottom: 8 }}>
                  {csStatus.phase === 'downloading'
                    ? `⬇ Downloading code-server... ${csStatus.percent ?? 0}%`
                    : csStatus.phase === 'extracting'
                    ? '📦 Extracting code-server...'
                    : csStatus.phase === 'starting'
                    ? `⚡ Starting code-server${csStatus.source ? ` (${csStatus.source})` : ''}...`
                    : csStatus.phase === 'ready'
                    ? '✓ code-server ready, connecting...'
                    : csStatus.phase === 'unsupported'
                    ? '✗ Platform not supported by code-server'
                    : csStatus.phase === 'error'
                    ? '✗ code-server failed to start'
                    : vscodeProbeCount === 0
                    ? '⏳ Connecting to VSCode...'
                    : '⏳ Waiting for code-server...'}
                </div>

                {csStatus.phase === 'downloading' && typeof csStatus.percent === 'number' && (
                  <div style={{ width: 320, marginTop: 12 }}>
                    <div style={{
                      width: '100%', height: 8, background: '#2a2a2a', borderRadius: 4, overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${csStatus.percent}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #0e639c, #1f8fd6)',
                        transition: 'width 0.2s ease',
                      }} />
                    </div>
                    {csStatus.mirror && (
                      <div style={{ marginTop: 6, color: '#888', fontSize: 11 }}>
                        mirror #{csStatus.attempt ?? 1}: {new URL(csStatus.mirror).host}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ marginTop: 8, color: '#888', maxWidth: 480, fontSize: 12 }}>
                  {csStatus.phase === 'downloading'
                    ? `First-launch download (~80MB). Multi-mirror fallback enabled.`
                    : csStatus.phase === 'error'
                    ? `Error: ${csStatus.error ?? 'unknown'}. You can fallback to Monaco below or retry by restarting.`
                    : vscodeProbeCount < 3
                    ? `Starting up...`
                    : vscodeProbeCount < 15
                    ? `Still waiting... (${vscodeProbeCount * 4}s elapsed)`
                    : `Looks slow. Switch to Monaco for instant editing.`}
                </div>

                {vscodeError && !csStatus.phase && (
                  <div style={{ marginTop: 8, color: '#e88', fontSize: 12 }}>
                    Last probe: {vscodeError}
                  </div>
                )}
                <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                  <button
                    className="ghost-toggle"
                    style={{ background: '#0e639c', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 4, cursor: 'pointer' }}
                    onClick={() => switchMode('monaco')}
                  >
                    ↪ Switch to Monaco Editor
                  </button>
                </div>
                <pre style={{ background: '#252526', padding: 12, borderRadius: 6, marginTop: 16, fontSize: 11, textAlign: 'left' }}>
                  {`If stuck, run in terminal:\nWORKSPACE=$(pwd) pnpm vscode`}
                </pre>
                <div style={{ marginTop: 8, color: '#888', fontSize: 11 }}>
                  Auto-retry every 4s. Target: {vscodeUrl}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <ChatPanel />
      {paletteOpen && (
        <CommandPalette
          onClose={() => togglePalette(false)}
          initialQuery={useStore.getState().paletteInitial}
        />
      )}
      {composerOpen && <ComposerPanel onClose={() => setComposerOpen(false)} />}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      {authModalOpen && <AuthModal onClose={() => setAuthModalOpen(false)} />}
      {terminalOpen && (
        <div className="bottom-drawer">
          <div className="bottom-drawer-handle" onClick={() => setTerminalOpen(false)} title="Close terminal">
            ×
          </div>
          <TerminalPanel visible={terminalOpen} />
        </div>
      )}
    </div>
  );
}