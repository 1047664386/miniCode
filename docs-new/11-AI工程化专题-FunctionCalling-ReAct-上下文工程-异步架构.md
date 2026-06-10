# AI 工程化深度专题：Function Calling、ReAct、上下文工程与异步架构

> 本文档深入挖掘 MiniCodeIDE 中 Function Calling 实现方式、ReAct 推理-行动循环、上下文检索注入策略、幻觉防护与格式约束、Token 去重机制、异步请求追踪等核心工程问题。
> 每个主题均给出：现状实现 → 最佳实践 → 改进方案 → 面试考点。

---

## 一、Function Calling 实现方式：原生 FC + Provider 适配层

### 1.1 现状实现

MiniCodeIDE 使用 **原生 Function Calling / Tool Use API**，不是 Prompt 模拟。但通过 Provider 适配层做了协议归一化：

```
┌─────────────────────────────────────────────────────────┐
│                Agent Loop (loop.ts)                      │
│  只操作统一的 ChatMessage / ToolCall / ChatChunk 类型    │
│  不知道底层是 OpenAI 还是 Anthropic                       │
└──────────────┬──────────────────┬────────────────────────┘
               │                  │
    ┌──────────▼──────┐  ┌───────▼──────────┐
    │ OpenAI Provider │  │ Anthropic Provider│
    │ tools: [{type:  │  │ tools: [{name,    │
    │  "function",    │  │  description,     │
    │  function:{name,│  │  input_schema}]   │
    │  description,   │  │                   │
    │  parameters}}]  │  │ tool_use block →  │
    │                 │  │ tool_result msg   │
    │ 流式解析:        │  │ 流式解析:          │
    │ delta.tool_calls│  │ content_block_    │
    │ 增量片段         │  │ start/delta       │
    └─────────────────┘  └────────────────────┘
```

**关键代码**（`openai.ts`）：

```typescript
// 工具定义传给 OpenAI 的格式
tools: opts.tools?.map(t => ({
  type: 'function',
  function: { name: t.name, description: t.description, parameters: t.parameters }
}))

// 流式解析 tool_call 增量
if (chunk.toolCallDelta) {
  const slot = (toolBuffers[i] ??= { args: '' });
  if (chunk.toolCallDelta.id) slot.id = chunk.toolCallDelta.id;
  if (chunk.toolCallDelta.name) slot.name = chunk.toolCallDelta.name;
  slot.args += chunk.toolCallDelta.arguments;  // JSON 片段累积
}
// 最终 safeJSONParse 解析完整参数
```

**Anthropic 适配**（`anthropic.ts`）：
- `transformMessages()` 做协议转换：`role: 'tool'` → `role: 'user' + tool_result block`
- 连续 tool 消息合并进同一个 user 消息（Anthropic API 要求）
- 流式解析 Anthropic 特有的 SSE 事件

### 1.2 为什么不用 Prompt 模拟？

| 方案 | 结构化程度 | 可靠性 | 并发支持 | Provider依赖 |
|------|-----------|--------|---------|-------------|
| **原生 FC** | 100%（JSON Schema 校验） | 高（Provider 保证格式） | 原生多 tool_call | 需适配协议 |
| **Prompt 模拟**（如 ReAct prompt） | ~80%（正则/JSON提取） | 低（LLM 可能格式错误） | 需自己拆分 | Provider 无关 |
| **混合模式**（FC + Prompt fallback） | 渐进降级 | 中 | 部分支持 | 灵活 |

**面试要点**：为什么选原生 FC？

1. **可靠性**：Provider 保证 `tool_call` 的 JSON 格式正确，不需要自己解析文本
2. **并发**：OpenAI 原生支持一次返回多个 `tool_call`，Prompt 模拟做不到
3. **Token 效率**：原生 FC 的参数不在 text 中，不与推理文本互相干扰
4. **类型安全**：Zod Schema → JSON Schema → Provider 校验 → Zod safeParse，四层保障

### 1.3 Zod → JSON Schema → FC 的四层类型保障

```
Layer 1: Zod Schema 定义（TypeScript 编译期类型检查）
  ↓ zodToJsonSchema()
Layer 2: JSON Schema（传给 LLM 的工具描述）
  ↓ LLM 返回 tool_call.arguments
Layer 3: safeJSONParse（防 JSON 格式错误）
  ↓ tool.schema.safeParse()
Layer 4: Zod 运行时校验（类型 + 约束 + 默认值）
```

