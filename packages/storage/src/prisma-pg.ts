/**
 * PgStorage — Prisma + Postgres 实现（云端版用）
 *
 * 这一层屏蔽底层 Prisma client，业务代码只 import @mini/storage 的 SessionStorage。
 *
 * ⚠️ 约束：
 *  - 每个 HTTP 请求 new 一个 PgStorage(prisma, userId)，userId 用作多租户隔离
 *  - 不持有内存 cache（与 JsonlStorage 不同），所有读都打 DB（依赖 Postgres 自己的 buffer pool）
 *  - chunks / tools 用 jsonb 数组追加（jsonb || ::jsonb），便于流式落盘
 *
 * 未来 M5 加 token 计费时，PgStorage.appendChunk 可以同时更新 User.usedTokens。
 */
import type {
  CreateOpts,
  SessionMessage,
  SessionMeta,
  SessionMode,
  SessionStorage,
  ToolCallRecord,
} from './types.js';

// 我们不直接引 @prisma/client，避免下游用户不装 prisma 也能 typecheck @mini/storage。
// 业务方启动时传一个 PrismaClient 进来即可。
type AnyPrisma = {
  user: any;
  session: any;
  message: any;
  turn: any;
  $executeRaw: any;
  $transaction: any;
};

function metaFromRow(row: any): SessionMeta {
  return {
    id: row.id,
    title: row.title,
    createdAt: new Date(row.createdAt).getTime(),
    updatedAt: new Date(row.updatedAt).getTime(),
    messageCount: row.messageCount,
    mode: row.mode as SessionMode,
    workspaceRoot: row.workspaceRoot ?? undefined,
    remoteUser: row.remoteUser ?? undefined,
    userId: row.userId,
    interruptedTurn: row.interruptedTurn ?? undefined,
  };
}

function messageFromRow(row: any): SessionMessage {
  return {
    role: row.role,
    content: row.content,
    ts: Number(row.ts),
    toolName: row.toolName ?? undefined,
    pendingEditId: row.pendingEditId ?? undefined,
    pendingEditPath: row.pendingEditPath ?? undefined,
  };
}

export class PgStorage implements SessionStorage {
  constructor(private prisma: AnyPrisma, private userId: string) {}

  async load() { /* 无需预加载 */ }

  async list(opts: { userId?: string; mode?: SessionMode; workspaceRoot?: string } = {}) {
    const where: any = { userId: opts.userId ?? this.userId };
    if (opts.mode) where.mode = opts.mode;
    if (opts.workspaceRoot) where.workspaceRoot = opts.workspaceRoot;
    const rows = await this.prisma.session.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(metaFromRow);
  }

  async get(id: string) {
    const row = await this.prisma.session.findFirst({
      where: { id, userId: this.userId },
      include: {
        messages: { orderBy: { ts: 'asc' } },
      },
    });
    if (!row) return undefined;
    return {
      meta: metaFromRow(row),
      messages: row.messages.map(messageFromRow),
    };
  }

  async create(titleOrOpts?: string | CreateOpts) {
    const opts: CreateOpts = typeof titleOrOpts === 'string' ? { title: titleOrOpts } : (titleOrOpts ?? {});
    const id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const row = await this.prisma.session.create({
      data: {
        id,
        userId: opts.userId ?? this.userId,
        title: opts.title?.trim() || 'New chat',
        mode: opts.mode ?? 'work',
        workspaceRoot: opts.workspaceRoot,
        remoteUser: opts.remoteUser,
      },
    });
    return metaFromRow(row);
  }

  async findOrCreateForRemote(wxUserId: string, opts: { title?: string; workspace?: string } = {}) {
    const row = await this.prisma.session.findFirst({
      where: { userId: this.userId, remoteUser: wxUserId },
      orderBy: { updatedAt: 'desc' },
    });
    if (row) return metaFromRow(row);
    return this.create({
      title: opts.title ?? `WeChat: ${wxUserId.slice(0, 8)}`,
      mode: 'code',
      workspaceRoot: opts.workspace,
      remoteUser: wxUserId,
    });
  }

