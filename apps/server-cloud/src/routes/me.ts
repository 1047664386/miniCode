
/**
 * /api/me/* —— 用户自服务（BYOK / 偏好）
 *
 * BYOK 流程：
 *   PATCH /api/me/api-key  { kind?, baseUrl?, model?, apiKey }
 *      → 加密存 User.llmKeyEnc，下次 chat 自动用用户 key（不计 quota）
 *
 *   DELETE /api/me/api-key
 *      → 清空，回到平台 key + freeQuota 模式
 *
 *   GET /api/me/api-key
 *      → 返回是否已配置 + base/model/kind 公开字段（永远不回明文 key）
 */
import type { FastifyPluginAsync } from 'fastify';
import { encryptApiKey } from '../llm/crypto.js';

export const registerMeRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api-key', async (req) => {
    const u = await app.prisma.user.findUnique({
      where: { id: req.userId },
      select: { llmKeyEnc: true, llmBaseUrl: true, llmModel: true, llmKind: true },
    });
    return {
      configured: !!u?.llmKeyEnc,
      baseUrl: u?.llmBaseUrl ?? null,
      model: u?.llmModel ?? null,
      kind: u?.llmKind ?? null,
    };
  });

  app.patch('/api-key', async (req, reply) => {
    const body = (req.body ?? {}) as any;
    const apiKey = String(body.apiKey ?? '').trim();
    if (!apiKey) return reply.code(400).send({ error: 'apiKey required' });

    const enc = encryptApiKey(apiKey);
    const baseUrl = body.baseUrl ? String(body.baseUrl) : null;
    const model = body.model ? String(body.model) : null;
    const kind = body.kind ? String(body.kind) : null;

    await app.prisma.user.update({
      where: { id: req.userId },
      data: { llmKeyEnc: enc, llmBaseUrl: baseUrl, llmModel: model, llmKind: kind },
    });
    return { ok: true };
  });

  app.delete('/api-key', async (req) => {
    await app.prisma.user.update({
      where: { id: req.userId },
      data: { llmKeyEnc: null, llmBaseUrl: null, llmModel: null, llmKind: null },
    });
    return { ok: true };
  });

  // 当前用户用量（前端展示「已用 / 总额」用）
  app.get('/usage', async (req) => {
    const u = await app.prisma.user.findUnique({
      where: { id: req.userId },
      select: { usedTokens: true, freeQuota: true, llmKeyEnc: true },
    });
    return {
      usedTokens: u?.usedTokens ?? 0,
      freeQuota: u?.freeQuota ?? 0,
      byok: !!u?.llmKeyEnc,
    };
  });
};