**不足**：
- `zodToJsonSchema()` 是简易实现，不支持 `ZodDiscriminatedUnion` / `ZodRecord` 等高级类型
- 没有 `$ref` 引用压缩，嵌套类型会膨胀 schema token
- 缺少 `examples` 字段，LLM 理解参数语义靠 description

### 1.4 最佳实践与改进

**业界最佳实践**（OpenAI / Anthropic 官方推荐）：

1. **Tool Description 即 Prompt**：description 写清楚"何时用、怎么用、什么不用"
2. **Parameters 加 examples**：JSON Schema 的 `examples` 字段帮助 LLM 理解参数格式
3. **渐进式工具暴露**（Progressive Disclosure）：不是一次把 27 个工具全给 LLM，而是按需注入

**MiniCodeIDE 已做的**：
- ✅ Tool Description 支持运行时占位符替换（`{roles}` → 实际角色列表）
- ✅ `ToolRegistry.filter()` 可按 profile 裁剪工具集
- ❌ 缺少 `examples` 字段
- ❌ 缺少工具使用频率统计来动态排序

**改进建议**：
```typescript
// 1. 在 Tool 定义中加 examples
interface Tool<I, O> {
  // ...
  examples?: Array<{ input: I; description: string }>;
}

// 2. 在 zodToJsonSchema 中注入 examples
if (def.typeName === 'ZodObject') {
  // ...
  if (tool.examples?.length) schema.examples = tool.examples.slice(0, 2);
}

// 3. 动态排序：高频工具放前面（LLM 更倾向选择排在前面的工具）
toLLMSchemas(): ToolSchema[] {
  return this.list()
    .sort((a, b) => (usageStats[b.name] ?? 0) - (usageStats[a.name] ?? 0))
    .map(t => ({ name: t.name, ... }));
}
```

---

## 二、ReAct 推理-行动循环深度解析

### 2.1 现状：隐式 ReAct（通过原生 FC 实现）

MiniCodeIDE 实现的是**隐式 ReAct**——没有显式的 `Thought: / Action: / Observation:` 标签，而是通过原生 Function Calling 的结构化能力隐式实现了 ReAct 的语义：

| ReAct 概念 | MiniCodeIDE 对应 | 实现方式 |
|-----------|-----------------|---------|
| **Thought** | `textBuf`（assistant 消息的纯文本部分） | LLM 自由文本输出 |
| **Action** | `tool_calls`（原生 FC 返回） | 结构化 JSON |
| **Observation** | `role: 'tool'` 消息（工具执行结果） | 回填到 messages |

**终止语义**：`!toolCalls.length → done`。LLM 不再请求工具 = 循环结束 = 任务完成。

### 2.2 对比三种 Agent 模式

| 模式 | 代表 | 思考方式 | 工具调用方式 | 优点 | 缺点 |
|------|------|---------|------------|------|------|
| **ReAct (Prompt)** | LangChain ReAct Agent | `Thought: I need to...` | `Action: tool_name[args]` | Provider无关 | 格式不稳定、无法并发 |
| **ReAct (FC)** | MiniCodeIDE / Claude Code | 自由文本 + FC | 原生 `tool_calls` | 格式可靠、并发支持 | 依赖Provider FC能力 |
| **Plan-and-Execute** | LangGraph Plan-Execute | 先规划再执行 | 分两阶段 | 避免局部最优 | 两阶段延迟 |
| **Reflexion** | Reflexion 论文 | 自我反思+重试 | 任意 | 能自我纠正 | Token消耗大 |
| **LATS** | LATS 论文 | 蒙特卡洛树搜索 | 任意 | 全局最优 | 计算成本极高 |

### 2.3 MiniCodeIDE 的 ReAct 增强

纯 ReAct 容易陷入局部最优（"改了A→报错→改B→报错→改A→..."）。MiniCodeIDE 加了多个增强：

**1. 显式思考工具（`think` tool）**

```typescript
// 27个内置工具之一，parallelSafe=true
{
  name: 'think',
  description: 'Use this tool to think step-by-step before taking action...',
  schema: z.object({ thought: z.string() }),
  execute: async ({ thought }) => `[thinking acknowledged] ${thought}`,
}
```

**设计意图**：给 LLM 一个"_scratchpad_"，让它可以在不触发任何外部操作的情况下整理思路。这在 ReAct 循环中相当于一个不消耗外部资源的"纯思考"步骤。

**2. Completion Audit（完成审计）**

