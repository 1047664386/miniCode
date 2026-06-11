
/**
 * Agents Window — 独立 zustand store
 * ---------------------------------------------------------------
 * 不复用主 IDE 的 store，避免主 IDE 切 workspace 影响这里。
 *
 * 关键设计：
 *  - workspaceRoot 是 Agents Window 自己的"工作区"概念，**完全独立** 于主 IDE
 *    打开的目录。切换它只影响 /api/agents/* 的查询参数，不会触发主进程
 *    `s.switchWorkspace`。这样主 IDE 在干自己的事，Agents Window 也能在
 *    另一个仓库里聊天而互不干扰。
 *  - recentWorkspaces 持久化在 localStorage（key = mci.agents.recentWs）
 *  - openFiles / previewFile 控制中间可关闭代码预览面板
 */
import { create } from 'zustand';

export type AgentsMode = 'agent' | 'ask' | 'plan';

const RECENT_KEY = 'mci.agents.recentWs';
const RECENT_MAX = 8;

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
function saveRecent(arr: string[]) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(arr.slice(0, RECENT_MAX))); } catch { /* ignore */ }
}

export interface ChatAttachment {
  name: string;
  size: number;
  type: string;
  dataUrl?: string;
  text?: string;
  wsPath?: string;
  /** 选区起始行（1-indexed）；不在时表示整文件 */
  line1?: number;
  /** 选区结束行（1-indexed，含） */
  line2?: number;
}

export interface SessionMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  mode?: AgentsMode;
  workspaceRoot?: string;
  remoteUser?: string;
}

interface State {
  // ---- 模式 / 工作区 ----
  mode: AgentsMode;
  workspaceRoot: string | null;        // 当前选中的工作区（绝对路径）
  branch: string | null;                // 当前 git 分支（null = 非 git 仓库 / 未加载）
  recentWorkspaces: string[];           // 最近打开过的工作区，最新在前

  // ---- 会话 ----
  activeSessionId: string | null;
  sessions: SessionMeta[];
  loading: boolean;

  // ---- 待发附件（从右侧面板 / 预览 “添加到对话” 注入给 AgentsMain）----
  pendingAttachments: ChatAttachment[];
  attachWorkspaceFile(relPath: string): Promise<void>;
  /** 将文件的某段选区作为附件，1-indexed，含起止 */
  attachWorkspaceSelection(relPath: string, line1: number, line2: number, text: string): void;
  removePendingAttachment(idx: number): void;
  clearPendingAttachments(): void;

  // ---- 中间预览面板 ----
  /** 已打开的文件 path（相对 workspaceRoot），按 tab 顺序 */
  openFiles: string[];
  /** 当前激活的预览文件（null = 关闭中间面板） */
  previewFile: string | null;

  // ---- 操作 ----
  setMode(m: AgentsMode): void;
  setActiveSession(id: string | null): void;
  loadSessions(): Promise<void>;
  createSession(title?: string): Promise<SessionMeta>;
  deleteSession(id: string): Promise<void>;
  loadCurrentWorkspace(): Promise<void>;          // 启动时拿主 IDE workspace 当默认
  setWorkspace(absPath: string): Promise<void>;   // 显式切换 Agents 自己的工作区
  refreshBranch(): Promise<void>;

  openFile(relPath: string): void;                // 加 tab + 设为 preview
  closeFile(relPath: string): void;
  setPreviewFile(relPath: string | null): void;   // null = 关闭中间面板
  closePreview(): void;

  // ---- 沙箱 dirty 标记（用于 beforeunload 警告） ----
  /** 沙箱里有未导出的改动？设为 true 时浏览器关闭/刷新会弹原生确认框。 */
  sandboxDirty: boolean;
  setSandboxDirty(v: boolean): void;

  // ---- Git 变更状态（文件树徽章 + Changes 面板共享） ----
  /** path → 'M'|'A'|'D'|'??'|'R' 等。null = 还没拉过 */
  gitStatus: Record<string, string> | null;
  /** 触发拉一次 git status；防抖在调用方控制 */
  refreshGitStatus(): Promise<void>;

