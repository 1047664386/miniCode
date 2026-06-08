
/**
 * McpSettingsPanel — MCP servers 配置 UI
 *
 * 功能：
 *  - 拉取当前 mcp.json 内容（不存在则展示 example）
 *  - 内嵌 JSON 编辑器（textarea + 校验）
 *  - Save & Reconnect 按钮
 *  - 状态显示：已连接 server 列表 + 每个的 tools 数
 */
import { useEffect, useState } from 'react';

interface ServerStatus {
  name: string;
  connected: boolean;
  tools: string[];
}

export function McpSettingsPanel({ onClose }: { onClose?: () => void }) {
  const [config, setConfig] = useState('');
  const [exists, setExists] = useState(false);
  const [path, setPath] = useState('');
  const [servers, setServers] = useState<ServerStatus[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadAll = async () => {
    try {
      const [c, s] = await Promise.all([
        fetch('/api/mcp/config').then((r) => r.json()),
        fetch('/api/mcp/status').then((r) => r.json()),
      ]);
      setConfig(c.content ?? '');
      setExists(!!c.exists);
      setPath(c.path ?? '');
      setServers(s.servers ?? []);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const save = async (reconnect: boolean) => {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      // 校验 JSON
      try {
        JSON.parse(config);
      } catch (e: any) {
        throw new Error(`invalid JSON: ${e?.message}`);
      }
      const r = await fetch('/api/mcp/config', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: config }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || `HTTP ${r.status}`);
      setMsg(`Saved to ${d.path}.`);
      if (reconnect) {
        const r2 = await fetch('/api/mcp/reconnect', { method: 'POST' });
        const d2 = await r2.json();
        if (!r2.ok) throw new Error(d2?.error || `reconnect HTTP ${r2.status}`);
        const ok = (d2.results ?? []).filter((x: any) => x.ok).length;
        const total = (d2.results ?? []).length;
        setMsg(`Saved + reconnected. ${ok}/${total} server(s) ok.`);
        await loadAll();
      }
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        background: '#1e1e1e',
        color: '#e2e8f0',
        padding: 16,
        borderRadius: 6,
        border: '1px solid #333',
        maxWidth: 760,
        fontSize: 12,
        fontFamily: 'system-ui',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 14 }}>MCP Servers</h3>
        {onClose && (
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 16, cursor: 'pointer' }}
          >
            ×
          </button>
        )}
      </div>

      {/* 已连接 server 状态 */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ color: '#94a3b8', marginBottom: 6 }}>
          Connected servers ({servers.length})
        </div>
        {servers.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: 11, fontStyle: 'italic' }}>
            No MCP server connected. Edit config below and click "Save & Reconnect".
          </div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {servers.map((s) => (
              <li
                key={s.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 8px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 3,
                  marginBottom: 3,
                }}
              >
                <span style={{ color: s.connected ? '#4ade80' : '#f87171' }}>
                  {s.connected ? '●' : '○'}
                </span>
                <span style={{ fontWeight: 600 }}>{s.name}</span>
                <span style={{ color: '#64748b', fontSize: 10 }}>
                  {s.tools.length} tool{s.tools.length === 1 ? '' : 's'}
                </span>
                {s.tools.length > 0 && (
                  <span style={{ color: '#64748b', fontSize: 10, marginLeft: 'auto', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.tools.join(', ')}>
                    {s.tools.slice(0, 4).join(', ')}{s.tools.length > 4 ? '…' : ''}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 配置编辑 */}
      <div style={{ color: '#94a3b8', marginBottom: 6 }}>
        Config: <code style={{ color: '#cbd5e1' }}>{path || '.minicodeide/mcp.json'}</code>{' '}
        {!exists && <span style={{ color: '#fbbf24' }}>(showing example, not saved yet)</span>}
      </div>
      <textarea
        value={config}
        onChange={(e) => setConfig(e.target.value)}
        rows={18}
        spellCheck={false}
        style={{
          width: '100%',
          background: '#0a0a0a',
          color: '#e2e8f0',
          border: '1px solid #333',
          borderRadius: 3,
          padding: 8,
          fontFamily: 'ui-monospace, monospace',
          fontSize: 11,
          lineHeight: 1.5,
          boxSizing: 'border-box',
          resize: 'vertical',
        }}
      />

      {msg && <div style={{ color: '#4ade80', marginTop: 8, fontSize: 11 }}>✓ {msg}</div>}
      {err && <div style={{ color: '#fca5a5', marginTop: 8, fontSize: 11 }}>⚠ {err}</div>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        <button
          onClick={loadAll}
          disabled={busy}
          style={{
            background: 'transparent',
            color: '#94a3b8',
            border: '1px solid #444',
            borderRadius: 3,
            padding: '6px 14px',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Reload
        </button>
        <button
          onClick={() => save(false)}
          disabled={busy}
          style={{
            background: 'transparent',
            color: '#7fc8ff',
            border: '1px solid #2c5e8a',
            borderRadius: 3,
            padding: '6px 14px',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Save only
        </button>
        <button
          onClick={() => save(true)}
          disabled={busy}
          style={{
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 3,
            padding: '6px 14px',
            fontSize: 12,
            cursor: 'pointer',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? 'Working…' : 'Save & Reconnect'}
        </button>
      </div>

      <div style={{ marginTop: 14, color: '#64748b', fontSize: 10, lineHeight: 1.6 }}>
        Tip: see <code>.minicodeide/mcp.example.json</code> for working examples (filesystem / github / postgres / brave-search / memory).
        <br />
        Security: only commands in <code>.minicodeide/mcp-allowlist.json</code> can be spawned (defaults: npx, uvx, node, python3, ...).
      </div>
    </div>
  );
}