在 `task_flow` prompt 段落中：
> "把'完成'当作未证明的命题，对每条用户需求逐项找权威证据。证据不强→视为未完成，继续干。"

**3. 循环检测 + loop-breaker**

3 连续相同 tool_call 签名 → 注入 `[loop-breaker]` + 要求用 `think` 重新考虑。

**4. 工具错误预算**

同工具连续 3 次失败 → 注入 `[tool-budget]` + 要求停止重试。

### 2.4 ReAct 的关键问题与最佳实践

**问题 1：ReAct 的"行动-观察"步数不可控**

MiniCodeIDE 设了 `maxSteps=25` 硬上限。但最佳实践是：

| 方案 | 实现 | 效果 |
|------|------|------|
| 固定上限 | `maxSteps=25` | 简单粗暴，可能不够或浪费 |
| 自适应上限 | 根据任务复杂度预估 | 需要复杂度评估器 |
| Early Stop | 检测连续 N 步无进展 | 节省 token |
| Plan-then-Act | 先规划步骤数，再执行 | 更可控 |

**建议**：加 Early Stop 检测——如果连续 3 步 `textBuf` 中包含"still failing"/"same error"/"no change"等关键词，主动终止。

**问题 2：ReAct 的局部最优陷阱**

LLM 可能在错误方向上越走越远。最佳实践：

- **Backtracking**：检测到连续失败时，回退到上一个成功状态，换策略
- **Diverse Search**：同一问题尝试 2-3 种不同方案，选最好的
- **Self-Reflection**：每 5 步强制调用 `think` 做一次阶段性总结

---

## 三、上下文检索注入策略：一次性 vs 渐进式

### 3.1 现状：一次性全量注入

`buildMessages()` 的组装流程是**一次性**的：

```
1. hybridRetrieve(userMessage) → 最多6条 autoContext
2. memory.recall(userMessage)  → 最多5条 memory
3. @-mentions 解析             → explicitContext
4. 一次拼接: system + context + history + user
5. 发给 LLM
```

**所有检索结果在 LLM 调用前就已经全部注入到 system 消息中**，不存在"先给一部分，LLM 再请求更多"的渐进式检索。

### 3.2 上下文会不会太大？

**会，但有缓解措施**：

| 缓解机制 | 触发时机 | 效果 |
|---------|---------|------|
| autoContext 截断 | `c.text.slice(0, 2000)` | 每条最多 2000 字符，6条最多 ~12000 字符 ≈ 3000 token |
| memory 截断 | `m.content.slice(0, 500)` | 每条最多 500 字符，5条最多 ~2500 字符 ≈ 600 token |
| @-mention 截断 | `c.content.slice(0, 3000)` | 每条最多 3000 字符 |
| InjectionCache 去重 | 每轮检查 | 不重复注入已知内容 |
| Prompt Cache | Anthropic 端 | system + tools 命中缓存时免 token |

**典型上下文大小分析**：

```
System Prompt:           ~2000 token
Tools Schema (27 tools): ~3000 token
AutoContext (6条):       ~3000 token
Memory (5条):            ~600 token
@-mentions (2条):        ~1500 token
Recent Activity:         ~200 token
压缩后 History:          ~10000 token (25轮对话压缩后)
User Message:            ~200 token
─────────────────────────────────
总计约:                  ~20000 token (Claude 200K窗口的10%)
```

**结论**：当前设计下上下文不会太大，因为各路检索都有硬性上限。但存在两个风险：
1. 用户大量 @-mention 文件时，explicitContext 可能膨胀
2. 长对话中 history 压缩不及时，context 可能超过 50%

### 3.3 对比主流方案

| 方案 | MiniCodeIDE | Cursor | RAG 系统 | MemGPT/Letta |
|------|-------------|--------|---------|-------------|
| 检索时机 | 一次性（LLM调用前） | 一次性 | 一次性 | 渐进式（按需检索） |
| 检索方式 | hybridRetrieve | 代码库索引 | 向量检索 | 三层记忆 + embedding |
| 上下文上限 | 硬截断 | 未知 | Top-K | 核心记忆始终在 |
| LLM 主动检索 | ❌ | ❌ | ❌ | ✅（LLM 可发起 memory.insert/search） |

### 3.4 最佳实践：RAG + Agent 检索

**最先进的方案是让 LLM 自己决定何时检索、检索什么**：

```
方案 A（当前）: 用户输入 → 检索 → 一次性注入 → LLM 处理
方案 B（推荐）: 用户输入 → LLM 判断是否需要检索 →
                → 需要时调 search_tool → 结果注入 → 继续推理
```

