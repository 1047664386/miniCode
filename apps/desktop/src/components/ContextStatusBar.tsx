
/**
 * ContextStatusBar — 在 ChatPanel 顶部显示 token 用量 + cache 命中率。
 *
 * 来源 SSE 事件：
 *  - context_stats：每轮 buildMessages 后发，含触发阈值与压缩前后 token
 *  - usage：每次 LLM 调用结束后发，含真实 prompt / completion / cached token
 *
 * 这是面向"工程严肃度"的展示——告诉用户/面试官"我能感知模型成本"。
 */
import { useStore } from '../store';

export function ContextStatusBar() {
  const stats = useStore((s) => s.contextStats);
  const usage = useStore((s) => s.usage);
  if (!stats && !usage) return null;

  const triggerPct =
    stats?.contextWindow && stats?.beforeTokens
      ? Math.round((stats.beforeTokens / stats.contextWindow) * 100)
      : null;

  const cachePct =
    usage?.promptTokens && usage?.cachedPromptTokens !== undefined
      ? Math.round((usage.cachedPromptTokens / usage.promptTokens) * 100)
      : null;

  return (
    <div className="ctx-status">
      {stats && (
        <span className="ctx-chip" title={`window=${stats.contextWindow} trigger=${stats.triggerTokens} target=${stats.targetTokens}`}>
          ctx&nbsp;
          <b>
            {fmt(stats.beforeTokens)}/{fmt(stats.contextWindow)}
          </b>
          {triggerPct !== null && <span className="ctx-pct">({triggerPct}%)</span>}
          {stats.triggered && <span className="ctx-tag">⚠ compacted</span>}
        </span>
      )}
      {stats?.stableTokens !== undefined && stats?.dynamicTokens !== undefined && (
        <span className="ctx-chip" title="stable / dynamic system prompt split (Prompt Cache friendly)">
          sys&nbsp;<b>{fmt(stats.stableTokens)}+{fmt(stats.dynamicTokens)}</b>
        </span>
      )}
      {usage && (
        <span className="ctx-chip" title={`real usage from provider`}>
          in&nbsp;<b>{fmt(usage.promptTokens)}</b>&nbsp;out&nbsp;<b>{fmt(usage.completionTokens)}</b>
          {cachePct !== null && <span className="ctx-tag ok">cache {cachePct}%</span>}
        </span>
      )}
    </div>
  );
}

function fmt(n?: number): string {
  if (n === undefined || n === null) return '?';
  if (n < 1000) return String(n);
  if (n < 1_000_000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return (n / 1_000_000).toFixed(2) + 'M';
}