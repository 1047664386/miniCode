
# Server 实现说明

本仓库当前维护**两套** server 实现，共享同一组业务逻辑（store / router / retrieval 等），
通过环境变量 `SERVER_TARGET` 在 Electron 打包时切换。

| 目录 | 包名 | 框架 | bundle 大小 | 启动 | 角色 |
|---|---|---|---|---|---|
| `apps/server` | `@mini/server` | Express + cors | **1.7 MB** | ~700 ms | **默认 / 兜底**，稳定可信赖 |
| `apps/server-node` | `@mini/server-node` | 裸 `node:http` + `ws` (手写 Router) | **564 KB** | **~50 ms** | 进阶 / 长期方向，参考 CodeFlicker `gateway/server.impl.ts` |

> 历史上还存在 `apps/server-nest`（NestJS 重写），已于 2026-06 删除：
> - bundle 巨大（含 reflect-metadata + DI 元数据 + rxjs）
> - 启动慢，pnpm deploy 阶段 850 MB / 4 分钟
> - 装饰器 + DI 反而让"小型本地 IDE server"更难调试

## 切换方式

```bash
# 默认：Express
node scripts/prepare-electron-resources.mjs

# 切换到裸 Node
SERVER_TARGET=server-node node scripts/prepare-electron-resources.mjs
```

`prepare-electron-resources.mjs` 会：
1. 根据 `SERVER_TARGET` 决定从哪个 `apps/<target>/dist/main.mjs` 拷
2. 按需触发 `pnpm --filter <pkg> build`
3. 拷 8 个 native binding 到 `resources/server/node_modules`
4. 总产物 **49–52 MB**

## 设计差异

### Express (`apps/server`)
- 经典 `express()` + `app.get/post`
- 中间件链：`cors → json → auth → rateLimit → routes`
- SSE 用 `res.setHeader` + `res.write` 手动管
- WS 通过 `httpServer.on('upgrade')` 挂载 lsp/terminal bridge

### Bare Node (`apps/server-node`)
- `http.createServer(handler)` + 手写 `Router`
  - `compile('/api/sessions/:id')` 编译成 RegExp
  - `*` 支持 wildcard
- 中间件就是普通函数（在 `handler` 内顺序调用）
  - CORS preflight、auth、token-bucket rate limit、access log
- SSE 抽象成 `openSse(req, res) → { send, end, signal }`
- 手动 `Services` container：构造函数按顺序 `new` 所有 store，无 DI、无 decorators、无 `reflect-metadata`
- WS 同样 `httpServer.on('upgrade')`

启动日志示例（裸 Node）：
```
[server-node] services ready (21.1ms)
[server-node] 64 routes registered
[lsp] bridge ready on ws://host/lsp/<lang>
[terminal] bridge ready on ws://host/terminal
[server-node] 🚀 listening on http://127.0.0.1:18250
[server-node] startup total 26.4ms
```

## 共享代码

`apps/server-node/src/services.ts` 与 `handlers/register.ts` 通过相对路径
（`../../server/src/*`）引用 `apps/server` 中的纯逻辑模块：

- `pending-edit.ts` / `checkpoint.ts` / `rules.ts` / `slash-commands.ts`
- `providers.ts` / `session-store.ts` / `skill-store.ts` / `subagent-manager.ts`
- `llm-router.ts` / `reranker.ts` / `retrieval.ts` / `exec-policy.ts`
- `mentions.ts` / `git-helpers.ts` / `watcher.ts`
- `lsp-bridge.ts` / `terminal-bridge.ts`

这些模块本身**不依赖 express**（已用 `grep -l "from 'express'" apps/server/src/*.ts` 验证：
只有 `main.ts` 和 `middleware.ts` 引用 express），所以 esbuild 能直接 bundle 进 server-node。

### 已知技术债
这种"应用 A 借应用 B 的源码"是 monorepo 反模式。
后续可以提取为 `packages/server-core/`：
1. 把上述共享文件迁移过去
2. `apps/server` 和 `apps/server-node` 都改成 `import from '@mini/server-core'`
3. 删除相对路径跨越

当前不做的原因：拆包要重新构建 type 边界与导出面，工作量 ~半天且对运行无收益。

## E2E 验证记录（2026-06）

### `SERVER_TARGET=server-node` 完整链路

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

总 resources 大小 49 MB（vs Express 52 MB，仅因 bundle 本身小 ~1 MB）。

## 何时该用哪个？

| 场景 | 推荐 |
|---|---|
| **生产 / 用户构建** | `SERVER_TARGET=server`（Express，久经验证） |
| **本地开发 / 演示** | `SERVER_TARGET=server-node`（启动 14× 快） |
| **CI 冷启动测试** | `server-node` |
| **Express middleware ecosystem 需求** | `server` |
| **打到极致的小体积** | `server-node` |