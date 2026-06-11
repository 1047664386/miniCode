/**
 * 持久化层通用类型 / 接口
 *
 * 设计原则：
 *  - 跟现有 `apps/server/src/session-store.ts` 行为完全对齐
 *  - 不让业务层感知底层是文件 / SQLite / Postgres
 *  - 所有写方法都是 `Promise<void> / Promise<T>`，便于 Prisma 同步/异步切换
 */

export type SessionMode = 'work' | 'code';

export interface SessionMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  mode?: SessionMode;
  workspaceRoot?: string;
  /** 由微信遥控通道创建的 session 才有，等于发起者 wxid */
  remoteUser?: string;
  /** 上一轮 assistant 没正常结束时的 partial 状态 */
  interruptedTurn?: {
    turnId: string;
    userMessage: string;
    partialAssistant: string;
    startedAt: number;
  };
  /** 多租户字段（M2 引入，桌面单机模式可为空） */
  userId?: string;
}

export interface SessionMessage {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  ts: number;
  toolName?: string;
  pendingEditId?: string;
  pendingEditPath?: string;
  /** 前端渲染元数据（可选），如 _toolRole, _toolArgs, _thinkingMs, thinkFull 等 */
  uiMeta?: Record<string, unknown>;
}

export interface ToolCallRecord {
  name: string;
  args: unknown;
  result?: unknown;
  ts?: number;
}

export interface CreateOpts {
  title?: string;
  mode?: SessionMode;
  workspaceRoot?: string;
  remoteUser?: string;
  userId?: string;
}

/**
 * 会话存储统一接口。
 * 任何实现（JSONL / SQLite / Postgres）都必须支持这套语义。
 */
export interface SessionStorage {
  /** 启动时一次性加载（JSONL 实现需要扫盘；DB 实现可以 no-op） */
  load(): Promise<void>;

  /** 列出（按 updatedAt desc）。云端 PgStorage 走 DB，本地 JsonlStorage 走内存。 */
  list(opts?: { userId?: string; mode?: SessionMode; workspaceRoot?: string }): Promise<SessionMeta[]>;

  /** 取一个 session（含消息） */
  get(id: string): Promise<{ meta: SessionMeta; messages: SessionMessage[] } | undefined>;

  /** 新建 */
  create(opts?: CreateOpts | string): Promise<SessionMeta>;

  /** 找/建（远程通道：每个 wxUserId 一个 active session） */
  findOrCreateForRemote(
    wxUserId: string,
    opts?: { title?: string; workspace?: string },
  ): Promise<SessionMeta>;

  /** 追加一条消息（user/assistant/tool/system） */
  append(id: string, msg: Omit<SessionMessage, 'ts'> & { ts?: number }): Promise<void>;

  /** 改标题 */
  rename(id: string, title: string): Promise<SessionMeta>;

  /** 删除 */
  delete(id: string): Promise<void>;

  /** 开始一个 turn，返回 turnId */
  startTurn(id: string, userMessage: string): Promise<string>;

  /** LLM 流式增量落盘 */
  appendChunk(id: string, turnId: string, delta: string): Promise<void>;

  /** 一次 tool 调用 */
  appendTool(id: string, turnId: string, rec: ToolCallRecord): Promise<void>;

  /** 正常结束 turn */
  endTurn(id: string, turnId: string, finalText?: string): Promise<void>;

  /** 主动标记 turn 为 interrupted */
  interruptTurn(id: string, turnId: string, reason?: string): Promise<void>;

  /** Fork：复制并截断 */
  fork(srcId: string, untilIndex: number, title?: string): Promise<SessionMeta>;
}