方案 B 的优势：
1. **按需检索**：简单问题不浪费检索资源
2. **精准检索**：LLM 可以根据当前推理状态构造更精准的查询
3. **多轮检索**：第一次检索结果不够时可以换关键词再搜
4. **上下文更精简**：只注入真正需要的上下文

**MiniCodeIDE 其实已经有了这个能力**——`semantic_search` / `grep_search` / `find_symbol` 就是让 LLM 主动检索的工具。问题在于 `buildMessages` 还会在 LLM 调用前做一次自动检索注入，造成**双重注入**。

**建议**：
- 简单问题（< 10字）：跳过 autoContext，完全依赖 LLM 主动检索
- 复杂问题（> 50字或含多实体）：保留 autoContext 预注入，作为"种子上下文"
- 检测 autoContext 命中质量：如果 top-1 的相似度 < 0.5，说明检索质量差，不注入

### 3.5 上下文预算分配策略

**当前没有显式的 token 预算分配**。最佳实践是像操作系统管理内存一样管理上下文窗口：

```
Context Window (200K for Claude / 128K for GPT-4o)
├── Fixed Budget (30%)
│   ├── System Prompt: 5% (~10K)
│   └── Tools Schema: 5% (~10K)
├── Dynamic Budget (50%)
│   ├── AutoContext: 0-15% (按检索质量动态分配)
│   ├── Memory: 0-5%
│   ├── History: 30-50% (压缩后)
│   └── User Message: 5-10%
└── Output Budget (20%)
    └── LLM 生成空间: 20% (~40K)
```

**核心原则**：
1. **Output Budget 必须预留**：不要把 context window 塞满，LLM 需要空间生成回答
2. **History 有优先级**：最近的对话比早期对话更重要
3. **检索结果按质量分配**：高相似度结果分配更多 token，低质量结果截断或不注入

---

## 四、幻觉防护与格式约束：如何让 AI 既有用又可靠

### 4.1 现状：五层防线体系

```
Layer 1: System Prompt 约束
  ├─ identity: "你是AI编程助手，不是万能的"
  ├─ tool_discipline: "read_before_write"、"verify_changes"
  ├─ task_flow: Completion Audit（完成审计）
  └─ safety: "不要执行危险命令"

Layer 2: 工具层约束
  ├─ edit_file: fuzzyApply四级匹配 + didYouMean 候选
  ├─ write_file: proposeEdit 审查 + approval
  ├─ run_command: execPolicy 三级判定 + sandbox
  └─ web_fetch: SSRF 防护 + 内网 IP 禁止

Layer 3: 循环/预算防护
  ├─ 循环检测: 3轮相同签名 → [loop-breaker]
  ├─ 工具预算: 同工具3次失败 → [tool-budget]
  └─ maxSteps: 25步硬上限

Layer 4: 自检验证
  ├─ verify_changes: typecheck/test/lint
  ├─ Completion Audit: 逐项验证需求完成
  └─ Hard Compact: 紧急压缩防 overflow

Layer 5: 人工审查
  ├─ Pending Edit: 用户 Accept/Reject
  ├─ Checkpoint: Git-based 回滚
  └─ Approval 弹窗: 危险操作二次确认
```

### 4.2 如何提高上下文回答的准确性？

**核心矛盾**：给 LLM 更多上下文 → 更准确，但上下文太大 → 注意力稀释 → 反而更容易产生幻觉。

**MiniCodeIDE 的策略**：

| 策略 | 实现 | 效果 |
|------|------|------|
| **检索相关性优先** | hybridRetrieve RRF 融合 | 只注入最相关的6条 |
| **InjectionCache 去重** | SHA256 hash 去重 | 避免同一条反复出现干扰注意力 |
| **read_before_write** | Prompt 强制要求 | 先读后写，减少"猜"文件内容 |
| **verify_changes** | 工具层自检 | typecheck/test/lint 验证 |
| **Completion Audit** | Prompt 层自检 | 逐项验证而非笼统宣称完成 |
| **fuzzyApply + didYouMean** | edit_file 四级匹配 | 减少因格式不匹配导致的幻觉编辑 |

### 4.3 如何既防幻觉又满足格式要求？

这是一个两难问题：
- **宽松格式**（纯文本）→ LLM 表达自由，但输出格式不可控
- **严格格式**（JSON Schema / XML 标签）→ 格式可控，但约束 LLM 推理自由度

