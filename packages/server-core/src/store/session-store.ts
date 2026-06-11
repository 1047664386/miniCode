
/**
 * SessionStore —— 多会话持久化（含 Resume 能力）。
 *
 * 目标：刷新页面 / 重启 server / Agent 跑到一半 crash 都不丢历史；并能续接。
 *
 * 存储格式（每个 session 一个 jsonl 文件，append-only）：
 *   .minicodeide/sessions/<id>.jsonl
 *
 *   {"t":"meta","title":"...","createdAt":...,"updatedAt":...}
 *   {"t":"msg","role":"user","content":"...","ts":...}
 *
 *   --- Resume 相关（增量落盘流式 assistant 输出） ---
 *   {"t":"turn_start","turnId":"t_xxx","userMessage":"...","ts":...}
 *   {"t":"chunk","turnId":"t_xxx","delta":"...","ts":...}     (重复 N 条)
 *   {"t":"tool","turnId":"t_xxx","name":"read_file","args":{...},"result":...}
 *   {"t":"turn_end","turnId":"t_xxx","finalText":"...","ts":...}
 *
 *   崩溃场景：最后一条 turn_start 后没有 turn_end → 标记 interruptedTurn
 *
 * 设计权衡：
 *  - jsonl 而非 SQLite：append-only 友好、坏一行不影响其他、人类可读、git diff 友好
 *  - chunk 事件 fsync 否：默认 no（性能优先），可通过 SESSION_FSYNC=1 打开
 *  - 同一 turn 的 chunks 在内存 reduce 成 partial 文本，方便前端展示"上次写到这里"
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

export type SessionMode = 'work' | 'code';

export interface SessionMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  /** Agents Window 模式：work=轻量聊天，code=完整编码（默认 code，向后兼容） */
  mode?: SessionMode;
  /** mode='code' 时绑定的 workspace 绝对路径（快照） */
  workspaceRoot?: string;
  /** 由微信遥控通道创建的 session 才有，等于发起者 wxid */
  remoteUser?: string;
  /** 若上一轮 assistant 没正常 turn_end，记下 turnId / partial 文本，前端可提示「继续」 */
  interruptedTurn?: {
    turnId: string;
    userMessage: string;
    partialAssistant: string;
    startedAt: number;
  };
}

export interface SessionMessage {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  ts: number;
  /** 工具调用元数据（可选） */
  toolName?: string;
  /** Pending edit 关联（可选） */
  pendingEditId?: string;
  pendingEditPath?: string;
  /** 前端渲染元数据（可选），如 _toolRole, _toolArgs, _thinkingMs, thinkFull 等 */
  uiMeta?: Record<string, unknown>;
}

interface InMemorySession {
  meta: SessionMeta;
  messages: SessionMessage[];
  /** 当前正在进行（或最后一次未结束）的 turn 的累积 partial */
  pendingTurn?: { turnId: string; userMessage: string; partialAssistant: string; startedAt: number };
}

/**
 * SessionLock —— 同一 Session 的写操作互斥锁。
 *
 * 用 Promise 链实现串行队列：每次 acquire 等待上一个 release 后才放行。
 * 确保同一 session 的 turn 生命周期（startTurn → appendChunk → endTurn）
 * 和消息 append 不会并发交叉。
 *
 * 用法：
 *   const release = await lock.acquire(sessionId);
 *   try { ... } finally { release(); }
 */
export class SessionLock {
  private chains = new Map<string, Promise<void>>();

  async acquire(sessionId: string): Promise<() => void> {
    const prev = this.chains.get(sessionId) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((resolve) => { release = resolve; });
    this.chains.set(sessionId, next);
    await prev;
    return () => {
      release();
      // 清理：仅当 Map 中仍指向本次的 Promise 时才删除，
      // 避免清理掉后续 acquire 已经 set 的新 entry。
      if (this.chains.get(sessionId) === next) {
        this.chains.delete(sessionId);
      }
    };
  }

  /** 检查某个 session 是否正在被锁定（用于快速判断，不阻塞） */
  isLocked(sessionId: string): boolean {
    return this.chains.has(sessionId);
  }
}

export class SessionStore {
  private dir: string;
  /** session id → 内存缓存（避免每次 list 都扫盘） */
  private cache = new Map<string, InMemorySession>();
  private loaded = false;
  /** 并发锁：确保同一 session 的 turn 生命周期不会交叉 */
  public readonly lock = new SessionLock();

