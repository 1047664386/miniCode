
/**
 * Agents Window — 三栏根布局（动态网格）
 *
 *  布局形态：
 *   ┌─────────────────────────────────────────────────────────┐
 *   │ Sidebar │  Main(对话)  │  Preview(文件)  │  Right(文件树) │   ← Code 模式 + 已开预览
 *   ├─────────────────────────────────────────────────────────┤
 *   │ Sidebar │       Main(对话宽)            │  Right(文件树) │   ← Code 模式 + 关闭预览
 *   ├─────────────────────────────────────────────────────────┤
 *   │ Sidebar │           Main(对话最宽)                       │   ← Work 模式
 *   └─────────────────────────────────────────────────────────┘
 */
import { useEffect, useState, lazy, Suspense } from 'react';
import { useAgentsStore } from './store';
import { AgentsSidebar } from './AgentsSidebar';
import { AgentsMain } from './AgentsMain';
import { AgentsRight } from './AgentsRight';
import { AgentsCodePreview } from './AgentsCodePreview';
import './agents.css';

// 引入设置面板所需的样式（主 IDE styles.css 包含 .settings-* 系列、.form-field 等）
import '../styles.css';

// 懒加载主 IDE 的 SettingsPanel（仅桌面端完整可用；web 端 /api/providers 不可用时会优雅降级）
const SettingsPanel = lazy(() => import('../components/SettingsPanel').then((m) => ({ default: m.SettingsPanel })));

export function AgentsApp() {
  const loadSessions = useAgentsStore((s) => s.loadSessions);
  const loadCurrentWorkspace = useAgentsStore((s) => s.loadCurrentWorkspace);
  const mode = useAgentsStore((s) => s.mode);
  const previewFile = useAgentsStore((s) => s.previewFile);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    void loadCurrentWorkspace().then(() => loadSessions());
  }, [loadCurrentWorkspace, loadSessions]);

  // 三栏 vs 四栏 vs 二栏
  const layoutClass =
    mode === 'ask'
      ? 'agents-body--work'
      : previewFile
        ? 'agents-body--preview'
        : 'agents-body--code';

  return (
    <div className="agents-window">
      <header className="agents-titlebar">
        <span className="agents-brand">▣ MyWorker</span>
        <span className="agents-titlebar-spacer" />
        <button
          type="button"
          className="agents-settings-btn"
          title="设置 (Providers / Routing / 超时)"
          onClick={() => setSettingsOpen(true)}
        >
          ⚙
        </button>
      </header>
      <div className={`agents-body ${layoutClass}`}>
        <AgentsSidebar key="sidebar" />
        <AgentsMain key="main" />
        {previewFile && <AgentsCodePreview key="preview" />}
        {mode !== 'ask' && <AgentsRight key="right" />}
      </div>

      {/* 设置面板 — 复用主 IDE 的 SettingsPanel */}
      {settingsOpen && (
        <Suspense fallback={<div className="agents-loading">加载设置…</div>}>
          <SettingsPanel onClose={() => setSettingsOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
