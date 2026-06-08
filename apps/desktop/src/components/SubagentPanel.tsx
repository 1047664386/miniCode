
/**
 * SubagentPanel — 显示当前会话所有派发的子 Agent 状态。
 *
 * 数据来源：
 *  - SSE `subagent_spawned` → upsertSubagent(running)
 *  - SSE `subagent_announce` → upsertSubagent(completed/error/timeout)
 *  - SSE `subagent_progress` → upsertSubagent(running, recentTools updated)
 *
 * 显示：
 *  - 每个 subagent 一行：role badge / label / status / task preview / 耗时
 *  - running 时展示最近 tool calls 进度条
 *  - 完成的 announce 全文可展开
 *  - 自动隐藏：subagents 数组为空时不渲染
 */
import { useState } from 'react';
import { useStore } from '../store';

const STATUS_COLOR: Record<string, string> = {
  running: '#60a5fa',
  completed: '#4ade80',
  error: '#f87171',
  timeout: '#fbbf24',
};

const STATUS_ICON: Record<string, string> = {
  running: '⟳',
  completed: '✓',
  error: '✗',
  timeout: '⏱',
};

const TOOL_ICON: Record<string, string> = {
  read_file: '📖',
  list_files: '📂',
  grep_search: '🔍',
  edit_file: '✏️',
  write_file: '📝',
  run_command: '⌨️',
  find_symbol: '🔎',
  semantic_search: '🧠',
  web_fetch: '🌐',
  think: '💭',
  apply_patch: '🩹',
  git_status: '📋',
  git_diff: '📊',
  git_log: '📜',
  git_commit: '💾',
};

export function SubagentPanel() {
  const subagents = useStore((s) => s.subagents);
  const clearSubagents = useStore((s) => s.clearSubagents);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!subagents || subagents.length === 0) return null;

  return (
    <div
      className="subagent-panel"
      style={{
        background: 'rgba(30, 35, 45, 0.6)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 6,
        padding: 8,
        margin: '8px 0',
        fontFamily: 'system-ui',
        fontSize: 12,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
          color: '#cbd5e1',
        }}
      >
        <span style={{ fontWeight: 600 }}>
          🤖 Subagents ({subagents.length})
        </span>
        <button
          onClick={clearSubagents}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.15)',
            color: '#94a3b8',
            borderRadius: 3,
            padding: '2px 8px',
            fontSize: 10,
            cursor: 'pointer',
          }}
          title="Clear panel (does not cancel running subagents)"
        >
          Clear
        </button>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {subagents.map((sa) => {
          const isExpanded = expandedId === sa.runId;
          const dur =
            sa.finishedAt && sa.startedAt
              ? `${((sa.finishedAt - sa.startedAt) / 1000).toFixed(1)}s`
              : sa.status === 'running'
              ? '...'
              : '';
          const hasRecentTools = sa.recentTools && sa.recentTools.length > 0;
          return (
            <li
              key={sa.runId}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 4,
                padding: 6,
                cursor: sa.result || sa.error ? 'pointer' : 'default',
              }}
              onClick={() => {
                if (sa.result || sa.error) {
                  setExpandedId(isExpanded ? null : sa.runId);
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    color: STATUS_COLOR[sa.status],
                    fontSize: 14,
                    width: 14,
                    display: 'inline-block',
                    textAlign: 'center',
                    animation: sa.status === 'running' ? 'subagent-spin 1.2s linear infinite' : 'none',
                  }}
                >
                  {STATUS_ICON[sa.status]}
                </span>
                {sa.role && (
                  <span
                    style={{
                      background: 'rgba(96, 165, 250, 0.15)',
                      color: '#93c5fd',
                      padding: '1px 6px',
                      borderRadius: 3,
                      fontSize: 10,
                      fontWeight: 600,
                    }}
                  >
                    {sa.role}
                  </span>
                )}
                <span style={{ flex: 1, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sa.label || '(no-label)'}
                </span>
                <span style={{ color: '#64748b', fontSize: 10 }}>{dur}</span>
              </div>
              <div
                style={{
                  color: '#94a3b8',
                  marginTop: 3,
                  marginLeft: 20,
                  fontSize: 11,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: isExpanded ? 'pre-wrap' : 'nowrap',
                  maxHeight: isExpanded ? 600 : 16,
                }}
              >
                {sa.task}
              </div>
              {/* Real-time progress: recent tool calls */}
              {sa.status === 'running' && hasRecentTools && (
                <div
                  style={{
                    marginTop: 4,
                    marginLeft: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  {sa.recentTools!.slice(-3).map((t, i) => (
                    <div
                      key={`${t.tool}-${i}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 10,
                        color: '#94a3b8',
                      }}
                    >
                      <span style={{ width: 14, textAlign: 'center' }}>
                        {TOOL_ICON[t.tool] ?? '🔧'}
                      </span>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.tool}
                        {t.resultPreview ? ` → ${t.resultPreview}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {isExpanded && (sa.result || sa.error) && (
                <div
                  style={{
                    marginTop: 6,
                    marginLeft: 20,
                    padding: 6,
                    background: 'rgba(0,0,0,0.25)',
                    borderRadius: 3,
                    color: sa.error ? '#fecaca' : '#d1fae5',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: 11,
                    maxHeight: 300,
                    overflow: 'auto',
                  }}
                >
                  {sa.error || sa.result}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <style>
        {`@keyframes subagent-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}
      </style>
    </div>
  );
}