  constructor(workspace: string) {
    this.dir = path.join(workspace, '.minicodeide', 'sessions');
  }

  /** 启动时加载所有 session（jsonl 文件），并对老数据自动补全 mode 字段 */
  async load() {
    if (this.loaded) return;
    await fs.mkdir(this.dir, { recursive: true });
    const files = await fs.readdir(this.dir);
    for (const f of files) {
      if (!f.endsWith('.jsonl')) continue;
      const id = f.replace(/\.jsonl$/, '');
      try {
        const sess = await this.readJsonl(id);
        if (sess) {
          // 旧数据迁移：没有 mode 字段 → 默认 code + 当前 workspace
          if (!sess.meta.mode) {
            sess.meta.mode = 'code';
            // workspaceRoot 不补，留空表示"未绑定"，handler 用时 fallback 到当前 workspace
          }
          this.cache.set(id, sess);
        }
      } catch {
        /* 坏文件跳过 */
      }
    }
    this.loaded = true;
  }

  list(): SessionMeta[] {
    return [...this.cache.values()]
      .map((s) => {
        // 只统计 user + assistant 消息作为"对话条数"，排除 tool/system 消息
        const messageCount = s.messages.filter((m) => m.role === 'user' || m.role === 'assistant').length;
        // 若 title 仍是默认且已有 user 消息，自动推断标题
        let title = s.meta.title;
        if ((title === 'New chat' || title === 'Untitled') && messageCount > 0) {
          const firstUser = s.messages.find((m) => m.role === 'user');
          if (firstUser?.content.trim()) {
            const raw = firstUser.content.trim().slice(0, 20);
            title = raw.length >= 20 ? raw + '…' : raw;
          }
        }
        return { ...s.meta, title, messageCount };
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  get(id: string): InMemorySession | undefined {
    return this.cache.get(id);
  }

  /**
   * 获取或重建 session（容错用）。
   * 如果 session 不在内存缓存中，尝试从 JSONL 文件恢复；
   * 若磁盘也没有，则创建一个空 session（保证后续 append 不会失败）。
   */
  async getOrCreate(id: string, opts?: { mode?: SessionMode; workspaceRoot?: string }): Promise<InMemorySession> {
    const cached = this.cache.get(id);
    if (cached) return cached;
    // 尝试从磁盘恢复
    try {
      const restored = await this.readJsonl(id);
      if (restored) {
        if (!restored.meta.mode) restored.meta.mode = 'code';
        this.cache.set(id, restored);
        return restored;
      }
    } catch { /* 读取失败则继续创建 */ }
    // 磁盘也没有 → 用指定 id 创建空 session
    const now = Date.now();
    const meta: SessionMeta = {
      id,
      title: 'New chat',
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      mode: opts?.mode ?? 'code',
      workspaceRoot: opts?.workspaceRoot,
    };
    const sess: InMemorySession = { meta, messages: [] };
    this.cache.set(id, sess);
    await this.appendLine(id, { t: 'meta', ...meta });
    return sess;
  }

  async create(
    titleOrOpts?: string | { title?: string; mode?: SessionMode; workspaceRoot?: string; remoteUser?: string },
  ): Promise<SessionMeta> {
    const opts = typeof titleOrOpts === 'string' ? { title: titleOrOpts } : (titleOrOpts ?? {});
    const id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();
    const meta: SessionMeta = {
      id,
      title: opts.title?.trim() || 'New chat',
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      mode: opts.mode ?? 'code',
      workspaceRoot: opts.workspaceRoot,
      remoteUser: opts.remoteUser,
    };
    const sess: InMemorySession = { meta, messages: [] };
    this.cache.set(id, sess);
    await this.appendLine(id, { t: 'meta', ...meta });
    return meta;
  }

  /** Remote 通道：按 wxUserId 找/建 session（一个 wxUser 默认一个 active session） */
  async findOrCreateForRemote(
    wxUserId: string,
    opts: { title?: string; workspace?: string } = {},
  ): Promise<SessionMeta> {
    const found = [...this.cache.values()]
      .filter((s) => s.meta.remoteUser === wxUserId)
      .sort((a, b) => b.meta.updatedAt - a.meta.updatedAt)[0];
    if (found) return found.meta;
    return this.create({
      title: opts.title ?? `WeChat: ${wxUserId.slice(0, 8)}`,
      mode: 'code',
      workspaceRoot: opts.workspace,
      remoteUser: wxUserId,
    });
  }

  /** 追加一条消息；自动设置 title（首条 user 消息的前 20 字符） */
  async append(id: string, msg: Omit<SessionMessage, 'ts'> & { ts?: number }): Promise<void> {
    const sess = this.cache.get(id);
    if (!sess) throw new Error(`Session not found: ${id}`);
    const fullMsg: SessionMessage = { ...msg, ts: msg.ts ?? Date.now() };
    sess.messages.push(fullMsg);
    sess.meta.updatedAt = fullMsg.ts;
    sess.meta.messageCount = sess.messages.length;

    // 首条 user 消息 → 取前 20 字符用作标题（超长补 …）
    if (sess.meta.title === 'New chat' && msg.role === 'user' && msg.content.trim()) {
      const raw = msg.content.trim().slice(0, 20);
      sess.meta.title = raw.length >= 20 ? raw + '…' : raw;
      await this.appendLine(id, { t: 'meta', ...sess.meta });
    }

    await this.appendLine(id, { t: 'msg', ...fullMsg });
  }

  async rename(id: string, title: string): Promise<SessionMeta> {
    const sess = this.cache.get(id);
    if (!sess) throw new Error(`Session not found: ${id}`);
    sess.meta.title = title.slice(0, 80) || sess.meta.title;
    sess.meta.updatedAt = Date.now();
    await this.appendLine(id, { t: 'meta', ...sess.meta });
    return sess.meta;
  }

  async delete(id: string): Promise<void> {
    if (!this.cache.has(id)) return;
    this.cache.delete(id);
    const file = path.join(this.dir, `${id}.jsonl`);
    await fs.unlink(file).catch(() => undefined);
  }

  // ===== Turn lifecycle (Resume 能力) =====

  /** 开始一个新 turn，写 turn_start 落盘；返回 turnId */
  async startTurn(id: string, userMessage: string): Promise<string> {
    const sess = this.cache.get(id);
    if (!sess) throw new Error(`Session not found: ${id}`);
    const turnId = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const startedAt = Date.now();
    sess.pendingTurn = { turnId, userMessage, partialAssistant: '', startedAt };
    sess.meta.interruptedTurn = { turnId, userMessage, partialAssistant: '', startedAt };
    await this.appendLine(id, { t: 'turn_start', turnId, userMessage, ts: startedAt });
    return turnId;
  }

  /** 流式 delta 落盘（每条都 append；fsync 由 SESSION_FSYNC env 控制） */
  async appendChunk(id: string, turnId: string, delta: string): Promise<void> {
    if (!delta) return;
    const sess = this.cache.get(id);
    if (!sess) return;
    if (sess.pendingTurn?.turnId !== turnId) return;
    sess.pendingTurn.partialAssistant += delta;
    if (sess.meta.interruptedTurn) sess.meta.interruptedTurn.partialAssistant = sess.pendingTurn.partialAssistant;
    await this.appendLine(id, { t: 'chunk', turnId, delta, ts: Date.now() });
  }

  /** 记一次 tool 调用（便于审计 / 续接时知道做过什么） */
  async appendTool(
    id: string,
    turnId: string,
    payload: { name: string; args?: unknown; result?: unknown; error?: string },
  ): Promise<void> {
    await this.appendLine(id, { t: 'tool', turnId, ts: Date.now(), ...payload });
  }

  /** 正常结束 turn：把 partial 升级为正式 assistant 消息，清空 pending */
  async endTurn(id: string, turnId: string, finalText?: string): Promise<void> {
    const sess = this.cache.get(id);
    if (!sess || sess.pendingTurn?.turnId !== turnId) return;
    const text = (finalText ?? sess.pendingTurn.partialAssistant).trim();
    sess.pendingTurn = undefined;
    sess.meta.interruptedTurn = undefined;
    await this.appendLine(id, { t: 'turn_end', turnId, finalText: text, ts: Date.now() });
    if (text) {
      await this.append(id, { role: 'assistant', content: text });
    }
  }

  /** 主动标记为 interrupted（用户点了 stop / 服务端 catch 到 error） */
  async interruptTurn(id: string, turnId: string, reason?: string): Promise<void> {
    const sess = this.cache.get(id);
    if (!sess || sess.pendingTurn?.turnId !== turnId) return;
    await this.appendLine(id, { t: 'turn_interrupted', turnId, reason, ts: Date.now() });
    // meta.interruptedTurn 保留，前端读 list 能看到「continue?」
  }

  /** Fork：复制现有 session 并截断到指定消息索引（含），创建新 session */
  async fork(srcId: string, untilIndex: number, title?: string): Promise<SessionMeta> {
    const src = this.cache.get(srcId);
    if (!src) throw new Error(`Source session not found: ${srcId}`);
    const cut = src.messages.slice(0, Math.min(untilIndex + 1, src.messages.length));
    const meta = await this.create(title || `Fork: ${src.meta.title}`);
    for (const m of cut) {
      await this.append(meta.id, m);
    }
    return this.cache.get(meta.id)!.meta;
  }

  /** 读取一个 jsonl 文件并 reduce 成 session 状态 */
  private async readJsonl(id: string): Promise<InMemorySession | null> {
    const file = path.join(this.dir, `${id}.jsonl`);
    let raw: string;
    try {
      raw = await fs.readFile(file, 'utf-8');
    } catch {
      return null;
    }
    const lines = raw.split('\n').filter((l) => l.trim());
    let meta: SessionMeta | null = null;
    const messages: SessionMessage[] = [];
    // 用于 reduce 未结束的 turn
    let curTurn: { turnId: string; userMessage: string; partial: string; startedAt: number } | null = null;
    for (const ln of lines) {
      try {
        const obj = JSON.parse(ln);
        if (obj.t === 'meta') {
          meta = {
            id: obj.id ?? id,
            title: obj.title ?? 'Untitled',
            createdAt: obj.createdAt ?? Date.now(),
            updatedAt: obj.updatedAt ?? Date.now(),
            messageCount: obj.messageCount ?? 0,
            mode: obj.mode,
            workspaceRoot: obj.workspaceRoot,
            remoteUser: obj.remoteUser,
          };
        } else if (obj.t === 'msg') {
          const { t, ...rest } = obj;
          messages.push(rest as SessionMessage);
        } else if (obj.t === 'turn_start') {
          curTurn = {
            turnId: obj.turnId,
            userMessage: obj.userMessage ?? '',
            partial: '',
            startedAt: obj.ts ?? Date.now(),
          };
        } else if (obj.t === 'chunk') {
          if (curTurn && obj.turnId === curTurn.turnId && typeof obj.delta === 'string') {
            curTurn.partial += obj.delta;
          }
        } else if (obj.t === 'turn_end' || obj.t === 'turn_interrupted') {
          // turn_end 后正式的 assistant msg 会被独立 't:msg' 行写入；这里只清状态
          if (obj.t === 'turn_end') curTurn = null;
          // turn_interrupted：保留 curTurn，外层会写到 meta.interruptedTurn
        }
        // 其他类型（plan / tool）暂未恢复
      } catch {
        /* 跳过坏行 */
      }
    }
    if (!meta) {
      meta = {
        id,
        title: 'Untitled',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messageCount: messages.length,
      };
    }
    meta.messageCount = messages.length;
    // 若 title 仍是默认且已有 user 消息，自动推断标题
    if ((meta.title === 'New chat' || meta.title === 'Untitled') && messages.length > 0) {
      const firstUser = messages.find((m) => m.role === 'user');
      if (firstUser?.content.trim()) {
        const raw = firstUser.content.trim().slice(0, 20);
        meta.title = raw.length >= 20 ? raw + '…' : raw;
      }
    }
    // 如果有未结束的 turn → 标记为 interrupted
    if (curTurn) {
      meta.interruptedTurn = {
        turnId: curTurn.turnId,
        userMessage: curTurn.userMessage,
        partialAssistant: curTurn.partial,
        startedAt: curTurn.startedAt,
      };
    }
    return { meta, messages };
  }

  private async appendLine(id: string, obj: Record<string, unknown>) {
    const file = path.join(this.dir, `${id}.jsonl`);
    await fs.appendFile(file, JSON.stringify(obj) + '\n', 'utf-8');
  }
}