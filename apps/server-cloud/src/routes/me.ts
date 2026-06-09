
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
import { encryptApiKey, decryptApiKey } from '../llm/crypto.js';

/**
 * 遍历 providerConfig，加密 / 解密 apiKey 字段
 */
function encryptProfileKeys(profiles: any[]): any[] {
  return profiles.map((p) => {
    const out = { ...p };
    if (out.apiKey) out._apiKeyEnc = encryptApiKey(out.apiKey);
    delete out.apiKey;
    if (Array.isArray(out.apiKeys)) {
      out._apiKeysEnc = out.apiKeys.map((k: string) => encryptApiKey(k));
      delete out.apiKeys;
    }
    return out;
  });
}

function decryptProfileKeys(profiles: any[]): any[] {
  return profiles.map((p) => {
    const out = { ...p };
    if (out._apiKeyEnc) {
      try { out.apiKey = decryptApiKey(out._apiKeyEnc); } catch { /* 解密失败则忽略 */ }
    }
    delete out._apiKeyEnc;
    if (Array.isArray(out._apiKeysEnc)) {
      try { out.apiKeys = out._apiKeysEnc.map((k: string) => decryptApiKey(k)); } catch { /* */ }
    }
    delete out._apiKeysEnc;
    return out;
  });
}

/** 脱敏：只保留末尾 4 位 */
function maskProfileKeys(profiles: any[]): any[] {
  return profiles.map((p) => {
    const out = { ...p };
    if (out.apiKey) out.apiKey = '***' + out.apiKey.slice(-4);
    if (Array.isArray(out.apiKeys)) {
      out.apiKeys = out.apiKeys.map((k: string) => '***' + k.slice(-4));
    }
    // 清除加密字段，不暴露给前端
    delete out._apiKeyEnc;
    delete out._apiKeysEnc;
    return out;
  });
}

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

  // ===== 用户设置（Provider 配置等） =====

  /**
   * GET /api/me/settings
   * 返回用户设置 JSON，其中 API key 已脱敏（仅显示末 4 位）
   */
  app.get('/settings', async (req) => {
    const u = await app.prisma.user.findUnique({
      where: { id: req.userId },
      select: { settings: true },
    });
    const raw = (u?.settings as any) ?? null;
    if (!raw) return { settings: null };

    // 脱敏 API keys
    const settings = { ...raw };
    if (settings.providerConfig?.profiles) {
      // 从 DB 读出时有 _apiKeyEnc，需要解密再脱敏给前端
      const decrypted = decryptProfileKeys(settings.providerConfig.profiles);
      settings.providerConfig = {
        ...settings.providerConfig,
        profiles: maskProfileKeys(decrypted),
      };
    }
    return { settings };
  });

  /**
   * PUT /api/me/settings
   * 保存用户设置。body 中 providerConfig.profiles 里的 apiKey / apiKeys 会被加密存储。
   */
  app.put('/settings', async (req, reply) => {
    const body = (req.body ?? {}) as any;
    if (!body.settings || typeof body.settings !== 'object') {
      return reply.code(400).send({ error: 'settings object required' });
    }

    const settings = { ...body.settings };
    // 加密 API keys
    if (settings.providerConfig?.profiles) {
      settings.providerConfig = {
        ...settings.providerConfig,
        profiles: encryptProfileKeys(settings.providerConfig.profiles),
      };
    }

    await app.prisma.user.update({
      where: { id: req.userId },
      data: { settings: settings as any },
    });
    return { ok: true };
  });
};