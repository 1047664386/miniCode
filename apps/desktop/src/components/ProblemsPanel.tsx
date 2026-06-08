
/**
 * ProblemsPanel —— typecheck/lint 错误聚合面板（点击跳行）
 * ----------------------------------------------------------------
 * 后端 /api/diagnostics 后台跑 tsc --noEmit，缓存 30s。
 * 前端：
 *   - 首次打开触发一次 force=1
 *   - 按文件分组，errors/warnings 各显示数量
 *   - 点击跳到对应 file:line
 *   - 顶部 Refresh 强制重跑
 *   - 显示上次扫描耗时
 */
import { useEffect, useState, useCallback } from 'react';
import { useStore } from '../store';

interface Diagnostic {
  file: string;
  line: number;
  col: number;
  severity: 'error' | 'warning';
  message: string;
  code?: string;
}

interface Resp {
  diagnostics: Diagnostic[];
  ts: number;
  running: boolean;
  durationMs?: number;
  error?: string;
  stale: boolean;
}

export function ProblemsPanel() {
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(false);
  const openFile = useStore((s) => s.openFile);
  const revealLine = useStore((s) => s.revealLine);

  const refresh = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/diagnostics${force ? '?force=1' : ''}`);
      const d = (await r.json()) as Resp;
      setData(d);
    } catch {
      /* */
    } finally {
      setLoading(false);
    }
  }, []);

  // 首次 force=1；之后 3s 轮询，直到 running=false
  useEffect(() => {
    refresh(true);
    const t = setInterval(() => refresh(false), 3000);
    return () => clearInterval(t);
  }, [refresh]);

  const jump = async (d: Diagnostic) => {
    await openFile(d.file);
    setTimeout(() => revealLine(d.file, d.line), 30);
  };

  const diagnostics = data?.diagnostics ?? [];
  // 按文件分组
  const byFile: Record<string, Diagnostic[]> = {};
  for (const d of diagnostics) (byFile[d.file] ??= []).push(d);
  const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
  const warnCount = diagnostics.filter((d) => d.severity === 'warning').length;

  return (
    <div className="problems-panel">
      <div className="problems-header">
        <div className="problems-title">Problems</div>
        <button
          className="problems-refresh"
          disabled={loading || data?.running}
          onClick={() => refresh(true)}
        >
          {data?.running ? '⏳ Scanning…' : loading ? '⏳' : '↻ Refresh'}
        </button>
        <div className="problems-stats">
          <span className="problems-err">● {errorCount}</span>
          <span className="problems-warn">▲ {warnCount}</span>
          {typeof data?.durationMs === 'number' && (
            <span className="problems-dur">{Math.round(data.durationMs / 100) / 10}s</span>
          )}
        </div>
      </div>
      <div className="problems-body">
        {!data && <div className="problems-empty">Loading…</div>}
        {data?.error && <div className="problems-empty" style={{ color: '#e06c75' }}>{data.error}</div>}
        {data && !data.error && diagnostics.length === 0 && (
          <div className="problems-empty" style={{ color: '#98c379' }}>
            ✓ No problems found
          </div>
        )}
        {Object.keys(byFile).map((f) => (
          <div key={f} className="problems-file-group">
            <div className="problems-file">
              <span className="problems-file-name">{f}</span>
              <span className="problems-file-count">({byFile[f].length})</span>
            </div>
            {byFile[f].map((d, i) => (
              <div key={i} className="problems-row" onClick={() => jump(d)} title="Jump to location">
                <span className={`problems-sev problems-sev-${d.severity}`}>
                  {d.severity === 'error' ? '●' : '▲'}
                </span>
                <span className="problems-loc">{d.line}:{d.col}</span>
                {d.code && <span className="problems-code">{d.code}</span>}
                <span className="problems-msg">{d.message}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}