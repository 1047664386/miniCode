
/**
 * CostMiniPanel — 浮动迷你面板，显示当前会话累计 LLM 用量 + 估算成本。
 *
 * 数据来源：SSE `usage` 事件（每次 LLM 调用结束）
 *  - promptTokens / completionTokens / cachedPromptTokens
 *
 * 显示内容：
 *  - 累计 input / output token
 *  - 累计 cache 命中 token + 命中率
 *  - 估算成本（$）基于 Anthropic / OpenAI 定价表
 *  - 当前 model name
 *  - per-turn breakdown 横条图
 *  - 浮在右下角，可折叠
 */
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';

interface TurnUsage {
  in: number;
  out: number;
  cached: number;
}

interface Accumulator {
  totalIn: number;
  totalOut: number;
  totalCached: number;
  callCount: number;
  turns: TurnUsage[];
}

/**
 * Simplified pricing table (per 1M tokens).
 * Key = lowercase model substring match.
 */
const PRICING: Record<string, { input: number; output: number; cacheRead: number }> = {
  'claude-3.5-sonnet': { input: 3, output: 15, cacheRead: 0.3 },
  'claude-3.5-haiku':  { input: 0.8, output: 4, cacheRead: 0.08 },
  'claude-3-opus':     { input: 15, output: 75, cacheRead: 1.5 },
  'claude-sonnet-4':   { input: 3, output: 15, cacheRead: 0.3 },
  'gpt-4o':            { input: 2.5, output: 10, cacheRead: 1.25 },
  'gpt-4o-mini':       { input: 0.15, output: 0.6, cacheRead: 0.075 },
  'gpt-4-turbo':       { input: 10, output: 30, cacheRead: 5 },
  'deepseek-chat':     { input: 0.14, output: 0.28, cacheRead: 0.014 },
  'deepseek-reasoner':  { input: 0.55, output: 2.18, cacheRead: 0.055 },
};

function getPricing(model?: string) {
  if (!model) return null;
  const m = model.toLowerCase();
  for (const [key, val] of Object.entries(PRICING)) {
    if (m.includes(key)) return val;
  }
  // Fallback: deepseek family
  if (m.includes('deepseek')) return PRICING['deepseek-chat'];
  // Fallback: gpt-4
  if (m.includes('gpt-4')) return PRICING['gpt-4o'];
  return null;
}

