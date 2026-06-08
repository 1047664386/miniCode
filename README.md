
# MiniCodeIDE

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


> 从零搭建的 Cursor / Qoder 风格 AI 代码编辑器。  
> **一个能跑、能改、能讲清楚每一行为什么这么写**的项目。

---

## ✨ Features

### 编辑器
- 🎨 **Monaco 编辑器** + 多 tab + 文件树
- 🧠 **TypeScript LSP**（WebSocket 桥到 `typescript-language-server`）
- 👻 **Inline Ghost Text 补全**（Cursor Tab 风格，debounce + abort）
- 🌳 **VSCode iframe 模式**：一键切换到完整 VSCode（code-server）

### AI Chat (Ask / Agent 双模式)
- 💬 **流式 Markdown 渲染** + 代码高亮 + 一键复制
- 🤖 **Agent + Tool Calling**（read/write/grep/find_symbol/find_references/semantic_search/run_command）
- ⚡ **并发 Tool 执行**：纯读类工具自动并发，写类工具强制串行
- 📋 **Composer Panel**：多文件 pending edits 一次审查 / accept / reject
- ⏮️ **Checkpoint Revert**：每次 accept 自动 snapshot，支持多文件一键回退

### 代码检索（核心亮点）
- 🔤 **BM25**（关键词倒排，毫秒级）
- 🧬 **SymbolGraph**（tree-sitter 抽取，go-to-def / find-references）
- 🧭 **Vector Store**（embedding 语义召回）
- 🔀 **RRF 融合**（Reciprocal Rank Fusion，k=60）

### 自动化
- 📜 **Rules 系统**（`.minicodeide/rules/*.md`，支持 always / auto+globs / manual）
- ⚡ **Slash Commands**（`/explain` `/test` `/refactor` `/docs` `/fix`，可自定义）
- 🔄 **增量索引**（chokidar watcher，debounce + burst limit）

### 多 LLM Provider（P6）
- 🔌 **OpenAI / DeepSeek / Moonshot / Ollama / OpenRouter** （OpenAI 兼容协议）
- 🧠 **Anthropic Claude 原生支持**（`/v1/messages` + x-api-key + stream/tool_use/cache_control 全适配）
- ⚡ **Active + Fallback Chain**：主 Provider 挊了 （429/5xx/timeout）自动切下一个，前端推 `provider_switch` 提示
- ⚙️ **Chat / Complete / Embed / Fast 四个角色独立配置**（每个都有 fallback 链）
- ♻️ **运行时热切换**（embedder 变了自动重建索引）

| Provider | kind | baseUrl | model 例 |
|---|---|---|---|
| DeepSeek | openai | `https://api.deepseek.com/v1` | `deepseek-chat` |
| OpenAI | openai | `https://api.openai.com/v1` | `gpt-4o-mini` |
| **Claude（直连）** | **anthropic** | `https://api.anthropic.com` | `claude-3-5-sonnet-20241022` |
| OpenRouter | openai | `https://openrouter.ai/api/v1` | `anthropic/claude-3.5-sonnet` |
| Moonshot | openai | `https://api.moonshot.cn/v1` | `moonshot-v1-8k` |
| Ollama | openai | `http://localhost:11434/v1` | `llama3.1` |

Settings 面板里一键预设 `+ DeepSeek / + Claude / + OpenAI / + OpenRouter`。`kind` 不指定时按 baseUrl 自动判定（`anthropic.com` → anthropic）。

### AI Harness（P2，可度量、可改进）
- 🧪 **Eval Harness**（`evals/`，端到端 HTTP + sandbox fixture + 多维指标 + CI 退出码）
- ✅ **Self-Verification**（`verify_changes` tool：tsc/test/lint/exec，结构化错误 + actionable hint）
- 🎯 **Cross-Encoder Reranker**（可选，`@xenova/transformers`，懒加载，env `RERANKER=on`）
- 🤖 **子 Agent 演进路径**（dispatch_subagent 设计已就绪，等 eval 数据决定）

跑评测：
```bash
pnpm eval            # 全量
pnpm eval:quick      # 只跑快 case
RERANKER=on pnpm eval  # 开 reranker 对照
```

### 协同 & 鲁棒性（P3）
- 🔁 **Session Resume**（流式增量落盘到 jsonl，崩溃 / 用户 stop / 断网都能续接，list 里 `⏸ Continue` 一键继续）
- 🧠 **Skills**（progressive disclosure：`<workspace>/.minicodeide/skills/<name>/SKILL.md` + `~/.minicodeide/skills/<name>/SKILL.md`，system prompt 只塞概要，LLM 调 `use_skill` 才加载全文）

