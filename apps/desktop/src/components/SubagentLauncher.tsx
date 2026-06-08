
/**
 * SubagentLauncher — 用户从前端直接派发 subagent 的 UI（不走 LLM 决策）
 *
 * 流程：
 *  1. 启动时 GET /api/subagents/profiles 拿可用 role
 *  2. 用户选 role + 写 task → POST /api/subagents/spawn
 *  3. 派发成功后 subagent 通过 SSE announce 回流，SubagentPanel 自动显示
 *
 * 作为一个浮动按钮 + popover，挂在 SubagentPanel 上方。
 */
import { useEffect, useState } from 'react';

interface Profile {
  name: string;
  description: string;
}

export function SubagentLauncher() {
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [role, setRole] = useState<string>('');
  const [label, setLabel] = useState('');
  const [task, setTask] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch('/api/subagents/profiles')
      .then((r) => r.json())
      .then((d) => setProfiles(d.profiles ?? []))
      .catch(() => setProfiles([]));
  }, [open]);

  const spawn = async () => {
    if (!task.trim()) {
      setErr('task is required');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/subagents/spawn', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          task,
          label: label || undefined,
          role: role || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || `HTTP ${r.status}`);
      setOpen(false);
      setTask('');
      setLabel('');
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ margin: '6px 0' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          background: 'rgba(96, 165, 250, 0.15)',
          color: '#93c5fd',
          border: '1px solid rgba(96, 165, 250, 0.3)',
          borderRadius: 4,
          padding: '4px 10px',
          fontSize: 11,
          cursor: 'pointer',
        }}
      >
        {open ? '× Close' : '+ Dispatch Subagent'}
      </button>
      {open && (
        <div
          style={{
            marginTop: 6,
            padding: 10,
            background: 'rgba(30, 35, 45, 0.85)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            fontSize: 12,
          }}
        >
          <div style={{ color: '#cbd5e1', fontSize: 11 }}>Role (optional):</div>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={{
              background: '#1e1e1e',
              color: '#e2e8f0',
              border: '1px solid #444',
              borderRadius: 3,
              padding: '4px',
              fontSize: 11,
            }}
          >
            <option value="">(no role — default subagent prompt)</option>
            {profiles.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name} — {p.description.slice(0, 50)}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="label (optional, e.g. review-loop.ts)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            style={{
              background: '#1e1e1e',
              color: '#e2e8f0',
              border: '1px solid #444',
              borderRadius: 3,
              padding: '4px',
              fontSize: 11,
            }}
          />
          <textarea
            placeholder="Task description (will become subagent's user message)..."
            value={task}
            onChange={(e) => setTask(e.target.value)}
            rows={4}
            style={{
              background: '#1e1e1e',
              color: '#e2e8f0',
              border: '1px solid #444',
              borderRadius: 3,
              padding: '6px',
              fontSize: 11,
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
          {err && <div style={{ color: '#fca5a5', fontSize: 11 }}>⚠ {err}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
            <button
              onClick={() => setOpen(false)}
              disabled={busy}
              style={{
                background: 'transparent',
                color: '#94a3b8',
                border: '1px solid #444',
                borderRadius: 3,
                padding: '4px 10px',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={spawn}
              disabled={busy || !task.trim()}
              style={{
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: 3,
                padding: '4px 12px',
                fontSize: 11,
                cursor: busy || !task.trim() ? 'not-allowed' : 'pointer',
                opacity: busy || !task.trim() ? 0.6 : 1,
              }}
            >
              {busy ? 'Dispatching…' : 'Dispatch'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}