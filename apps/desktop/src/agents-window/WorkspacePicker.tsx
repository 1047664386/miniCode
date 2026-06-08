
/**
 * WorkspacePicker — Agents Window 工作区选择器（仅 Code 模式显示）
 *
 * 形态：composer 上方一排 chip
 *   📁 miniCodeIde ⌄    ⎇ main
 *
 * 点击 chip → 弹出 popover：
 *   - 当前 workspace
 *   - 最近列表（localStorage）
 *   - "+ 打开工作空间" → Electron 走 dialog；浏览器走 prompt
 */
import { useEffect, useRef, useState } from 'react';
import { useAgentsStore } from './store';
import { SandboxModal } from './SandboxModal';

export function WorkspacePicker() {
  const ws = useAgentsStore((s) => s.workspaceRoot);
  const branch = useAgentsStore((s) => s.branch);
  const recents = useAgentsStore((s) => s.recentWorkspaces);
  const setWorkspace = useAgentsStore((s) => s.setWorkspace);

  const [open, setOpen] = useState(false);
  const [sandboxOpen, setSandboxOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const wsName = ws ? ws.split('/').pop() || ws : '未选择';

  const pick = async () => {
    setOpen(false);
    const api = (window as any).electronAPI;
    if (api?.openFolderDialog) {
      try {
        const picked = await api.openFolderDialog();
        if (picked) await setWorkspace(picked);
      } catch (e) { console.error(e); }
    } else {
      // 浏览器：弹出沙箱 modal（克隆 / 空沙箱）
      setSandboxOpen(true);
    }
  };

  return (
    <div className="ws-picker" ref={ref}>
      <button
        type="button"
        className="ws-chip"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        title={ws ?? '点击选择工作区'}
      >
        <span className="ws-chip-icon">📁</span>
        <span className="ws-chip-name">{wsName}</span>
        <span className="ws-chip-caret">▾</span>
      </button>
      {branch && (
        <span className="ws-branch" title={`Git branch: ${branch}`}>
          <span className="ws-branch-icon">⎇</span>
          {branch}
        </span>
      )}

      {open && (
        <div className="ws-popover">
          {ws && (
            <>
              <div className="ws-popover-section">当前</div>
              <div className="ws-popover-item ws-popover-item--active">
                <span className="ws-icon">📁</span>
                <span className="ws-name">{wsName}</span>
                <span className="ws-check">✓</span>
              </div>
            </>
          )}
          {recents.filter((r) => r !== ws).length > 0 && (
            <>
              <div className="ws-popover-section">最近</div>
              {recents.filter((r) => r !== ws).map((p) => (
                <div
                  key={p}
                  className="ws-popover-item"
                  onClick={() => { setOpen(false); void setWorkspace(p); }}
                  title={p}
                >
                  <span className="ws-icon">📁</span>
                  <span className="ws-name">{p.split('/').pop() || p}</span>
                </div>
              ))}
            </>
          )}
          <div className="ws-popover-divider" />
          <div className="ws-popover-item ws-popover-item--action" onClick={pick}>
            <span className="ws-icon">＋</span>
            <span className="ws-name">打开工作空间…</span>
          </div>
        </div>
      )}
      <SandboxModal
        open={sandboxOpen}
        onClose={() => setSandboxOpen(false)}
        onReady={(label) => { void setWorkspace(`/${label}`); }}
      />
    </div>
  );
}