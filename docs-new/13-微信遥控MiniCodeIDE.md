# 微信遥控 MiniCodeIDE

> 通过微信给 MiniCodeIDE 发指令，人在外面，IDE 在家干活。
> 基于 `apps/remote-wechat` 模块，独立 Node 进程，通过 HTTP 桥接到本地 server-node。

---

## 一、架构总览

```
┌──────────────┐   iLink 长轮询    ┌───────────────────────┐   HTTP    ┌──────────────────┐
│   微信客户端  │ ───────────────► │  mci-remote (本进程)   │ ────────► │ server-node      │
│ (iOS/Android) │                  │  bridge + provider     │           │  :5175 (dev)     │
└──────────────┘                   └───────────────────────┘           │  :5174 (Electron)│
                                       │                                │  /api/remote/*   │
                                       │ 凭证持久化                      │  /api/chat       │
                                       ▼                                │  /api/approve    │
                                  ~/.mci/remote-wechat/                 └──────────────────┘
                                   credentials.json
```

**关键特征**：

- remote-wechat 是一个**独立 Node 进程**，不嵌入 IDE，不共享代码
- 后端统一为 server-node（dev 5175 / Electron 5174），不再有 Express
- bridge 首条消息进来时自动探测可用后端（5175→5174），也可通过 `MCI_BASE` 环境变量指定
- 运行在 **agent 模式**（全量工具），bridge 自动审批工具调用，微信端可读写文件、跑命令

---

## 二、数据流

### 2.1 消息收发完整链路

```
用户在微信发送 "帮我读一下 README.md"
  → iLink Bot 协议（长轮询 getUpdates）
    → ILinkProvider.handleMessage()
      → 去重检查（recentMsgIds Set，max 200）
      → bridge.handle(msg)
        → ensureSession(wxUserId)
          → POST /api/remote/sessions {wxUserId, mode:'code'}
          → server-node 的 findOrCreateForRemote()
            → 按 wxUserId 查找已有 session，没有就创建（mode='code', remoteUser=wxUserId）
          → 返回 sessionId
        → streamChat(sessionId, history, userMessage)
          → POST /api/chat {sessionId, userMessage, mode:'agent', messages:history}
          → server-node 执行 agent 模式（全量工具）
          → 读取 SSE 流：
            - type:text → 聚合到回复文本
            - type:tool_use → 打印日志
            - type:tool_result → 打印日志
            - type:approve_request → 自动审批 POST /api/approve/:id
          → 流结束，返回完整回复文本
        → sanitizeReply() 过滤残留的 tool_call XML（兜底）
        → 更新 historyCache（保留最近 10 轮）
        → 切片发送（微信单条 ≤ 2000 字，按 1800 字切片）
          → ILinkProvider.send() → POST /ilink/bot/sendmessage
```

### 2.2 Agent 模式 + 自动审批

bridge 以 `mode: 'agent'` 调用 server-node，LLM 可以使用全量工具。当 server-node 发出 `approve_request` SSE 事件时，bridge 自动调用审批 API 放行：

