# MiniCodeIDE 复刻指南（Rebuild Guide）

> 目标读者：你（zhuxiaorui），想把 MiniCodeIDE 从 0 到 1 自己再写一遍。
> 这份文档**只描述本仓库实际存在的代码**，不臆造功能。
> 所有路径都是相对仓库根的真实路径，照着抄就能跑。

---

## 0. 这个系统整体可用吗？

**结论：可用，且能本地完整跑通**。已验证的能力：

| 模块 | 状态 | 证据 |
|---|---|---|
| Express 后端（`apps/server`） | ✅ 可用，主路由共 72KB 代码 | `apps/server/src/main.ts` |
| Bare-Node 重写后端（`apps/server-node`） | ✅ 可用，无 Express，自己写 router | `apps/server-node/src/router/router.ts` |
| 前端桌面壳（`apps/desktop`） | ✅ 可用，Vite + React + Monaco | `apps/desktop/src/App.tsx`（15KB） |
| Electron 打包 | ✅ 已产出 dmg/zip，arm64 + x64 都打过 | `apps/electron/release/*.dmg` |
| Agents Window（独立窗口） | ✅ 可用 | `apps/desktop/src/agents-window/` 14 个文件 |
| 云端版（`apps/server-cloud`） | 🟡 骨架完成，未上线 | `apps/server-cloud/src/index.ts` + Prisma schema |
| Web 版（`apps/web`） | 🟡 骨架，仅 1.6KB App.tsx | `apps/web/src/App.tsx` |
| 微信桥（`apps/remote-wechat`） | 🟡 stub provider 阶段 | `apps/remote-wechat/src/stub-provider.ts` |
| Eval Harness | ✅ 可跑 | `evals/`，`pnpm eval` |
| LLM Provider（OpenAI 兼容 + Anthropic 原生 + Router fallback） | ✅ | `packages/core/src/llm/{openai,anthropic}.ts` + `apps/server/src/llm-router.ts` |
| 索引三件套（BM25 / SymbolGraph / Vector） | ✅ | `packages/indexer/src/*` |
| Subagent 调度 | ✅ | `apps/server/src/subagent-manager.ts`（13KB） |

**核心跑得起来的入口**（README 已写）：

```bash
pnpm install
cd apps/server && WORKSPACE=/path/to/proj pnpm dev   # 一终端
cd apps/desktop && pnpm dev                           # 二终端，→ http://localhost:5173
```

---

## 1. 整体架构（一图概览）

```
┌──────────────── 前端 (React + Vite + Monaco) ────────────────┐
│                                                              │
│   主窗口 App.tsx              Agents Window                  │
│   ├─ ActivityBar / FileTree   ├─ AgentsSidebar               │
│   ├─ EditorArea (Monaco)      ├─ AgentsMain (Chat)           │
│   ├─ ChatPanel                └─ AgentsRight (preview/diff)  │
│   ├─ ComposerPanel                                           │
│   └─ SettingsPanel  ←─── store.ts (zustand)                  │
└──────────┬───────────────────────────────────┬───────────────┘
           │ HTTP / SSE                        │ WS（lsp / terminal）
           ▼                                   ▼
┌──────────────── 后端（两套实现，二选一）────────────────────┐
│                                                              │
│  apps/server          apps/server-node                       │
│  Express 路由全集     原生 http + 自写 router                 │
│  main.ts (72KB)       handlers/register.ts (55KB)            │
│                                                              │
│  共用业务模块：                                                │
│   - retrieval / watcher / pending-edit / checkpoint           │
│   - rules / slash-commands / providers / llm-router          │
│   - session-store / skill-store / subagent-manager           │
│   - exec-policy / lsp-bridge / terminal-bridge / mcp-client   │
└──────────┬───────────────────────────────────┬───────────────┘
           │                                   │
           ▼                                   ▼
┌─ packages/core ──────────┐  ┌─ packages/indexer ────────────┐
│ agent/loop.ts            │  │ bm25 + symbol-graph +         │
│ agent/builtin-tools.ts   │  │ vector-store + embedder       │
│ agent/tool-registry.ts   │  │ scanner / chunker / extractor │
│ agent/error-recovery     │  │ tree-sitter parsers           │
│ agent/fuzzy-apply        │  └───────────────────────────────┘
│ context/builder + 4种压缩 │
│ llm/openai + anthropic   │  ┌─ packages/storage ─────────────┐
│ memory/store + auto-mem  │  │ jsonl 实现 + Prisma(PG) 实现   │
└──────────────────────────┘  │ factory.ts 按 env 选         │
                              └────────────────────────────────┘
                              ┌─ packages/sandbox ─────────────┐
                              │ 内存 vfs（Web 模式准备）        │
                              └────────────────────────────────┘
```

**关键事实**：
- **monorepo + pnpm workspace**，根 `pnpm-workspace.yaml` 定义 `apps/*` `packages/*`。
- **ESM only**：所有 `package.json` 都是 `"type": "module"`，import 必须带 `.js` 后缀。
- 后端**有两套实现**（Express 旧版 + Bare-Node 新版），是渐进迁移过程中的产物，**目前两套都能跑**。

---

## 2. 仓库目录结构（真实清单）