新建一个 skill：
```
mkdir -p .minicodeide/skills/my-skill
cat > .minicodeide/skills/my-skill/SKILL.md << EOF
---
name: my-skill
description: 当用户说 xxx 时触发的复杂工作流
---
# my-skill
工作流步骤...
EOF
```
重启 server（或 `POST /api/skills/reload`）即可，LLM 自动看到。

### Multi-Agent / 子 Agent（P4）
仿 CodeFlicker 的「**单 Agent + 多 Worker 层级模式**」（不是 AutoGen 群聊）：

- 🤖 **dispatch_subagent tool**：父 Agent 一键 spawn 独立子 Agent 跑 focused 子任务
- 📨 **Push Announce**：子 Agent 完成 → 结果作为合成 user message 自动注入父下一 turn（**zero-token，不轮询**）
- 🛡️ **三道保险**：maxDepth=2 / maxConcurrentPerParent=3 / runTimeoutMs=120s
- 🔒 **registry 裁剪**：子 Agent 默认只读，写盘必须父来（保留 review checkpoint）
- 📁 **独立 jsonl**：每个子 session 单独落盘，复用 P3 的崩溃续接机制

典型用法：
> 给 src/controllers/ 下这 5 个文件分别加中文 JSDoc，并行做

父 Agent 自动 spawn 5 个子，子各自跑完 push 回结果，父汇总 → 一次完成。

### 安全 & 成本（P5）
- 🛡️ **Exec Policy**：`run_command` 三档策略 —— 白名单（ls/cat/git status/pnpm test）直跑、未知/写类弹审批、`rm -rf /`/`sudo`/`curl`/`base64 -d` 直拒。前端审批卡片 Approve/Deny
- 💰 **Subagent 模型降级**：providers 新增 `fast` role，子 Agent 优先用便宜模型（Haiku/mini），未配则 fallback 到 chat。**5 个并行子任务 = 12× 成本差**

> 明确不做：完整 Docker 沙箱（threat model 不在 IDE 场景）/ 完整多 Agent 配置（fast/chat 二档已 cover 80%）

### AI 体验优化（P7-AI-UX，新一轮）

> 不动架构、效果立竿见影的 Agent 体验改进。详见 [docs/AI-UX-IMPROVEMENTS.md](./docs/AI-UX-IMPROVEMENTS.md)

**Round 1（Agent 自身）：**
- 💭 **`think` tool**：业界共识的 scratchpad reasoning（Anthropic best practice），让 Agent 显式思考而不污染 chat
- 🔁 **循环检测**：连续 3 轮同 tool + 同参数 → 强制注入 `[loop-breaker]` 让模型换策略
- 🎯 **`edit_file` didYouMean**：失败时返回最相似的 3 行候选 + suggestion，模型自我纠正而不是瞎重试
- 📖 **`read_file` 升级**：默认 500 行窗口、行号前缀（`"   42→content"`）、路径错时给同目录候选
- 🔍 **`grep_search` 增强**：`case_insensitive` + `context_lines` + glob `file_pattern`，找不到时给可执行 hint
- 📂 **`list_files` 结构化**：返回 `{path, type, size}` 而非字符串数组，默认忽略 dist/.git/.minicodeide
- 📋 **Tool 使用纪律**：System prompt 显式教 LLM 批量并发、不重复调用、优先 semantic 检索

**Round 2（前端体验 + 防御）：**
- ⌨️ **Inline Completion 增强**：LRU 缓存 + 句尾抑制 + 失败熔断 30s（Cursor Tab 风格补全，已存在，本轮做强化）
- 🛑 **Tool Error Retry Budget**：单 tool 连续 3 次失败 → 强制注入 `[tool-budget]` 提示换策略
- 📝 **多步任务自动建议 update_plan**：检测 "1) 2) 3)" / "all/every" / 3+ 文件路径 → 提示 LLM 先列计划
- 💬 **think tool 折叠 UI**：紫色卡片专门渲染，默认折叠预览 80 字
- 🎯 **`@-mention` 按相关性排序**：basename 命中 / 路径前缀命中 / 短路径优先
- 🔗 **Markdown 自动链接**：Agent 输出的 `src/foo.ts:42` 自动转可点击跳转编辑器

---

## 🚀 Quick Start

```bash
# 1. install
pnpm install

# 2. typecheck（可选）
pnpm -r typecheck

# 3. 启动 server
cd apps/server
WORKSPACE=/path/to/your/project pnpm dev

# 4. 另一个终端启动前端
cd apps/desktop
pnpm dev
# → http://localhost:5173
```

### 配置 LLM Provider

打开浏览器，点右上角 **⚙ Settings**，可以：

