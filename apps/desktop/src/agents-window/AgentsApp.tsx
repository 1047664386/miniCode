
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
import { useEffect } from 'react';
import { useAgentsStore } from './store';
import { AgentsSidebar } from './AgentsSidebar';
import { AgentsMain } from './AgentsMain';
import { AgentsRight } from './AgentsRight';
import { AgentsCodePreview } from './AgentsCodePreview';
import './agents.css';

export function AgentsApp() {
  const loadSessions = useAgentsStore((s) => s.loadSessions);
  const loadCurrentWorkspace = useAgentsStore((s) => s.loadCurrentWorkspace);
  const mode = useAgentsStore((s) => s.mode);
  const previewFile = useAgentsStore((s) => s.previewFile);

  useEffect(() => {
    void loadCurrentWorkspace().then(() => loadSessions());
  }, [loadCurrentWorkspace, loadSessions]);

  // 三栏 vs 四栏 vs 二栏
  const layoutClass =
    mode === 'work'
      ? 'agents-body--work'
      : previewFile
        ? 'agents-body--preview'
        : 'agents-body--code';

  return (
    <div className="agents-window">
      <header className="agents-titlebar">
        <span className="agents-brand">MyFlicker</span>
        <span className="agents-titlebar-spacer" />
      </header>
      <div className={`agents-body ${layoutClass}`}>
        <AgentsSidebar key="sidebar" />
        <AgentsMain key="main" />
        {previewFile && <AgentsCodePreview key="preview" />}
        {mode === 'code' && <AgentsRight key="right" />}
      </div>
    </div>
  );
}