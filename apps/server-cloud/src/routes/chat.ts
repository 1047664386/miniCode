
/**
 * /api/chat —— 真实 LLM SSE 流式聊天（M3：支持 tool calling 接入云沙箱）
 *
 * 协议（与 desktop /api/chat 一致）：
 *   请求体: { sessionId, userMessage, mode?: 'work'|'code', messages? }
 *   SSE 事件:
 *     event: text\ndata: {"delta":"..."}
 *     event: tool_call\ndata: {"name","args"}
 *     event: tool_result\ndata: {"name","ok","summary"}
 *     event: done\ndata: {...}
 *     event: error\ndata: {"message":"..."}
 *
 * 模式：
 *   work 模式 → 纯聊天（不开工具，省 token）
 *   code 模式 → runAgent + sandbox 工具集（read/write/list/run/grep）
 */
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { PgStorage } from '@mini/storage';
import {
  type ChatMessage,
  ToolRegistry,
  runAgent,
} from '@mini/core';
import type { SandboxProvider } from '@mini/sandbox';
import { pickProvider } from '../llm/factory.js';
import { makeSandboxTools } from '../agent/sandbox-tools.js';

const SYSTEM_WORK = `You are MyWorker, a helpful AI assistant integrated into miniCodeIde.
- Be concise, friendly, and pragmatic.
- When user asks code questions, prefer code blocks with language tags.`;

const SYSTEM_CODE = `You are MyWorker, an AI coding assistant running with a CLOUD SANDBOX.
You can call tools to read, write, search files and run shell commands inside the sandbox.

Tool usage discipline:
- Prefer list_files / grep_search to explore an unfamiliar repo before reading.
- Read large files in windows (start_line/end_line) to save context.
- Use run_command for tests, builds, installs. Default cwd is workspace root.
- Do NOT call the same tool with the same args twice in a row.
- After a successful change, summarize what you did and how the user can verify.

The sandbox is a fresh Linux environment per user; node, npm, git are available.`;

interface ChatBody {
  sessionId?: string;
  userMessage?: string;
  text?: string;
  mode?: string;
  messages?: { role: string; content: string }[];
  timeout?: { fetchTimeoutMs?: number; streamIdleTimeoutMs?: number };
}

interface Deps {
  sandbox: SandboxProvider;
}