```typescript
// bridge.ts — 自动审批
if (j.type === 'approve_request') {
  await autoApprove(j.id, j.tool);
}

async function autoApprove(id: string, tool: string) {
  const base = await getBase();
  await fetch(`${base}/api/approve/${id}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ok: true }),
  });
}
```

这样远程通道虽然没有 IDE 前端审批弹窗，但 agent 的全量工具能力都能用——读文件、写代码、跑命令都行。

### 2.3 SSE 事件处理

| SSE 事件类型 | bridge 处理方式 |
|-------------|----------------|
| `text` | 聚合到回复文本 |
| `tool_use` | 打印日志（工具名） |
| `tool_result` | 打印日志（结果预览） |
| `approve_request` | **自动审批**（POST /api/approve/:id） |
| `meta` / `done` / `retrieval` | 忽略 |

### 2.4 iLink sendmessage 协议要点

iLink Bot 的 sendmessage API 对请求体格式要求严格，以下是实测确认的正确格式：

```json
{
  "msg": {
    "from_user_id": "",
    "to_user_id": "用户ID",
    "client_id": "mci_时间戳_随机串",
    "message_type": 2,
    "message_state": 2,
    "context_token": "从收到的消息中获取",
    "item_list": [{ "type": 1, "text_item": { "text": "回复内容" } }]
  },
  "base_info": { "channel_version": "1.0.3" }
}
```

**踩坑记录**：
- `message_state` 必须是数字 `2`，不是字符串 `"FINISH"`
- `base_info` 字段缺失会导致消息静默丢弃（API 返回 `{"ret":-1}` 但不报错）
- `context_token` 来自收到的消息，有有效期，bridge 在 AI 生成回复后尽快发送

---

## 三、模块结构

```
apps/remote-wechat/
├── src/
│   ├── index.ts          # 入口：创建 provider + bridge，启动进程
│   ├── provider.ts       # Provider 接口定义（start/stop/send）
│   ├── bridge.ts         # 桥接核心：微信消息 → server-node → 回复
│   ├── stub-provider.ts  # Stub 模式：本地 HTTP 模拟微信（开发测试用）
│   └── ilink-provider.ts # iLink 模式：真实微信 Bot 协议
├── package.json          # @mci/remote-wechat，依赖 qrcode-terminal + tsx
├── tsconfig.json         # ES2022 + ESM + Bundler moduleResolution
└── README.md             # 快速开始 + 环境变量说明
```

### 3.1 Provider 接口

```typescript
interface Provider {
  start(onInbound: InboundHandler): Promise<void>;
  stop(): Promise<void>;
  send(msg: OutboundMessage): Promise<void>;
}
```

扩展新通道只需实现此接口。

### 3.2 ILinkProvider 关键实现

| 功能 | 实现方式 |
|------|---------|
| 扫码登录 | `GET /ilink/bot/get_bot_qrcode?bot_type=3` → 终端渲染二维码 → 轮询状态 |
| 二维码渲染 | 动态 import qrcode-terminal，CJS 兼容：`mod.default ?? mod` |
| 消息拉取 | `POST /ilink/bot/getupdates`（长轮询，40s 超时） |
| 消息发送 | `POST /ilink/bot/sendmessage`，message_state=2（数字），单条 4000 字切片 |
| 凭证持久化 | `~/.mci/remote-wechat/credentials.json`（mode 0600），重启免扫码 |
| Token 过期 | 检测 401/403 → 清除凭证 → 重新扫码 |
| 消息去重 | recentMsgIds Set + FIFO 队列，max 200 条 |
| 错误退避 | 指数退避（3s * 1.5^n），上限 30s |

### 3.3 后端端口自动探测

bridge 首次请求时自动探测可用后端（5175→5174），探测结果缓存后不再重复。`MCI_BASE` 环境变量可强制指定。

---

## 四、启动方式

### 4.1 开发模式

```bash
# 终端 1：启动 server-node
pnpm -F @mini/server-node dev

# 终端 2：启动微信桥（iLink 模式）
cd apps/remote-wechat
WECHAT_PROVIDER=ilink pnpm dev
```

### 4.2 Electron 打包版

```bash
cd apps/remote-wechat
WECHAT_PROVIDER=ilink pnpm dev
# 或手动指定
MCI_BASE=http://127.0.0.1:5174 WECHAT_PROVIDER=ilink pnpm dev
```

### 4.3 Stub 模式（开发测试）

```bash
cd apps/remote-wechat && pnpm dev

# 另一个终端模拟消息：
curl -X POST http://127.0.0.1:5180/wechat/inbound \
  -H 'content-type: application/json' \
  -d '{"wxUserId":"u_test","text":"帮我读一下 README.md"}'
