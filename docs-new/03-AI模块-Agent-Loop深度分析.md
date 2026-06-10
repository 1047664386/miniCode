# AI 核心模块：Agent Loop 深度分析

> 本文档深入分析 MiniCodeIDE 的 Agent Loop（ReAct 循环）实现，包括设计模式、并发调度、错误恢复、与主流方案的对比，以及改进方向。

---

## 一、ReAct 循环架构

### 1.1 核心设计

`runAgent()` 是一个 **AsyncGenerator**，流式 yield `AgentEvent` 事件。设计为 Generator 而非 Promise 的原因：

1. **流式输出**：LLM 的 text delta 可以实时推送到前端，用户不用等整个 turn 完成
2. **可中断**：调用方可以随时 `break` 退出循环（用户点 Stop、超时、signal abort）
3. **背压控制**：消费方慢时，Generator 自动暂停生产

### 1.2 单次 Turn 执行流程

```
┌─────────────────────────────────────────────────────────┐
│                     runAgent Loop                        │
│                                                         │
│  1. UserPromptSubmit Hook（注入额外context/阻断）        │
│                                                         │
│  2. for step = 0 .. maxSteps (默认25):                  │
│     │                                                   │
│     ├─ Soft Compact (L1+L2+L3) 廉价压缩                │
│     │                                                   │
│     ├─ LLM.chatStream(messages) 流式调用                │
│     │  ├─ 两阶段消费：第一帧探活 + 续流                  │
│     │  ├─ 收集 text delta + tool_call delta             │
│     │  └─ yield AgentEvent(type:'text'/'tool_call')     │
│     │                                                   │
│     ├─ 无tool_call → 触发Stop Hook → done?              │
│     │                                                   │
│     ├─ 循环检测（3轮相同签名 → [loop-breaker]）         │
│     │                                                   │
│     ├─ 并发/串行段分割 + 执行                            │
│     │  ├─ parallelSafe段 → Promise.all 并发              │
│     │  ├─ 非parallelSafe段 → 串行                       │
│     │  └─ PreToolUse Hook → PostToolUse Hook            │
│     │                                                   │
│     ├─ Tool结果回填                                      │
│     │  ├─ 大结果(>4KB) → spill到.minicodeide/spill/     │
│     │  ├─ __image字段 → multimodal content blocks       │
│     │  └─ yield AgentEvent(type:'tool_result')          │
│     │                                                   │
│     └─ 工具错误预算检查（同工具连续3次失败 → [tool-budget]）│
│                                                         │
│  3. 退出原因：completed/max_steps/stream_error/fatal/hook_block│
└─────────────────────────────────────────────────────────┘
```

### 1.3 与主流 Agent 框架对比

| 特性 | MiniCodeIDE | LangChain ReAct | AutoGPT | Claude Code |
|------|-------------|-----------------|---------|-------------|
| 执行模式 | AsyncGenerator | Promise Chain | Event Loop | AsyncGenerator |
| 流式输出 | ✅ 逐token | ❌ 等完成 | ❌ 等完成 | ✅ 逐token |
| 并发工具 | ✅ parallelSafe分段 | ❌ 串行 | ✅ 并发 | ✅ 并发 |
| 循环检测 | ✅ 3轮签名 | ❌ | ❌ | ✅ |
| 错误恢复 | ✅ 4类+自动 | ❌ 手动 | ❌ | ✅ |
| Hook扩展 | ✅ 4事件 | ❌ Callback | ❌ | ✅ |
| 上下文压缩 | ✅ 4级管线 | ❌ | ❌ | ✅ 分层 |
| 大结果处理 | ✅ spill落盘 | ❌ | ❌ | ✅ |

**亮点**：MiniCodeIDE 的 Agent Loop 在"流式 + 并发 + 压缩 + 错误恢复"四个维度都做到了，这在开源项目中很少见。

---

## 二、并发调度详解

### 2.1 并发/串行段分割算法

LLM 一次返回多个 tool_call 时，按 `parallelSafe` 标志切分：

