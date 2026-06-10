
# Server 实现说明

本仓库当前维护**一套**本地 server 实现（`apps/server-node`），业务逻辑通过 `packages/server-core` 共享。

| 目录 | 包名 | 框架 | bundle 大小 | 启动 | 角色 |
|---|---|---|---|---|---|
| `apps/server-node` | `@mini/server-node` | 裸 `node:http` + `ws` (手写 Router) | **564 KB** | **~50 ms** | 本地 IDE 后端，参考 CodeFlicker `gateway/server.impl.ts` |
| `apps/server-cloud` | — | Fastify + Prisma + PG | — | — | Web 云端版本，独立部署，JWT + PostgreSQL |

> 历史上还存在 `apps/server`（Express 版）和 `apps/server-nest`（NestJS 重写），均已于 2026-06 删除：
> - `apps/server` 的业务逻辑已迁移到 `packages/server-core`，由 `server-node` 通过 `@mini/server-core` 导入
> - `apps/server-nest`：bundle 巨大、启动慢、装饰器 + DI 让小型本地 IDE server 更难调试

## 架构

```
packages/server-core  ← 纯业务逻辑（store / router / retrieval / agents / mcp / git）
        ↑
apps/server-node      ← HTTP 层 + 手动 Services container，导入 @mini/server-core
apps/server-cloud     ← 独立云后端，不依赖 server-core
```

### Bare Node (`apps/server-node`)
- `http.createServer(handler)` + 手写 `Router`
  - `compile('/api/sessions/:id')` 编译成 RegExp
  - `*` 支持 wildcard
- 中间件就是普通函数（在 `handler` 内顺序调用）
  - CORS preflight、auth、token-bucket rate limit、access log
- SSE 抽象成 `openSse(req, res) → { send, end, signal }`
- 手动 `Services` container：构造函数按顺序 `new` 所有 store，无 DI、无 decorators、无 `reflect-metadata`
- WS 通过 `httpServer.on('upgrade')` 挂载 lsp/terminal bridge

启动日志示例：
```
[server-node] services ready (21.1ms)
[server-node] 64 routes registered
[lsp] bridge ready on ws://host/lsp/<lang>
[terminal] bridge ready on ws://host/terminal
[server-node] 🚀 listening on http://127.0.0.1:18250
[server-node] startup total 26.4ms
```

## 共享代码 (`packages/server-core`)

`apps/server-node/src/services.ts` 与 `handlers/register.ts` 通过 `@mini/server-core` 引用共享业务模块：

- `store/` — pending-edit / checkpoint / rules / slash-commands / providers / session-store / skill-store / project-memory
- `agent/` — subagent-manager / agent-profile-loader / slash-commands / system-hooks
- `llm/` — llm-router / key-rotator
- `git/` — git-helpers
- `indexer/` — retrieval / reranker / watcher
- `exec/` — exec-policy / permission-aware-policy
- `tasks/` — bg-tasks / verify-after-accept / worktree-manager
- `bridge/` — lsp-bridge / terminal-bridge / mcp-client
- `utils/` — detect-hint / diagnostics / glob-regex / mentions / logger

这些模块本身**不依赖任何 HTTP 框架**，esbuild 能直接 bundle。

## E2E 验证记录（2026-06）

### server-node 完整链路

```
[prepare] server target: server-node (@mini/server-node)
[prepare] staged 8/8 native packages → server/node_modules/
[prepare] done.   ← 总耗时 ~2s
```

```
$ PORT=18250 node apps/electron/resources/server/main.mjs
[server-node] services ready (21.1ms)
[server-node] 64 routes registered
[server-node] 🚀 listening on http://127.0.0.1:18250
[server-node] startup total 26.4ms
```

```
$ for p in /api/health /api/version /api/providers /api/sessions /api/edits \
          /api/checkpoints /api/rules /api/slash /api/skills /api/subagents \
          /api/memory /api/files; do
    curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:18250$p
  done
200 × 12   ✓ all green
```