  // ---- 模型选择 ----
  selectedProfileId: string | null;  // null = auto-routing
  providerProfiles: Array<{ id: string; name: string; model?: string }>;
  setSelectedProfileId(id: string | null): void;
  loadProviderProfiles(): Promise<void>;
  handleModelSelect(profileId: string | null): void;
}

export const useAgentsStore = create<State>((set, get) => ({
  mode: 'agent',
  workspaceRoot: null,
  branch: null,
  recentWorkspaces: loadRecent(),
  activeSessionId: null,
  sessions: [],
  loading: false,
  openFiles: [],
  previewFile: null,
  pendingAttachments: [],

  setMode(m) {
    set({ mode: m });
    void get().loadSessions();
  },

  setActiveSession(id) {
    if (!id) { set({ activeSessionId: null }); return; }
    // 如果会话带了 workspaceRoot 且与当前不一致 → 静默切换 workspace（不清附件）
    const sess = get().sessions.find((s) => s.id === id);
    if (sess?.workspaceRoot && sess.workspaceRoot !== get().workspaceRoot) {
      const recent = [sess.workspaceRoot, ...get().recentWorkspaces.filter((p) => p !== sess.workspaceRoot)].slice(0, RECENT_MAX);
      saveRecent(recent);
      set({
        workspaceRoot: sess.workspaceRoot,
        recentWorkspaces: recent,
        openFiles: [],
        previewFile: null,
        branch: null,
        activeSessionId: id,
      });
      void get().refreshBranch();
    } else {
      set({ activeSessionId: id });
    }
  },

  async loadSessions() {
    set({ loading: true });
    try {
      // 不按 mode 过滤 —— 历史列表统一展示所有会话（对齐 Cursor/Claude Code 设计）
      // mode 只影响新建会话的默认值和 composer 行为，不作为会话分类维度
      const r = await fetch('/api/sessions');
      const list: SessionMeta[] = r.ok ? await r.json() : [];
      set({ sessions: list, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  async createSession(title?: string) {
    const { mode, workspaceRoot } = get();
    const r = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title,
        mode: mode === 'ask' ? 'work' : 'code',
        workspaceRoot: mode !== 'ask' ? workspaceRoot ?? undefined : undefined,
      }),
    });
    const meta: SessionMeta = await r.json();
    await get().loadSessions();
    set({ activeSessionId: meta.id });
    return meta;
  },

  async deleteSession(id) {
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' }).catch(() => undefined);
    if (get().activeSessionId === id) {
      set({ activeSessionId: null });
      get().clearPendingAttachments();
    }
    await get().loadSessions();
  },

  async loadCurrentWorkspace() {
    if (get().workspaceRoot) return;
    try {
      const r = await fetch('/api/workspace');
      if (!r.ok) return;
      const j = await r.json();
      if (j?.path) {
        set({ workspaceRoot: j.path });
        await get().refreshBranch();
      }
    } catch { /* ignore */ }
  },

  async setWorkspace(absPath) {
    const next = absPath;
    const recent = [next, ...get().recentWorkspaces.filter((p) => p !== next)].slice(0, RECENT_MAX);
    saveRecent(recent);
    set({
      workspaceRoot: next,
      recentWorkspaces: recent,
      // 切换工作区 → 重置上下文：会话、附件、已打开文件 / 预览
      activeSessionId: null,
      pendingAttachments: [],
      openFiles: [],
      previewFile: null,
      branch: null,
    });
    await get().refreshBranch();
    await get().loadSessions();
  },

  async refreshBranch() {
    const ws = get().workspaceRoot;
    if (!ws) { set({ branch: null }); return; }
    try {
      const r = await fetch(`/api/agents/git/branch?ws=${encodeURIComponent(ws)}`);
      if (!r.ok) { set({ branch: null }); return; }
      const j = await r.json();
      set({ branch: j?.isRepo ? (j.branch || null) : null });
    } catch {
      set({ branch: null });
    }
  },

  openFile(rel) {
    set((s) => ({
      openFiles: s.openFiles.includes(rel) ? s.openFiles : [...s.openFiles, rel],
      previewFile: rel,
    }));
  },

  closeFile(rel) {
    set((s) => {
      const next = s.openFiles.filter((p) => p !== rel);
      const previewFile =
        s.previewFile === rel
          ? next.length > 0
            ? next[next.length - 1]
            : null
          : s.previewFile;
      return { openFiles: next, previewFile };
    });
  },

  setPreviewFile(rel) {
    set({ previewFile: rel });
  },

  closePreview() {
    set({ previewFile: null });
  },

  // ---- 沙箱 dirty ----
  sandboxDirty: false,
  setSandboxDirty(v) { set({ sandboxDirty: !!v }); },

  // ---- Git 状态 ----
  gitStatus: null,
  async refreshGitStatus() {
    try {
      const r = await fetch('/api/agents/git/status');
      if (!r.ok) { set({ gitStatus: {} }); return; }
      const j = await r.json();
      const map: Record<string, string> = {};
      if (j?.isRepo && Array.isArray(j.changes)) {
        for (const c of j.changes) {
          if (c?.path) map[c.path] = c.status;
        }
      }
      set({ gitStatus: map });
      // 顺手联动 dirty
      if (j?.isRepo) {
        set({ sandboxDirty: Object.keys(map).length > 0 });
      }
    } catch {
      set({ gitStatus: {} });
    }
  },

  /** 将工作区里一个文件作为附件加入待发送列表 */
  async attachWorkspaceFile(relPath) {
    const ws = get().workspaceRoot;
    if (!ws) return;
    // 已存在（全文件身份，无选区）→ 去重
    if (get().pendingAttachments.some((a) => a.wsPath === relPath && !a.line1)) return;
    try {
      const r = await fetch(
        `/api/agents/file?ws=${encodeURIComponent(ws)}&path=${encodeURIComponent(relPath)}`,
      );
      if (!r.ok) return;
      const j = await r.json();
      const name = relPath.split('/').pop() ?? relPath;
      const att: ChatAttachment = {
        name,
        size: j?.size ?? (j?.content?.length ?? 0),
        type: 'text/plain',
        text: typeof j?.content === 'string' ? j.content : '',
        wsPath: relPath,
      };
      set((s) => ({ pendingAttachments: [...s.pendingAttachments, att] }));
    } catch {
      /* ignore */
    }
  },
  attachWorkspaceSelection(relPath, line1, line2, text) {
    const name = relPath.split('/').pop() ?? relPath;
    // 同范围已在 → 去重
    if (
      get().pendingAttachments.some(
        (a) => a.wsPath === relPath && a.line1 === line1 && a.line2 === line2,
      )
    ) return;
    const att: ChatAttachment = {
      name,
      size: text.length,
      type: 'text/plain',
      text,
      wsPath: relPath,
      line1,
      line2,
    };
    set((s) => ({ pendingAttachments: [...s.pendingAttachments, att] }));
  },
  removePendingAttachment(idx) {
    set((s) => ({ pendingAttachments: s.pendingAttachments.filter((_, i) => i !== idx) }));
  },
  clearPendingAttachments() {
    set({ pendingAttachments: [] });
  },

  // ---- 模型选择 ----
  selectedProfileId: null,
  providerProfiles: [],
  setSelectedProfileId(id) { set({ selectedProfileId: id }); },
  async loadProviderProfiles() {
    try {
      const r = await fetch('/api/providers');
      if (!r.ok) return;
      const data = await r.json();
      const profiles = (data?.profiles ?? []).filter((p: any) => !p.hash);
      const mapped = profiles.map((p: any) => ({ id: p.id, name: p.name, model: p.model }));
      // 验证 active ID 确实存在于 profiles 列表中（防止 cloud 侧的 stale ID）
      const activeId: string | null = data?.active?.chat ?? null;
      const validActive = activeId && mapped.some((p: { id: string }) => p.id === activeId) ? activeId : null;
      set({
        providerProfiles: mapped,
        selectedProfileId: validActive,
      });
    } catch { /* ignore */ }
  },
  handleModelSelect(profileId) {
    const targetId = (profileId === get().selectedProfileId) ? null : profileId;
    fetch('/api/providers/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'chat', id: targetId }),
    }).then(() => {
      void get().loadProviderProfiles();
      window.dispatchEvent(new Event('providers-changed'));
    }).catch(() => {});
  },
}));