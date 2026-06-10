
/**
 * /api/auth/* —— 认证路由
 *
 * 已实现：
 *   POST /register  → 用户名+密码注册（自动登录）
 *   POST /login     → 用户名+密码登录
 *   DELETE /logout   → 清除 JWT cookie
 *   POST /anonymous → 创建匿名用户（免登录体验）
 *   GET  /me        → 获取当前用户信息
 *
 * 后续扩展：
 *   POST /email/code     → 邮箱验证码
 *   POST /email/verify   → 邮箱验证
 *   POST /wx/qr          → 微信扫码
 *   POST /wx/callback    → 微信回调
 */
import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 30, // 30 天
};

export const registerAuthRoutes: FastifyPluginAsync = async (app) => {
  // ─── 注册 ──────────────────────────────────────────────
  app.post('/register', async (req, reply) => {
    const { username, password } = req.body as { username?: string; password?: string };

    if (!username?.trim() || !password) {
      return reply.code(400).send({ error: '用户名和密码不能为空' });
    }
    if (password.length < 6) {
      return reply.code(400).send({ error: '密码至少 6 位' });
    }

    const existing = await app.prisma.user.findUnique({ where: { username: username.trim() } });
    if (existing) {
      return reply.code(400).send({ error: '用户名已存在' });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await app.prisma.user.create({
      data: {
        username: username.trim(),
        password: hash,
        name: username.trim(),
      },
    });

    const token = app.jwt.sign({ userId: user.id, anon: false });
    reply.setCookie('mci_jwt', token, COOKIE_OPTS);

    return {
      token,
      user: { id: user.id, username: user.username, name: user.name },
      message: '注册成功',
    };
  });

  // ─── 登录 ──────────────────────────────────────────────
  app.post('/login', async (req, reply) => {
    const { username, password } = req.body as { username?: string; password?: string };

    if (!username?.trim() || !password) {
      return reply.code(400).send({ error: '用户名和密码不能为空' });
    }

    const user = await app.prisma.user.findUnique({ where: { username: username.trim() } });
    if (!user || !user.password) {
      return reply.code(400).send({ error: '用户名不存在' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return reply.code(400).send({ error: '密码错误' });
    }

    const token = app.jwt.sign({ userId: user.id, anon: false });
    reply.setCookie('mci_jwt', token, COOKIE_OPTS);

    return {
      token,
      user: { id: user.id, username: user.username, name: user.name },
      message: '登录成功',
    };
  });

  // ─── 登出 ──────────────────────────────────────────────
  app.delete('/logout', async (_req, reply) => {
    reply.clearCookie('mci_jwt', { path: '/' });
    return { message: '已登出' };
  });

  // ─── 匿名用户（免登录体验）───────────────────────────────
  app.post('/anonymous', async (req, reply) => {
    const user = await app.prisma.user.create({
      data: { name: 'Anonymous' },
    });
    const token = app.jwt.sign({ userId: user.id, anon: true });
    reply.setCookie('mci_jwt', token, COOKIE_OPTS);
    return { token, userId: user.id };
  });

  // ─── 当前用户 ──────────────────────────────────────────
  app.get('/me', async (req, reply) => {
    try {
      await req.jwtVerify();
      const userId = (req.user as any).userId;
      const u = await app.prisma.user.findUnique({ where: { id: userId } });
      if (!u) return reply.code(404).send({ error: 'user not found' });
      return {
        userId: u.id,
        username: u.username,
        name: u.name,
        email: u.email,
        isAnonymous: !u.username,
        usedTokens: u.usedTokens,
        freeQuota: u.freeQuota,
      };
    } catch {
      return reply.code(401).send({ error: 'unauthorized' });
    }
  });
};
