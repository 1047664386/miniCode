# AI 核心模块：Skill 系统、MCP 集成与子 Agent 深度分析

> 本文档深入分析 MiniCodeIDE 的 Skill 渐进式加载、MCP 协议集成、子 Agent 编排调度三大扩展机制。

---

## 一、Skill 系统（Progressive Disclosure）

### 1.1 设计理念

**核心问题**：如果一次把所有 skill 的完整内容注入 system prompt，可能占几千 token，严重挤压对话空间。

**解决方案**：Progressive Disclosure（渐进式展开）

```
System Prompt 注入: 只显示概览
  - **deploy** [project]: 一键部署到云平台
  - **test-runner** [user]: 运行测试并分析失败原因
  - **code-reviewer** [project]: 代码审查最佳实践

LLM 判断需要 → 调用 use_skill(name="deploy")
  → 返回完整 SKILL.md + supportFiles 列表
  → 注入到后续消息

LLM 不需要 → 概览只占几token，浪费极小
```

### 1.2 目录结构

```
<workspace>/.minicodeide/skills/<name>/SKILL.md   # project-level
~/.minicodeide/skills/<name>/SKILL.md             # user-level

加载优先级: user先加载，project同名覆盖user
```

### 1.3 SKILL.md 格式

```markdown
---
name: deploy
description: 一键部署到云平台，支持 Vercel/Cloudflare/AWS
user_invocable: true
---

# Deploy Skill

## When to use
- 用户说"部署"/"deploy"/"上线"时
- 需要将项目部署到云平台时

## Steps
1. 检查项目类型（Next.js/React/Node.js）
2. 选择部署平台
3. 构建项目
4. 部署

## Support files
- `templates/vercel.json`
- `templates/cloudflare.toml`
```

### 1.4 use_skill 工具实现

```typescript
// 在 builtin-tools.ts 中
{
  name: 'use_skill',
  description: 'Load a skill\'s full instructions. Only call this when you need the skill.',
  schema: z.object({ name: z.string() }),
  parallelSafe: true,
  async execute({ name }, ctx) {
    const full = await ctx.skillStore.loadFull(name);
    if (!full) return { ok: false, error: `Skill "${name}" not found` };
    // 返回完整skill内容 + 支持文件列表
    return {
      ok: true,
      body: full.body,
      supportFiles: full.supportFiles,
      directory: full.directory,
    };
  }
}
```

### 1.5 与主流 Skill 系统对比

| 维度 | MiniCodeIDE | Cursor Rules | Claude Code | Cline |
|------|-------------|-------------|-------------|-------|
| 触发方式 | LLM自主判断 | glob匹配+@rule | LLM判断 | 用户选择 |
| 加载策略 | Progressive Disclosure | 全量注入 | 全量注入 | 全量注入 |
| 用户调用 | /skill (未实现) | @rule:name | /command | /task |
| 多层级 | project + user | project only | project + user | project only |
| 支持文件 | ✅ 目录扫描 | ❌ | ❌ | ❌ |
| 热更新 | ❌ | ✅ (文件监听) | ✅ | ❌ |

**亮点**：Progressive Disclosure 是最节省 context 的方案。
**不足**：完全依赖 LLM 自主判断是否触发，可能漏掉。

### 1.6 改进方向

#### 1.6.1 Keyword 自动触发

```typescript
// 在 frontmatter 中增加 triggers 字段
---
name: deploy
description: 一键部署
triggers: ["deploy", "部署", "上线", "publish"]
---

// 匹配逻辑
function matchSkill(query: string, skills: SkillMeta[]): SkillMeta[] {
  return skills.filter(s => {
    const triggers = s.triggers ?? [];
    return triggers.some(t => query.toLowerCase().includes(t.toLowerCase()));
  });
}
```

#### 1.6.2 Embedding 匹配

对于没有明确关键词的场景：
1. 给每个 skill 的 description + triggers 做 embedding
2. 用户输入也做 embedding
3. 余弦相似度 >0.7 → 自动注入到 context

#### 1.6.3 /skill Slash Command

```
用户: /skill deploy
  → 解析skill名
  → 直接加载skill全文到context
  → 不依赖LLM判断
```

---

## 二、MCP (Model Context Protocol) 集成

### 2.1 MCP 协议概述

MCP 是 Anthropic 主推的 LLM 工具扩展协议，已成为事实标准（Cursor/Cline/Continue 都支持）。