async function runChat(req: FastifyRequest, reply: FastifyReply, app: any, deps: Deps) {
  const body = (req.body ?? {}) as ChatBody;
  const sessionId = String(body.sessionId ?? '');
  const text = String(body.userMessage ?? body.text ?? '').trim();
  const mode = String(body.mode ?? 'work').toLowerCase();
  const clientTimeout = body.timeout; // { fetchTimeoutMs?, streamIdleTimeoutMs? } | undefined
  if (!sessionId || !text) return reply.code(400).send({ error: 'sessionId + userMessage required' });

  const storage = new PgStorage(app.prisma, req.userId);
  const sess = await storage.get(sessionId);
  if (!sess) return reply.code(404).send({ error: 'session not found' });

  const user = await app.prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return reply.code(401).send({ error: 'user not found' });

  let providerResult;
  try {
    providerResult = pickProvider(user);
  } catch (e: any) {
    return reply.code(503).send({ error: 'no_llm_provider', message: e?.message });
  }
  const { provider, model, byok } = providerResult;

  if (!byok && user.usedTokens >= user.freeQuota) {
    return reply.code(402).send({
      error: 'quota_exceeded',
      message: 'Free quota used up. Configure BYOK via PATCH /api/me/api-key.',
      usedTokens: user.usedTokens,
      freeQuota: user.freeQuota,
    });
  }

  await storage.append(sessionId, { role: 'user', content: text });
  const turnId = await storage.startTurn(sessionId, text);

  reply.raw.setHeader('content-type', 'text/event-stream; charset=utf-8');
  reply.raw.setHeader('cache-control', 'no-cache');
  reply.raw.setHeader('connection', 'keep-alive');
  reply.raw.flushHeaders?.();

  const write = (event: string, data: any) => {
    reply.raw.write(`event: ${event}\n`);
    reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const ctl = new AbortController();
  req.raw.on('close', () => ctl.abort());

  const recent = sess.messages
    .slice(-20)
    .filter((m: any) => m.role === 'user' || m.role === 'assistant');
  const sys = mode === 'code' ? SYSTEM_CODE : SYSTEM_WORK;
  const messages: ChatMessage[] = [
    { role: 'system', content: sys },
    ...recent.map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: text },
  ];

  let finalText = '';
  let promptTokens = 0;
  let completionTokens = 0;
  let doneReason = 'completed'; // 跟踪 Agent 结束原因

  try {
    if (mode === 'code') {
      // === Code 模式：开 runAgent + 沙箱工具 ===
      const sb = await deps.sandbox.getOrCreate(`u_${req.userId}`);
      const tools = makeSandboxTools(sb);
      const registry = new ToolRegistry();
      for (const t of tools) registry.register(t);

      for await (const ev of runAgent({
        llm: provider,
        registry,
        messages,
        toolCtx: { cwd: '/' },
        maxSteps: 10,
        model,
        signal: ctl.signal,
        llmTimeout: clientTimeout,
      })) {
        if (ev.type === 'text' && ev.text) {
          finalText += ev.text;
          await storage.appendChunk(sessionId, turnId, ev.text);
          write('text', { delta: ev.text });
        } else if (ev.type === 'tool_call' && ev.toolCall) {
          write('tool_call', { name: ev.toolCall.name, args: ev.toolCall.arguments });
        } else if (ev.type === 'tool_result') {
          // 给 UI 一个简短摘要（避免发巨大 stdout 上来）
          const r = ev.toolResult as any;
          let summary = '';
          if (r && typeof r === 'object') {
            if ('exitCode' in r) summary = `exit=${r.exitCode}`;
            else if ('totalLines' in r) summary = `${r.totalLines} lines`;
            else if (Array.isArray(r)) summary = `${r.length} items`;
            else if ('matches' in r) summary = `${r.matches?.length ?? 0} matches`;
            else if ('bytes' in r) summary = `wrote ${r.bytes} bytes`;
          }
          write('tool_result', { ok: true, summary });
        } else if (ev.type === 'usage') {
          promptTokens = ev.usage?.promptTokens ?? promptTokens;
          completionTokens = ev.usage?.completionTokens ?? completionTokens;
        } else if (ev.type === 'error') {
          write('error', { message: ev.error });
        } else if (ev.type === 'done' && ev.reason) {
          doneReason = ev.reason;
        }
      }
    } else {
      // === Work 模式：纯流式 ===
      const streamOpts: any = { model, signal: ctl.signal };
      if (clientTimeout?.fetchTimeoutMs !== undefined) streamOpts.fetchTimeoutMs = clientTimeout.fetchTimeoutMs;
      if (clientTimeout?.streamIdleTimeoutMs !== undefined) streamOpts.streamIdleTimeoutMs = clientTimeout.streamIdleTimeoutMs;

      try {
        for await (const chunk of provider.chatStream(messages, streamOpts)) {
          if (chunk.delta) {
            finalText += chunk.delta;
            await storage.appendChunk(sessionId, turnId, chunk.delta);
            write('text', { delta: chunk.delta });
          }
          if (chunk.usage) {
            promptTokens = chunk.usage.promptTokens ?? promptTokens;
            completionTokens = chunk.usage.completionTokens ?? completionTokens;
          }
          if (chunk.done) break;
        }
      } catch (streamErr: any) {
        doneReason = 'stream_error';
        write('error', { message: streamErr?.message ?? 'stream interrupted' });
      }
    }

    await storage.endTurn(sessionId, turnId, finalText);

    if (!byok && (promptTokens || completionTokens)) {
      const used = promptTokens + completionTokens;
      await app.prisma.user.update({
        where: { id: req.userId },
        data: { usedTokens: { increment: used } },
      });
    }

    write('done', { turnId, finalText, reason: doneReason, usage: { promptTokens, completionTokens, byok } });
  } catch (e: any) {
    app.log.error({ err: e }, 'chat stream failed');
    doneReason = 'fatal';
    await storage.interruptTurn(sessionId, turnId, 'error');
    write('error', { message: e?.message ?? 'stream failed' });
    write('done', { turnId, reason: doneReason });
  } finally {
    reply.raw.end();
  }
}

export function makeChatRoutes(deps: Deps): FastifyPluginAsync {
  return async (app) => {
    app.post('/', async (req, reply) => runChat(req, reply, app, deps));
    app.post('/stream', async (req, reply) => runChat(req, reply, app, deps));

    app.post('/abort', async (req) => {
      const body = (req.body ?? {}) as any;
      const storage = new PgStorage(app.prisma as any, req.userId);
      if (body.sessionId && body.turnId) {
        await storage.interruptTurn(body.sessionId, body.turnId, 'user-abort');
      }
      return { ok: true };
    });
  };
}

// 兼容旧导出（不带 sandbox 的入口，仅 work 模式可用）
export const registerChatRoutes: FastifyPluginAsync = async (_app) => {
  throw new Error('use makeChatRoutes({ sandbox }) instead');
};