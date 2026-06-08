
/**
 * VSCode 风格欢迎页 —— 当编辑器没有打开任何文件时显示。
 *
 * 卡片：打开 / 新建文件 / 克隆 Git / 打开 Agents 窗口
 * 最近：localStorage.mci.recentWorkspaces
 */
import { useState } from 'react';
import { useStore } from '../store';

interface FileTpl { ext: string; label: string; icon: string; template: string; }
const TEMPLATES: FileTpl[] = [
  { ext: 'ts', label: 'TypeScript', icon: 'TS', template: '' },
  { ext: 'tsx', label: 'React (TSX)', icon: 'TSX', template: 'export function Component() {\n  return <div>Hello</div>;\n}\n' },
  { ext: 'js', label: 'JavaScript', icon: 'JS', template: '' },
  { ext: 'py', label: 'Python', icon: 'PY', template: '' },
  { ext: 'md', label: 'Markdown', icon: 'MD', template: '# Title\n\n' },
  { ext: 'json', label: 'JSON', icon: '{}', template: '{\n  \n}\n' },
  { ext: 'txt', label: 'Plain Text', icon: 'TXT', template: '' },
];

export function WelcomePage() {
  const workspace = useStore((s) => s.workspace);
  const recents = useStore((s) => s.recentWorkspaces);
  const pushRecent = useStore((s) => s.pushRecentWorkspace);
  const loadTree = useStore((s) => s.loadTree);
  const closeTab = useStore((s) => s.closeTab);
  const createUntitled = useStore((s) => s.createUntitled);
  const [pickerOpen, setPickerOpen] = useState(false);

  /** 切换 workspace —— 走后端 live switch（无需 relaunch） */
  const switchWorkspace = async (absPath: string) => {
    try {
      const r = await fetch('/api/workspace/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: absPath }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        alert(`切换失败：${err.error ?? r.statusText}`);
        return false;
      }
      const data = await r.json();
      // 关掉旧 tabs（属于旧 workspace）
      for (const t of useStore.getState().tabs) closeTab(t.path);
      pushRecent(data.workspace ?? absPath);
      // 同步 store.workspace；下一次 health 轮询也会刷
      useStore.setState({ workspace: data.workspace ?? absPath });
      await loadTree('.');
      return true;
    } catch (e: any) {
      alert('切换失败：' + (e?.message ?? e));
      return false;
    }
  };

  const handleOpen = async () => {
    const api = (window as any).electronAPI;
    if (!api?.openFolderDialog) {
      alert('当前环境不支持原生选择对话框（仅 Electron 桌面端可用）。');
      return;
    }
    const picked = await api.openFolderDialog();
    if (!picked) return;
    await switchWorkspace(picked);
  };

  const handleNewFile = () => setPickerOpen(true);

  const handleClone = () => {
    const url = prompt('克隆 Git 仓库 — 粘贴 URL（暂以提示形式给出命令）');
    if (!url) return;
    alert(`请在终端运行：\n  git clone ${url}\n克隆完成后再 "打开..." 选择新目录。`);
  };

  const handleOpenAgents = () => {
    const api = (window as any).mciAgents;
    if (api?.openWindow) {
      void api.openWindow();
    } else {
      // 浏览器/dev 模式 fallback：在新标签页打开
      window.open(`${window.location.origin}/?window=agents`, '_blank');
    }
  };

  const openRecent = async (p: string) => switchWorkspace(p);

  const pickTemplate = (t: FileTpl) => {
    setPickerOpen(false);
    createUntitled(t.ext, t.template);
  };

  return (
    <div className="welcome">
      <div className="welcome__inner">
        <div className="welcome__brand">
          <span className="welcome__logo">▣</span>
          <span className="welcome__title">MiniCodeIDE</span>
        </div>

        <div className="welcome__section-label">启动</div>
        <div className="welcome__cards">
          <button className="welcome__card" onClick={handleOpen}>
            <span className="welcome__card-icon">📂</span>
            <span className="welcome__card-label">打开...</span>
          </button>
          <button className="welcome__card" onClick={handleNewFile}>
            <span className="welcome__card-icon">📄</span>
            <span className="welcome__card-label">新建文件...</span>
          </button>
          <button className="welcome__card" onClick={handleClone}>
            <span className="welcome__card-icon">⎇</span>
            <span className="welcome__card-label">克隆 Git 仓库...</span>
          </button>
          <button className="welcome__card" onClick={handleOpenAgents}>
            <span className="welcome__card-icon">✦</span>
            <span className="welcome__card-label">Open Agents Window</span>
          </button>
        </div>

        <div className="welcome__section-label">最近</div>
        <div className="welcome__recents">
          {recents.length === 0 && (
            <div className="welcome__recents-empty">
              暂无最近打开记录。{workspace ? `当前：${workspace}` : ''}
            </div>
          )}
          {recents.map((p) => {
            const name = p.split('/').filter(Boolean).pop() ?? p;
            const dir = p.slice(0, p.length - name.length).replace(/\/$/, '');
            return (
              <button key={p} className="welcome__recent" onClick={() => openRecent(p)} title={p}>
                <span className="welcome__recent-name">{name}</span>
                <span className="welcome__recent-dir">{dir}</span>
              </button>
            );
          })}
        </div>
      </div>

      {pickerOpen && (
        <div className="newfile-modal" onClick={() => setPickerOpen(false)}>
          <div className="newfile-modal__panel" onClick={(e) => e.stopPropagation()}>
            <div className="newfile-modal__header">选择文件类型</div>
            <div className="newfile-modal__list">
              {TEMPLATES.map((t) => (
                <button key={t.ext} className="newfile-modal__row" onClick={() => pickTemplate(t)}>
                  <span className="newfile-modal__icon">{t.icon}</span>
                  <span className="newfile-modal__label">{t.label}</span>
                  <span className="newfile-modal__ext">.{t.ext}</span>
                </button>
              ))}
            </div>
            <div className="newfile-modal__hint">
              选完会创建一个未命名 tab。⌘S 保存时弹原生对话框选路径。
            </div>
          </div>
        </div>
      )}
    </div>
  );
}