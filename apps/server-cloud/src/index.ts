
/**
 * @mini/server-cloud — 网页版云端 Server（M2 骨架）
 *
 * 形态：Fastify + Prisma Postgres + JWT
 * 与 apps/server / apps/server-node 的关系：
 *   - 它们：跟 Electron 同进程，跑用户本地，单租户
 *   - 这里：独立部署，多租户，每请求带 userId
 *
 * 启动：
 *   cp .env.example .env
 *   cd infra && docker compose up -d
 *   pnpm --filter @mini/storage prisma:migrate
 *   pnpm --filter @mini/server-cloud dev
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.env') });
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';
// Prisma 7：客户端类型从 @mini/storage 重新导出（指向 src/generated/prisma）
// runtime + types 都从 storage 包出，server 不再直接吃 @prisma/client
import { PrismaClient } from '@mini/storage';
import { PrismaPg } from '@prisma/adapter-pg';

import { registerAuthRoutes } from './routes/auth.js';
import { registerSessionsRoutes } from './routes/sessions.js';
import { makeChatRoutes } from './routes/chat.js';
import { registerMeRoutes } from './routes/me.js';
import { registerCompatRoutes } from './routes/compat.js';
import { makeAgentsRoutes } from './routes/agents.js';
import { authPlugin } from './middleware/auth.js';
import { createSandboxProvider } from '@mini/sandbox';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const app = Fastify({ logger: true, bodyLimit: 50 * 1024 * 1024 });

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
    credentials: true,
  });
  await app.register(cookie);
  await app.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'dev-only-secret',
    cookie: { cookieName: 'mci_jwt', signed: false },
  });

  // 把 prisma / userId 注入到 request 上
  app.decorate('prisma', prisma);
  await app.register(authPlugin);

  // 路由
  await app.register(registerAuthRoutes, { prefix: '/api/auth' });
  await app.register(registerSessionsRoutes, { prefix: '/api/sessions' });
  await app.register(registerMeRoutes, { prefix: '/api/me' });
  // 云沙箱（默认 mem provider，本地开发零配置）
  const sandbox = createSandboxProvider();
  app.log.info(`sandbox provider: ${process.env.SANDBOX_KIND ?? 'mem'}`);
  await app.register(makeAgentsRoutes({ sandbox }), { prefix: '/api/agents' });
  // chat 路由需要 sandbox（code 模式调工具）
  await app.register(makeChatRoutes({ sandbox }), { prefix: '/api/chat' });

  // 分块上传：注册 application/octet-stream parser → Buffer
  app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer' }, (_req, body, done) => {
    done(null, body);
  });
  const { makeUploadsRoutes } = await import('./routes/uploads.js');
  await app.register(makeUploadsRoutes({ sandbox }), { prefix: '/api/uploads' });
  // 兼容桌面 UI 的 workspace/skills 概念
  await app.register(registerCompatRoutes);

  app.get('/healthz', async () => ({ ok: true, ts: Date.now() }));

  const port = Number(process.env.PORT ?? 4000);
  await app.listen({ host: '0.0.0.0', port });
  app.log.info(`server-cloud listening on :${port}`);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

// ---- TS module augmentation：让 req.userId / app.prisma 有类型 ----
declare module 'fastify' {
  interface FastifyInstance {
    prisma: any;
  }
  interface FastifyRequest {
    userId: string;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { userId: string; anon?: boolean };
    user: { userId: string; anon?: boolean };
  }
}