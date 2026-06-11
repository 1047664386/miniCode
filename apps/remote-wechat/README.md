# @mci/remote-wechat — 微信遥控桥

> 把微信消息透传给本地 miniCodeIde server-node，让你在外面用微信发指令，IDE 在家干活。

## 设计

```
┌──────────────┐  长轮询/Webhook   ┌──────────────────────┐  HTTP   ┌──────────────────┐
│   微信客户端  │ ───────────────► │  mci-remote (本进程) │ ─────► │ server-node      │
│ (iOS/Android) │                  │  bridge + provider   │         │  :5175 (dev)     │
└──────────────┘                   └──────────────────────┘         │  :5174 (Electron)│
                                       ▲                            │  /api/remote/*   │
                                       │ 持久化 sessions             │  /api/chat       │
                                       ▼                            │  /api/approve    │
                                  ~/.mci/remote-wechat/             └──────────────────┘
                                   credentials.json
```

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 启动 IDE 后端

**方式 A — 开 Electron 桌面应用**（推荐，自带 server-node 在 5174）

**方式 B — 命令行启动 dev server-node：**
```bash
pnpm -F @mini/server-node dev
```

### 3. 启动桥接

**Stub 模式（默认，本地模拟）：**
```bash
cd apps/remote-wechat
pnpm dev
```

**iLink 模式（真实微信）：**
```bash
cd apps/remote-wechat
WECHAT_PROVIDER=ilink pnpm dev
```

如果自动探测选错了端口，可以手动指定：
```bash
MCI_BASE=http://127.0.0.1:5174 WECHAT_PROVIDER=ilink pnpm dev
```

## Provider 说明

通过环境变量 `WECHAT_PROVIDER` 选择通道，默认 `stub`。

### Stub Provider（默认）

本地 HTTP 模拟微信，用于开发测试：
- 监听 `127.0.0.1:5180/wechat/inbound` 接收消息（手动 curl 模拟微信）
- 把消息透传给 server-node 的 `/api/chat`
- SSE 回复聚合后通过 `WECHAT_OUTBOUND_URL`（如设置）回吐，否则打到 stdout

```bash
# 模拟"用户在微信发了一句话"
curl -X POST http://127.0.0.1:5180/wechat/inbound \
  -H 'content-type: application/json' \
  -d '{"wxUserId":"u_demo","text":"帮我读一下 README.md"}'
```

### ILink Provider（真实微信）

基于微信 iLink Bot 协议，扫码登录后可收发真实微信消息：
- 首次启动在终端显示二维码，用微信（iOS / Android ≥ 8.0.70）扫码登录
- 登录凭证自动保存到 `~/.mci/remote-wechat/credentials.json`，重启免扫码
- 长轮询拉取微信消息，回复直接发到对方微信
- 运行在 **agent 模式**（全量工具），bridge 自动审批工具调用

```bash
WECHAT_PROVIDER=ilink pnpm dev
```

**登录流程：**
1. 终端显示二维码
2. 用微信扫描二维码（iOS 或 Android ≥ 8.0.70）
3. 手机上点击确认
4. 登录成功，开始监听消息

**注意事项：**
- iOS / Android 微信均可扫码（Android 需 ≥ 8.0.70 版本）
- 二维码过期会自动刷新（最多 3 次）
- 凭证文件权限为 0600，仅当前用户可读写
- 如需重新登录，删除 `~/.mci/remote-wechat/credentials.json`

## 工作原理

### Agent 模式 + 自动审批

bridge 以 `mode: 'agent'` 调用 server-node 的 `/api/chat`，LLM 可以使用全量工具（读文件、写代码、跑命令等）。当 server-node 发出 `approve_request` SSE 事件时，bridge 自动 POST `/api/approve/:id` 放行，替代 IDE 前端的审批弹窗。

```
微信消息 → bridge → POST /api/chat (mode:agent)
                      → LLM 生成文本 → SSE type:text → bridge 聚合
                      → LLM 调用工具 → SSE type:tool_use
                      → 需要审批   → SSE type:approve_request → bridge 自动审批
                      → 工具执行   → SSE type:tool_result
                      → LLM 生成最终回复 → SSE type:text → bridge 聚合
                    → 流结束 → bridge 发送完整回复到微信
```

### SSE 事件处理

| SSE 事件类型 | bridge 处理方式 |
|-------------|----------------|
| `text` | 聚合到回复文本 |
| `tool_use` | 打印日志（工具名） |
| `tool_result` | 打印日志（结果预览） |
| `approve_request` | **自动审批**（POST /api/approve/:id {ok:true}） |
| `meta` / `done` / `retrieval` | 忽略 |

### 超时保护

SSE 流读取设有 180 秒空闲超时。如果 server-node 3 分钟无新数据，bridge 自动中止流并返回已聚合的文本。

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `WECHAT_PROVIDER` | `stub` | 通道选择：`stub` 或 `ilink` |
| `MCI_BASE` | 自动探测 | IDE 后端地址（自动尝试 5175→5174；也可手动指定，如 `http://127.0.0.1:5175`） |
| `WECHAT_INBOUND_PORT` | `5180` | Stub 模式入站监听端口 |
| `WECHAT_OUTBOUND_URL` | 无 | Stub 模式回复推送地址，不设则输出到 stdout |
| `WECHAT_BOT_TOKEN` | 无 | 可选鉴权 token |

## 斜杠命令

在微信聊天中发送以下命令：

| 命令 | 作用 |
|------|------|
| `/help` | 显示帮助 |
| `/reset` | 重置对话（清除 session 和历史） |
| `/mode` | 查看当前模式（agent 全量工具） |

## 安全

- Stub 模式只监听 `127.0.0.1`
- 启动时校验 `WECHAT_BOT_TOKEN` 环境变量（可选鉴权）
- agent 模式下 bridge 自动审批所有工具调用（信任微信操作者）
- iLink 凭证文件权限 0600
- SSE 流 180 秒空闲超时，防止僵死

## 已修复的问题

| 问题 | 原因 | 修复 |
|------|------|------|
| 终端不显示二维码 | `qrcode-terminal` 是 CJS 模块，动态 import 后方法在 `.default` 上 | `const qrcode = mod.default ?? mod` |
| 微信收不到回复 | iLink sendmessage 请求体格式错误 | `message_state: 2`（数字，非字符串）+ 添加 `base_info: {channel_version: '1.0.3'}` |
| AI 返回 tool_call XML | ask 模式无工具但 LLM 仍生成工具调用文本 | 改为 agent 模式，工具实际执行 |
| 自动探测选错端口 | dev server-node 无 LLM 配置 | 自动探测 + `MCI_BASE` 手动覆盖 |

## 未来扩展

只需实现 `Provider` 接口（`start` / `stop` / `send`），即可接入更多通道：
- 企业微信回调：白名单内最稳，需企业资质
- 第三方网关：如 wechaty puppet-padlocal，订阅制
