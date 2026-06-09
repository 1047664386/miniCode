
/**
 * /api/sessions/* —— 多租户会话 CRUD
 *
 * 全部走 PgStorage(prisma, req.userId)，自动按 userId 隔离。
 */
import type { FastifyPluginAsync } from 'fastify';
import { PgStorage } from '@mini/storage';

export const registerSessionsRoutes: FastifyPluginAsync = async (app) => {
  // helper：每请求 new 一个 storage
  const storage = (req: any) => new PgStorage(app.prisma as any, req.userId);

  app.get('/', async (req) => {
    const q = req.query as any;
    return storage(req).list({
      mode: q.mode,
      workspaceRoot: q.workspace,
    });
  });

  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const sess = await storage(req).get(id);
    if (!sess) return reply.code(404).send({ error: 'not found' });
    return sess;
  });

  app.post('/', async (req) => {
    const body = (req.body ?? {}) as any;
    return storage(req).create({
      title: body.title,
      mode: body.mode,
      workspaceRoot: body.workspaceRoot,
    });
  });

  app.patch('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as any;
    try {
      const meta = await storage(req).rename(id, String(body.title ?? ''));
      return meta;
    } catch (e: any) {
      return reply.code(404).send({ error: e?.message ?? 'not found' });
    }
  });

  app.delete('/:id', async (req) => {
    const { id } = req.params as { id: string };
    await storage(req).delete(id);
    return { ok: true };
  });

  app.post('/:id/fork', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as any;
    try {
      const idx = Number(body.untilIndex ?? -1);
      const meta = await storage(req).fork(id, idx, body.title);
      return meta;
    } catch (e: any) {
      return reply.code(400).send({ error: e?.message ?? 'fork failed' });
    }
  });

  app.get('/:id/resume-info', async (req, reply) => {
    const { id } = req.params as { id: string };
    const sess = await storage(req).get(id);
    if (!sess) return reply.code(404).send({ error: 'not found' });
    const it = sess.meta.interruptedTurn;
    if (!it) return { interrupted: false };
    const hint =
      `[RESUME] 上一次对话在执行中被中断。你已经输出了以下部分内容：\n\n` +
      '----- 已输出（截断）-----\n' +
      (it.partialAssistant ?? '').slice(-2000) +
      '\n----- 已输出结束 -----\n\n' +
      `原始任务："${it.userMessage}"\n\n` +
      `请继续完成这个任务。如果上面输出已经完整就只补充收尾；否则从中断处接着写或重新执行剩余步骤。`;
    return {
      interrupted: true,
      turnId: it.turnId,
      originalUserMessage: it.userMessage,
      partialAssistant: it.partialAssistant,
      startedAt: it.startedAt,
      suggestedResumePrompt: hint,
      history: sess.messages,
    };
  });

  app.post('/:id/resume-discard', async (req, reply) => {
    const { id } = req.params as { id: string };
    const sess = await storage(req).get(id);
    if (!sess) return reply.code(404).send({ error: 'not found' });
    if (sess.meta.interruptedTurn) {
      await storage(req)
        .interruptTurn(id, sess.meta.interruptedTurn.turnId, 'user_discard')
        .catch(() => undefined);
    }
    return { ok: true };
  });
};