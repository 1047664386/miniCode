/**
 * Prisma 7 配置文件
 * ---------------------------------------------------------------
 * Prisma 7 起，datasource 的 `url` 不再写在 schema.prisma 里，
 * 而是在这里配置（或者运行时传 adapter 给 PrismaClient）。
 *
 * 我们这边迁移工具（migrate / generate）走 process.env.DATABASE_URL，
 * 运行时业务代码自己 new PrismaClient({ datasourceUrl: ... })。
 */
import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
  },
  // Prisma 7 要求 migrate 命令通过环境变量拿 URL，这里显式声明
  // （等价于继续使用 DATABASE_URL）
  datasource: {
    url: process.env.DATABASE_URL,
  },
});