**MiniCodeIDE 的选择**：

```
工具调用 → 原生 FC（严格格式，Provider 保证）
普通文本 → 自由文本（无格式约束）
编辑操作 → fuzzyApply 容错匹配（格式宽松+校验严格）
```

**最佳实践**：

| 场景 | 格式约束策略 | 理由 |
|------|------------|------|
| 工具参数 | 原生 FC + Zod Schema | 必须结构化 |
| 代码编辑 | oldString/newString 模式 | 精确到行的 diff |
| 解释/回答 | 自由文本 | 不需要格式约束 |
| 任务计划 | update_plan → 结构化 JSON | 需要状态追踪 |
| API 响应 | response_format: json_object | 可选的 JSON 模式 |

**改进建议**：对某些场景使用 **Structured Output**（OpenAI 的 `response_format: { type: "json_schema", json_schema: {...} }`），比 prompt 约束更可靠。

### 4.4 幻觉的三大来源与对策

| 来源 | 本项目的表现 | 对策 |
|------|------------|------|
| **知识性幻觉**（LLM 编造事实） | 凭空生成不存在的 API 或库 | System Prompt 约束 + read_before_write |
| **上下文幻觉**（LLM 曲解上下文） | 错误解读工具返回结果 | verify_changes + Completion Audit |
| **承诺性幻觉**（LLM 声称完成但实际没有） | 说"已修复"但代码没变 | Completion Audit 强制逐项验证 |

**最有效的单一措施**：Completion Audit。它直接对抗最危险的"承诺性幻觉"。

---

## 五、Token 去重与格式规范化：如何避免重复浪费

### 5.1 问题分析

在 Agent ReAct 循环中，同一信息可能被反复发送：

```
Step 1: messages = [system(2K), tools(3K), history(5K), tool_result_A(1K)]
Step 2: messages = [system(2K), tools(3K), history(5K), tool_result_A(1K), tool_result_B(1K)]
                                                                    ↑ 重复发送
Step 3: messages = [system(2K), tools(3K), history(5K), tool_result_A(1K), tool_result_B(1K), tool_result_C(1K)]
                                                                    ↑ 再次重复
```

**每一步都需要把完整的 messages 发给 LLM**（HTTP 请求是无状态的），所以：

| 重复项 | 每轮 token 浪费 | 原因 |
|--------|---------------|------|
| System Prompt | ~2000 token | 每轮全量重发 |
| Tools Schema | ~3000 token | 27 个工具的 JSON Schema 每轮都发 |
| 历史 tool_result | 累积增长 | 只有 soft-compact 才压缩 |
| Memory / AutoContext | ~3600 token | InjectionCache 去重后仍有首次注入成本 |

### 5.2 现有去重机制

| 机制 | 位置 | 效果 |
|------|------|------|
| **InjectionCache** | `injection-cache.ts` | 同 session 不重复注入相同 memory/chunk |
| **Immediate Spill** | `loop.ts` 第369-397行 | tool_result > 4KB 立即落盘 |
| **Soft Compact L3** | `soft-compact.ts` | > 4KB 的 tool_result 落盘，只保留索引行 |
| **Soft Compact L2** | `soft-compact.ts` | 旧 tool_result 压成一行占位 |
| **Prompt Cache** | `anthropic.ts` | Anthropic 端 system + tools 缓存 |
| **LLM Summarize** | `compactor.ts` | 中间段用 LLM 摘要替代原文 |

### 5.3 核心问题：Prompt Cache 的局限

**Anthropic Prompt Cache**（最成熟的方案）：

```
请求1: [system(cache)] + [tools(cache)] + [history_1] + [user]
       → 缓存命中: system + tools = 省 ~5000 token

请求2: [system(cache)] + [tools(cache)] + [history_2] + [user']
       → 如果 system 内容没变 → 命中缓存
       → 如果 system 内容变了（autoContext 更新了）→ 缓存失效！
```

**问题**：`buildMessages()` 把 system prompt + autoContext + memory + systemExtras 全部拼在一个 system 消息里。**任何一部分变化，整个 system 消息的缓存都会失效**。

### 5.4 最佳实践：分离 Stable 和 Dynamic 上下文

**关键洞察**：Prompt Cache 命中的前提是**前缀不变**。把稳定内容和动态内容分开，让稳定部分始终命中缓存。

