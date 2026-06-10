
/**
 * 全局 store (zustand)：编辑器/聊天/模式状态的"单一事实源"。
 *
 * 主要分区：
 *  - 文件树 + 多 tab + dirty/diff 状态
 *  - chat messages + agent/ask mode + running flag
 *  - mode 切换（monaco / vscode iframe）
 *
 * 服务端持久化：所有真实写盘动作走 /api 路由，store 只缓存 UI 状态。
 */
import { create } from 'zustand';

/**
 * 云端 API 基地址。
 * - 已登录 + VITE_CLOUD_API 已配置 → 返回云端 URL（带 credentials）
 * - 已登录 + 开发环境 → 使用 /cloud-api 代理
 * - 否则 → 返回空字符串（走本地 server）
 */
const CLOUD_API = (import.meta as any).env?.VITE_CLOUD_API ?? '';

function sessionApiBase(): string {
  const user = useStore.getState().authUser;
  if (user && !user.isAnonymous) {
    if (CLOUD_API) return CLOUD_API;
    return '/cloud-api';  // dev proxy → cloud server
  }
  return '';
}
export function sessionFetch(path: string, init?: RequestInit) {
  const base = sessionApiBase();
  return fetch(`${base}${path}`, {
    ...init,
    credentials: base ? 'include' : 'omit',
  });
}
/** Always routes to cloud (for auth endpoints that only exist on cloud server). */
export function cloudFetch(path: string, init?: RequestInit) {
  const base = CLOUD_API || '/cloud-api';
  return fetch(`${base}${path}`, {
    ...init,
    credentials: 'include',
  });
}

/** Pending: 待粘到 chat input 的内容（来自 editor 选区 / 文件树 "Add to Chat"） */
export interface PendingInputText { text: string; nonce: number; }


export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
}
export interface OpenTab {
  path: string;
  content: string;
  dirty: boolean;
  /** 若设置，则该 tab 渲染为 DiffEditor，对照 oldContent vs content */
  diffOld?: string | null;
  /** 关联的 pending edit id，用于 accept/reject */
  pendingEditId?: string;
  /** 未落盘的 untitled tab：path 是占位（如 untitled-1.ts），保存时弹原生 save dialog */
  isUntitled?: boolean;
  /** untitled tab 用于推断语言模式 */
  language?: string;
}
export interface ChatMsg {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  tool_call_id?: string;
  name?: string;
  /** 若关联 pending edit */
  pendingEditId?: string;
  pendingEditPath?: string;
  /** think tool 完整内容（前端折叠渲染用） */
  thinkFull?: string;
  isThink?: boolean;
  /** 工具链聚合：属于同一 turn 的工具调用 */
  _toolGroupId?: string;
  _toolRole?: 'call' | 'result';
  _toolName?: string;
  _toolArgs?: string;
  /** 思考计时（ms），由 frontend 计算填入 */
  _thinkingMs?: number;
  /** tool_result 里的图片数据（来自 read_image / screenshot tool 的 __image 字段） */
  _imageData?: { media_type: string; data: string };
  /** 用户消息附带的图片缩略图（粘贴/拖拽/上传） */
  _images?: Array<{ name: string; dataUrl: string }>;
  /** 用户实际输入的文字（不含 @file:xxx 等附件前缀和 <editor-context> 标签） */
  _displayText?: string;
  /** SSE mentions 事件的结构化数据（用于渲染 MentionTag） */
  _mentionItems?: Array<{ kind: string; label: string; path?: string }>;
}

