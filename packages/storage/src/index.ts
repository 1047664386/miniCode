/**
 * @mini/storage — 持久化抽象层
 *
 * 目标：支持桌面 (JSONL / SQLite) + 云端 (Postgres) 三套实现，业务层不感知。
 *
 * Roadmap：
 *  - v1 (M1)：抽接口 + JsonlStorage 实现 (复刻现有 apps/server/src/session-store.ts)
 *  - v2     ：PrismaSqliteStorage（桌面版未来切换）
 *  - v3 (M2)：PrismaPgStorage（网页版云端）
 *
 * 切换策略：环境变量 STORAGE_KIND = jsonl | sqlite | postgres
 */
export * from './types.js';
export { JsonlStorage } from './jsonl.js';
export { PgStorage } from './prisma-pg.js';
export { createStorage } from './factory.js';

// 重新导出 Prisma 7 生成的 client（custom output 之后必须从这里导入）
// 业务方：import { PrismaClient } from '@mini/storage';
export { PrismaClient, Prisma } from './generated/prisma/index.js';