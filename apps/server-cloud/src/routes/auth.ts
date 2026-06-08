
/**
 * /api/auth/* —— 匿名/扫码登录
 *
 * M2 只实现：
 *   POST /anonymous → 发一个 anonymous JWT（创建 anon User，存到 DB）
 *   GET  /me        → 当前用户
 *
 * 后续 M5 加：
 *   POST /wx/qr     → 生成微信扫码二维码
 *   POST /wx/callback
 *   POST /email/code
 *   POST /email/verify
 */
import type { FastifyPluginAsync } from 'fastify';

export const registerAuthRoutes: FastifyPluginAsync = async (app) => {
  app.post('/anonymous', async (req, reply) => {
    const user = await app.prisma.user.create({
      data: { name: 'Anonymous' },
    });
    const token = app.jwt.sign({ userId: user.id, anon: true });
    reply.setCookie('mci_jwt', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    return { token, userId: user.id };
  });

  app.get('/me', async (req, reply) => {
    try {
      await req.jwtVerify();
      const userId = (req.user as any).userId;
      const u = await app.prisma.user.findUnique({ where: { id: userId } });
      if (!u) return reply.code(404).send({ error: 'user not found' });
      return { userId: u.id, name: u.name, email: u.email, usedTokens: u.usedTokens, freeQuota: u.freeQuota };
    } catch {
      return reply.code(401).send({ error: 'unauthorized' });
    }
  });
};