
# MiniCodeIDE

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