```
当前设计（1条 system 消息）:
  [system_prompt + autoContext + memory + systemExtras]  ← 任何变化都破坏缓存

优化设计（3条 system 消息）:
  [system_prompt(cache)]           ← 永远不变，100%命中缓存
  [system_rules + permissions(cache)] ← 很少变化，90%命中
  [autoContext + memory + systemExtras]  ← 每轮可能变化，不缓存
```

**Anthropic API 支持多个 system 消息**，每条可以独立打 `cache_control`：

```typescript
// 优化后的 system 消息拆分
const messages = [
  { role: 'system', content: systemBase, cacheHint: 'ephemeral' },  // 稳定
  { role: 'system', content: rulesAndPermissions, cacheHint: 'ephemeral' },  // 半稳定
  // 不打 cacheHint → 动态部分
  { role: 'system', content: dynamicContext },  // autoContext + memory
  ...compactedHistory,
  userMsg,
];
```

**预期效果**：
- system prompt（~2000 token）+ rules（~500 token）= ~2500 token 几乎每轮都命中缓存
- 动态部分（autoContext + memory）~3600 token 不缓存，但只在变化时发送

### 5.5 工具 Schema 去重

27 个工具的 JSON Schema 约 3000 token，每轮全量发送。优化方案：

**方案 1：Progressive Tool Disclosure**（已部分实现）

```typescript
// 只暴露当前模式需要的工具
const CHAT_ONLY_PROFILE = ['read_file', 'list_files', 'grep_search', 'find_symbol', 'search_web'];
// Chat 模式只给 5 个工具 → ~600 token，省 2400 token
```

**方案 2：Tool Schema 压缩**

```typescript
// 当前: 完整 description + parameters
{ name: "read_file", description: "Read a file from the filesystem...", parameters: { type: "object", properties: { path: { type: "string", description: "The file path to read" }, ... }, required: ["path"] } }

// 压缩: 精简 description + 移除冗余 description
{ name: "read_file", description: "Read file content. Use before edit_file.", parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } }
```

**方案 3：工具 Schema 缓存**

利用 Prompt Cache，在 tools 数组末尾打 `cache_control: { type: 'ephemeral' }`（已实现）。

### 5.6 Tool Result 的 Token 去重策略

| 策略 | 当前实现 | 效果 | 改进空间 |
|------|---------|------|---------|
| Immediate Spill | > 4KB 落盘 | 大结果只留索引行 | 可调低阈值到 2KB |
| Micro Compact | 旧结果压成一行 | 最近3条完整 | 可根据 token budget 动态调整保留数量 |
| 跨轮结果缓存 | ❌ | — | 同文件多次读取时共享结果 |
| 差量更新 | ❌ | — | edit 后 read 同文件时只返回 diff |

**改进建议**：增加 **Virtual Read Cache**——当 `edit_file` 后 LLM 又 `read_file` 同一文件时，从 pending edit 的虚拟内容中直接返回，不需要重新读磁盘。而且可以只返回变更的行，而不是整个文件。

---

## 六、异步请求追踪：如何区分"这是谁的请求"

### 6.1 问题本质

在 AI Agent 场景下，异步请求追踪的核心问题有两个：

1. **请求-响应关联**：LLM 返回的 tool_call 结果如何与原始请求对应？
2. **并发会话隔离**：多个用户/多个 session 同时使用时，如何保证不串？

### 6.2 现状实现

**LLM 层面的关联**：原生 Function Calling 自动解决了！

```
1. LLM 返回: tool_calls = [{ id: "call_abc123", name: "read_file", arguments: {path: "foo.ts"} }]
2. 系统执行: read_file("foo.ts") → 返回结果
3. 回填消息: { role: "tool", tool_call_id: "call_abc123", content: "结果..." }
4. LLM 看到结果，通过 tool_call_id 关联
```

**关键**：`tool_call.id` 是 LLM Provider 自动生成的唯一标识，系统在回填时通过 `tool_call_id` 关联。**不需要在请求里加任务 ID 让 LLM 带回来**，这是原生 FC 的内置能力。

**Session 层面的隔离**：

```
Session ID: sess_1717935600_a3f2  ← 前端传递
  ├─ Turn ID: t_1717935600_b7c1  ← 每次用户输入生成
  │   ├─ chatSessionId: sess_1717935600_a3f2  ← InjectionCache 分桶用
  │   ├─ SSE 事件流: { type: 'text', ... }   ← 前端通过 HTTP 连接关联
  │   └─ jsonl 落盘: {"t":"chunk","turnId":"t_...","delta":"..."}
```

