
# @mci/remote-wechat — 微信遥控桥 MVP

> 把微信消息透传给本地 miniCodeIde server-node，让你在外面用微信发指令，IDE 在家干活。

## 设计

```
┌──────────────┐  长轮询/Webhook   ┌──────────────────────┐  HTTP   ┌─────────────────┐
│   微信客户端  │ ───────────────► │  mci-remote (本进程) │ ─────► │ server-node:5174│
└──────────────┘                  └──────────────────────┘         │  /api/remote/*  │
                                       ▲                            │  /api/chat      │
                                       │ 持久化 sessions             └─────────────────┘
                                       ▼
                                  ~/.mci/remote-wechat/
                                   bot-token.json
                                   sessions.jsonl
```

## V0 — Stub Provider（**当前实现**）

为了让链路先打通、不依赖任何外部协议，V0 内置 `StubProvider`：
- 监听本地 HTTP `127.0.0.1:5180/wechat/inbound` 接收消息（手动 curl 模拟微信）
- 把消息透传给 `http://127.0.0.1:5174/api/chat`
- SSE 回复聚合后通过 `WECHAT_OUTBOUND_URL`（如设置）回吐，否则打到 stdout

这意味着今天就能 e2e 跑通：
```bash
# 1. 启动 IDE 后端
pnpm -F @mci/server-node dev

# 2. 启动桥接
pnpm -F @mci/remote-wechat dev

# 3. 模拟"用户在微信发了一句话"
curl -X POST http://127.0.0.1:5180/wechat/inbound \
  -H 'content-type: application/json' \
  -d '{"wxUserId":"u_demo","text":"帮我读一下 README.md"}'
```

## V1 — 真·微信通道（待实现）

可选三选一（按合规风险升序）：
1. **企业微信回调**：白名单内最稳，需企业资质
2. **iLink 协议**：参考 cf-remote，QR 登录后长轮询，覆盖个人号
3. **第三方网关**：如 wechaty puppet-padlocal，订阅制

V1 只需替换 `provider.ts`，链路其他部分不变。

## 安全

- 只监听 `127.0.0.1`
- 启动时校验 `WECHAT_BOT_TOKEN` 环境变量（可选鉴权）
- 工具集走 `ToolRegistry.CHAT_ONLY_PROFILE`（远端默认无危险工具）
- 工作区切换、`run_command` 等高危操作 V0 直接拒绝