
/**
 * ModelSettingsPanel — 模型 Provider 配置 UI
 *
 * 功能：
 *  - 展示已配置的 Provider 列表（含 active 标记）
 *  - 添加/编辑 Provider（name, baseUrl, apiKey, model, supportsVision）
 *  - 删除 Provider
 *  - 设置 active chat provider
 *  - 测试连通性
 */
import { useEffect, useState } from 'react';
import { useStore, cloudFetch } from '../store';

interface ProviderItem {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  model?: string;
  kind?: string;
  supportsVision?: boolean;
}

interface FormData {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  supportsVision: boolean;
}

const emptyForm: FormData = {
  id: '',
  name: '',
  baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  apiKey: '',
  model: '',
  supportsVision: true,
};

export function ModelSettingsPanel({ onClose }: { onClose?: () => void }) {
  const [profiles, setProfiles] = useState<ProviderItem[]>([]);
  const [activeChat, setActiveChat] = useState<string>('');
  const [form, setForm] = useState<FormData>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  const authUser = useStore((s) => s.authUser);
  const isLoggedIn = !!authUser && !authUser.isAnonymous;

  /** 同步当前本地 provider 配置到云端（使用 raw 端点获取明文 apiKey） */
  const syncToCloud = async () => {
    if (!isLoggedIn) return;
    try {
      const data = await fetch('/api/providers/raw').then((r) => r.json());
      const providerConfig = {
        profiles: (data?.profiles ?? []).filter((p: any) => !p.hash),
        active: data?.active ?? {},
        fallbacks: data?.fallbacks ?? {},
      };
      await cloudFetch('/api/me/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { providerConfig } }),
      });
    } catch {
      /* 云端同步失败不阻塞本地操作 */
    }
  };

  const load = async () => {
    try {
      // 并行加载本地 + 云端
      const [localData, cloudResp] = await Promise.all([
        fetch('/api/providers').then((r) => r.json()).catch(() => null),
        isLoggedIn
          ? cloudFetch('/api/me/settings').then((r) => r.ok ? r.json() : null).catch(() => null)
          : Promise.resolve(null),
      ]);

      // 判断本地是否有真实（非 hash）的 provider
      const localReal = (localData?.profiles ?? []).filter((p: any) => !p.hash);

      // 如果云端有设置且本地没有真实 provider，从云端恢复
      if (cloudResp?.settings?.providerConfig?.profiles?.length && !localReal.length) {
        // 过滤掉脱敏 key（以 *** 开头）和空 key 的 profile
        const validProfiles = cloudResp.settings.providerConfig.profiles.filter(
          (p: any) => p.apiKey && !p.apiKey.startsWith('***') && !p.hash,
        );

        if (validProfiles.length) {
          // 将云端 profiles 逐个写入本地
          for (const p of validProfiles) {
            await fetch('/api/providers', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: p.id, name: p.name, baseUrl: p.baseUrl,
                apiKey: p.apiKey, model: p.model,
                supportsVision: p.supportsVision,
              }),
            }).catch(() => {});
          }
          // 同步 active 设置
          if (cloudResp.settings.providerConfig.active?.chat) {
            await fetch('/api/providers/active', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ role: 'chat', id: cloudResp.settings.providerConfig.active.chat }),
            }).catch(() => {});
          }
          // 重新从本地加载（已是云端同步后的数据）
          const synced = await fetch('/api/providers').then((r) => r.json());
          await applyLocalData(synced);
          return;
        }
      }

      await applyLocalData(localData);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  };

  const applyLocalData = async (data: any) => {
    if (!data) return;
    const list = (data?.profiles ?? []).filter((p: any) => !p.hash);
    setProfiles(list.map((p: any) => ({
      id: p.id, name: p.name, baseUrl: p.baseUrl,
      model: p.model, kind: p.kind, supportsVision: p.supportsVision,
      apiKey: p.apiKey,
    })));
    const currentActive = data?.active?.chat ?? '';
    setActiveChat(currentActive);

    // 如果有 provider 但没有 active chat，自动激活第一个
    if (list.length > 0 && !currentActive) {
      const firstId = list[0].id;
      try {
        await fetch('/api/providers/active', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'chat', id: firstId }),
        });
        setActiveChat(firstId);
      } catch { /* 自动激活失败不阻塞 */ }
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
    setMsg(null);
    setErr(null);
  };

  const openEdit = (p: ProviderItem) => {
    setForm({
      id: p.id,
      name: p.name,
      baseUrl: p.baseUrl,
      apiKey: '',  // 不回显 key
      model: p.model ?? '',
      supportsVision: p.supportsVision !== false,
    });
    setEditingId(p.id);
    setShowForm(true);
    setMsg(null);
    setErr(null);
  };

  const handleSave = async () => {
    if (!form.name || !form.baseUrl) return;
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const body: any = {
        name: form.name,
        baseUrl: form.baseUrl,
        model: form.model || undefined,
        supportsVision: form.supportsVision,
      };
      if (editingId) {
        body.id = editingId;
      }
      if (form.apiKey) {
        body.apiKey = form.apiKey;
      }
      const r = await fetch('/api/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || `HTTP ${r.status}`);
      setMsg(editingId ? '模型已更新' : '模型已添加');
      setShowForm(false);
      setEditingId(null);
      await load();
      syncToCloud();
      window.dispatchEvent(new Event('providers-changed'));
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此模型配置？')) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/providers/${id}`, { method: 'DELETE' });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d?.error || `HTTP ${r.status}`);
      }
      setMsg('已删除');
      await load();
      syncToCloud();
      window.dispatchEvent(new Event('providers-changed'));
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleSetActive = async (id: string) => {
    try {
      const r = await fetch('/api/providers/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'chat', id }),
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d?.error || `HTTP ${r.status}`);
      }
      setActiveChat(id);
      setMsg(`已设为默认: ${profiles.find(p => p.id === id)?.name}`);
      syncToCloud();
      window.dispatchEvent(new Event('providers-changed'));
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    setMsg(null);
    setErr(null);
    try {
      const r = await fetch('/api/providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || `HTTP ${r.status}`);
      setMsg(`✓ 连接成功 (${d.latencyMs ?? '?'}ms): "${(d.response ?? '').slice(0, 50)}"`);
    } catch (e: any) {
      setErr(`✗ 测试失败: ${e?.message ?? String(e)}`);
    } finally {
      setTesting(null);
    }
  };

  return (
    <div style={{
      background: '#1e1e1e', color: '#e2e8f0', padding: 16, borderRadius: 6,
      border: '1px solid #333', maxWidth: 760, fontSize: 12, fontFamily: 'system-ui',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 14 }}>⚙ 模型设置</h3>
        {onClose && (
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 16, cursor: 'pointer',
          }}>×</button>
        )}
      </div>

      {/* Provider 列表 */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ color: '#94a3b8' }}>已配置模型 ({profiles.length})</span>
          <button onClick={openAdd} style={{
            background: '#2563eb', color: '#fff', border: 'none', borderRadius: 3,
            padding: '4px 12px', fontSize: 11, cursor: 'pointer',
          }}>+ 添加模型</button>
        </div>

        {profiles.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: 11, fontStyle: 'italic', padding: '12px 0' }}>
            还没有配置模型。点击"添加模型"开始配置。
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {profiles.map((p) => (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px', background: activeChat === p.id ? 'rgba(37, 99, 235, 0.15)' : 'rgba(255,255,255,0.03)',
                borderRadius: 4, border: activeChat === p.id ? '1px solid rgba(37,99,235,0.3)' : '1px solid transparent',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 12 }}>{p.name}</span>
                    {activeChat === p.id && (
                      <span style={{ fontSize: 9, color: '#4ade80', background: 'rgba(74,222,128,0.1)', padding: '1px 6px', borderRadius: 3 }}>默认</span>
                    )}
                    {p.supportsVision !== false && (
                      <span style={{ fontSize: 9, color: '#60a5fa', background: 'rgba(96,165,250,0.1)', padding: '1px 6px', borderRadius: 3 }}>视觉</span>
                    )}
                  </div>
                  <div style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>
                    {p.model ?? '(default)'} · {p.baseUrl.replace(/^https?:\/\//, '').slice(0, 40)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {activeChat !== p.id && (
                    <button onClick={() => handleSetActive(p.id)} title="设为默认" style={btnStyle('#94a3b8', '#444')}>★</button>
                  )}
                  <button onClick={() => handleTest(p.id)} disabled={testing === p.id} title="测试连接" style={btnStyle('#7fc8ff', '#2c5e8a')}>
                    {testing === p.id ? '...' : '🔗'}
                  </button>
                  <button onClick={() => openEdit(p)} title="编辑" style={btnStyle('#94a3b8', '#444')}>✎</button>
                  <button onClick={() => handleDelete(p.id)} title="删除" style={btnStyle('#f87171', '#5c2020')}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 添加/编辑表单 */}
      {showForm && (
        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid #333',
          borderRadius: 4, padding: 12, marginBottom: 12,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13 }}>
            {editingId ? '编辑模型' : '添加 OpenAI 兼容模型'}
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            <FormField label="显示名称" value={form.name}
              onChange={(v) => setForm({ ...form, name: v })} placeholder="通义千问 / DeepSeek" />
            <FormField label="Base URL" value={form.baseUrl}
              onChange={(v) => setForm({ ...form, baseUrl: v })} placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1" />
            <FormField label="API Key" value={form.apiKey} type="password"
              onChange={(v) => setForm({ ...form, apiKey: v })}
              placeholder={editingId ? '(不修改请留空)' : 'sk-...'} />
            <FormField label="模型 ID" value={form.model}
              onChange={(v) => setForm({ ...form, model: v })} placeholder="qwen-max / deepseek-chat" />

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#94a3b8', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.supportsVision}
                onChange={(e) => setForm({ ...form, supportsVision: e.target.checked })}
                style={{ accentColor: '#2563eb' }} />
              支持多模态图片（Vision）
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} style={{
              background: 'transparent', color: '#94a3b8', border: '1px solid #444',
              borderRadius: 3, padding: '6px 14px', fontSize: 12, cursor: 'pointer',
            }}>取消</button>
            <button onClick={handleSave} disabled={busy} style={{
              background: '#2563eb', color: '#fff', border: 'none', borderRadius: 3,
              padding: '6px 14px', fontSize: 12, cursor: 'pointer', opacity: busy ? 0.6 : 1,
            }}>{busy ? '保存中...' : '保存'}</button>
          </div>
        </div>
      )}

      {msg && <div style={{ color: '#4ade80', fontSize: 11, marginBottom: 6 }}>✓ {msg}</div>}
      {err && <div style={{ color: '#fca5a5', fontSize: 11, marginBottom: 6 }}>⚠ {err}</div>}

      <div style={{ color: '#64748b', fontSize: 10, lineHeight: 1.6, marginTop: 8 }}>
        提示：支持所有 OpenAI 兼容接口（DashScope/通义千问、DeepSeek、Moonshot、OpenRouter、Ollama 等）。
        <br />若图片识别报 400 错误，请取消勾选"支持多模态图片"。
      </div>
    </div>
  );
}

function FormField({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 10, color: '#94a3b8', marginBottom: 3 }}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{
          width: '100%', background: '#0a0a0a', color: '#e2e8f0', border: '1px solid #333',
          borderRadius: 3, padding: '6px 8px', fontSize: 11, boxSizing: 'border-box',
        }} />
    </div>
  );
}

function btnStyle(color: string, borderColor: string): React.CSSProperties {
  return {
    background: 'transparent', color, border: `1px solid ${borderColor}`,
    borderRadius: 3, padding: '3px 8px', fontSize: 11, cursor: 'pointer', lineHeight: 1,
  };
}
