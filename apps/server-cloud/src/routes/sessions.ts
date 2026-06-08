
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
};