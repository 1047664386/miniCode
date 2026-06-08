
/**
 * /api/workspace + /api/skills —— 桌面 UI 兼容层（云端无意义）
 *
 * 注意：/api/agents/* 已由 routes/agents.ts 提供真实实现（M3 起），
 * 这里只剩 desktop-only 的 fs/workspace 概念。
 */
import type { FastifyPluginAsync } from 'fastify';

export const registerCompatRoutes: FastifyPluginAsync = async (app) => {
  // 桌面 IDE 的 workspace 概念，云端无意义 → 返回空（云端用 sandbox 代替）
  app.get('/api/workspace', async () => ({ path: '/sandbox' }));

  // 技能列表：M5 之后再做
  app.get('/api/skills', async () => []);
};