```
miniCodeIde/
├── apps/
│   ├── desktop/                # 前端主壳
│   │   ├── src/
│   │   │   ├── App.tsx                15KB  主窗口入口
│   │   │   ├── store.ts               18KB  zustand 全局状态
│   │   │   ├── styles.css             64KB  全部样式（手写，无 tailwind）
│   │   │   ├── monaco-setup.ts        Monaco worker 注册
│   │   │   ├── inline-completion.ts   8KB   Ghost text 补全
│   │   │   ├── lsp-client.ts          5KB   LSP WS 客户端
│   │   │   ├── electron-bridge.ts     4KB   file:// fetch 劫持
│   │   │   ├── vscode-bridge.ts       5KB   iframe postMessage RPC
│   │   │   ├── components/            主 UI 组件（21 个）
│   │   │   ├── agents-window/         独立 Agents 窗口（14 个文件）
│   │   │   └── hooks/useWebSpeech.ts  语音输入
│   │   └── vite.config.ts
│   │
│   ├── server/                 # 后端 Express 实现（功能完整）
│   │   └── src/
│   │       ├── main.ts                72KB  全部路由 + 启动
│   │       ├── retrieval.ts           BM25+Vector RRF 融合
│   │       ├── watcher.ts             chokidar 增量索引
│   │       ├── pending-edit.ts        编辑提议存储
│   │       ├── checkpoint.ts          回退存储
│   │       ├── rules.ts               .minicodeide/rules/*.md 解析
│   │       ├── slash-commands.ts      / 命令模板
│   │       ├── providers.ts           Provider Profile 管理
│   │       ├── llm-router.ts          Provider 链 + fallback
│   │       ├── session-store.ts       jsonl session 持久化（12KB）
│   │       ├── skill-store.ts         Skill progressive disclosure
│   │       ├── subagent-manager.ts    子 Agent 调度（13KB）
│   │       ├── exec-policy.ts         run_command 三档安全策略
│   │       ├── lsp-bridge.ts          WS ↔ tsserver 子进程
│   │       ├── terminal-bridge.ts     WS pty
│   │       ├── mcp-client.ts          MCP 客户端
│   │       ├── mentions.ts            @file/@symbol 解析
│   │       ├── reranker.ts            cross-encoder rerank
│   │       ├── middleware.ts          auth/rate limit/health
│   │       ├── key-rotator.ts         多 key 轮转
│   │       ├── git-helpers.ts         git CLI 包装
│   │       ├── bg-tasks.ts            后台任务队列
│   │       ├── system-hooks.ts        生命周期 hook
│   │       └── worktree-manager.ts    git worktree 管理
│   │
│   ├── server-node/            # 后端 Bare-Node 重写（无 Express）
│   │   └── src/
│   │       ├── main.ts                启动入口
│   │       ├── services.ts            DI 容器（10KB）
│   │       ├── env.ts                 env 解析
│   │       ├── approvals.ts           审批存储
│   │       ├── handlers/register.ts   55KB  注册全部路由
│   │       └── router/
│   │           ├── router.ts          自写 trie 路由
│   │           └── http-utils.ts      sse/json/parsebody
│   │
│   ├── server-cloud/           # 云端版（多租户，Web 模式）
│   │   └── src/
│   │       ├── index.ts               入口
│   │       ├── middleware/auth.ts     JWT
│   │       ├── routes/
│   │       │   ├── auth.ts            登录
│   │       │   ├── me.ts              用户信息
│   │       │   ├── sessions.ts        会话 CRUD
│   │       │   ├── chat.ts            8KB Chat SSE
│   │       │   ├── agents.ts          15KB Agents 编排
│   │       │   ├── uploads.ts         10KB 分片上传
│   │       │   └── compat.ts          兼容层
│   │       ├── llm/{factory,crypto}.ts BYOK + AES 加密
│   │       └── agent/sandbox-tools.ts  浏览器侧沙箱工具
│   │
│   ├── electron/               # 桌面打包
│   │   ├── main.js             28KB  主进程（含 code-server 启动）
│   │   ├── preload.js          IPC 桥
│   │   ├── agents-window.js    Agents 窗口创建
│   │   └── resources/
│   │       ├── code-server/    预置的 code-server 二进制
│   │       ├── server/         打包好的后端 main.mjs
│   │       ├── renderer/       打包好的前端
│   │       └── vscode-bridge-ext/ 注入 code-server 的扩展
│   │
│   ├── web/                    # 纯 Web 版本（M3，骨架）
│   │   └── src/{App.tsx,main.tsx}
│   │
│   └── remote-wechat/          # 微信远程控制（stub 阶段）
│       └── src/{bridge,stub-provider,index,provider}.ts
│
├── packages/
│   ├── core/                   # 框架无关业务核心
│   │   └── src/
│   │       ├── agent/
│   │       │   ├── loop.ts             14KB  ReAct loop
│   │       │   ├── tool-registry.ts    6KB   tool 注册 + parallel 分段
│   │       │   ├── builtin-tools.ts    40KB  10+ 个内置 tool
│   │       │   ├── error-recovery.ts   失败补救
│   │       │   ├── fuzzy-apply.ts      模糊 patch（diff 不严格匹配时）
│   │       │   └── hooks.ts            生命周期 hook
│   │       ├── context/
│   │       │   ├── builder.ts          消息组装
│   │       │   ├── compactor.ts        智能压缩
│   │       │   ├── soft-compact.ts     软压缩（删冗余）
│   │       │   ├── hard-compact.ts     硬压缩（强制截）
│   │       │   ├── injection-cache.ts  rules/skills 注入缓存
│   │       │   ├── recent-activity.ts  近期活跃文件追踪
│   │       │   └── token-estimator.ts  tiktoken 估算
│   │       ├── llm/
│   │       │   ├── openai.ts           OpenAI 兼容 provider
│   │       │   ├── anthropic.ts        10KB  Anthropic 原生
│   │       │   ├── structured.ts       10KB  结构化输出（function/json mode）
│   │       │   └── types.ts
│   │       └── memory/
│   │           ├── store.ts            16KB  长期记忆
│   │           └── auto-memory.ts      自动记忆抽取
│   │
│   ├── indexer/                # 索引子系统
│   │   └── src/
│   │       ├── scanner.ts          目录扫描（gitignore-aware）
│   │       ├── chunker.ts          代码切块（行/AST 混合）
│   │       ├── extractor.ts        符号抽取
│   │       ├── parsers.ts          tree-sitter wasm 加载
│   │       ├── bm25.ts             倒排 + BM25 公式
│   │       ├── symbol-graph.ts     name→symbol/path/refs hashmap
│   │       ├── vector-store.ts     Float32Array + 点积 topK
│   │       ├── embedder.ts         OpenAI / hash fallback
│   │       └── builder.ts          全量构建编排
│   │
│   ├── storage/                # 持久化抽象
│   │   ├── prisma/schema.prisma    User / Session / Message / Turn
│   │   └── src/
│   │       ├── factory.ts          按 env 选 jsonl 或 prisma
│   │       ├── jsonl.ts            10KB  本地 jsonl 实现
│   │       ├── prisma-pg.ts        8KB   Postgres 实现
│   │       └── types.ts            统一接口
│   │
│   └── sandbox/                # 内存 vfs（Web 沙箱准备）
│       └── src/{index,mem}.ts
│
├── infra/
│   └── docker-compose.yml      Postgres + Adminer（云端开发用）
│
├── evals/                      # AI 评测框架
│   ├── runner.ts               主流程
│   ├── cases/                  *.json case
│   ├── fixtures/               隔离 fixture 项目
│   └── reports/                时间戳报告
│
├── docs/                       # 文档（本目录）
│   ├── ARCHITECTURE.md         51KB（最详细，要读）
│   ├── INTERVIEW.md            73KB（面试 Q&A）
│   ├── AI-UX-IMPROVEMENTS.md   两轮 13 项 Agent UX 改进
│   ├── AGENT-OPTIMIZATIONS.md  Round 3：Memory/Hygiene/KeyPool
│   ├── DEPLOYMENT.md           部署 SOP
│   ├── AGENTS-WINDOW.md / -TECH.md  Agents 窗口 PRD + 技术方案
│   ├── MEMORY-AND-ATTENTION.md
│   ├── HARNESS.md              Eval 框架
│   ├── REMOTE-WECHAT.md
│   ├── PRD.md / ROADMAP.md / TDD.md
│   ├── UX_REVAMP_PLAN.md
│   ├── FORK-OPENVSCODE-SERVER-PRD.md
│   ├── PRODUCTION-HARDENING.md
│   ├── vscode-extension-roadmap.md
│   └── REBUILD-GUIDE.md        ← 本文件
│
└── scripts/                    构建/打包/清理脚本
```