**子 Agent 异步追踪**：

```
父 Agent → dispatch_subagent({ task, parentSessionId, parentTurnId })
  ← 立即返回 { runId, childSessionId }
  ← 子 Agent 在独立 session 中运行
  ← 完成后自动注入 [Subagent Completed] 消息到父 session
  ← 父 Agent 下一轮 turn 看到结果
```

### 6.3 三种异步追踪模式对比

| 模式 | 实现方式 | 适用场景 | 优缺点 |
|------|---------|---------|--------|
| **同步等待** | `await tool()` | 简单工具 | 简单，但阻塞 Agent 循环 |
| **Push 通知** | 子 Agent 完成后主动注入消息 | 子 Agent | 非阻塞，但有延迟（下一轮才看到） |
| **Poll 拉取** | `list_background_tasks` + `get_background_result` | 后台任务 | LLM 可控，但浪费步数 |

**MiniCodeIDE 用了 Push + Poll 混合**：
- 子 Agent → Push（`[Subagent Completed]` 自动注入）
- 后台命令 → Poll（`get_background_result` 主动拉取）

### 6.4 为什么不用"在请求里加任务 ID 让 LLM 带回来"？

**这个方案有根本性缺陷**：

1. **LLM 不保证遵从**：你让 LLM 在输出中带上 `task_id: "xxx"`，它可能忘带、带错、格式不对
2. **违反 FC 语义**：原生 FC 的 `tool_call.id` 是 Provider 生成的，不应该被覆盖
3. **增加了 Prompt 负担**：额外的格式要求消耗注意力，可能影响工具选择的准确性
4. **不需要**：Provider 的 `tool_call.id` 已经完美解决了请求-响应关联问题

**正确做法**：**在系统层面做关联，不依赖 LLM**。

```
┌──────────────────────────────────────────────┐
│            系统层面的请求追踪                   │
│                                              │
│  1. Session ID → 隔离不同用户的对话            │
│  2. tool_call.id → Provider 生成，系统关联    │
│  3. SSE 连接 → 前端通过 HTTP 连接接收事件      │
│  4. turnId → jsonl 落盘 + 崩溃恢复            │
│  5. runId → 子 Agent / 后台任务追踪           │
│                                              │
│  LLM 完全不参与 ID 管理！                      │
└──────────────────────────────────────────────┘
```

### 6.5 并发 Session 的隔离

**当前设计**：每个 session 有独立的：
- jsonl 文件（`.minicodeide/sessions/<id>.jsonl`）
- InjectionCache 分桶（`sessionId → LRU Cache`）
- Memory 上下文（`memory.recall()` 按 session 检索）
- SSE 连接（每个 HTTP 请求独立）

**不足**：
- 没有 session 级并发锁：同一 session 的两个请求可能同时修改 messages
- 子 Agent 和父 Agent 共享 workspace：文件系统层面的并发写入没有保护

**改进建议**：

```typescript
// 1. Session 级互斥锁
class SessionLock {
  private locks = new Map<string, Promise<void>>();
  async acquire(sessionId: string): Promise<() => void> {
    while (this.locks.has(sessionId)) await this.locks.get(sessionId);
    let resolve: () => void;
    this.locks.set(sessionId, new Promise(r => resolve = r));
    return () => { this.locks.delete(sessionId); resolve!(); };
  }
}

// 2. Workspace 级文件锁（子 Agent 用 worktree 隔离）
// dispatch_subagent 已支持 worktree 隔离，但需要确保所有写操作都走 worktree
```

### 6.6 与主流方案对比

| 方案 | OpenAI Assistants API | LangGraph | Dify |
|------|----------------------|-----------|------|
| 会话隔离 | Thread ID | Checkpoint | Conversation ID |
| 异步追踪 | Run ID + Poll | Channel + State | 消息队列 |
| 子 Agent | 不支持 | 原生支持 | Workflow DAG |
| 崩溃恢复 | Server-side | Checkpoint 恢复 | 不支持 |

**MiniCodeIDE 的优势**：
- ✅ jsonl append-only 落盘 → 崩溃恢复
- ✅ 子 Agent Push 通知 → 非 Poll 模式
- ✅ turnId 关联 → 精确到步的追踪

**不足**：
- ❌ 没有 Session 级并发锁
- ❌ 子 Agent 结果延迟（下一轮 turn 才看到）
- ❌ 没有 Event Bus（所有事件走 SSE，不支持多消费者）

---

## 七、面试高频考点速查

