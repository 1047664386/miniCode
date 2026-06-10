# MiniCodeIDE 项目记忆

## 项目概况
- MiniCodeIDE 是自建的 Cursor/Claude-Code 风格 AI 编程 IDE
- pnpm monorepo, ESM-only TypeScript
- 核心包: packages/core (Agent Loop + LLM + Memory + Context + Prompts), packages/indexer (BM25 + SymbolGraph + Vector)
- **packages/server-core**: 共享业务逻辑包（store/agent/llm/git/indexer/exec/tasks/bridge/utils），由 server-node 导入
- 后端: apps/server-node (bare-Node, 唯一本地后端), apps/server-cloud (Fastify + Prisma + PG)
- 前端: apps/desktop (React + Monaco), apps/web (复用desktop)
- 桌面壳: apps/electron
- **apps/server (Express) 已于 2026-06-10 删除**，业务逻辑迁移至 packages/server-core

## 已完成的文档梳理 (2026-06-09)
- docs-new/ 下 11 篇深度分析文档（含新增第11篇AI工程化专题）
- 发现 27 个逻辑缺口/Bug，最高优先级: Skill自动触发、MCP Schema、System分层缓存、Session并发锁
- 面试题从24道增至30道，新增FC/ReAct/上下文工程/异步架构

## 已实现特性 (2026-06-10)
- P1 Skill 自动触发：parseFrontmatter 支持 triggers 数组、matchForInput 关键词匹配、renderAutoTriggeredSkills 自动注入
- P2 Progressive Tool Disclosure：plan 模式用 CHAT_ONLY_PROFILE（5 个只读工具），agent 全量
- P2 记忆召回上下文关联：buildEnrichedRecallQuery 融合用户消息 + 最近 2 轮对话
- P2 子 Agent 流式输出：subagentEventBuffer 统一 text/tool/progress，child_text 200ms 节流
- ❌ MCP Resources 跳过（ROI 低）
- 停止生成功能：ChatPanel AbortController + stopChat + 红色停止按钮
- 文件树实时刷新：chokidar → onFileChange → SSE /api/fs/events → 前端 EventSource → bumpTree + loadTree + TreeNode treeVersion 监听
- acceptPending 后刷新文件树
- Electron cloud-api 代理：electron-bridge.ts 新增 isCloudPath + rewriteCloudPath，/cloud-api/ → http://127.0.0.1:4000/
- Slash Skill 选择器：/ 唤起 skill 列表 + Tag 样式插入 + /skill:xxx 后端解析注入

## 后端架构现状 (2026-06-10)
- **server-node 是唯一本地后端**：Electron 打包 + Vite 开发都用 server-node
- **packages/server-core** 提供所有共享业务逻辑，通过 `@mini/server-core` barrel 导出
- server-node 通过 `import { ... } from '@mini/server-core'` 导入，不再有相对路径跨越
- server-cloud 完全独立（JWT+PostgreSQL+SandboxHandle），不动
- 3 个前端消费端：Electron IDE(useStore) + Agent Window(useAgentsStore) + Cloud Web(useAgentsStore)

## 后端整合 + server-core 提取 (2026-06-10) — ✅ 已完成
- 6 Phase 整合全部完成：提取重复代码 → 补 API 缺口 → 对齐 Chat Handler 15项 → 中间件安全加固 → SSE保持双端点 → Electron已默认server-node
- server-core 提取完成：9 目录 31 文件，全部 < 500 行
- subagent-manager 拆分：→ subagent-types.ts + profile-watcher.ts
- 严格 CR 修复：P0 跨目录引用改为 barrel、P1 类型导出补全 + as any 消除 + /tmp 跨平台
- apps/server 已删除，prepare-electron-resources.mjs 硬编码 server-node
- 用户准备用此项目面试，需要深入掌握 AI 模块
- 面试重点方向: Agent Loop、上下文压缩、幻觉处理、记忆系统、代码检索、Skill/MCP/子Agent