```typescript
// 示例：LLM返回4个tool_call
// [read_file(p1), read_file(p2), write_file(p3), read_file(p4)]
// parallelSafe: [true, true, false, true]

// 分段结果：
// 段1: [read_file(p1), read_file(p2)] → Promise.all 并发
// 段2: [write_file(p3)]               → 串行
// 段3: [read_file(p4)]               → 单独执行
```

**设计原理**：
- 写操作（write_file, edit_file, run_command）标记 `parallelSafe=false`
- 读操作（read_file, grep_search, find_symbol）标记 `parallelSafe=true`
- 段间保持顺序，段内并发，段间串行
- **tool_result 按原始顺序回填**，保证 LLM 看到的顺序与请求一致

### 2.2 并发安全分析

| 场景 | 风险 | 处理方式 |
|------|------|---------|
| 两个 read_file 并发 | 无风险 | Promise.all |
| read_file + write_file 并发 | 可能读到半写状态 | 分段：read先、write后 |
| 两个 write_file 并发 | 后写覆盖 | 分段：串行执行 |
| write_file + run_command 并发 | 命令可能读到半写状态 | 分段：串行执行 |

**不足**：当前只做粗粒度的读/写分离，没有做文件级锁。两个写不同文件的 write_file 理论上可以并发，但当前会被强制串行。

**改进方向**：引入文件级锁表，写不同文件时允许并发。

### 2.3 对比主流方案

- **Cursor**：工具调用全部串行（单 Composer Agent），通过多 Agent 实现并行
- **Claude Code**：类似方案，按工具类型标记 safe/unsafe
- **OpenAI Function Calling**：原生支持 `parallel_tool_calls`，但由模型决定并发
- **LangChain**：不支持并发工具调用

---

## 三、错误恢复系统

### 3.1 错误分类与恢复策略

```typescript
// 错误恢复状态机
RecoveryState {
  maxTokensFails: number;    // max_tokens截断次数
  overflowFails: number;     // context overflow次数
  rateLimitFails: number;    // 429/529次数
  totalRetries: number;      // 总重试次数
}
```

| 错误类型 | 第1次 | 第2次 | 第3次+ | 最大重试 |
|---------|-------|-------|--------|---------|
| `max_tokens` 截断 | 升级 maxTokens 8K→64K | 注入续写提示 | fatal | 3 |
| `prompt_too_long` | reactive hardCompact | fatal | — | 1 |
| 429 rate_limit | 指数退避 1s→2s→4s→8s→16s | 继续退避 | 连续3次529→切fallback | 5 |
| timeout | 同429 | 同429 | fatal | 5 |
| stream_error | 重试 | 重试 | fatal | 3 |
| tool执行错误 | 返回错误给LLM | LLM自行决定 | tool-budget拦截 | — |

### 3.2 Backoff 算法

```typescript
// 指数退避 + Jitter
const baseDelay = Math.min(1000 * 2 ** attempt, 16_000); // 最大16s
const jitter = Math.random() * 500; // 0-500ms随机抖动
await sleep(baseDelay + jitter);
```

**Jitter 的作用**：多用户同时触发限流时，避免所有请求在同一时刻重试（"惊群效应"）。

### 3.3 与主流方案对比

- **LangChain**：只有简单的 retry(max_attempts)，没有分类恢复
- **OpenAI SDK**：内置 exponential backoff，但没有 overflow 恢复
- **Claude Code**：类似方案，但 overflow 直接终止
- **Cursor**：未公开，推测类似

**亮点**：MiniCodeIDE 的错误恢复是"分类处理 + 自动升级 + 智能降级"，比简单的 retry 更鲁棒。

---

## 四、HookBus 生命周期

### 4.1 四个 Hook 点

```
用户输入 ─→ [UserPromptSubmit] ─→ Agent Loop ─→ [PreToolUse] ─→ 工具执行 ─→ [PostToolUse] ─→ 结果回填 ─→ ... ─→ [Stop] ─→ 结束
```

