# MiniCodeIDE 项目记忆

## 项目概况
- MiniCodeIDE 是自建的 Cursor/Claude-Code 风格 AI 编程 IDE
- pnpm monorepo, ESM-only TypeScript
- 核心包: packages/core (Agent Loop + LLM + Memory + Context + Prompts), packages/indexer (BM25 + SymbolGraph + Vector)
- 后端: apps/server (Express), apps/server-node (bare-Node), apps/server-cloud (Fastify + Prisma + PG)
- 前端: apps/desktop (React + Monaco), apps/web (复用desktop)
- 桌面壳: apps/electron

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
- 3 个后端并存：server(Express 2488行), server-node(bare-Node 1310行), server-cloud(Fastify+Prisma)
- Electron 打包用 server(Express)；Vite 开发用 server-node(bare-Node)；Web 版用 server-cloud
- server-node 17 个业务模块通过相对路径导入 server，路由层 ~80% 重复，3 个函数完全复制粘贴
- 2 个持久 SSE 通道：/api/fs/events(文件+skill变更) + /api/composer/events(VSCode转发)
- SSE 协议不统一：server/server-node 用 `data:` 格式，server-cloud 用 `event:+data:` 格式
- server 不支持 workspace 热切换，server-node 支持
- server-node 架构更优：Services 容器、openSse 封装、ApprovalsStore 抽象、workspace switch
- 用户准备用此项目面试，需要深入掌握 AI 模块
- 面试重点方向: Agent Loop、上下文压缩、幻觉处理、记忆系统、代码检索、Skill/MCP/子Agent