export function CostMiniPanel() {
  const usage = useStore((s) => s.usage);
  const selectedProfileId = useStore((s) => s.selectedProfileId);
  const [acc, setAcc] = useState<Accumulator>({ totalIn: 0, totalOut: 0, totalCached: 0, callCount: 0, turns: [] });
  const [collapsed, setCollapsed] = useState(true);
  const [modelName, setModelName] = useState<string>('');

  // Fetch model name from profiles when selectedProfileId changes
  useEffect(() => {
    if (!selectedProfileId) {
      // Auto routing — try to get active chat profile from server
      fetch('/api/providers')
        .then((r) => r.json())
        .then((data: any) => {
          const activeChat = data?.active?.chat;
          const profile = (data?.profiles ?? []).find((p: any) => p.id === activeChat);
          setModelName(profile?.model ?? 'auto');
        })
        .catch(() => setModelName('auto'));
    } else {
      fetch('/api/providers')
        .then((r) => r.json())
        .then((data: any) => {
          const profile = (data?.profiles ?? []).find((p: any) => p.id === selectedProfileId);
          setModelName(profile?.model ?? selectedProfileId);
        })
        .catch(() => setModelName(selectedProfileId));
    }
  }, [selectedProfileId]);

  // 每次 usage 变化（新 LLM 调用）累加
  useEffect(() => {
    if (!usage) return;
    const turnIn = usage.promptTokens ?? 0;
    const turnOut = usage.completionTokens ?? 0;
    const turnCached = usage.cachedPromptTokens ?? 0;
    setAcc((prev) => ({
      totalIn: prev.totalIn + turnIn,
      totalOut: prev.totalOut + turnOut,
      totalCached: prev.totalCached + turnCached,
      callCount: prev.callCount + 1,
      turns: [...prev.turns, { in: turnIn, out: turnOut, cached: turnCached }],
    }));
  }, [usage]);

  if (acc.callCount === 0) return null;

  const cachePct = acc.totalIn > 0 ? Math.round((acc.totalCached / acc.totalIn) * 100) : 0;
  const savedTokensEquiv = Math.round(acc.totalCached * 0.9);

  // Cost estimation
  const pricing = getPricing(modelName);
  let costStr = '';
  if (pricing) {
    const inputCost = (acc.totalIn / 1_000_000) * pricing.input;
    const cacheSavings = (acc.totalCached / 1_000_000) * (pricing.input - pricing.cacheRead);
    const outputCost = (acc.totalOut / 1_000_000) * pricing.output;
    const total = inputCost - cacheSavings + outputCost;
    costStr = total < 0.01 ? total.toFixed(4) : total < 1 ? total.toFixed(3) : total.toFixed(2);
  }

  // Per-turn breakdown bars
  const maxTurnTokens = Math.max(1, ...acc.turns.map((t) => t.in + t.out));
  const showBars = !collapsed && acc.turns.length > 0;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 12,
        right: 12,
        zIndex: 50,
        background: 'rgba(20, 24, 32, 0.92)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 6,
        padding: collapsed ? '4px 10px' : '8px 12px',
        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
        fontSize: 11,
        color: '#cbd5e1',
        cursor: 'pointer',
        userSelect: 'none',
        backdropFilter: 'blur(6px)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        minWidth: collapsed ? undefined : 260,
        maxWidth: 300,
      }}
      onClick={() => setCollapsed(!collapsed)}
      title="Click to expand/collapse"
    >
      {collapsed ? (
        <span>
          💰 {fmt(acc.totalIn + acc.totalOut)} tok{costStr && <span style={{ marginLeft: 6, color: '#fbbf24' }}>${costStr}</span>}
          {cachePct > 0 && <span style={{ color: '#4ade80', marginLeft: 6 }}>cache {cachePct}%</span>}
        </span>
      ) : (
        <div>
          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 4, marginBottom: 6, fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
            <span>💰 LLM Usage ({acc.callCount} call{acc.callCount > 1 ? 's' : ''})</span>
            {modelName && <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 10 }}>{modelName}</span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '2px 8px' }}>
            <span style={{ color: '#94a3b8' }}>input</span>
            <b>{fmt(acc.totalIn)}</b>
            <span />
            <span style={{ color: '#94a3b8' }}>output</span>
            <b>{fmt(acc.totalOut)}</b>
            <span />
            {acc.totalCached > 0 && (
              <>
                <span style={{ color: '#94a3b8' }}>cached</span>
                <b style={{ color: '#4ade80' }}>{fmt(acc.totalCached)} ({cachePct}%)</b>
                <span />
                <span style={{ color: '#94a3b8' }}>~saved</span>
                <b style={{ color: '#4ade80' }}>{fmt(savedTokensEquiv)} tok</b>
                <span />
              </>
            )}
            {costStr && (
              <>
                <span style={{ color: '#94a3b8' }}>est. cost</span>
                <b style={{ color: '#fbbf24' }}>${costStr}</b>
                <span />
              </>
            )}
          </div>
          {showBars && (
            <div style={{ marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6 }}>
              <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>Per-turn breakdown</div>
              {acc.turns.slice(-12).map((t, i) => {
                const inW = (t.in / maxTurnTokens) * 100;
                const outW = (t.out / maxTurnTokens) * 100;
                const cachedW = (t.cached / maxTurnTokens) * 100;
                return (
                  <div key={i} style={{ display: 'flex', gap: 1, marginBottom: 2, alignItems: 'center' }}>
                    <span style={{ color: '#666', width: 16, textAlign: 'right', fontSize: 9, flexShrink: 0 }}>{i + 1}</span>
                    <div style={{ flex: 1, display: 'flex', gap: 1, height: 6, borderRadius: 2, overflow: 'hidden', background: 'rgba(255,255,255,0.04)' }}>
                      {t.cached > 0 && (
                        <div style={{ width: `${cachedW}%`, background: '#22c55e', borderRadius: 1 }} title={`cached: ${fmt(t.cached)}`} />
                      )}
                      <div style={{ width: `${Math.max(inW - cachedW, 0)}%`, background: '#3b82f6', borderRadius: 1 }} title={`input: ${fmt(t.in)}`} />
                      <div style={{ width: `${outW}%`, background: '#f59e0b', borderRadius: 1 }} title={`output: ${fmt(t.out)}`} />
                    </div>
                  </div>
                );
              })}
              <div style={{ display: 'flex', gap: 10, fontSize: 9, color: '#888', marginTop: 2 }}>
                <span><span style={{ display: 'inline-block', width: 6, height: 6, background: '#3b82f6', borderRadius: 1, marginRight: 3 }} />in</span>
                <span><span style={{ display: 'inline-block', width: 6, height: 6, background: '#f59e0b', borderRadius: 1, marginRight: 3 }} />out</span>
                <span><span style={{ display: 'inline-block', width: 6, height: 6, background: '#22c55e', borderRadius: 1, marginRight: 3 }} />cache</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function fmt(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return (n / 1_000_000).toFixed(2) + 'M';
}