---

## 3. 技术栈（写实清单）

| 层 | 选型 | 实际用在哪 |
|---|---|---|
| 包管理 | **pnpm 9 + workspace** | `pnpm-workspace.yaml` `package.json` |
| 模块 | **ESM only** | 所有 `type:"module"` |
| 语言 | **TypeScript 5.4** | 全仓 |
| 前端框架 | **React 18** | `apps/desktop` `apps/web` |
| 前端构建 | **Vite 5** | `apps/desktop/vite.config.ts` |
| 状态管理 | **zustand 4** | `apps/desktop/src/store.ts` |
| 编辑器内核 | **monaco-editor 0.50** + `@monaco-editor/react` | `apps/desktop/src/components/EditorArea.tsx` |
| Markdown 渲染 | **react-markdown + remark-gfm + rehype-highlight + highlight.js** | `MarkdownMessage.tsx` |
| 后端（旧）| **Express 4 + ws + cors + zod + chokidar** | `apps/server` |
| 后端（新）| **原生 http + ws**（无框架） | `apps/server-node` |
| Dev runner | **tsx watch** | 各 `package.json` 的 `dev` |
| 打包 server | **esbuild** | `apps/server/build.mjs` |
| 解析器 | **tree-sitter**（wasm 版用 `web-tree-sitter`，Node 版用 `tree-sitter-typescript/javascript`） | `packages/indexer/src/parsers.ts` |
| LLM | **OpenAI 兼容协议 + Anthropic 原生**（自实现，无 SDK 依赖） | `packages/core/src/llm/` |
| Reranker | **`@xenova/transformers`**（懒加载，可选） | `apps/server/src/reranker.ts` |
| 数据库（云）| **Prisma + Postgres 16** | `packages/storage/prisma/` `infra/docker-compose.yml` |
| 桌面打包 | **electron + electron-builder** | `apps/electron/` |
| LSP | **typescript-language-server**（子进程 stdio） | `apps/server/src/lsp-bridge.ts` |
| 终端 | **node-pty over WS**（terminal-bridge.ts） |
| MCP | 自实现 stdio client | `apps/server/src/mcp-client.ts` |

**没有用**：tailwind、Next.js、tRPC、Redux、shadcn、Vercel AI SDK（刻意不用，要把抽象自己写）。

---

## 4. 功能怎么分块的（按"用户能感知的能力"切）

### 4.1 编辑器区（IDE 基本盘）

| 功能 | 前端 | 后端 |
|---|---|---|
| 文件树 | `components/FileTree.tsx` | `GET /api/tree` |
| 多 tab 编辑 | `components/EditorArea.tsx` + Monaco | `GET /api/file` `PUT /api/file` |
| 命令面板（Cmd+P 多模式）| `components/CommandPalette.tsx` | `/api/files/all` `/api/symbols` |
| 文件夹切换 | `components/FolderPickerModal.tsx` | `POST /api/workspace/switch` |
| Inline 补全（Ghost）| `inline-completion.ts` | `POST /api/complete`（非流式）|
| LSP 跳转/Hover | `lsp-client.ts` | `WS /lsp/ts` → tsserver |
| 终端 | `components/TerminalPanel.tsx` | `WS /terminal` → node-pty |
| 问题面板 | `components/ProblemsPanel.tsx` | `/api/diagnostics`（LSP 转发）|
| Outline | `components/OutlinePanel.tsx` | `/api/symbols` |
| 搜索面板 | `components/SearchPanel.tsx` | `/api/grep` `/api/semantic-search` |
| Welcome 页 | `components/WelcomePage.tsx` | — |
| 全屏 VSCode（iframe）| `components/VSCodeFrame.tsx` + `vscode-bridge.ts` | electron 启动 code-server |

### 4.2 AI Chat 区（双模式 Ask / Agent）