```
┌─────────────┐  stdio JSON-RPC  ┌─────────────┐
│  MCP Client │ ◄──────────────► │  MCP Server │
│  (MiniCodeIDE)│                 │  (第三方服务) │
└─────────────┘                  └─────────────┘

协议流程:
1. initialize (握手 + 能力协商)
2. notifications/initialized (客户端就绪)
3. tools/list (获取工具清单)
4. tools/call (执行工具)
5. resources/list (获取资源，未实现)
6. resources/read (读取资源，未实现)
```

### 2.2 客户端实现

```typescript
class McpClient {
  // spawn server子进程
  proc = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });

  // JSON-RPC通信
  request(method, params) → Promise<result>
  notify(method, params) → void

  // 生命周期
  connect() → initialize → tools/list
  callTool(name, args) → tools/call
  close() → SIGTERM
}
```

### 2.3 工具注册

```typescript
// MCP工具注册到ToolRegistry
McpManager.registerToolsTo(registry):
  for each client:
    for each tool:
      registry.register({
        name: `mcp__${client.name}__${tool.name}`,  // 命名约定避免冲突
        description: `[MCP:${client.name}] ${tool.description}`,
        schema: z.record(z.string(), z.any()),       // ⚠️ 丢失了原始inputSchema
        parallelSafe: false,                          // 保守：未知副作用 → 串行
        execute: (input) => client.callTool(tool.name, input),
      });
```

### 2.4 安全防护

```typescript
// 命令白名单
DEFAULT_ALLOWLIST = {
  allowedCommands: ['npx', 'uvx', 'node', 'python3', 'python', 'bunx', 'pnpm', 'docker'],
  denyArgs: ['--allow-shell', '--unsafe', '--rm-rf'],
};

// 校验流程
validateServerAgainstAllowlist(config, allowlist):
  1. command basename 是否在白名单中
  2. args 是否包含禁止的token
  3. 不通过 → 拒绝启动
```

### 2.5 与主流 MCP 集成对比

| 维度 | MiniCodeIDE | Cursor | Claude Code | Cline |
|------|-------------|--------|-------------|-------|
| 传输协议 | stdio | stdio + SSE | stdio | stdio |
| 工具发现 | tools/list | tools/list | tools/list | tools/list |
| 资源协议 | ❌ 未实现 | ✅ | ✅ | ✅ |
| 参数Schema | ❌ 透传any | ✅ JSON Schema | ✅ JSON Schema | ✅ JSON Schema |
| 安全白名单 | ✅ | ✅ | ✅ | ✅ |
| 动态加载 | ❌ 重启生效 | ✅ 热加载 | ✅ 热加载 | ✅ 热加载 |
| 进程管理 | 简单spawn/kill | 完善生命周期 | 完善生命周期 | 简单 |

### 2.6 改进方向

1. **参数 Schema 注入** — 将 inputSchema 渲染到 description，让 LLM 知道参数格式
2. **Resources 协议** — 实现 resources/list + resources/read，获取 MCP 上下文资源
3. **进程健康检查** — heartbeat ping + 自动重连
4. **动态加载** — 监听 mcp.json 变更，自动加载/卸载 MCP server
5. **SSE 传输** — 支持远程 MCP server（通过 HTTP SSE 通信）

---

## 三、子 Agent 编排调度

### 3.1 层级模式

```
父 Agent (depth=0)
  ├─ 子 Agent A (depth=1, role="code-reviewer")
  ├─ 子 Agent B (depth=1, role="test-runner")
  └─ 子 Agent C (depth=1, 无角色)
       └─ ❌ 不能再spawn子Agent (maxDepth=2)
```

### 3.2 核心参数

| 参数 | 值 | 说明 |
|------|-----|------|
| maxDepth | 2 | 最多2层嵌套 |
| maxConcurrentPerParent | 3 | 每个父Agent最多3个并发子Agent |
| runTimeoutMs | 120_000 | 子Agent超时2分钟 |
| maxSteps | 8 | 子Agent最多8步（父是25步） |

### 3.3 Push not Poll 模式

```
父Agent调dispatch_subagent
  → 立即返回 {runId, childSessionId}
  → 父Agent继续执行（不阻塞）

子Agent在后台独立执行
  → 完成后 deliverAnnounce()
  → 结果放入 pendingAnnounceByParent 队列

父Agent下一turn开始
  → pickPendingAnnouncements()
  → 拉取子Agent结果
  → 作为合成user消息合入上下文
```

**为什么选 Push not Poll？**
- Poll 模式：父Agent每轮都问"子Agent好了吗"，浪费token
- Push 模式：子Agent完成时主动通知，父Agent只在需要时消费
- 类似消息队列的"发布-订阅"模式

