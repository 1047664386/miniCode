
# miniCodeIde 网页版（@mini/web + @mini/server-cloud）

⚠️ M2 骨架阶段 —— 只支持 **Work 模式**（聊天），LLM 流是 mock echo。
Code 模式（云沙箱）排到 M3。

## 一键起本地（4 步）

```bash
# 0. 装依赖（仓库根目录跑一次）
pnpm install

# 1. 起 Postgres + Adminer（默认 5432 / 8080）
cd infra && docker compose up -d && cd ..

# 2. 配 .env（DATABASE_URL 已对齐 docker-compose 默认）
cp .env.example .env

# 3. 跑 Prisma migrate（首次）+ generate client
pnpm --filter @mini/storage prisma:migrate
pnpm --filter @mini/storage prisma:generate
```

## 启动服务（两个终端）

```bash
# 终端 A：云端 API（端口 4000）
pnpm --filter @mini/server-cloud dev

# 终端 B：前端（端口 5174，自动代理 /api → 4000）
pnpm --filter @mini/web dev
```

打开 http://localhost:5174 即可。

## 当前功能

- ✅ 匿名 token（自动创建匿名用户）
- ✅ 多租户隔离（PgStorage 按 userId 过滤）
- ✅ 会话 CRUD（list / create / delete）
- ✅ SSE 流式聊天（mock）
- ⏳ 真 LLM 接入 → M5
- ⏳ Code 模式云沙箱 → M3
- ⏳ 微信扫码登录 → M5
- ⏳ 部署生产 → 本里程碑 Step 7

## 与桌面版的对比

| 维度 | 桌面 (apps/desktop + apps/server) | 网页 (apps/web + apps/server-cloud) |
|------|--------|--------|
| 存储 | JsonlStorage（文件） | PgStorage（Postgres） |
| 部署 | Electron 打包 | Docker 部署到云主机 |
| 认证 | 无 | JWT (cookie) + 匿名/微信 |
| 多用户 | ❌ | ✅ |
| Code 模式 | 本地 fs | 云沙箱（M3 未实现） |
| LLM Key | 用户本机存 | 平台 Key + BYOK（M5） |

代码共享：
- `packages/core` 100% 共享（LLM + tool）
- `packages/storage` 100% 共享（接口统一）
- `apps/desktop/src/agents-window` 通过 vite alias `@desktop` 可被 web 引（M3+ 移植）