interface State {
  workspace: string;
  indexReady: boolean;
  // file tree
  tree: FileEntry[];
  loadTree: (p?: string) => Promise<void>;
  /** bump this number to ask all TreeNodes to reload their children */
  treeVersion: number;
  bumpTree: () => void;
  /** which entry path is currently in inline-rename mode (used by FileTree) */
  renameTarget: string | null;
  setRenameTarget: (p: string | null) => void;
  // skills
  /** bump this number to ask ChatPanel to reload skill list */
  skillVersion: number;
  bumpSkills: () => void;
  // tabs
  tabs: OpenTab[];
  activeTab: string | null;
  openFile: (p: string) => Promise<void>;
  closeTab: (p: string) => void;
  updateTab: (p: string, content: string) => void;
  saveActive: () => Promise<void>;
  /** 创建一个 untitled tab（不落盘），用于 VSCode 风格 New File */
  createUntitled: (ext: string, template?: string) => void;
  /** 把当前 untitled tab 用 save dialog 落盘到选定路径 */
  saveAsActive: () => Promise<string | null>;
  /** 打开/更新一个 diff tab（来自 pending edit） */
  openDiffTab: (params: {
    path: string;
    oldContent: string | null;
    newContent: string;
    pendingEditId: string;
  }) => void;
  /** Accept/Reject 当前 active diff tab */
  acceptPending: (id: string) => Promise<void>;
  rejectPending: (id: string) => Promise<void>;
  // chat
  messages: ChatMsg[];
  pushMessage: (m: ChatMsg) => void;
  patchLastAssistant: (delta: string) => void;
  /** Update a message at a specific index (used for tool chain rendering) */
  patchMessageAt: (index: number, patch: Partial<ChatMsg>) => void;
  resetChat: () => void;
  mode: 'ask' | 'agent' | 'plan';
  setMode: (m: 'ask' | 'agent' | 'plan') => void;
  running: boolean;
  setRunning: (b: boolean) => void;
  // command palette
  paletteOpen: boolean;
  paletteInitial: string;
  togglePalette: (b?: boolean, initial?: string) => void;
  // 左侧活动栏当前打开的面板（null = 折叠，该列宽 0）
  sidebarView: 'explorer' | 'search' | 'git' | 'outline' | 'problems' | null;
  setSidebarView: (v: State['sidebarView']) => void;
  /** 最近打开过的 workspace 路径（存 localStorage） */
  recentWorkspaces: string[];
  pushRecentWorkspace: (p: string) => void;
  /** 跳转到指定行（被 EditorArea useEffect 消费） */
  revealTarget: { path: string; line: number; nonce: number } | null;
  revealLine: (path: string, line: number) => void;
  // Agent 任务计划（来自 update_plan tool 或 server 推送）
  plan: {
    items: Array<{
      id: string;
      content: string;
      status: 'pending' | 'in_progress' | 'completed';
      priority?: 'high' | 'medium' | 'low';
      parentId?: string;
      note?: string;
    }>;
    summary?: string;
  } | null;
  setPlan: (p: State['plan']) => void;
  // 上下文 / 用量统计（用于状态栏显示）
  contextStats: {
    contextWindow?: number;
    triggerTokens?: number;
    targetTokens?: number;
    beforeTokens?: number;
    afterTokens?: number;
    triggered?: boolean;
    stableTokens?: number;
    dynamicTokens?: number;
  } | null;
  setContextStats: (s: State['contextStats']) => void;
  usage: {
    promptTokens?: number;
    completionTokens?: number;
    cachedPromptTokens?: number;
  } | null;
  setUsage: (u: State['usage']) => void;
  // ---- Model / Provider ----
  selectedProfileId: string | null;  // null = auto-routing
  setSelectedProfileId: (id: string | null) => void;
  // ---- Subagents ----
  subagents: Array<{
    runId: string;
    label?: string;
    role?: string;
    task: string;
    status: 'running' | 'completed' | 'error' | 'timeout';
    startedAt: number;
    finishedAt?: number;
    result?: string;
    error?: string;
    /** Recent tool calls made by this subagent (for real-time progress) */
    recentTools?: Array<{ tool: string; resultPreview: string; ts: number }>;
  }>;
  upsertSubagent: (run: State['subagents'][number]) => void;
  clearSubagents: () => void;
  // ---- Sessions ----
  /** Resume 时由 store 写入，ChatPanel 监听并填充到 input */
  resumeDraft?: string;
  setResumeDraft: (s?: string) => void;
  sessionId: string | null;
  sessionList: {
    id: string;
    title: string;
    updatedAt: number;
    messageCount: number;
    interruptedTurn?: { turnId: string; userMessage: string; partialAssistant: string };
  }[];
  loadSessions: () => Promise<void>;
  createSession: (title?: string) => Promise<string>;
  switchSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  renameSession: (id: string, title: string) => Promise<void>;
  forkSession: (id: string, untilIndex: number) => Promise<string>;
  /** Resume：切换到指定 session 并自动发"continue"消息 */
  resumeSession: (id: string) => Promise<void>;
  /** 放弃续接（仅清掉 interruptedTurn 标记） */
  discardResume: (id: string) => Promise<void>;
  /** 让 ChatPanel 把这段文字 append 到 input（用于 Add-to-Chat） */
  pendingInput: PendingInputText | null;
  appendChatInput: (text: string) => void;
  /** Composer 上方的可视化上下文 chip */
  composerAttachments: Array<{
    id: string;
    kind: 'file' | 'folder' | 'selection' | 'symbol';
    label: string;
    path: string;
    line1?: number;
    line2?: number;
  }>;
  addAttachment: (a: { kind: 'file' | 'folder' | 'selection' | 'symbol'; path: string; line1?: number; line2?: number; label?: string }) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;
  // ─── 认证状态 ──────────────────────────────────────────
  authUser: { id: string; username?: string; name?: string; isAnonymous: boolean } | null;
  authChecked: boolean;  // 启动时是否已完成 auth 检查
  authModalOpen: boolean;
  checkAuth: () => Promise<void>;
  login: (username: string, password: string) => Promise<{ error?: string }>;
  register: (username: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  setAuthModalOpen: (open: boolean) => void;
  // ─── 高级设置（localStorage 持久化） ────────────────────
  advancedSettings: {
    /** 首帧等待超时（秒），0 = 不限制 */
    fetchTimeoutSec: number;
    /** 流中途 idle 超时（秒），0 = 不限制 */
    streamIdleTimeoutSec: number;
    /** 是否禁用超时（勾选后上面两个值不生效） */
    noTimeout: boolean;
  };
  setAdvancedSettings: (s: Partial<State['advancedSettings']>) => void;
}

export const useStore = create<State>((set, get) => ({
  workspace: '',
  indexReady: false,
  tree: [],
  treeVersion: 0,
  renameTarget: null,
  setRenameTarget(p) { set({ renameTarget: p }); },
  bumpTree() { set((s) => ({ treeVersion: s.treeVersion + 1 })); },
  skillVersion: 0,
  bumpSkills() { set((s) => ({ skillVersion: s.skillVersion + 1 })); },
  async loadTree(p = '.') {
    const r = await fetch(`/api/files?path=${encodeURIComponent(p)}`);
    const data = await r.json();
    set((s) => ({ tree: data, treeVersion: s.treeVersion + 1 }));
  },
  tabs: [],
  activeTab: null,
  async openFile(p) {
    const existing = get().tabs.find((t) => t.path === p);
    if (existing) {
      set({ activeTab: p });
      return;
    }
    const r = await fetch(`/api/file?path=${encodeURIComponent(p)}`);
    const data = await r.json();
    set((s) => ({
      tabs: [...s.tabs, { path: p, content: data.content ?? '', dirty: false }],
      activeTab: p,
    }));
  },
  closeTab(p) {
    set((s) => {
      const tabs = s.tabs.filter((t) => t.path !== p);
      return {
        tabs,
        activeTab: s.activeTab === p ? tabs[tabs.length - 1]?.path ?? null : s.activeTab,
      };
    });
  },
  updateTab(p, content) {
    set((s) => ({
      tabs: s.tabs.map((t) => (t.path === p ? { ...t, content, dirty: true } : t)),
    }));
  },
  async saveActive() {
    const tab = get().tabs.find((t) => t.path === get().activeTab);
    if (!tab) return;
    if (tab.isUntitled) { await get().saveAsActive(); return; }
    await fetch('/api/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: tab.path, content: tab.content }),
    });
    // 同步刷新 monaco TS extra lib（动态导入避免循环依赖）
    import('./monaco-setup').then((m) => m.refreshExtraLib(tab.path, tab.content));
    set((s) => ({ tabs: s.tabs.map((t) => (t.path === tab.path ? { ...t, dirty: false } : t)) }));
  },
  createUntitled(ext, template = '') {
    const used = new Set(get().tabs.map((t) => t.path));
    let n = 1;
    while (used.has(`untitled-${n}.${ext}`)) n++;
    const p = `untitled-${n}.${ext}`;
    set((s) => ({
      tabs: [...s.tabs, { path: p, content: template, dirty: true, isUntitled: true, language: ext }],
      activeTab: p,
    }));
  },
  async saveAsActive() {
    const tab = get().tabs.find((t) => t.path === get().activeTab);
    if (!tab) return null;
    const api = (window as any).electronAPI;
    if (!api?.saveFileDialog) {
      // Web fallback：让用户输入相对路径
      const rel = prompt('保存为（相对 workspace 路径）', tab.path);
      if (!rel) return null;
      await fetch('/api/file', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: rel, content: tab.content }),
      });
      set((s) => ({
        tabs: s.tabs.map((t) => (t.path === tab.path ? { path: rel, content: t.content, dirty: false } : t)),
        activeTab: rel,
      }));
      await get().loadTree('.');
      return rel;
    }
    const ws = get().workspace;
    const suggested = tab.isUntitled
      ? (ws ? `${ws}/${tab.path}` : tab.path)
      : (ws && !tab.path.startsWith('/') ? `${ws}/${tab.path}` : tab.path);
    const abs = await api.saveFileDialog({ title: 'Save File', defaultPath: suggested });
    if (!abs) return null;
    // 必须落在当前 workspace 下，否则提示用户先切 workspace
    if (!ws || !abs.startsWith(ws + '/')) {
      alert(`保存路径必须在当前 workspace 内：\n${ws}\n\n请改选 workspace 内的位置，或先用"打开..."切换 workspace。`);
      return null;
    }
    const rel = abs.slice(ws.length + 1);
    const r = await fetch('/api/file', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: rel, content: tab.content }),
    });
    if (!r.ok) { alert('保存失败：' + (await r.text())); return null; }    set((s) => ({
      tabs: s.tabs.map((t) => (t.path === tab.path
        ? { path: rel, content: t.content, dirty: false }
        : t)),
      activeTab: rel,
    }));
    await get().loadTree('.');
    return rel;
  },
  openDiffTab({ path, oldContent, newContent, pendingEditId }) {
    set((s) => {
      const exists = s.tabs.find((t) => t.path === path);
      const next: OpenTab = {
        path,
        content: newContent,
        dirty: false,
        diffOld: oldContent,
        pendingEditId,
      };
      const tabs = exists
        ? s.tabs.map((t) => (t.path === path ? next : t))
        : [...s.tabs, next];
      return { tabs, activeTab: path };
    });
  },
  async acceptPending(id) {
    await fetch(`/api/edits/${id}/accept`, { method: 'POST' });
    // accept 后从磁盘重新拉一次最新内容，并清除 diff/pendingEdit 状态
    const tab = get().tabs.find((t) => t.pendingEditId === id);
    if (tab) {
      const r = await fetch(`/api/file?path=${encodeURIComponent(tab.path)}`);
      const data = await r.json();
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.pendingEditId === id
            ? { path: t.path, content: data.content ?? '', dirty: false, diffOld: undefined, pendingEditId: undefined }
            : t,
        ),
      }));
    }
    // accept 后文件已落盘，刷新文件树（文件可能新建或目录结构改变）
    get().loadTree('.');
    get().bumpTree();
  },
  async rejectPending(id) {
    await fetch(`/api/edits/${id}/reject`, { method: 'POST' });
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.pendingEditId === id ? { ...t, diffOld: undefined, pendingEditId: undefined } : t,
      ),
    }));
  },
  messages: [],
  pushMessage(m) {
    set((s) => ({ messages: [...s.messages, m] }));
  },
  patchLastAssistant(delta) {
    set((s) => {
      const ms = [...s.messages];
      const last = ms[ms.length - 1];
      if (last && last.role === 'assistant') {
        ms[ms.length - 1] = { ...last, content: last.content + delta };
      } else {
        ms.push({ role: 'assistant', content: delta });
      }
      return { messages: ms };
    });
  },
  patchMessageAt(index, patch) {
    set((s) => {
      if (index < 0 || index >= s.messages.length) return s;
      const ms = [...s.messages];
      ms[index] = { ...ms[index], ...patch };
      return { messages: ms };
    });
  },
  resetChat() {
    set({ messages: [], plan: null, contextStats: null, usage: null });
  },
  mode: 'agent',
  setMode(m) {
    set({ mode: m });
  },
  running: false,
  setRunning(b) {
    set({ running: b });
  },
  paletteOpen: false,
  paletteInitial: '',
  togglePalette(b, initial) {
    set((s) => ({
      paletteOpen: b ?? !s.paletteOpen,
      paletteInitial: typeof initial === 'string' ? initial : '',
    }));
  },
  sidebarView: 'explorer',
  setSidebarView(v) { set({ sidebarView: v }); },
  recentWorkspaces: (() => {
    try {
      const raw = localStorage.getItem('mci.recentWorkspaces');
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string').slice(0, 8) : [];
    } catch { return []; }
  })(),
  pushRecentWorkspace(p) {
    if (!p) return;
    set((s) => {
      const arr = [p, ...s.recentWorkspaces.filter((x) => x !== p)].slice(0, 8);
      try { localStorage.setItem('mci.recentWorkspaces', JSON.stringify(arr)); } catch {}
      return { recentWorkspaces: arr };
    });
  },
  revealTarget: null,
  revealLine(path, line) {
    set({ revealTarget: { path, line, nonce: Date.now() } });
  },
  plan: null,
  setPlan(p) {
    set({ plan: p });
  },
  contextStats: null,
  setContextStats(s) {
    set({ contextStats: s });
  },
  usage: null,
  setUsage(u) {
    set({ usage: u });
  },
  // ---- Model / Provider ----
  selectedProfileId: null,
  setSelectedProfileId(id) { set({ selectedProfileId: id }); },
  // ---- Subagents ----
  subagents: [],
  upsertSubagent(run) {
    set((state) => {
      const idx = state.subagents.findIndex((s) => s.runId === run.runId);
      if (idx >= 0) {
        const next = [...state.subagents];
        // Merge recentTools: append new entries from run, keep existing
        const existingTools = next[idx].recentTools ?? [];
        const newTools = run.recentTools ?? [];
        next[idx] = { ...next[idx], ...run, recentTools: [...existingTools, ...newTools].slice(-10) };
        return { subagents: next };
      }
      return { subagents: [...state.subagents, { ...run, recentTools: run.recentTools ?? [] }] };
    });
  },
  clearSubagents() {
    set({ subagents: [] });
  },
  resumeDraft: undefined,
  setResumeDraft(s) {
    set({ resumeDraft: s });
  },
  sessionId: null,
  sessionList: [],
  async loadSessions() {
    try {
      const r = await sessionFetch('/api/sessions');
      const list = await r.json();
      set({ sessionList: list });
    } catch {
      /* */
    }
  },
  async createSession(title) {
    const r = await sessionFetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    const meta = await r.json();
    set({
      sessionId: meta.id,
      plan: null,
      contextStats: null,
      usage: null,
    });
    await get().loadSessions();
    return meta.id;
  },
  async switchSession(id) {
    const r = await sessionFetch(`/api/sessions/${id}`);
    if (!r.ok) return;
    const data = await r.json();
    set({
      sessionId: id,
      messages: (data.messages ?? []).map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
      plan: null,
      contextStats: null,
      usage: null,
    });
  },
  async deleteSession(id) {
    await sessionFetch(`/api/sessions/${id}`, { method: 'DELETE' });
    if (get().sessionId === id) {
      set({ sessionId: null, messages: [] });
    }
    await get().loadSessions();
  },
  async renameSession(id, title) {
    await sessionFetch(`/api/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    await get().loadSessions();
  },
  async forkSession(id, untilIndex) {
    const r = await sessionFetch(`/api/sessions/${id}/fork`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ untilIndex }),
    });
    const meta = await r.json();
    await get().loadSessions();
    return meta.id;
  },
  /**
   * Resume：
   *  1. 拉 resume-info 得到 partialAssistant + originalUserMessage + suggestedResumePrompt
   *  2. switch 到该 session（载入已落盘 messages）
   *  3. 把 partial 拼成一条灰色 assistant 消息插进去给用户预览
   *  4. 把 suggestedResumePrompt 塞进 chat input（让用户决定是否直接发出）
   *
   * 注意：不强制自动发，给用户最后一刻 review 的机会。
   */
  async resumeSession(id) {
    const r = await sessionFetch(`/api/sessions/${id}/resume-info`);
    if (!r.ok) return;
    const info = await r.json();
    if (!info.interrupted) {
      // 没断点就当普通 switch
      await get().switchSession(id);
      return;
    }
    // 载入已落盘 messages
    const histResp = await sessionFetch(`/api/sessions/${id}`);
    const data = await histResp.json();
    const messages = (data.messages ?? []).map((m: any) => ({
      role: m.role,
      content: m.content,
    }));
    // 把 partial 作为最后一条灰色 assistant 显示（标记 interrupted 由 UI 处理）
    if (info.partialAssistant?.trim()) {
      messages.push({
        role: 'assistant' as const,
        content: info.partialAssistant + '\n\n_[⏸ interrupted — click Continue to resume]_',
      });
    }
    set({
      sessionId: id,
      messages,
      plan: null,
      contextStats: null,
      usage: null,
      // resumeDraft 给 ChatPanel 用：自动填到 input
      resumeDraft: info.suggestedResumePrompt as string,
    } as any);
  },
  async discardResume(id) {
    await sessionFetch(`/api/sessions/${id}/resume-discard`, { method: 'POST' });
    await get().loadSessions();
  },
  pendingInput: null,
  appendChatInput(text) {
    // 解析 @file:path / @folder:path / @selection:path:l1-l2 / @symbol:name
    // 命中 → 转成 chip；其余原样塞回输入框
    const re = /@(file|folder|selection|symbol):([^\s]+)/g;
    let m: RegExpExecArray | null;
    let consumed = false;
    while ((m = re.exec(text)) !== null) {
      const kind = m[1] as 'file' | 'folder' | 'selection' | 'symbol';
      const raw = m[2];
      if (kind === 'selection') {
        const mm = raw.match(/^(.+):(\d+)-(\d+)$/);
        if (mm) {
          get().addAttachment({
            kind,
            path: mm[1],
            line1: Number(mm[2]),
            line2: Number(mm[3]),
            label: `${mm[1].split('/').pop()}:${mm[2]}-${mm[3]}`,
          });
          consumed = true;
          continue;
        }
      }
      get().addAttachment({ kind, path: raw, label: raw.split('/').pop() ?? raw });
      consumed = true;
    }
    const rest = text.replace(re, '').replace(/\s+/g, ' ').trim();
    if (rest || !consumed) {
      set({ pendingInput: { text: consumed ? rest : text, nonce: Date.now() } });
    }
  },
  composerAttachments: [],
  addAttachment(a) {
    const id = `${a.kind}:${a.path}${a.line1 ? `:${a.line1}-${a.line2}` : ''}`;
    set((s) => {
      if (s.composerAttachments.some((x) => x.id === id)) return s;
      const label = a.label ?? a.path.split('/').pop() ?? a.path;
      return {
        composerAttachments: [
          ...s.composerAttachments,
          { id, kind: a.kind, label, path: a.path, line1: a.line1, line2: a.line2 },
        ],
      };
    });
  },
  removeAttachment(id) {
    set((s) => ({ composerAttachments: s.composerAttachments.filter((x) => x.id !== id) }));
  },
  clearAttachments() {
    set({ composerAttachments: [] });
  },
  // ─── 认证 ──────────────────────────────────────────────
  authUser: null,
  authChecked: false,
  authModalOpen: false,
  setAuthModalOpen(open) { set({ authModalOpen: open }); },
  async checkAuth() {
    try {
      const r = await cloudFetch('/api/auth/me');
      if (r.ok) {
        const data = await r.json();
        const user = { id: data.userId, username: data.username, name: data.name, isAnonymous: data.isAnonymous ?? !data.username };
        set({ authUser: user, authChecked: true });
        // 已登录用户 → 启动时拉取云端会话
        if (!user.isAnonymous) {
          get().loadSessions().catch(() => {});
        }
      } else {
        set({ authUser: null, authChecked: true });
      }
    } catch {
      set({ authUser: null, authChecked: true });
    }
  },
  async login(username, password) {
    try {
      const r = await cloudFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await r.json();
      if (!r.ok) return { error: data.error || '登录失败' };
      set({ authUser: { id: data.user.id, username: data.user.username, name: data.user.name, isAnonymous: false }, authModalOpen: false });
      // 登录后拉取云端会话列表
      get().loadSessions().catch(() => {});
      return {};
    } catch { return { error: '网络错误' }; }
  },
  async register(username, password) {
    try {
      const r = await cloudFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await r.json();
      if (!r.ok) return { error: data.error || '注册失败' };
      set({ authUser: { id: data.user.id, username: data.user.username, name: data.user.name, isAnonymous: false }, authModalOpen: false });
      // 注册后拉取云端会话列表
      get().loadSessions().catch(() => {});
      return {};
    } catch { return { error: '网络错误' }; }
  },
  async logout() {
    try { await cloudFetch('/api/auth/logout', { method: 'DELETE' }); } catch {}
    set({ authUser: null });
    // 登出后切回本地会话列表
    get().loadSessions().catch(() => {});
  },
  // ─── 高级设置 ──────────────────────────────────────────
  advancedSettings: (() => {
    try {
      const raw = localStorage.getItem('mci.advancedSettings');
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          fetchTimeoutSec: parsed.fetchTimeoutSec ?? 300,
          streamIdleTimeoutSec: parsed.streamIdleTimeoutSec ?? 120,
          noTimeout: parsed.noTimeout ?? false,
        };
      }
    } catch { /* */ }
    return { fetchTimeoutSec: 300, streamIdleTimeoutSec: 120, noTimeout: false };
  })(),
  setAdvancedSettings(patch) {
    set((s) => {
      const next = { ...s.advancedSettings, ...patch };
      try { localStorage.setItem('mci.advancedSettings', JSON.stringify(next)); } catch {}
      return { advancedSettings: next };
    });
  },
}));