| 功能 | 入口 | 关键文件 |
|---|---|---|
| Chat 对话流 | `ChatPanel.tsx` | `POST /api/chat`（SSE） → `core/agent/loop.ts` |
| Slash Command | 输入 `/` 触发 | `slash-commands.ts` |
| @ Mention | `MentionInput.tsx` | `mentions.ts` + `/api/mentions/suggest` |
| 添加 Context 弹窗 | `AddContextPopover.tsx` | 同上 |
| 流式 Markdown | `MarkdownMessage.tsx` | react-markdown |
| 代码块 Apply | 解析 ```ts:path 头 | `POST /api/edits`（创建 PendingEdit）|
| 跳转链接 `src/foo.ts:42` | MarkdownMessage 自动转链 | 前端 onClick |
| Composer Panel | `ComposerPanel.tsx` | 列出 PendingEdit + Checkpoint |
| Pending Edits Hub | `PendingEditsHub.tsx` | `/api/edits` |
| Diff 预览 | Monaco DiffEditor（在 EditorArea 中按 tab.kind='diff' 切换） | `pending-edit.ts` |
| Cmd+K Inline Edit | `InlineEditWidget.tsx` | `POST /api/inline-edit`（SSE）|
| Plan 面板 | `PlanPanel.tsx` | `update_plan` tool |
| Sessions 抽屉 | `SessionsDrawer.tsx` | `/api/sessions/*` |
| 设置面板 | `SettingsPanel.tsx`（31KB，最大组件） | `/api/providers/*` |

### 4.3 Agents Window（独立窗口，工作流模式）

`apps/desktop/src/agents-window/` 是个**完整独立的 React 应用**（Electron 拉第二个 BrowserWindow）：

- `AgentsApp.tsx` 入口
- `AgentsSidebar.tsx` 左栏会话列表
- `AgentsMain.tsx` 中栏 Chat（26KB）
- `AgentsRight.tsx` 右栏代码预览/diff
- `AgentsCodePreview.tsx` 内嵌 Monaco 只读
- `GitChangesPanel.tsx` Git 变更
- `GitHistoryPanel.tsx` Git 历史
- `SandboxModal.tsx` 沙箱环境选择（15KB）
- `ModeToggle.tsx` Work / Code 切换
- `WorkspacePicker.tsx` 沙箱目录
- `chunkedUpload.ts` 分片上传
- `store.ts` 独立 zustand
- `agents.css` 32KB 样式

主进程入口在 `apps/electron/agents-window.js`。

### 4.4 后端能力分块（看 `apps/server/src/main.ts` 的路由表分组）

| 类目 | 代表路由 | 实现文件 |
|---|---|---|
| 文件 | `/api/file` `/api/tree` `/api/files/all` | main.ts inline |
| 索引/检索 | `/api/grep` `/api/semantic-search` `/api/symbols` `/api/find-references` | `retrieval.ts` |
| Watcher | 启动时挂载 chokidar | `watcher.ts` |
| Chat / Agent | `POST /api/chat` (SSE) | `core/agent/loop.ts` |
| Complete | `POST /api/complete` | inline + `llm-router.ts` |
| Inline Edit | `POST /api/inline-edit` (SSE) | inline |
| Pending Edit | `/api/edits` `/api/edits/:id/accept|reject` | `pending-edit.ts` |
| Checkpoint | `/api/checkpoints` `/api/checkpoints/:id/revert` | `checkpoint.ts` |
| Sessions | `/api/sessions` `/api/sessions/:id/*` | `session-store.ts` |
| Rules | `/api/rules` `/api/rules/reload` | `rules.ts` |
| Slash | `/api/slash-commands` | `slash-commands.ts` |
| Skills | `/api/skills` `/api/skills/reload` | `skill-store.ts` |
| Mentions | `/api/mentions/suggest` | `mentions.ts` |
| Providers | `/api/providers` `/api/providers/test` | `providers.ts` + `llm-router.ts` |
| Subagents | `dispatch_subagent` tool（不是单独路由）| `subagent-manager.ts` |
| Approvals | `/api/approvals/:id/(approve|deny)` | `exec-policy.ts` |
| Git | `/api/git/status|diff|log|generate-message|commit` | `git-helpers.ts` |
| Health | `/api/health` | inline |
| LSP | `WS /lsp/ts` | `lsp-bridge.ts` |
| Terminal | `WS /terminal` | `terminal-bridge.ts` |
| MCP | `/api/mcp/*` | `mcp-client.ts` |

---

## 5. 后端：你应该按什么顺序写

> 别一上来照 72KB 的 `main.ts` 抄。按下面顺序，每个里程碑都能跑。

### M0：能开个文件（HTTP 文件 server）

**目标**：浏览器能读 / 写工作区文件，能列树。

1. 建 `apps/server`，装 `express cors zod`。
2. 启动时读 env `WORKSPACE`，全局存 `cwd`。
3. 写 `resolveInside(cwd, p)` 路径守卫——**所有文件 IO 必须走它**，否则可被路径穿越。
4. 三个路由：
   - `GET /api/tree?path=` → 递归 readdir，过滤 `node_modules .git dist .minicodeide`
   - `GET /api/file?path=` → 读文本
   - `PUT /api/file?path=` → 写文本（先 mkdir -p）
5. `cors()` 允许 `localhost:5173`。

> **难点 1**：路径守卫一处不严，整个 IDE 就成了任意写马。`resolveInside` 必须用 `path.relative` 检查 `..` 而不是字符串前缀。

### M1：前端骨架 + Monaco

1. 建 `apps/desktop`，装 `react react-dom monaco-editor @monaco-editor/react zustand vite @vitejs/plugin-react`。
2. `monaco-setup.ts`：通过 `?worker` import 注册 4 个 worker（json/css/html/typescript），否则语言能力直接挂。
3. `store.ts` 用 zustand 建：`tabs / activeTab / fileTree / chatHistory`。
4. `App.tsx`：3 栏布局（侧栏 / 编辑区 / Chat）。
5. `FileTree.tsx`：递归渲染 + 点击 → fetch 文件 → 开 tab。

> **难点 2**：Monaco 在 Vite 下要用 `monaco-editor/esm/vs/editor/editor.worker?worker` 的语法，且必须配 `MonacoEnvironment.getWorker`，否则你只看到 fallback 编辑器。

### M2：索引三件套（亮点）

按下面顺序写 `packages/indexer`：

1. **scanner.ts**：递归 `readdir`，参考 `.gitignore`（用 `ignore` 包或自己写最简版）。
2. **chunker.ts**：先按行切（80 行一块、20 行 overlap），后续可加 AST 切。
3. **bm25.ts**：
   - 数据：`Map<term, Map<docId, tf>>` + `Map<docId, len>` + `avgLen`
   - 公式：`idf * (tf*(k1+1)) / (tf + k1*(1-b+b*len/avgLen))`，k1=1.2 b=0.75
   - tokenizer：`\W+` split + 小写 + 长度 ≥ 2
4. **symbol-graph.ts**：tree-sitter 抽 `function/class/method/interface/type/import`，三个 hashmap：`name→[]` `path→facts` `callee→refs`。
5. **vector-store.ts**：
   - 数据：`{path, chunkId, vec: Float32Array, text}[]`
   - search：点积 / 余弦 → topK
   - 持久化：jsonl，每行一个 chunk
6. **embedder.ts**：
   - 接口 `embed(texts: string[]): Promise<number[][]>`
   - OpenAI 实现（`/v1/embeddings`）
   - hash fallback：把字符串 hash 到固定维度向量（无 API key 时用，几乎没语义但能保证流程跑通）
7. **builder.ts**：scanner → chunker → 三个索引并行写入。

> **亮点 1**：embedder 失败 fallback 到 hash 实现，保证「没 key 也能跑」。
> **亮点 2**：embedder 切换时整个 vector index 要 reset（不同 embedder 维度不同），见 `providers.ts onChange` hook。

### M3：检索融合 + 增量索引

1. **retrieval.ts**（`apps/server/src/`）：
   ```
   hybridRetrieve(query, k):
     bm25Top   = bm25.search(query, k*3)
     vectorTop = vec.search(await embedder.embed([query]), k*3)
     return RRF(bm25Top, vectorTop, k=60).slice(0, k)
   ```
   RRF：`Σ 1/(60 + rank)`。
2. **watcher.ts**：chokidar 监听，debounce 300ms，单文件 `removeByPath + upsertFile`。**burst limit**：一次 200+ 文件变更（git checkout）跳过 embedding。

> **难点 3**：增量索引要保证 embedder 切换 / chunker 改了 schema 时不会读到脏数据。我用「embedder 名字 + chunker version」组合 key，名字变了就 reset。

### M4：LLM Provider 抽象（亮点核心）

`packages/core/src/llm/`：

1. **types.ts**：
   ```ts
   interface ChatChunk {
     delta?: string;
     toolCallDelta?: { index, id?, name?, arguments? };
     finishReason?: string;
     usage?: { input, output, cacheRead?, cacheWrite? };
     done?: boolean;
   }
   interface LLMProvider {
     chatStream(messages, opts): AsyncGenerator<ChatChunk>;
     embed?(texts): Promise<number[][]>;
   }
   ```
2. **openai.ts**：fetch `/v1/chat/completions` SSE，按 `choices[0].delta` 拆 chunk。tool_calls 按 `index` 累加 arguments（OpenAI 是 string 增量）。
3. **anthropic.ts**：fetch `/v1/messages` SSE，事件类型：`message_start / content_block_{start,delta,stop} / message_delta / message_stop`。**适配点**（详见 ARCHITECTURE.md 13.4）：
   - system 数组 → 顶层 `system` 字段
   - tool 输出按 `content_block_delta.input_json_delta.partial_json` 累积
   - tool result 回写要包成 `role:'user' content:[{type:tool_result, tool_use_id, content}]`
   - `max_tokens` 必传
   - 头：`x-api-key` + `anthropic-version: 2023-06-01`
   - prompt cache：在 system + cacheHint='ephemeral' 的 message 上加 `cache_control:{type:'ephemeral'}`

4. **`apps/server/src/providers.ts`**：profile = `{id, name, kind?, baseUrl, apiKey, model, embedModel}`，4 个 role 各自有 active + fallbacks（chat/complete/embed/fast）。kind 缺省时 `anthropic.com` → anthropic。

5. **`apps/server/src/llm-router.ts`**：
   ```ts
   for (let i=0; i<chain.length; i++) {
     let started = false;
     try {
       for await (chunk of provider.chatStream(...)) {
         started = true;
         yield chunk;
       }
       return;
     } catch (e) {
       if (started) throw e;        // 已吐 token 不重试
       if (!isRetryable(e)) throw;  // 401/400 用户错
       onSwitch?.(...);             // 推 SSE provider_switch
     }
   }
   ```

> **亮点 3**：Multi-Provider + 自动 Fallback + 已开始 stream 后不切换（一致性优先）。
> **难点 4**：Anthropic 协议跟 OpenAI 差异极大，你**至少要花 1-2 天**专门读官方 SSE 文档把每个事件吃透。

### M5：Agent Loop（最难的部分）

`packages/core/src/agent/`：

1. **tool-registry.ts**：
   ```ts
   interface Tool {
     name; description; schema(zod); execute(args, ctx);
     parallelSafe?: boolean;
     requiresApproval?: boolean;
   }
   ```
2. **loop.ts** ReAct 主循环：
   ```
   while true:
     stream = llm.chatStream([system, ...history, ...new], { tools })
     收 delta → 累积到 assistantMsg / toolBuffers
     for try chunk in stream:
       yield chunk to caller (SSE 转发)
     if no tool_calls: break
     // 切段：连续 parallelSafe → Promise.all 一段；遇副作用 → 单独段
     for seg of segments:
       results = await Promise.all(seg.map(execute))
       push tool messages
   ```
3. **builtin-tools.ts**（40KB，10+ 个 tool，**项目精华**）：
   - `read_file`（行号前缀 + 默认 500 行 + path 错时给同目录候选）
   - `grep_search`（case_insensitive + context_lines + glob）
   - `list_files`（`{path,type,size}` 结构化）
   - `find_symbol` / `find_references`（走 SymbolGraph）
   - `semantic_search`（走 hybridRetrieve）
   - `edit_file`（didYouMean：失败时返回最相似 3 行候选，**亮点**）
   - `write_file`（走 `proposeEdit`，不直写）
   - `run_command`（走 `exec-policy`）
   - `verify_changes`（typecheck/test/lint/exec，结构化错误 + hint）
   - `think`（scratchpad，Anthropic 推荐）
   - `update_plan`
   - `dispatch_subagent`
   - `use_skill`
4. **error-recovery.ts**：连续 3 次同 tool 同参数失败 → 注入 `[loop-breaker]`；同 tool 3 次报错 → `[tool-budget]`。
5. **fuzzy-apply.ts**：edit_file 严格匹配失败时尝试模糊补丁。
6. **hooks.ts**：`onBeforeWrite / onProposeEdit / onSubagentSpawn` 等。

> **难点 5**：tool_call 的流式累积是个坑。OpenAI 是 string 增量靠 `index` 拼，Anthropic 是 `partial_json` 靠 content_block index 拼，**两套都得正确，否则 JSON.parse 必挂**。
> **难点 6**：parallel 切段。规则：连续 `parallelSafe=true` 一段并发；遇到非 safe 单独成段。错了的话写文件并发跑会冲突。

### M6：Pending Edit + Checkpoint 双保险（亮点）

1. **pending-edit.ts**：`propose / list / accept / reject`。同一文件多次 propose 自动合并到同一 entry。
2. **checkpoint.ts**：`accept` 触发 `onBeforeWrite` → 自动 snapshot 当前磁盘内容到 `.minicodeide/checkpoints/<id>.json`。`revert` 时 oldContent=null → unlink 否则 writeFile。保留 100 条。

> **亮点 4**：所有写盘都过 PendingEdit，等于天然实现「半个 PR」机制。

### M7：Sessions（jsonl + Resume）

1. 路径 `.minicodeide/sessions/<id>.jsonl`，append-only。
2. 4 种事件：`turn_start / chunk / tool / turn_end / turn_interrupted`。
3. 启动一次性 reduce 进内存 `Map<id, InMemorySession>`。
4. Resume：reduce 时发现 `turn_start` 没配对 `turn_end` → 标记 interrupted，UI 显示 ⏸ 按钮。

> **亮点 5**：流式增量落盘（每个 SSE delta 立刻写一行 chunk），崩溃只丢最后几个 token，比"等结束 finally 再写"健壮 100 倍。

### M8：Rules / Slash / Skills

按出现频率从重到轻：

| 机制 | 实现复杂度 | 触发 | 注入位置 |
|---|---|---|---|
| Rules | 解析 frontmatter + glob 匹配 | always / auto+globs / manual | system prompt extras |
| Slash | 模板替换 `$ARG` | `/explain xxx` | 改写 user message |
| Skills | progressive disclosure | LLM 自调 `use_skill` | 概要进 system，全文按需读 |

### M9：高阶能力（按需）

- **Subagent Manager**：层级模式（不是群聊）。父 spawn 子 → 子独立 ReAct loop → push announce 回父 → 下一 turn user role 注入。三道保险：maxDepth=2 / maxConcurrentPerParent=3 / runTimeoutMs=120s。
- **Exec Policy**：`run_command` 三档：白名单 auto、危险 deny、未知 ask（前端审批卡片）。
- **Reranker**：cross-encoder（`@xenova/transformers`），懒加载、失败 silently。
- **Memory**：`packages/core/src/memory/store.ts`（16KB），auto-memory 从对话抽取。
- **Eval Harness**：见 `evals/`。
- **MCP Client**：连第三方 MCP server。
- **Key Rotator**：多 API key 轮转（429 时切下一把）。

---

## 6. 前端：你应该按什么顺序写

### F0：Vite + React + Monaco 跑起来（半天）

略，参考 M1。

### F1：状态管理 store.ts（zustand）

切片：
- `workspace`：cwd / fileTree
- `editor`：openTabs / activeTabId / dirtyMap / cursorPos
- `chat`：sessions / activeSessionId / messages / streaming
- `composer`：pendingEdits / checkpoints
- `ui`：activitySidebar / panelLayout / theme
- `settings`：providers / activeRoles

### F2：3 栏 + ActivityBar 布局

`App.tsx` 用 grid，左 ActivityBar + 可折叠侧栏，中编辑器+底部 Panel（terminal/problems/output 切换），右 ChatPanel。

### F3：核心组件优先级（按用户使用频率）

```
P0（必做）: FileTree, EditorArea, ChatPanel, MarkdownMessage
P1: ComposerPanel, SettingsPanel, CommandPalette
P2: MentionInput, AddContextPopover, InlineEditWidget, PendingEditsHub
P3: GitPanel, SessionsDrawer, OutlinePanel, ProblemsPanel, SearchPanel
P4: TerminalPanel, PlanPanel, ContextStatusBar, WelcomePage, VSCodeFrame
```

### F4：Inline Completion（亮点）

`inline-completion.ts`：
- 注册 `monaco.languages.registerInlineCompletionsProvider`
- debounce 300ms + AbortController
- prefix 取光标前 30 行、suffix 后 10 行
- POST `/api/complete`，单次返回（非流式 ghost text 更顺）
- LRU cache（同 prefix → 直接返回）
- 句尾抑制（`;` `}` 之后 300ms 内不弹）
- 失败熔断 30s（连续报错就停）

### F5：Agents Window（独立 BrowserWindow）

Electron 主进程开第二个 window，加载 `agents-window` 子路径或独立 entry。共享 store？**不**，各自一份 zustand。通过 IPC 同步必要数据（如 active session）。

---

## 7. AI 相关详解（你可能最关心）

### 7.1 一次 chat 请求完整生命周期

```
ChatPanel.send()
  → POST /api/chat { sessionId, userMessage, mode, mentions[] }
  → server:
       1) maybeExpandSlash(userMessage)
       2) parseMentions(text, ctx) → explicitContext[]
       3) hybridRetrieve(text) → topK chunks
       4) rules.pick(touchedPaths) → systemExtras
       5) buildMessages({ history, system, systemExtras, mentions, retrieved })
       6) llmRouter.chatStream(messages, { tools, onSwitch })
       7) runAgent(stream) loop:
            - text delta → SSE event:'text' delta
            - tool_call delta → 累积
            - tool_call 完成 → 切段执行 → SSE event:'tool' name+result
            - 写盘 tool → proposeEdit → SSE event:'pending_edit'
            - run_command → exec-policy → 可能 SSE event:'approve_request'
            - subagent → SSE event:'subagent_spawned'
       8) finally:
            - awaitAllForParent(60s) 等子 Agent
            - SSE event:'subagent_announce' × N
            - turn_end 写 jsonl
            - SSE event:'done'
```

**前端**收每一类事件都有对应 reducer；`subagent_announce` 会自动续发新一轮 chat。

### 7.2 Tool Calling 怎么并发

规则（在 `tool-registry.ts:planSegments`）：
- 连续 `parallelSafe=true` 的 tool → 一段 `Promise.all`
- 遇到 `parallelSafe=false`（write/run_command）→ 单独成段
- 段间严格串行

例：`[read, read, grep, write, read]` → `[[read,read,grep], [write], [read]]` 三段。

### 7.3 Context 怎么组装

`packages/core/src/context/builder.ts`：

```
final messages =
  [system(systemBase + systemExtras + skillsSummary)]
  + recentActivity 摘要（最近改的文件 path 列表）
  + 历史 messages（按 token 预算可能压缩）
  + retrievedChunks（hybridRetrieve 拿来的）
  + explicitContext（@mention 解析的）
  + currentUserMessage
```

token 预算超了走 `compactor`：先 soft（删冗余 tool result），再 hard（强截）。

### 7.4 Agent UX 13 项改进（已落地）

详见 `docs/AI-UX-IMPROVEMENTS.md`。要点：

- `think` tool（scratchpad）
- 循环检测 `[loop-breaker]`
- `edit_file` didYouMean
- `read_file` 行号前缀 + 路径候选
- `grep_search` glob + context_lines
- `list_files` 结构化 + 默认忽略
- system prompt 教 LLM 批量并发
- inline completion LRU + 熔断
- tool error retry budget
- 多步任务建议 update_plan
- think tool 折叠 UI
- @-mention 相关性排序
- markdown 自动链接

---

## 8. 文件模块怎么分（包依赖图）

```
apps/desktop  ──────┐
apps/electron       │
apps/web ──────┐    │
                ▼   ▼
              [packages/core] ←── apps/server / server-node / server-cloud
                  │     │
                  ▼     ▼
              [packages/indexer]   [packages/storage]   [packages/sandbox]
```

依赖原则：
- `packages/*` **不能依赖** `apps/*`
- `core` 不依赖 `indexer`（loop 接受外部 retrieve 函数）
- `indexer` 只依赖 tree-sitter
- `storage` 接口在 `types.ts`，jsonl 和 prisma 实现都对它编程
- `apps/server` 是组装层（DI 容器），把 core+indexer+storage 拼成可服务

---

## 9. 亮点（面试 / 复盘要讲的点）

1. **三层检索 + RRF 融合**——一句话：纯向量召回精确符号差，纯 BM25 自然语言差，三路并跑 RRF 融合不需要分数对齐又抗噪。
2. **Multi-Provider + Anthropic 原生 + Fallback Router**——OpenAI 兼容协议覆盖 90% 但不够，Claude 必须原生（`/v1/messages` 全套适配），Router 做链式 fallback 且开始 stream 后绝不切换（一致性优先）。
3. **Pending Edit + Checkpoint 双保险**——所有写盘走提议流程，等于天然「半个 PR」；事后回退靠 onBeforeWrite hook 自动 snapshot。
4. **Tool 并发分段**——`parallelSafe` 标记自动切段，纯读并发，写串行，多文件分析显著提速但绝不冲突。
5. **Session jsonl + 流式增量落盘**——崩溃续接，每个 SSE delta 立刻 append，不等 finally。
6. **Subagent 层级模式（不是群聊）**——push announce 回父、深度+并发硬上限、独立 jsonl、子默认只读。
7. **教学性 Tool Error**——edit_file 失败给 didYouMean 候选、loop 检测注入 `[loop-breaker]`、retry budget、`verify_changes` 给 actionable hint。
8. **Skills（progressive disclosure）**——system prompt 只塞概要，LLM 调 use_skill 才加载全文，省 context。
9. **Exec Policy 三档**——白名单 auto / 危险 deny / 未知 ask，明确放弃 Docker（threat model 不在 IDE 场景）。
10. **Eval Harness 端到端**——固定 fixture + 真实 HTTP + 多维指标 + CI 退出码，所有 AI 调优靠它判定，不靠"我觉得"。
11. **后端两套实现并存**（Express + Bare-Node）——能体现工程演进；server-node 完全无框架手写 router/SSE。
12. **不用 Vercel AI SDK**——刻意自实现 LLMProvider 抽象，把这层讲清楚比快糙猛挂个 SDK 更值。

---

## 10. 难点（你写的时候会卡住的地方）

1. **Anthropic SSE 协议适配**——事件分 7 种、tool_use 用 `partial_json` 增量、`max_tokens` 必传、tool_result 要包在 user message 的 content array 里。**至少 1-2 天**专门搞，建议先打开 Anthropic playground 抓真实包看。
2. **Tool 流式累积的 index 拼接**——OpenAI 用 `tool_calls[].index` + arguments string 拼，Anthropic 用 `content_block_index` + `partial_json` 拼，错一个 JSON.parse 必挂。
3. **Monaco Worker 在 Vite 下的注册**——必须 `MonacoEnvironment.getWorker = (id, label) => { ... new Worker(...) }`，少一个语言能力就缺。
4. **chokidar 增量索引的 burst 控制**——`git checkout` 一次 1000 个文件变更，要 debounce 合并 + 跳过 embedding（钱）+ 异步 vectors.save。
5. **路径守卫 resolveInside**——必须用 `path.relative` 检查 `..`，**不要**只看字符串前缀（symlink 能绕过，写完单测）。
6. **Pending Edit 同文件合并**——同一文件多次 propose 要 merge 而不是覆盖，否则 LLM 多步改一个文件最后只剩最后一步。
7. **Subagent push announce 时机**——父 turn 结束 finally 等子 60s，比 CodeFlicker 的 embedded inject 简单但延迟 1-2s，要写在 system prompt 里告诉 LLM "不要 poll"。
8. **embedder 切换时的索引重置**——不同 embedder 维度不同，混存就完了。`onChange` hook 必须清 vector store。
9. **Markdown 流式渲染性能**——每个 token re-render 整个 react-markdown，1000 token 内可接受，再大要么 throttle 要么 virtualize。
10. **Electron + code-server 跨进程通信**——file:// renderer 的 fetch 要劫持（`electron-bridge.ts`），iframe code-server 要 postMessage RPC（`vscode-bridge.ts`），还要往 code-server 注入扩展（`vscode-bridge-ext`）反向冒泡 editor 事件。**这块是最大坑，详见 docs/INTERVIEW.md 第十一章**。

---

## 11. 待优化点（坦诚清单）

| 类别 | 当前状态 | 待做 |
|---|---|---|
| 后端两套并存 | server / server-node 共享逻辑通过相对 import（`../server/src/*`），耦合 | 提 `packages/server-core`，两套 app 都依赖它 |
| 索引规模 | jsonl + 内存，几千 chunks 够用 | 切 LanceDB / Qdrant 才能上万 chunks |
| Embedding 去重 | 仅按 path 替换 | 加内容 hash + 持久化 dedup（同内容不重新 embed）|
| 多用户 | 单租户进程 | server-cloud 已有 Prisma schema，但 workspace 维度依赖注入还没抽象 |
| 沙箱 | 无 Docker，靠 cwd + exec policy | LLM 用 `node -e ...` 仍能绕过 → 不在 threat model |
| LSP | 仅 TS 一种 | 多语言要按 lang 分别开 child + 路由 |
| Reranker | 懒加载 22MB 模型，CPU 30-50ms | 大量 query 时切到 GPU 或调小模型 |
| Web 版 | apps/web 仅骨架 | sandbox vfs（packages/sandbox）+ 远程 server-cloud 接通 |
| 微信桥 | stub provider | 真实接 wxbot 协议 |
| Tests | 仅 4 个 spec（store/structured/recovery/hooks/soft-compact/chunker） | Agent loop / retrieval / pending-edit 关键路径补单测 |
| node_modules 体积 | 大 | electron-builder 已配了 prune，但 release/*.dmg 仍 220MB+ |
| 多 Agent 配置 | 仅 fast/chat 二档 | reviewer / planner role 抽象点已留 |
| 状态恢复 | session jsonl resume | composer/checkpoint 跨重启没恢复 UI 状态（待加 store persist）|
| 类型同步 | 前后端各写一套 type | 抽 `packages/contract` 共享 |
| Agents Window 与主窗口同步 | 各自 store | 通过 IPC + electron-store 双向 sync |

---

## 12. 你的 Rebuild 推荐路径

按这个顺序，每一步都能看到效果，不会写一周才 demo 一次：

```
Day 1-2:   M0 (HTTP 文件 server) + F0/F1/F2 (前端骨架)
Day 3:     M1 / F3 P0：能开文件、能编辑、能存
Day 4-5:   M4 (LLM Provider) + 简易 ChatPanel：能 chat 流式
Day 6-7:   M5 (Agent loop + 5 个核心 tool: read/grep/list/write/edit)
Day 8:     M6 (Pending + Checkpoint)：能审查 / 回退
Day 9-10:  M2/M3 (索引 + 检索)：semantic_search 能跑
Day 11:    M7 (Sessions jsonl)
Day 12:    M8 (Rules + Slash)
Day 13:    Inline completion + Cmd+K
Day 14:    Settings / Providers UI + 多 provider 切换
Day 15:    Anthropic 原生（如果你要）+ Router fallback
Day 16+:   M9 高阶（subagent / exec-policy / reranker / eval / electron 打包）
```

**最小可演示**（Day 7）：能用 GPT-4 让它读文件 / grep / 改文件，改的内容你能审查 + 回退。
**面试可演示**（Day 14）：上面 + 检索 + sessions + 多 provider，能讲清架构。
**生产可用**（Day 30+）：上面 + electron 打包 + eval + skills + 安全 + 部署。

---

## 13. 进一步阅读（本仓库已有的好文档）

读完本指南后建议按这个顺序看：

1. **docs/ARCHITECTURE.md**（51KB）——技术深度最大，1-13 章覆盖 P0~P6 全貌
2. **docs/INTERVIEW.md**（73KB）——以 Q&A 形式讲每个亮点，**面试场景高效路径**
3. **docs/AI-UX-IMPROVEMENTS.md**——两轮 13 项 UX 改进，对应代码就在 `builtin-tools.ts`
4. **docs/AGENT-OPTIMIZATIONS.md**——Round 3：Memory / KeyPool / Eval baseline
5. **docs/MEMORY-AND-ATTENTION.md**——长期记忆 + 注意力调度
6. **docs/HARNESS.md**——Eval 框架细节
7. **docs/AGENTS-WINDOW.md / -TECH.md**——Agents 窗口 PRD + 实现
8. **docs/DEPLOYMENT.md**——上线 SOP（Auth / RateLimit / Health / Electron / auto-update）
9. **docs/TDD.md / PRD.md / ROADMAP.md**——产品演进路径
10. **docs/FORK-OPENVSCODE-SERVER-PRD.md**——为啥不 fork VSCode 的决策
11. **docs/UX_REVAMP_PLAN.md**——P1-P6 UX 改造 P0/P1/P2 等
12. **docs/REMOTE-WECHAT.md**——微信桥设计
13. **docs/PRODUCTION-HARDENING.md**——生产硬化清单

---

## 14. 一句话总结

> **MiniCodeIDE = Monaco 壳 + 三层检索 + Agent ReAct loop + 多 Provider Router + Pending/Checkpoint 双保险 + jsonl Session + Subagent 层级 + Exec Policy + Skills 渐进式 + Eval 闭环。**

你照着第 5、6 节的里程碑顺序写，每一步都能跑、都能演示、都能讲。卡的时候回查第 10 节难点清单——那是踩过的坑。

Good luck. — 给你自己复刻时的我自己。