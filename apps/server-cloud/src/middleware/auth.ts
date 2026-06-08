
/**
 * authPlugin —— JWT 解析 + req.userId 注入
 *
 * 策略：
 *  - 优先从 cookie `mci_jwt` 取，再 fallback Authorization header
 *  - 没有 token / 解析失败时，在白名单路由上放行（让前端去拿 anonymous token）
 *  - 其他路由会被 401
 */
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

const PUBLIC_PREFIXES = ['/api/auth/', '/healthz'];

function isPublic(req: FastifyRequest) {
  return PUBLIC_PREFIXES.some((p) => req.url.startsWith(p));
}

const plugin: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.addHook('onRequest', async (req, reply) => {
    if (isPublic(req)) return;
    try {
      await req.jwtVerify();
      req.userId = (req.user as any).userId;
    } catch {
      reply.code(401).send({ error: 'unauthorized' });
    }
  });
};

// fastify-plugin 解除封装，hook 才能影响兄弟 plugin（routes/*）
export const authPlugin = fp(plugin, { name: 'auth-plugin' });