1. **一键预设**：点 `+ DeepSeek` / `+ Claude` / `+ OpenAI` / `+ OpenRouter`，只填 API Key 即可
2. **手动添加**：指定 Protocol（auto / openai / anthropic）+ baseUrl + key + model
3. **设置 Active + Fallback**：每个角色（chat/complete/embed/fast）选 primary + 多个 fallback
4. **Test** 按钮：一键探伤，看首 token 延迟 + 总耗时

**举例**：主用 Claude，挊了自动切 DeepSeek
```
chat 角色:
  primary:  Claude
  fallback: [DeepSeek, OpenAI]
embed 角色:
  primary:  OpenAI (text-embedding-3-small)
  fallback: [hash-fallback]
```

**没 API Key 也能跑**：embedder 会自动 fallback 到 hash embedder，LLM 部分需要至少一个 provider。

---

## 📁 项目结构

```
miniCodeIde/
├── apps/
│   ├── desktop/                 # React + Vite + Monaco
│   │   └── src/components/
│   │       ├── ChatPanel.tsx       # Chat UI + Slash + Markdown
│   │       ├── ComposerPanel.tsx   # Pending edits + Checkpoints
│   │       ├── FileTree.tsx
│   │       ├── EditorTabs.tsx + Editor.tsx
│   │       ├── DiffEditor.tsx
│   │       ├── CommandPalette.tsx  # Cmd+P
│   │       ├── SettingsPanel.tsx   # Provider 管理
│   │       └── MarkdownMessage.tsx
│   └── server/
│       └── src/
│           ├── main.ts             # 全部路由 + Agent 入口
│           ├── retrieval.ts        # Hybrid + RRF
│           ├── watcher.ts          # 增量索引
│           ├── pending-edit.ts     # Edit 审查
│           ├── checkpoint.ts       # 回退
│           ├── rules.ts            # 规则注入
│           ├── slash-commands.ts
│           ├── providers.ts        # LLM Provider 管理
│           └── lsp-bridge.ts
└── packages/
    ├── core/                    # 框架无关
    │   └── src/
    │       ├── agent/              # ReAct Loop + Tool Registry + Builtin Tools
    │       ├── llm/                # OpenAI-compat + Anthropic provider
    │       ├── context/            # 消息组装
    │       └── memory/             # 对话 memory
    └── indexer/                 # 索引子系统
        └── src/
            ├── scanner.ts          # 文件扫描
            ├── chunker.ts
            ├── bm25.ts
            ├── symbol-graph.ts     # tree-sitter
            ├── vector-store.ts
            ├── embedder.ts
            └── builder.ts
```

---

## 📚 文档

- **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** — 技术架构 + 数据流 + 关键决策
- **[docs/INTERVIEW.md](./docs/INTERVIEW.md)** — 面试题精选 + 参考答案
- **[docs/AI-UX-IMPROVEMENTS.md](./docs/AI-UX-IMPROVEMENTS.md)** — Agent 体验改进沉淀（两轮共 13 项）
- **[docs/AGENT-OPTIMIZATIONS.md](./docs/AGENT-OPTIMIZATIONS.md)** — Agent 智能层优化（Round 3，P0+P1 共 7 项：Memory/Auto-Memory/Overflow/Activity/Hygiene/Key Pool/Eval Baseline）
- **[docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)** — 部署 / 分发 / 运维 SOP（Auth + RateLimit + Health + Electron 打包 + auto-update）

> 这几个文档是项目的精华。如果是面试场景，**先看 INTERVIEW 再翻代码** 是最高效的路径；如果要部署上线，**直接照着 DEPLOYMENT 走**。

---

## 🧪 试试看

启动后，在 Chat 面板输入这些：

| 输入 | 演示的能力 |
|------|----------|
| `where is auth handled?` | Hybrid retrieve + 自动注入相关 chunks |
| `/explain Hybrid retrieval works` | Slash command 模板 |
| `Refactor X to use Y` | Agent edit_file → Pending → 审查 → Checkpoint |
| `Add a function foo to utils.ts and call it from main.ts` | 多文件 pending |
| `Find all callers of buildIndex` | find_symbol + find_references 工具链 |

---

## 🛠 技术栈

| 层 | 选型 |
|----|------|
| 前端 | React 18, Vite, Monaco Editor, zustand |
| 后端 | Node 20+, Express, ws, tsx |
| 解析 | web-tree-sitter (TS/TSX/JS) |
| 索引 | 自实现 BM25, 自实现 VectorStore (jsonl) |
| LSP | typescript-language-server |
| Markdown | react-markdown + remark-gfm + rehype-highlight |
| 包管理 | pnpm workspace |
| 模块 | ESM only |

---

## 📜 License

MIT
