
import { useEffect, useMemo, useState } from 'react';

type Kind = 'openai' | 'anthropic' | undefined;

interface ProfileView {
  id: string;
  name: string;
  kind?: Kind;
  baseUrl: string;
  apiKey: string; // masked
  model?: string;
  embedModel?: string;
  embedDim?: number;
  hash?: boolean;
}
interface Cfg {
  profiles: ProfileView[];
  active: { chat?: string; complete?: string; embed?: string; fast?: string };
  fallbacks?: {
    chat?: string[];
    complete?: string[];
    embed?: string[];
    fast?: string[];
  };
}

interface DraftState {
  id?: string;
  name: string;
  kind: 'auto' | 'openai' | 'anthropic';
  baseUrl: string;
  apiKey: string;
  model: string;
  embedModel: string;
}

const EMPTY_DRAFT: DraftState = {
  name: '',
  kind: 'auto',
  baseUrl: '',
  apiKey: '',
  model: '',
  embedModel: '',
};

/**
 * Provider 预设大全。每个预设带：
 *   - 默认 baseUrl / 默认 chat model
 *   - 常用 chat model 列表（前端做 datalist 下拉补全）
 *   - 是否提供 embedding（无则 UI 显示提示）
 */
interface Preset {
  id: string;
  label: string;
  vendor: string;
  icon: string;
  kind: 'openai' | 'anthropic';
  baseUrl: string;
  defaultModel: string;
  models: string[];
  defaultEmbedModel?: string;
  embedModels?: string[];
  signupUrl?: string;
  notes?: string;
}

