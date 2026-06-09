
/**
 * env.ts —— 环境变量统一入口
 */
import path from 'node:path';

export const env = {
  PORT: Number(process.env.PORT ?? 5175),
  WORKSPACE: process.env.WORKSPACE ? path.resolve(process.env.WORKSPACE) : process.cwd(),
  AUTH_TOKEN: process.env.MINI_AUTH_TOKEN?.trim() || '',
  AUTH_TOKENS: (process.env.MINI_AUTH_TOKENS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  RATE_LIMIT: Number(process.env.MINI_RATE_LIMIT ?? 0),
  RATE_LIMIT_CHAT: Number(process.env.MINI_RATE_LIMIT_CHAT ?? 0),
  LOG_LEVEL: (process.env.MINI_LOG_LEVEL ?? 'info').toLowerCase(),
};