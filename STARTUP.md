# MiniCodeIDE 启动 / 构建 / 打包指南

## 前置要求

| 工具 | 版本要求 | 说明 |
|------|---------|------|
| Node.js | >= 20.x | 推荐 v22+ |
| pnpm | 9.x | 包管理器，`npm i -g pnpm@9` |
| Docker | 可选 | 仅云端部署（Postgres）时需要 |

---

## 1. 安装依赖

```bash
# 在项目根目录执行
pnpm install
```

首次安装会生成 `pnpm-lock.yaml`。`.npmrc` 已配置国内 Electron 镜像，无需额外设置。

---

## 2. 开发模式启动

项目采用前后端分离架构，需要**同时启动后端和前端**。

### 2.1 启动后端（二选一）

**方案 A：裸 Node 后端（推荐，启动更快）**

```bash
pnpm devserver
# 即 pnpm --filter @mini/server-node run dev
# 监听 http://127.0.0.1:5174
```

**方案 B：Express 后端（功能更全）**

```bash
pnpm devserverexpress
# 即 pnpm --filter @mini/server run dev
# 监听 http://localhost:5174
```

两个后端共享核心逻辑（`apps/server/src/` 下的模块），区别：
- `server-node`：裸 Node http + 手写 Router，无 Express 依赖，启动 ~10ms
- `server`：Express + 完整中间件链（auth / rateLimit / metrics），启动稍慢

### 2.2 启动前端

**Web 模式（浏览器访问）**

```bash
pnpm devapp
# 即 pnpm --filter @mini/desktop run dev
# 监听 http://localhost:5173
# 自动代理 /api → http://localhost:5174
```

浏览器打开 http://localhost:5173 即可使用。

**Electron 模式（桌面应用）**

```bash
pnpm develectron
# 即 pnpm --filter @mini/electron run dev
# 需要 ELECTRON_DEV=1 环境变量（已配置在 script 中）
```

> 注意：Electron 模式需要先构建 server 和 desktop 的产物到 `apps/electron/resources/` 下。

### 2.3 一键全部启动

```bash
pnpm dev
# 并行启动所有 apps/* 和 packages/* 的 dev 脚本
```

---

## 3. 环境变量配置

### 3.1 本地开发（桌面模式）

桌面模式**不需要** `.env` 文件，后端默认使用：
- 端口：5174
- 工作区：当前目录（`process.cwd()`）
- 存储：本地 JSONL 文件
- LLM：需要在 UI 的 Settings 面板配置 API Key

### 3.2 云端部署

复制示例文件并修改：

```bash
cp .env.example .env
```

关键变量：

```bash
# 数据库（云端模式需要）
DATABASE_URL="postgresql://mci:mci@localhost:5433/mci?schema=public"
STORAGE_KIND=postgres

# 服务端口
PORT=4000

# LLM 配置（至少配一个）
OPENAI_API_KEY=sk-xxx
# 或
ANTHROPIC_API_KEY=sk-ant-xxx

# 默认模型
LLM_BASE_URL=https://api1.deepseek.com/v1
LLM_MODEL=deepseek-chat

# 沙箱模式
SANDBOX_KIND=mem   # mem=本地进程(开发用), e2b=E2B(生产推荐)
```

---

## 4. Docker（云端部署用）

本地开发**不需要**启动 Docker。仅云端部署（`apps/server-cloud`）需要 Postgres。

```bash
cd infra
docker-compose up -d
# Postgres: localhost:5433 (user: mci, password: mci, db: mci)
# Adminer:  http://localhost:8080
```

---

## 5. 构建

### 5.1 单包构建

```bash
# 构建 server-node
pnpm --filter @mini/server-node build

# 构建 desktop（Vite 前端）
pnpm --filter @mini/desktop build

# 构建 Express server
pnpm --filter @mini/server build
```

### 5.2 全量构建

```bash
pnpm build
# 即 pnpm -r run build，构建所有包
```

### 5.3 类型检查

```bash
# 全量类型检查
pnpm typecheck

# 单包类型检查
pnpm --filter @mini/core typecheck
```

---

## 6. 打包桌面应用（Electron 分发）

打包前需要先构建 server 和 desktop 产物：

```bash
# macOS (DMG + ZIP)
pnpm dist:mac

# macOS 快速打包（仅 ZIP, arm64）
pnpm dist:mac:fast

# Windows (NSIS)
pnpm dist:win

# Linux (AppImage + deb)
pnpm dist:linux

# 使用 Express 后端打包
pnpm dist:express
```

产物输出到 `apps/electron/release/`。

> 首次打包前建议清理旧产物：`pnpm clean`

---

## 7. 测试

```bash
# 运行 core 包测试
pnpm --filter @mini/core test

# 运行 eval 套件
pnpm evals
```

---

## 8. 常用命令速查

| 命令 | 说明 |
|------|------|
| `pnpm install` | 安装依赖 |
| `pnpm dev` | 并行启动所有服务 |
| `pnpm devserver` | 启动裸 Node 后端 (5174) |
| `pnpm devserverexpress` | 启动 Express 后端 (5174) |
| `pnpm devapp` | 启动前端 (5173) |
| `pnpm develectron` | 启动 Electron 桌面应用 |
| `pnpm build` | 全量构建 |
| `pnpm typecheck` | 全量类型检查 |
| `pnpm dist:mac` | 打包 macOS 应用 |
| `pnpm clean` | 清理所有构建产物 |
| `pnpm --filter @mini/core test` | 运行 core 测试 |

---

## 9. 项目结构

```
Ai-miniCodeIde/
├── apps/
│   ├── desktop/        # React 前端 (Vite + Monaco + zustand)
│   ├── electron/       # Electron 壳
│   ├── server/         # Express 后端 (主实现)
│   ├── server-node/    # 裸 Node 后端 (轻量替代)
│   ├── server-cloud/   # 云端后端 (Fastify + Prisma + Postgres)
│   ├── web/            # 纯 Web 前端 (简化版)
│   └── remote-wechat/  # 微信遥控桥
├── packages/
│   ├── core/           # 核心域 (LLM / Agent / Memory / Context / Prompts)
│   └── indexer/        # 代码索引 (BM25 + tree-sitter + Vector + RRF)
├── evals/              # 评测套件
├── infra/              # Docker Compose (Postgres + Adminer)
└── pnpm-workspace.yaml # monorepo 配置
```

---

## 10. 常见问题

### Q: `pnpm dev` 报错 "does not provide an export named 'xxx'"
A: `packages/core` 缺少对应导出。检查 `packages/core/src/*/index.ts` 是否导出了该符号。

### Q: 前端白屏 / API 请求 404
A: 确保后端已启动在 5174 端口。前端 Vite 配置了 `proxy: { '/api': 'http://localhost:5174' }`。

### Q: Electron 模式白屏
A: Electron 加载 `file://` 协议，需要先构建产物到 `apps/electron/resources/`。

### Q: 索引构建失败
A: 首次启动会自动构建索引（hash embedder，无需 API Key）。如果 tree-sitter 报错，检查 `pnpm install` 是否成功安装了 native 模块。

### Q: 如何配置 LLM API Key？
A: 启动后在 UI 的 Settings 面板添加 Provider（支持 OpenAI 兼容 / Anthropic），或通过 `.env` 设置 `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`。