const PRESETS: Preset[] = [
  {
    id: 'deepseek',
    label: 'DeepSeek',
    vendor: 'DeepSeek',
    icon: '🔮',
    kind: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-coder'],
    signupUrl: 'https://platform.deepseek.com/api_keys',
    notes: '便宜 + 国内速度好；无 embedding，请用 OpenAI 或 hash fallback',
  },
  {
    id: 'tencent-lkeap',
    label: '腾讯云 LKEAP (DeepSeek)',
    vendor: 'Tencent Cloud',
    icon: '🐧',
    kind: 'openai',
    baseUrl: 'https://api.lkeap.cloud.tencent.com/v1',
    defaultModel: 'deepseek-v4',
    models: [
      'deepseek-v4',
      'deepseek-v4-pro',
      'deepseek-v3.2-exp',
      'deepseek-v3.1',
      'deepseek-v3-0324',
      'deepseek-v3',
      'deepseek-r1',
      'deepseek-r1-0528',
      'deepseek-r1-distill-qwen-32b',
    ],
    signupUrl: 'https://console.cloud.tencent.com/lkeap/api',
    notes: '腾讯云知识引擎原子能力(LKEAP)，托管满血 DeepSeek V3/R1；新用户每模型送 100w token，OpenAI 兼容协议',
  },
  {
    id: 'hunyuan',
    label: '腾讯混元 (Hunyuan)',
    vendor: 'Tencent Cloud',
    icon: '🐧',
    kind: 'openai',
    baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',
    defaultModel: 'hunyuan-turbos-latest',
    models: [
      'hunyuan-turbos-latest',
      'hunyuan-turbo',
      'hunyuan-large',
      'hunyuan-standard',
      'hunyuan-standard-256K',
      'hunyuan-lite',
      'hunyuan-code',
      'hunyuan-t1-latest',
    ],
    defaultEmbedModel: 'hunyuan-embedding',
    embedModels: ['hunyuan-embedding'],
    signupUrl: 'https://console.cloud.tencent.com/hunyuan/api-key',
    notes: '腾讯自研混元大模型，OpenAI 兼容；hunyuan-lite 永久免费',
  },
  {
    id: 'kimi',
    label: 'Kimi (Moonshot)',
    vendor: 'Moonshot',
    icon: '🌙',
    kind: 'openai',
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-32k',
    models: [
      'moonshot-v1-8k',
      'moonshot-v1-32k',
      'moonshot-v1-128k',
      'moonshot-v1-auto',
      'kimi-k2-0711-preview',
    ],
    signupUrl: 'https://platform.moonshot.cn/console/api-keys',
    notes: '长上下文友好（128k）；OpenAI 兼容协议',
  },
  {
    id: 'glm',
    label: 'GLM (智谱)',
    vendor: 'Zhipu',
    icon: '🐉',
    kind: 'openai',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-plus',
    models: [
      'glm-4.6',
      'glm-4-plus',
      'glm-4-0520',
      'glm-4-long',
      'glm-4-air',
      'glm-4-flash',
      'glm-4v-plus',
    ],
    defaultEmbedModel: 'embedding-3',
    embedModels: ['embedding-2', 'embedding-3'],
    signupUrl: 'https://open.bigmodel.cn/usercenter/proj-mgmt/apikeys',
    notes: '智谱 GLM，原生支持 OpenAI /v1 协议，自带 embedding-3',
  },
  {
    id: 'minimax',
    label: 'MiniMax',
    vendor: 'MiniMax',
    icon: '🧬',
    kind: 'openai',
    baseUrl: 'https://api.minimaxi.com/v1',
    defaultModel: 'MiniMax-Text-01',
    models: ['MiniMax-Text-01', 'abab6.5s-chat', 'abab6.5g-chat', 'abab6.5t-chat'],
    defaultEmbedModel: 'embo-01',
    embedModels: ['embo-01'],
    signupUrl: 'https://platform.minimaxi.com/user-center/basic-information/interface-key',
    notes: '海螺 AI 官方接口（注意：海外版用 minimax.io，国内版 minimaxi.com）',
  },
  {
    id: 'qwen',
    label: '通义千问 (Qwen)',
    vendor: 'Alibaba',
    icon: '☁️',
    kind: 'openai',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-max',
    models: [
      'qwen-max',
      'qwen-max-latest',
      'qwen-plus',
      'qwen-turbo',
      'qwen-long',
      'qwen2.5-72b-instruct',
      'qwen2.5-coder-32b-instruct',
      'qwen3-235b-a22b',
    ],
    defaultEmbedModel: 'text-embedding-v3',
    embedModels: ['text-embedding-v1', 'text-embedding-v2', 'text-embedding-v3'],
    signupUrl: 'https://bailian.console.aliyun.com/?apiKey=1',
    notes: '阿里云灵积；使用 OpenAI 兼容端点（compatible-mode）',
  },
  {
    id: 'doubao',
    label: '豆包 (Doubao)',
    vendor: 'ByteDance Volc',
    icon: '🫘',
    kind: 'openai',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: '',
    models: [
      'doubao-1-5-pro-32k-250115',
      'doubao-1-5-pro-256k-250115',
      'doubao-1-5-lite-32k-250115',
      'doubao-pro-32k',
      'doubao-pro-128k',
      'doubao-1-5-thinking-pro-250415',
    ],
    signupUrl: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey',
    notes: '字节火山引擎；model 字段填的是「endpoint_id」（ep-xxx）或预置模型 ID',
  },
  {
    id: 'siliconflow',
    label: '硅基流动 (SiliconFlow)',
    vendor: 'SiliconFlow',
    icon: '🪐',
    kind: 'openai',
    baseUrl: 'https://api.siliconflow.cn/v1',
    defaultModel: 'Qwen/Qwen2.5-72B-Instruct',
    models: [
      'Qwen/Qwen2.5-72B-Instruct',
      'Qwen/Qwen2.5-Coder-32B-Instruct',
      'deepseek-ai/DeepSeek-V3',
      'deepseek-ai/DeepSeek-R1',
      'meta-llama/Meta-Llama-3.1-405B-Instruct',
      'THUDM/glm-4-9b-chat',
    ],
    defaultEmbedModel: 'BAAI/bge-large-zh-v1.5',
    embedModels: ['BAAI/bge-large-zh-v1.5', 'BAAI/bge-m3', 'netease-youdao/bce-embedding-base_v1'],
    signupUrl: 'https://cloud.siliconflow.cn/account/ak',
    notes: '聚合托管多家开源模型 + 嵌入；OpenAI 兼容；新用户送额度',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    vendor: 'OpenAI',
    icon: '⚪',
    kind: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    models: [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-4.1',
      'gpt-4.1-mini',
      'o1',
      'o1-mini',
      'o3-mini',
      'gpt-3.5-turbo',
    ],
    defaultEmbedModel: 'text-embedding-3-small',
    embedModels: ['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002'],
    signupUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'claude',
    label: 'Claude (Anthropic)',
    vendor: 'Anthropic',
    icon: '🟧',
    kind: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-3-5-sonnet-20241022',
    models: [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-sonnet-20240620',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
      'claude-sonnet-4-5',
      'claude-opus-4-7',
    ],
    signupUrl: 'https://console.anthropic.com/settings/keys',
    notes: '走原生 /v1/messages；不提供 embedding',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    vendor: 'OpenRouter',
    icon: '🌐',
    kind: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-3.5-sonnet',
    models: [
      'anthropic/claude-3.5-sonnet',
      'anthropic/claude-3-opus',
      'openai/gpt-4o',
      'google/gemini-pro-1.5',
      'meta-llama/llama-3.1-405b-instruct',
      'deepseek/deepseek-chat',
      'qwen/qwen-2.5-72b-instruct',
    ],
    signupUrl: 'https://openrouter.ai/keys',
    notes: '聚合 200+ 模型，可以一个 key 用所有',
  },
  {
    id: 'groq',
    label: 'Groq',
    vendor: 'Groq',
    icon: '⚡',
    kind: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    models: [
      'llama-3.3-70b-versatile',
      'llama-3.1-70b-versatile',
      'llama-3.1-8b-instant',
      'mixtral-8x7b-32768',
      'gemma2-9b-it',
    ],
    signupUrl: 'https://console.groq.com/keys',
    notes: '主打超低延迟推理；OpenAI 兼容',
  },
  {
    id: 'mistral',
    label: 'Mistral',
    vendor: 'Mistral AI',
    icon: '🇫🇷',
    kind: 'openai',
    baseUrl: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-large-latest',
    models: [
      'mistral-large-latest',
      'mistral-medium-latest',
      'mistral-small-latest',
      'codestral-latest',
      'open-mistral-nemo',
    ],
    defaultEmbedModel: 'mistral-embed',
    embedModels: ['mistral-embed'],
    signupUrl: 'https://console.mistral.ai/api-keys/',
  },
  {
    id: 'ollama',
    label: 'Ollama (本地)',
    vendor: 'Local',
    icon: '🦙',
    kind: 'openai',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'qwen2.5-coder:7b',
    models: [
      'llama3.3',
      'llama3.2',
      'qwen2.5:7b',
      'qwen2.5:14b',
      'qwen2.5-coder:7b',
      'qwen2.5-coder:32b',
      'deepseek-r1:7b',
      'deepseek-r1:32b',
      'gemma2:9b',
      'mistral-nemo',
    ],
    defaultEmbedModel: 'nomic-embed-text',
    embedModels: ['nomic-embed-text', 'mxbai-embed-large', 'bge-m3'],
    notes: '本地模型；apiKey 随便填一个非空字符串即可（Ollama 不校验）',
  },
  {
    id: 'custom',
    label: '自定义 (Custom)',
    vendor: 'Any',
    icon: '🛠',
    kind: 'openai',
    baseUrl: '',
    defaultModel: '',
    models: [],
    notes: '任何 OpenAI / Anthropic 兼容的端点都可手动填',
  },
];