| Hook | 时机 | 能力 | 语义 |
|------|------|------|------|
| `UserPromptSubmit` | 用户输入后、进LLM前 | 注入context / 阻断 | 第一个block=true短路 |
| `PreToolUse` | 工具执行前 | 拦截 / 改写参数 | 第一个block=true短路 |
| `PostToolUse` | 工具执行后 | 副作用（log/checkpoint） | 所有handler都跑，异常swallow |
| `Stop` | loop即将退出时 | 强制续跑 | forceContinue取并集 |

### 4.2 设计模式

这是经典的 **Observer + Interceptor** 模式：

- Observer：PostToolUse / Stop 是观察者，不影响主流程
- Interceptor：PreToolUse / UserPromptSubmit 是拦截器，可以阻断或改写

### 4.3 应用场景

| 场景 | Hook | 实现 |
|------|------|------|
| 敏感命令二次确认 | PreToolUse | run_command时弹出approval弹窗 |
| 自动注入Git diff | UserPromptSubmit | 检测到用户说"commit"时注入git status |
| 工具调用审计日志 | PostToolUse | 记录所有工具调用到审计日志 |
| 强制补全未完成任务 | Stop | 检测plan有未完成项时forceContinue |

---

## 五、Fuzzy Apply 四级匹配

当 LLM 生成的 `edit_file` oldString 与实际文件不完全匹配时，`fuzzyApply` 依次尝试四级匹配策略：

```
Level 1: 精确匹配（oldString === 文件子串）
Level 2: 忽略首尾空白匹配
Level 3: 逐行 trim 后匹配（容许缩进差异）
Level 4: 相似度匹配（findSimilarLines，Levenshtein距离）
```

Level 4 匹配时，如果仍然失败，会返回 `didYouMean` 候选行（最相似的3行），帮助 LLM 自我纠正。

**与主流方案对比**：
- Cursor：类似策略，但更激进（允许整块替换）
- Claude Code：使用 search-replace 块 + APL-style diff
- Aider：使用"search-replace" + `--no-auto-commits` 审查模式

---

## 六、循环检测机制

### 6.1 签名算法

```typescript
// 每轮的工具调用签名
const sig = toolCalls
  .map(tc => `${tc.name}(${Object.keys(tc.arguments).sort().join(',')})`)
  .join('|');
// 例: "read_file(path)|grep_search(pattern,path)"
```

维护 `recentSigs[]`（最近3轮），连续3轮签名相同 → 注入 `[loop-breaker]` system 消息：

```
[loop-breaker] You've made the same tool calls 3 times in a row.
Use the `think` tool to reconsider your approach.
```

### 6.2 工具错误预算

每个工具名维护 `consecutiveFails` 计数，超过3次注入 `[tool-budget]` 提示：

```
[tool-budget] Tool "edit_file" has failed 3 times consecutively.
Stop retrying this tool. Use `think` to reconsider.
```

**亮点**：这是简单但有效的"防护栏"机制，防止 LLM 陷入死循环。很多开源项目都没有这个。

---

## 七、改进方向

### 7.1 Adaptive Max Steps

当前 maxSteps 固定为 25，但简单任务（"解释这个函数"）只需要 1-2 步，复杂任务（"重构整个模块"）可能需要 50+ 步。

**建议**：基于任务复杂度自适应调整 maxSteps，或允许 LLM 通过 `update_plan` 请求更多步数。

### 7.2 工具调用依赖图

当前并发调度只按 parallelSafe 做粗粒度分割。更精细的方案是分析工具调用的数据依赖：

```
read_file(a) → edit_file(a)    # 依赖：edit依赖read的结果
read_file(b) → edit_file(b)    # 依赖：同上
read_file(a) 和 read_file(b)   # 无依赖：可并发
```

**建议**：分析 tool_call 参数中的文件路径，构建依赖图，做更精细的并发调度。

### 7.3 中间结果共享

多个工具调用可能读取同一文件，当前每次都独立读取。

**建议**：在同一段的并发工具调用间共享已读取的文件缓存，减少 I/O。

### 7.4 Agent Loop 可视化

当前 Agent 的执行过程对用户是一个黑盒。

**建议**：增加执行步骤的可视化（每一步的工具调用 + 结果 + 决策理由），类似 Cursor 的 Agent Trace。