```

---

## 五、微信端操作

### 5.1 斜杠命令

| 命令 | 作用 |
|------|------|
| `/help` | 显示帮助 |
| `/reset` | 重置对话（清除 session 和历史） |
| `/mode` | 查看当前模式（agent 全量工具） |

### 5.2 普通消息

以 **agent 模式**运行（全量工具），LLM 可以读文件、写代码、跑命令，bridge 自动审批工具调用。维护每个微信用户的对话历史（最近 10 轮）。

### 5.3 长文切片

微信单条上限约 2000 字，bridge 按 1800 字切片。iLink 协议单条上限约 4000 字，ILinkProvider 也做了 4000 字切片。

---

## 六、安全设计

| 层面 | 措施 |
|------|------|
| 模式 | agent 模式（全量工具），bridge 自动审批所有工具调用 |
| 网络隔离 | Stub 模式只监听 `127.0.0.1` |
| 凭证保护 | credentials.json 权限 0600 |
| 会话隔离 | 每个微信用户独立 session，`remoteUser` 字段标记 |
| 超时保护 | SSE 流 180 秒空闲超时，防止 agent 僵死 |
| 文本过滤 | `sanitizeReply()` 兜底过滤 LLM 误吐出的 tool_call XML |

**安全考量**：远程通道的操作者是你自己（通过自己的微信发消息），信任度等同于坐在电脑前。bridge 自动审批所有工具调用，相当于省去了 IDE 前端弹窗。如果未来需要细粒度控制，可以在 `autoApprove` 中加工具白名单。

---

## 七、后端接口

### POST /api/remote/sessions

创建或获取远程 session（按 wxUserId 单例）。返回 SessionMeta。

### POST /api/chat

标准 chat 接口，bridge 以 `mode: 'agent'` 调用。返回 SSE 流。

### POST /api/approve/:id

审批工具调用。请求 `{ ok: true }` 放行。bridge 自动调用。

---

## 八、开发调试中踩过的坑

### 8.1 二维码不显示

`qrcode-terminal` 是 CJS 模块，ESM 环境动态 import 后方法在 `.default` 上。直接调 `qrcode.generate()` 失败，走进 catch 只打印 URL。

**修复**：`const qrcode = mod.default ?? mod;`

### 8.2 iLink sendmessage 返回 ret=-1

API 返回 HTTP 200 但 body 是 `{"ret":-1}`，消息没有送达。

**原因**：请求体格式不对：
1. `message_state` 应该是数字 `2`，不是字符串 `"FINISH"`
2. 缺少 `base_info: { channel_version: "1.0.3" }` 字段

### 8.3 AI 返回 tool_call XML 而不是文本

ask 模式下 LLM 没有工具可用，但系统提示词里仍有工具描述，LLM 生成了 tool_call 文本但无法执行。

**修复**：改为 agent 模式，工具实际执行。保留 `sanitizeReply()` 作为兜底过滤。

### 8.4 自动探测选错端口

两个 server-node 同时运行时（dev 5175 + Electron 5174），自动探测选了没有 LLM 配置的那个。

**修复**：通过 `MCI_BASE` 环境变量手动指定正确的后端地址。

### 8.5 bridge 无日志无超时

原始代码在 ensureSession 和 streamChat 之间没有任何日志输出，SSE 流读取也没有超时保护，出问题完全看不出卡在哪。

**修复**：每个关键步骤加了 `[bridge]` 前缀日志，SSE 流增加 180 秒空闲超时。

---

## 九、面试要点

### Q: 为什么做成独立进程？

1. **生命周期解耦**：IDE 关闭后微信通道可以继续运行
2. **进程隔离**：微信长轮询的网络开销和错误不影响 IDE 主进程
3. **安全边界**：远程通道在独立进程空间，即使被攻破也不影响 IDE
4. **扩展性**：同样的架构可以对接其他 IM

### Q: 远程 agent 模式的安全性如何保证？

bridge 代替 IDE 前端自动审批所有工具调用。操作者通过自己的微信发消息，信任度等同于坐在电脑前使用 IDE。如果需要更细粒度的控制，可以在 autoApprove 中加入工具白名单过滤。

### Q: iLink 协议的局限性？

1. 需要微信 >= 8.0.70（iOS / Android 均可）
2. bot_token 有有效期，过期后需重新扫码
3. 单条消息约 4000 字上限，长回复需切片
4. 非官方协议，可能随时变更

### Q: 如何扩展到企业微信？

实现新的 Provider，用企业微信 Webhook 回调接收消息、API 发送回复。核心 bridge 逻辑完全复用，只需替换消息收发层。