### Q1: "你们的 Function Calling 是怎么做的？"

**参考回答**：
> 用原生 FC，不是 Prompt 模拟。Zod 定义参数 Schema → zodToJsonSchema 转换 → 传给 Provider 的 tools 参数。LLM 返回的 tool_call.arguments 经过 safeJSONParse + Zod safeParse 双重校验。Provider 适配层归一化了 OpenAI 和 Anthropic 的协议差异——OpenAI 用 `tools[].function`，Anthropic 用 `tools[].input_schema` + `tool_use` content block，Agent Loop 完全无感。

**追问**：为什么不选 Prompt 模拟？
> 三点：一是格式可靠性，Provider 保证 JSON 格式，自己解析文本不稳定；二是并发，OpenAI 原生支持一次返回多个 tool_call，Prompt 模拟做不到；三是 Token 效率，FC 的参数不在 text 里，不干扰推理。

### Q2: "上下文检索是一次性还是渐进式？怎么控制大小？"

**参考回答**：
> 当前是一次性注入——buildMessages 在 LLM 调用前把 autoContext、memory、@-mentions 全部拼到 system 消息里。但有多重控制：autoContext 最多 6 条、每条截 2000 字符；memory 最多 5 条、每条截 500 字符；InjectionCache 跨轮去重。实际上系统已有 `semantic_search`/`grep_search` 工具让 LLM 主动检索，存在"预注入 + LLM 主动检索"的双重机制。更好的做法是根据问题复杂度动态选择：简单问题跳过预注入，复杂问题预注入作种子。

### Q3: "怎么防止幻觉？又要保证格式？"

**参考回答**：
> 五层防线：Prompt 约束 → 工具层校验 → 循环/预算防护 → 自检验证 → 人工审查。最有效的是 Completion Audit——把"完成"当未证明命题，逐项找证据。格式方面，工具调用用原生 FC 保证结构化，编辑用 fuzzyApply 容错匹配，普通文本不约束格式。关键洞察：格式约束和防幻觉不矛盾——对需要结构化的场景用 FC 严格约束，对需要推理自由的场景用自然文本，不要一刀切。

### Q4: "Token 重复浪费怎么处理？"

**参考回答**：
> 两个维度：去重和压缩。去重方面，InjectionCache 防止同一条 memory/chunk 重复注入；Prompt Cache 让 system + tools 在 Anthropic 端命中缓存。压缩方面，四级压缩管线——Soft Compact（L1+L2+L3）每轮跑，Hard Compact 在 overflow 时跑。最大的改进空间在 system 消息拆分：当前把稳定内容和动态内容混在一起，任何变化都破坏 Prompt Cache。应该拆成 [stable system(cache)] + [dynamic context] 两层。

### Q5: "异步请求怎么追踪？多个并发请求怎么区分是谁的？"

**参考回答**：
> 关键认知：**LLM 不需要参与 ID 管理**。原生 Function Calling 自带 tool_call.id，Provider 生成、系统回填，LLM 无感。Session 层面用 Session ID 隔离不同用户，SSE 连接天然关联请求和响应。子 Agent 用 Push 模式——完成后自动注入 [Subagent Completed] 到父 session，不需要 LLM 轮询。后台命令用 Poll 模式——LLM 主动调用 get_background_result。如果试图"在请求里加任务 ID 让 LLM 带回来"，一是 LLM 不保证遵从，二是违反 FC 语义，三是增加 Prompt 负担。正确做法是在系统层面做关联。

---

## 八、总结：现状 vs 最佳实践

| 主题 | 现状 | 最佳实践 | 差距 |
|------|------|---------|------|
| Function Calling | 原生 FC + Zod 四层校验 | ✅ 已达最佳实践 | 缺 examples 字段 |
| ReAct 循环 | 隐式 ReAct + 增强机制 | Plan-and-Execute 更可控 | 缺 Early Stop |
| 上下文检索 | 一次性注入 + 硬上限 | 按需检索 + token 预算 | 缺动态策略 |
| 幻觉防护 | 五层防线 | ✅ 比大多数开源项目好 | Completion Audit 可自动化 |
| 格式约束 | FC 严格 + 文本自由 | Structured Output 可选 | 缺 response_format |
| Token 去重 | InjectionCache + Prompt Cache | 分层缓存 + 差量更新 | system 消息未拆分 |
| 异步追踪 | tool_call.id + Push/Poll | ✅ 方案正确 | 缺 Session 并发锁 |