type Role = 'chat' | 'complete' | 'embed' | 'fast';
const ROLES: Role[] = ['chat', 'complete', 'embed', 'fast'];
const ROLE_DESC: Record<Role, string> = {
  chat: '对话 / Agent 主模型',
  complete: '补全（inline completion）',
  embed: 'Embedding（构建向量索引）',
  fast: '快速任务（commit msg / 路由器分流）',
};

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<'providers' | 'routing'>('providers');

  const refresh = async () => {
    const r = await fetch('/api/providers');
    setCfg(await r.json());
  };

  useEffect(() => {
    refresh();
  }, []);

  // Esc 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = async () => {
    if (!draft.name || !draft.baseUrl) return;
    setBusy(true);
    try {
      await fetch('/api/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editingId ? { id: editingId } : {}),
          name: draft.name,
          kind: draft.kind === 'auto' ? undefined : draft.kind,
          baseUrl: draft.baseUrl,
          apiKey: draft.apiKey || undefined,
          model: draft.model || undefined,
          embedModel: draft.embedModel || undefined,
        }),
      });
      setDraft(EMPTY_DRAFT);
      setEditingId(null);
      setSelectedPreset(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete provider profile?')) return;
    setBusy(true);
    try {
      await fetch(`/api/providers/${id}`, { method: 'DELETE' });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const setActive = async (role: Role, id: string) => {
    setBusy(true);
    try {
      await fetch('/api/providers/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, id: id || null }),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const setFallbacks = async (role: Role, ids: string[]) => {
    setBusy(true);
    try {
      await fetch('/api/providers/fallbacks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, ids }),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (p: ProfileView) => {
    setEditingId(p.id);
    // 找一下这条 profile 跟哪个预设最像（matching by baseUrl），把它的 model list 也带上
    const preset = PRESETS.find((x) => x.baseUrl && p.baseUrl && x.baseUrl === p.baseUrl);
    setSelectedPreset(preset?.id ?? 'custom');
    setDraft({
      id: p.id,
      name: p.name,
      kind: p.kind ?? 'auto',
      baseUrl: p.baseUrl,
      apiKey: '', // masked; user must re-enter to change
      model: p.model ?? '',
      embedModel: p.embedModel ?? '',
    });
    setTab('providers');
  };

  const applyPreset = (preset: Preset) => {
    setEditingId(null);
    setSelectedPreset(preset.id);
    setDraft({
      ...EMPTY_DRAFT,
      name: preset.label.replace(/\s*\(.*\)$/, ''),
      kind: preset.kind,
      baseUrl: preset.baseUrl,
      model: preset.defaultModel,
      embedModel: preset.defaultEmbedModel ?? '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setSelectedPreset(null);
    setDraft(EMPTY_DRAFT);
  };

  const testProfile = async (id: string) => {
    setTestResult((r) => ({ ...r, [id]: 'testing...' }));
    try {
      const resp = await fetch('/api/providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const j = await resp.json();
      if (j.ok) {
        setTestResult((r) => ({
          ...r,
          [id]: `✓ ${j.firstTokenMs}ms first / ${j.totalMs}ms total`,
        }));
      } else {
        setTestResult((r) => ({ ...r, [id]: `✗ ${j.error?.slice(0, 80) ?? 'failed'}` }));
      }
    } catch (e: any) {
      setTestResult((r) => ({ ...r, [id]: `✗ ${e?.message ?? 'error'}` }));
    }
  };

  const detectedKind = useMemo(() => {
    if (draft.kind !== 'auto') return draft.kind;
    return /\banthropic\.com\b/.test(draft.baseUrl) ? 'anthropic' : 'openai';
  }, [draft.kind, draft.baseUrl]);

  const currentPreset = useMemo(
    () => PRESETS.find((p) => p.id === selectedPreset),
    [selectedPreset],
  );

  return (
    <div className="settings-mask" onClick={onClose}>
      <div className="settings-dialog" onClick={(e) => e.stopPropagation()}>
        <header className="settings-head">
          <div className="settings-title">
            <span className="settings-icon">⚙️</span>
            <h3>Settings</h3>
            <span className="settings-sub">· LLM Providers</span>
          </div>
          <div className="settings-tabs">
            <button
              className={tab === 'providers' ? 'active' : ''}
              onClick={() => setTab('providers')}
            >
              Providers
            </button>
            <button
              className={tab === 'routing' ? 'active' : ''}
              onClick={() => setTab('routing')}
            >
              Routing
            </button>
          </div>
          <button className="settings-close" onClick={onClose} title="Close (Esc)">
            ×
          </button>
        </header>

        <div className="settings-body">
          {tab === 'providers' ? (
            <>
              {/* 左：已有 profile + 添加面板，右：预设卡片 */}
              <div className="settings-pane settings-pane-left">
                <section className="settings-section">
                  <div className="settings-section-head">
                    <h4>已配置的 Providers</h4>
                    <span className="settings-count">{cfg?.profiles.length ?? 0}</span>
                  </div>
                  <div className="profile-list">
                    {(!cfg || cfg.profiles.length === 0) && (
                      <div className="settings-empty">还没有配置任何 Provider，从右侧选一个预设开始 →</div>
                    )}
                    {cfg?.profiles.map((p) => {
                      const kindLabel = p.hash
                        ? 'fallback'
                        : p.kind ??
                          (/\banthropic\.com\b/.test(p.baseUrl)
                            ? 'anthropic (auto)'
                            : 'openai (auto)');
                      const isActive = Object.values(cfg.active).includes(p.id);
                      return (
                        <div
                          key={p.id}
                          className={`profile-card ${editingId === p.id ? 'editing' : ''} ${
                            isActive ? 'is-active' : ''
                          }`}
                        >
                          <div className="profile-card-head">
                            <div className="profile-card-title">
                              <span className="profile-card-name">{p.name}</span>
                              <span className={`badge badge-${p.hash ? 'fallback' : 'kind'}`}>
                                {kindLabel}
                              </span>
                              {isActive && <span className="badge badge-active">ACTIVE</span>}
                            </div>
                            {!p.hash && (
                              <div className="profile-card-actions">
                                <button onClick={() => testProfile(p.id)} title="Test connectivity">
                                  Test
                                </button>
                                <button onClick={() => startEdit(p)} title="Edit">
                                  Edit
                                </button>
                                <button
                                  onClick={() => remove(p.id)}
                                  className="danger"
                                  title="Delete"
                                >
                                  Del
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="profile-card-detail">
                            <span className="kv">
                              <span className="k">URL</span>
                              <span className="v">{p.baseUrl || '(no url)'}</span>
                            </span>
                            <span className="kv">
                              <span className="k">KEY</span>
                              <span className="v">{p.apiKey || '(none)'}</span>
                            </span>
                            <span className="kv">
                              <span className="k">CHAT</span>
                              <span className="v">{p.model || '-'}</span>
                            </span>
                            <span className="kv">
                              <span className="k">EMBED</span>
                              <span className="v">{p.embedModel || '-'}</span>
                            </span>
                          </div>
                          {testResult[p.id] && (
                            <div
                              className={`profile-test ${
                                testResult[p.id].startsWith('✓')
                                  ? 'ok'
                                  : testResult[p.id].startsWith('✗')
                                  ? 'err'
                                  : ''
                              }`}
                            >
                              {testResult[p.id]}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="settings-section">
                  <div className="settings-section-head">
                    <h4>{editingId ? `编辑 · ${draft.name}` : '添加 / 编辑 Provider'}</h4>
                    {currentPreset && (
                      <span className="settings-current-preset">
                        {currentPreset.icon} {currentPreset.label}
                      </span>
                    )}
                  </div>

                  {currentPreset?.notes && (
                    <div className="settings-tip">💡 {currentPreset.notes}</div>
                  )}

                  <div className="draft-form">
                    <Field label="Name">
                      <input
                        value={draft.name}
                        placeholder="e.g. DeepSeek Personal"
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      />
                    </Field>

                    <Field label="Protocol">
                      <select
                        value={draft.kind}
                        onChange={(e) =>
                          setDraft({ ...draft, kind: e.target.value as DraftState['kind'] })
                        }
                      >
                        <option value="auto">Auto-detect (by baseUrl)</option>
                        <option value="openai">OpenAI-compatible (/v1/chat/completions)</option>
                        <option value="anthropic">Anthropic Messages (/v1/messages)</option>
                      </select>
                      <small className="hint">→ resolved: {detectedKind}</small>
                    </Field>

                    <Field label="Base URL">
                      <input
                        value={draft.baseUrl}
                        placeholder="https://api.openai.com/v1"
                        onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
                      />
                    </Field>

                    <Field label="API Key">
                      <input
                        type="password"
                        value={draft.apiKey}
                        placeholder={editingId ? '(unchanged unless you type)' : 'sk-...'}
                        onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
                      />
                      {currentPreset?.signupUrl && (
                        <small className="hint">
                          没 key？{' '}
                          <a
                            href={currentPreset.signupUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="link"
                          >
                            申请 →
                          </a>
                        </small>
                      )}
                    </Field>

                    <Field label="Chat Model">
                      <input
                        list={`models-${selectedPreset ?? 'none'}`}
                        value={draft.model}
                        placeholder="deepseek-chat / gpt-4o-mini / ..."
                        onChange={(e) => setDraft({ ...draft, model: e.target.value })}
                      />
                      {currentPreset && currentPreset.models.length > 0 && (
                        <datalist id={`models-${selectedPreset}`}>
                          {currentPreset.models.map((m) => (
                            <option key={m} value={m} />
                          ))}
                        </datalist>
                      )}
                      {currentPreset && currentPreset.models.length > 0 && (
                        <div className="chip-row">
                          {currentPreset.models.slice(0, 6).map((m) => (
                            <button
                              key={m}
                              className={`chip ${draft.model === m ? 'active' : ''}`}
                              onClick={() => setDraft({ ...draft, model: m })}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                      )}
                    </Field>

                    <Field label="Embed Model">
                      <input
                        list={`embed-models-${selectedPreset ?? 'none'}`}
                        value={draft.embedModel}
                        placeholder="(可选；该 Provider 无 embedding 留空即可)"
                        onChange={(e) => setDraft({ ...draft, embedModel: e.target.value })}
                      />
                      {currentPreset?.embedModels && currentPreset.embedModels.length > 0 && (
                        <datalist id={`embed-models-${selectedPreset}`}>
                          {currentPreset.embedModels.map((m) => (
                            <option key={m} value={m} />
                          ))}
                        </datalist>
                      )}
                    </Field>

                    <div className="draft-actions">
                      <button
                        className="primary"
                        onClick={save}
                        disabled={busy || !draft.name || !draft.baseUrl}
                      >
                        {editingId ? '💾 保存修改' : '＋ 添加 Provider'}
                      </button>
                      <button onClick={cancelEdit}>取消</button>
                    </div>
                  </div>
                </section>
              </div>

              <div className="settings-pane settings-pane-right">
                <section className="settings-section">
                  <div className="settings-section-head">
                    <h4>选一个预设</h4>
                    <span className="settings-hint-inline">点击 → 自动填表单</span>
                  </div>
                  <div className="preset-grid">
                    {PRESETS.map((p) => (
                      <button
                        key={p.id}
                        className={`preset-card ${selectedPreset === p.id ? 'selected' : ''}`}
                        onClick={() => applyPreset(p)}
                      >
                        <div className="preset-icon">{p.icon}</div>
                        <div className="preset-label">{p.label}</div>
                        <div className="preset-vendor">{p.vendor}</div>
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            </>
          ) : (
            <div className="settings-pane settings-pane-full">
              <section className="settings-section">
                <div className="settings-section-head">
                  <h4>角色路由 (Active + Fallback)</h4>
                </div>
                <p className="settings-hint">
                  每个 role 指定一个主 Provider + 一组 fallback。当主 Provider 返回 429 / 5xx / 网络错误且
                  尚未流出任何 token 时，自动按顺序切到 fallback。
                </p>
                <div className="role-grid">
                  {ROLES.map((role) => (
                    <RoleRow
                      key={role}
                      role={role}
                      desc={ROLE_DESC[role]}
                      cfg={cfg}
                      busy={busy}
                      onActive={(id) => setActive(role, id)}
                      onFallbacks={(ids) => setFallbacks(role, ids)}
                    />
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="form-field">
      <span className="form-field-label">{label}</span>
      <div className="form-field-control">{children}</div>
    </label>
  );
}

/** 单个 role 的「Primary + Fallback chain」编辑行 */
function RoleRow({
  role,
  desc,
  cfg,
  busy,
  onActive,
  onFallbacks,
}: {
  role: Role;
  desc: string;
  cfg: Cfg | null;
  busy: boolean;
  onActive: (id: string) => void;
  onFallbacks: (ids: string[]) => void;
}) {
  const profiles = cfg?.profiles ?? [];
  const active = cfg?.active[role] ?? '';
  const fallbacks = cfg?.fallbacks?.[role] ?? [];
  const available = profiles.filter((p) => p.id !== active && !fallbacks.includes(p.id));

  return (
    <div className="role-card">
      <div className="role-card-head">
        <div className="role-name">{role.toUpperCase()}</div>
        <div className="role-desc">{desc}</div>
      </div>
      <div className="role-card-body">
        <div className="role-row">
          <span className="role-label">primary</span>
          <select value={active} onChange={(e) => onActive(e.target.value)} disabled={busy}>
            <option value="">(none)</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        {fallbacks.length > 0 && (
          <div className="role-row">
            <span className="role-label">fallbacks</span>
            <div className="chip-row">
              {fallbacks.map((id, idx) => {
                const p = profiles.find((x) => x.id === id);
                if (!p) return null;
                return (
                  <span key={id} className="chip chip-fallback">
                    {idx + 1}. {p.name}
                    <button
                      className="chip-x"
                      onClick={() => onFallbacks(fallbacks.filter((x) => x !== id))}
                      title="Remove"
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        )}
        {available.length > 0 && (
          <div className="role-row">
            <span className="role-label">+ add</span>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) onFallbacks([...fallbacks, e.target.value]);
              }}
              disabled={busy}
            >
              <option value="">(pick fallback…)</option>
              {available.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}