  async append(id: string, msg: Omit<SessionMessage, 'ts'> & { ts?: number }) {
    const ts = msg.ts ?? Date.now();
    await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          sessionId: id,
          role: msg.role,
          content: msg.content,
          ts: BigInt(ts),
          toolName: msg.toolName,
          pendingEditId: msg.pendingEditId,
          pendingEditPath: msg.pendingEditPath,
        },
      }),
      this.prisma.session.update({
        where: { id },
        data: {
          messageCount: { increment: 1 },
          updatedAt: new Date(ts),
          // 首条 user 消息 → 用作 title（在 SQL 里用 CASE 实现成本高，这里用 raw SQL 替代）
        },
      }),
    ]);
    if (msg.role === 'user' && msg.content.trim()) {
      // 仅当当前 title 仍为 'New chat' 时才覆盖
      await this.prisma.$executeRaw`
        UPDATE "Session"
           SET title = ${msg.content.trim().slice(0, 40).replace(/\s+/g, ' ')}
         WHERE id = ${id} AND title = 'New chat'
      `;
    }
  }

  async rename(id: string, title: string) {
    const row = await this.prisma.session.update({
      where: { id },
      data: { title: title.slice(0, 80) || 'Untitled' },
    });
    return metaFromRow(row);
  }

  async delete(id: string) {
    // onDelete: Cascade 会清掉 messages / turns
    await this.prisma.session.deleteMany({ where: { id, userId: this.userId } });
  }

  async startTurn(id: string, userMessage: string) {
    const turnId = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const startedAt = Date.now();
    await this.prisma.$transaction([
      this.prisma.turn.create({
        data: {
          id: turnId,
          sessionId: id,
          userMessage,
          status: 'pending',
          startedAt: BigInt(startedAt),
        },
      }),
      this.prisma.session.update({
        where: { id },
        data: {
          interruptedTurn: { turnId, userMessage, partialAssistant: '', startedAt },
        },
      }),
    ]);
    return turnId;
  }

  async appendChunk(id: string, turnId: string, delta: string) {
    if (!delta) return;
    const ts = Date.now();
    // jsonb 数组 append；用 raw SQL（Prisma 没原生的 array push for jsonb）
    await this.prisma.$executeRaw`
      UPDATE "Turn"
         SET chunks = chunks || ${JSON.stringify([{ delta, ts }])}::jsonb
       WHERE id = ${turnId} AND "sessionId" = ${id}
    `;
    // 同步更新 Session.interruptedTurn.partialAssistant（用 jsonb_set）
    await this.prisma.$executeRaw`
      UPDATE "Session"
         SET "interruptedTurn" = jsonb_set(
               COALESCE("interruptedTurn", '{}'::jsonb),
               '{partialAssistant}',
               to_jsonb(COALESCE("interruptedTurn"->>'partialAssistant', '') || ${delta})
             )
       WHERE id = ${id}
    `;
  }

  async appendTool(id: string, turnId: string, rec: ToolCallRecord) {
    void id;
    const payload = { ...rec, ts: rec.ts ?? Date.now() };
    await this.prisma.$executeRaw`
      UPDATE "Turn"
         SET tools = tools || ${JSON.stringify([payload])}::jsonb
       WHERE id = ${turnId}
    `;
  }

  async endTurn(id: string, turnId: string, finalText?: string) {
    // 把 partial 提升为正式 assistant 消息
    const turn = await this.prisma.turn.findUnique({ where: { id: turnId } });
    if (!turn) return;
    const chunks: { delta: string }[] = Array.isArray(turn.chunks) ? turn.chunks : [];
    const text = (finalText ?? chunks.map((c) => c.delta).join('')).trim();
    await this.prisma.$transaction([
      this.prisma.turn.update({
        where: { id: turnId },
        data: {
          status: 'done',
          finalText: text,
          endedAt: BigInt(Date.now()),
        },
      }),
      this.prisma.session.update({
        where: { id },
        data: { interruptedTurn: null as any },
      }),
    ]);
    if (text) {
      await this.append(id, { role: 'assistant', content: text });
    }
  }

  async interruptTurn(_id: string, turnId: string, reason?: string) {
    await this.prisma.turn.update({
      where: { id: turnId },
      data: { status: 'interrupted', endedAt: BigInt(Date.now()), finalText: reason ?? null },
    }).catch(() => undefined);
  }

  async fork(srcId: string, untilIndex: number, title?: string) {
    const src = await this.get(srcId);
    if (!src) throw new Error(`Source session not found: ${srcId}`);
    const cut = src.messages.slice(0, Math.min(untilIndex + 1, src.messages.length));
    const meta = await this.create({ title: title || `Fork: ${src.meta.title}`, mode: src.meta.mode });
    for (const m of cut) {
      await this.append(meta.id, m);
    }
    return meta;
  }
}