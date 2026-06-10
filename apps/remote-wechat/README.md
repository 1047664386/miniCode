# @mci/remote-wechat — 微信遥控桥

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
                                   credentials.json
```

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 启动 IDE 后端

```bash
pnpm -F @mci/server-node dev
```

### 3. 启动桥接

**Stub 模式（默认，本地模拟）：**
```bash
pnpm -F @mci/remote-wechat dev
```

**iLink 模式（真实微信）：**
```bash
WECHAT_PROVIDER=ilink pnpm -F @mci/remote-wechat dev
```

## Provider 说明

通过环境变量 `WECHAT_PROVIDER` 选择通道，默认 `stub`。

### Stub Provider（默认）

本地 HTTP 模拟微信，用于开发测试：
- 监听 `127.0.0.1:5180/wechat/inbound` 接收消息（手动 curl 模拟微信）
- 把消息透传给 `http://127.0.0.1:5174/api/chat`
- SSE 回复聚合后通过 `WECHAT_OUTBOUND_URL`（如设置）回吐，否则打到 stdout

```bash
# 模拟"用户在微信发了一句话"
curl -X POST http://127.0.0.1:5180/wechat/inbound \
  -H 'content-type: application/json' \
  -d '{"wxUserId":"u_demo","text":"帮我读一下 README.md"}'
```

### ILink Provider（真实微信）

基于微信官方 iLink Bot 协议，扫码登录后可收发真实微信消息：
- 首次启动在终端显示二维码，用 iOS 微信扫码登录
- 登录凭证自动保存到 `~/.mci/remote-wechat/credentials.json`，重启免扫码
- 长轮询拉取微信消息，回复直接发到对方微信

```bash
WECHAT_PROVIDER=ilink pnpm -F @mci/remote-wechat dev
```

**登录流程：**
1. 终端显示二维码
2. 用 iOS 微信扫描二维码
3. 手机上点击确认
4. 登录成功，开始监听消息

**注意事项：**
- 需要 iOS 微信扫码（Android 暂不支持）
- 二维码过期会自动刷新（最多 3 次）
- 凭证文件权限为 0600，仅当前用户可读写
- 如需重新登录，删除 `~/.mci/remote-wechat/credentials.json`

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `WECHAT_PROVIDER` | `stub` | 通道选择：`stub` 或 `ilink` |
| `MCI_BASE` | `http://127.0.0.1:5174` | IDE 后端地址 |
| `WECHAT_INBOUND_PORT` | `5180` | Stub 模式入站监听端口 |
| `WECHAT_OUTBOUND_URL` | 无 | Stub 模式回复推送地址，不设则输出到 stdout |
| `WECHAT_BOT_TOKEN` | 无 | 可选鉴权 token |

## 斜杠命令

在微信聊天中发送以下命令：

| 命令 | 作用 |
|------|------|
| `/help` | 显示帮助 |
| `/reset` | 重置对话 |
| `/mode work\|code` | 切换模式（当前仅支持 work） |

## 安全

- Stub 模式只监听 `127.0.0.1`
- 启动时校验 `WECHAT_BOT_TOKEN` 环境变量（可选鉴权）
- 工具集走 `ToolRegistry.CHAT_ONLY_PROFILE`（远端默认无危险工具）
- 工作区切换、`run_command` 等高危操作直接拒绝
- iLink 凭证文件权限 0600

## 未来扩展

只需实现 `Provider` 接口（`start` / `stop` / `send`），即可接入更多通道：
- 企业微信回调：白名单内最稳，需企业资质
- 第三方网关：如 wechaty puppet-padlocal，订阅制