### 3.4 角色系统 (Agent Profile)

```yaml
# .minicodeide/agents/code-reviewer.md
---
name: code-reviewer
description: Reviews code for bugs, style, and best practices
allowed_tools: [read_file, list_files, grep_search, find_symbol, find_references]
denied_tools: []
sandbox: read_only
max_steps: 6
---

You are a code reviewer. Focus on:
- Bug detection
- Code style and conventions
- Performance issues
- Security vulnerabilities
```

**工具裁剪策略**：
1. 所有子Agent都移除 `dispatch_subagent` 和 `update_plan`
2. 有角色时：
   - 有 `allowedTools` → 白名单模式（只保留列表中的）
   - 有 `deniedTools` → 黑名单模式（移除列表中的）
   - `sandbox: read_only` → 强制移除写工具
3. 无角色（默认子Agent）→ 移除所有写工具 + shell

### 3.5 Worktree 隔离

```
子Agent并发写文件冲突问题:
  子AgentA: write_file("src/foo.ts")
  子AgentB: write_file("src/foo.ts")
  → 后写覆盖前写！

Worktree隔离:
  子AgentA → .minicodeide/worktrees/srun_xxx/src/ (独立目录)
  子AgentB → .minicodeide/worktrees/srun_yyy/src/ (独立目录)
  → 各自写自己的副本，不冲突

完成后:
  Git worktree → 独立分支
  → 用户可以手动merge
  → 或自动cherry-pick到主分支
```

### 3.6 Profile 热更新

```typescript
// fs.watch .minicodeide/agents/ 目录
// 文件变更 → debounce 500ms → refreshProfiles()
_startProfileWatcher(workspaceRoot) {
  this.profileWatcher = fsSync.watch(agentsDir, (eventType, filename) => {
    if (!filename?.endsWith('.md')) return;
    // debounce
    clearTimeout(this.profileReloadTimer);
    this.profileReloadTimer = setTimeout(async () => {
      this.profiles = await loadAgentProfiles(workspaceRoot);
    }, 500);
  });
}
```

### 3.7 与主流多 Agent 方案对比

| 维度 | MiniCodeIDE | AutoGen | CrewAI | Cursor Composer |
|------|-------------|---------|--------|----------------|
| 架构 | 层级式 | 对话式 | 流水线 | 并行Agent |
| 通信 | Push announce | 对话链 | 顺序传递 | 共享编辑器 |
| 并发 | ✅ 3个/父 | ✅ | ❌ 串行 | ✅ |
| 隔离 | Worktree | 进程级 | 无 | 文件级 |
| 角色系统 | Profile文件 | System Prompt | Role类 | 隐式 |
| 深度限制 | 2层 | 无限 | 1层 | 1层 |
| 结果聚合 | announce队列 | 对话汇总 | 顺序合并 | 代码合并 |

### 3.8 改进方向

1. **流式输出** — 子Agent的text/tool事件转发到前端SSE
2. **结果即时推送** — 子Agent完成时可以中断父Agent当前turn
3. **智能并发调度** — 分析子Agent的文件依赖，有冲突时串行
4. **子Agent协作** — 子Agent之间可以共享信息（当前完全隔离）
5. **动态角色生成** — 不需要预定义Profile，LLM根据任务自动生成角色

---

## 四、三者协同流程

以"帮我重构认证模块并部署"为例：

```
用户: "帮我重构认证模块并部署"

1. Agent Loop 识别到这是一个复杂任务
2. 调用 update_plan 声明子任务:
   - 子任务1: 分析认证模块
   - 子任务2: 重构代码
   - 子任务3: 部署

3. dispatch_subagent({
     task: "分析认证模块的代码结构",
     role: "code-reviewer",  // 只读角色
   })
   → 子AgentA（只读）后台分析

4. 子AgentA完成 → announce结果
   → 父Agent拉取 → 理解认证模块结构

5. 父Agent自主执行重构（使用write_file/edit_file）

6. 调 use_skill("deploy") 加载部署skill
   → 按skill指引执行部署

7. dispatch_subagent({
     task: "运行测试验证重构",
     role: "test-runner",
   })
   → 子AgentB执行测试

8. 子AgentB完成 → announce结果
   → 父Agent确认测试通过 → 声明完成
```

**这个流程体现了三者的协同**：
- Skill 提供领域知识（部署步骤）
- 子 Agent 处理并行子任务（分析、测试）
- MCP 可以接入 CI/CD 工具（如 GitHub Actions）
