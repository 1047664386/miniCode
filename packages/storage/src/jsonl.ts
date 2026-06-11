/**
 * JsonlStorage — 文件型实现（桌面默认）
 *
 * 完整复刻 `apps/server/src/session-store.ts` 的行为，作为统一接口的第一个实现。
 * 后续 SqliteStorage / PgStorage 都会实现同一个 SessionStorage 接口。
 *
 * 存储路径：<workspace>/.minicodeide/sessions/<id>.jsonl
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  CreateOpts,
  SessionMessage,
  SessionMeta,
  SessionMode,
  SessionStorage,
  ToolCallRecord,
} from './types.js';

interface InMemorySession {
  meta: SessionMeta;
  messages: SessionMessage[];
  pendingTurn?: { turnId: string; userMessage: string; partialAssistant: string; startedAt: number };
}

export class JsonlStorage implements SessionStorage {
  private dir: string;
  private cache = new Map<string, InMemorySession>();
  private loaded = false;

  constructor(workspace: string) {
    this.dir = path.join(workspace, '.minicodeide', 'sessions');
  }

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
          if (!sess.meta.mode) sess.meta.mode = 'code';
          this.cache.set(id, sess);
        }
      } catch { /* skip */ }
    }
    this.loaded = true;
  }

  async list(opts: { userId?: string; mode?: SessionMode; workspaceRoot?: string } = {}): Promise<SessionMeta[]> {
    let arr = [...this.cache.values()].map((s) => {
      const messageCount = s.messages.length;
      let title = s.meta.title;
      if ((title === 'New chat' || title === 'Untitled') && messageCount > 0) {
        const firstUser = s.messages.find((m) => m.role === 'user');
        if (firstUser?.content.trim()) {
          const raw = firstUser.content.trim().slice(0, 20);
          title = raw.length >= 20 ? raw + '…' : raw;
        }
      }
      return { ...s.meta, title, messageCount };
    });
    if (opts.mode) arr = arr.filter((m) => (m.mode ?? 'code') === opts.mode);
    if (opts.workspaceRoot) arr = arr.filter((m) => m.workspaceRoot === opts.workspaceRoot);
    if (opts.userId) arr = arr.filter((m) => m.userId === opts.userId);
    return arr.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async get(id: string) {
    const s = this.cache.get(id);
    if (!s) return undefined;
    return { meta: s.meta, messages: s.messages };
  }

  /** 同步 list （桌面后兼容、制存在内存，云端 PgStorage 不提供） */
  listSync(opts: { userId?: string; mode?: SessionMode; workspaceRoot?: string } = {}): SessionMeta[] {
    let arr = [...this.cache.values()].map((s) => {
      const messageCount = s.messages.length;
      let title = s.meta.title;
      if ((title === 'New chat' || title === 'Untitled') && messageCount > 0) {
        const firstUser = s.messages.find((m) => m.role === 'user');
        if (firstUser?.content.trim()) {
          const raw = firstUser.content.trim().slice(0, 20);
          title = raw.length >= 20 ? raw + '…' : raw;
        }
      }
      return { ...s.meta, title, messageCount };
    });
    if (opts.mode) arr = arr.filter((m) => (m.mode ?? 'code') === opts.mode);
    if (opts.workspaceRoot) arr = arr.filter((m) => m.workspaceRoot === opts.workspaceRoot);
    if (opts.userId) arr = arr.filter((m) => m.userId === opts.userId);
    return arr.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /** 同步 get （桌面后兼容） */
  getSync(id: string) {
    const s = this.cache.get(id);
    if (!s) return undefined;
    return { meta: s.meta, messages: s.messages };
  }

  /** 内部：拿到 InMemorySession（含 pendingTurn），仅 storage 内用 */
  _getInternal(id: string): InMemorySession | undefined {
    return this.cache.get(id);
  }

  async create(titleOrOpts?: string | CreateOpts): Promise<SessionMeta> {
    const opts: CreateOpts = typeof titleOrOpts === 'string' ? { title: titleOrOpts } : (titleOrOpts ?? {});
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
      userId: opts.userId,
    };
    this.cache.set(id, { meta, messages: [] });
    await this.appendLine(id, { t: 'meta', ...meta });
    return meta;
  }

  async findOrCreateForRemote(wxUserId: string, opts: { title?: string; workspace?: string } = {}) {
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

  async append(id: string, msg: Omit<SessionMessage, 'ts'> & { ts?: number }) {
    const sess = this.cache.get(id);
    if (!sess) throw new Error(`Session not found: ${id}`);
    const fullMsg: SessionMessage = { ...msg, ts: msg.ts ?? Date.now() };
    sess.messages.push(fullMsg);
    sess.meta.updatedAt = fullMsg.ts;
    sess.meta.messageCount = sess.messages.length;
    if (sess.meta.title === 'New chat' && msg.role === 'user' && msg.content.trim()) {
      const raw = msg.content.trim().slice(0, 20);
      sess.meta.title = raw.length >= 20 ? raw + '…' : raw;
      await this.appendLine(id, { t: 'meta', ...sess.meta });
    }
    await this.appendLine(id, { t: 'msg', ...fullMsg });
  }

  async rename(id: string, title: string) {
    const sess = this.cache.get(id);
    if (!sess) throw new Error(`Session not found: ${id}`);
    sess.meta.title = title.slice(0, 80) || sess.meta.title;
    sess.meta.updatedAt = Date.now();
    await this.appendLine(id, { t: 'meta', ...sess.meta });
    return sess.meta;
  }

  async delete(id: string) {
    if (!this.cache.has(id)) return;
    this.cache.delete(id);
    const file = path.join(this.dir, `${id}.jsonl`);
    await fs.unlink(file).catch(() => undefined);
  }

  async startTurn(id: string, userMessage: string) {
    const sess = this.cache.get(id);
    if (!sess) throw new Error(`Session not found: ${id}`);
    const turnId = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const startedAt = Date.now();
    sess.pendingTurn = { turnId, userMessage, partialAssistant: '', startedAt };
    sess.meta.interruptedTurn = { turnId, userMessage, partialAssistant: '', startedAt };
    await this.appendLine(id, { t: 'turn_start', turnId, userMessage, ts: startedAt });
    return turnId;
  }

  async appendChunk(id: string, turnId: string, delta: string) {
    if (!delta) return;
    const sess = this.cache.get(id);
    if (!sess) return;
    if (sess.pendingTurn?.turnId !== turnId) return;
    sess.pendingTurn.partialAssistant += delta;
    if (sess.meta.interruptedTurn) sess.meta.interruptedTurn.partialAssistant = sess.pendingTurn.partialAssistant;
    await this.appendLine(id, { t: 'chunk', turnId, delta, ts: Date.now() });
  }

  async appendTool(id: string, turnId: string, rec: ToolCallRecord) {
    await this.appendLine(id, { t: 'tool', turnId, ts: rec.ts ?? Date.now(), ...rec });
  }

  async endTurn(id: string, turnId: string, finalText?: string) {
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

  async interruptTurn(id: string, turnId: string, reason?: string) {
    const sess = this.cache.get(id);
    if (!sess || sess.pendingTurn?.turnId !== turnId) return;
    await this.appendLine(id, { t: 'turn_interrupted', turnId, reason, ts: Date.now() });
  }

  async fork(srcId: string, untilIndex: number, title?: string) {
    const src = this.cache.get(srcId);
    if (!src) throw new Error(`Source session not found: ${srcId}`);
    const cut = src.messages.slice(0, Math.min(untilIndex + 1, src.messages.length));
    const meta = await this.create(title || `Fork: ${src.meta.title}`);
    for (const m of cut) {
      await this.append(meta.id, m);
    }
    return this.cache.get(meta.id)!.meta;
  }

  // ---- 内部 ----

  private async readJsonl(id: string): Promise<InMemorySession | null> {
    const file = path.join(this.dir, `${id}.jsonl`);
    let raw: string;
    try { raw = await fs.readFile(file, 'utf-8'); } catch { return null; }
    const lines = raw.split('\n').filter((l) => l.trim());
    let meta: SessionMeta | null = null;
    const messages: SessionMessage[] = [];
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
            userId: obj.userId,
          };
        } else if (obj.t === 'msg') {
          const { t, ...rest } = obj;
          void t;
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
          if (obj.t === 'turn_end') curTurn = null;
        }
      } catch { /* skip */ }
    }
    if (!meta) {
      meta = {
        id, title: 'Untitled', createdAt: Date.now(), updatedAt: Date.now(),
        messageCount: messages.length,
      };
    }
    meta.messageCount = messages.length;
    if ((meta.title === 'New chat' || meta.title === 'Untitled') && messages.length > 0) {
      const firstUser = messages.find((m) => m.role === 'user');
      if (firstUser?.content.trim()) {
        const raw = firstUser.content.trim().slice(0, 20);
        meta.title = raw.length >= 20 ? raw + '…' : raw;
      }
    }
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