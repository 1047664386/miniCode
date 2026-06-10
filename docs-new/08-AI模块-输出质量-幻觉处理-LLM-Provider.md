# AI 核心模块：输出质量、幻觉处理与 LLM Provider 深度分析

> 本文档深入分析 MiniCodeIDE 的 AI 输出质量控制、幻觉防护机制、LLM Provider 抽象层和模型路由策略。

---

## 一、AI 输出质量控制体系

### 1.1 多层防线架构

```
┌─────────────────────────────────────────────────────────┐
│              AI 输出质量防线（Defense in Depth）           │
│                                                         │
│  Layer 1: System Prompt 约束                            │
│  ├─ identity: "你是AI编程助手，不是万能的"               │
│  ├─ tool_discipline: "read_before_write"                │
│  ├─ task_flow: Completion Audit（完成审计）              │
│  └─ safety: "不要执行危险命令"                           │
│                                                         │
│  Layer 2: 工具层约束                                     │
│  ├─ edit_file: fuzzyApply四级匹配 + didYouMean          │
│  ├─ write_file: proposeEdit审查 + approval              │
│  ├─ run_command: execPolicy三级判定 + sandbox           │
│  └─ web_fetch: SSRF防护 + 内网IP禁止                    │
│                                                         │
│  Layer 3: 循环/预算防护                                  │
│  ├─ 循环检测: 3轮相同签名 → [loop-breaker]              │
│  ├─ 工具预算: 同工具3次失败 → [tool-budget]             │
│  └─ maxSteps: 25步硬上限                                │
│                                                         │
│  Layer 4: 自检验证                                       │
│  ├─ verify_changes: typecheck/test/lint                 │
│  ├─ Completion Audit: 逐项验证需求完成                   │
│  └─ Hard Compact: 紧急压缩防overflow崩溃                 │
│                                                         │
│  Layer 5: 人工审查                                       │
│  ├─ Pending Edit: 用户Accept/Reject                     │
│  ├─ Checkpoint: Git-based回滚                           │
│  └─ Approval弹窗: 危险操作二次确认                       │
└─────────────────────────────────────────────────────────┘
```

### 1.2 与主流方案对比

| 防线 | MiniCodeIDE | Cursor | Claude Code | ChatGPT Code |
|------|-------------|--------|-------------|-------------|
| Prompt约束 | ✅ 7段式 | ✅ | ✅ | ✅ |
| 工具层约束 | ✅ fuzzy+approval | ✅ | ✅ | ❌ |
| 循环检测 | ✅ 3轮签名 | 未知 | ✅ | ❌ |
| 工具预算 | ✅ 3次失败 | 未知 | ✅ | ❌ |
| 自检验证 | ✅ verify_changes | ✅ | ✅ | ❌ |
| 人工审查 | ✅ Proposed Edit | ✅ | ❌ | ❌ |
| Checkpoint | ✅ Git-based | ✅ | ❌ | ❌ |

**亮点**：5层防线 + 人工审查闭环，在开源项目中属于领先水平。

---

## 二、幻觉处理机制

### 2.1 幻觉的常见类型与对应防护

| 幻觉类型 | 示例 | 防护机制 |
|---------|------|---------|
| 虚构文件路径 | 编辑一个不存在的文件 | read_before_write + fuzzyApply失败 |
| 虚构API | 调用不存在的库方法 | verify_changes (typecheck) |
| 虚构完成 | "我已经修好了"但没改代码 | Completion Audit + verify_changes |
| 虚构上下文 | "你之前说..."但没说过 | Hard Compact标注[HARD-COMPACT] |
| 重复幻觉 | 同样的错误修改反复尝试 | 循环检测 + 工具预算 |

### 2.2 Completion Audit（完成审计）详解

在 System Prompt 的 `task_flow` 段落中：

```
## Completion Audit（完成审计）

在声明"完成"之前，你必须：
1. 把"完成"当作未证明的命题
2. 对每条用户需求逐项找权威证据
3. 证据不强/间接/仅"与完成一致" → 视为未完成
4. 验证范围匹配需求范围（不能用窄检查支持宽声明）

NEVER claim "done" with failing verification.
```

**这是一种 Prompt-level 的幻觉防护**，强迫 LLM 在输出"完成"前做自检。

### 2.3 verify_changes 自检验证闭环

```typescript
// verify_changes 工具
{
  name: 'verify_changes',
  description: 'Verify recent changes by running typecheck/test/lint',
  async execute({ kinds }, ctx) {
    // kinds: ['typecheck', 'test', 'lint', 'exec']
    const results = [];
    for (const kind of kinds) {
      switch (kind) {
        case 'typecheck':
          // 运行 tsc --noEmit
          results.push(await runTypecheck(ctx.cwd));
          break;
        case 'test':
          // 运行 vitest
          results.push(await runTests(ctx.cwd));
          break;
        case 'lint':
          // 运行 eslint
          results.push(await runLint(ctx.cwd));
          break;
      }
    }
    // 最多12条错误，每条<200字符 + 可操作hint
    return { ok: allPassed, results };
  }
}
```

### 2.4 循环检测防幻觉

LLM 陷入幻觉时的典型行为：反复调用同一工具，每次得到错误结果，但不改变策略。

```
轮次1: edit_file(old="foo", new="bar") → 匹配失败
轮次2: edit_file(old="foo", new="bar") → 匹配失败（相同调用）
轮次3: edit_file(old="foo", new="bar") → 匹配失败（相同调用）
       → [loop-breaker] 强制使用think工具重新思考
```

### 2.5 与主流幻觉防护对比

| 方法 | MiniCodeIDE | Self-Refine | RAGAS | FActScore |
|------|-------------|-------------|-------|-----------|
| Prompt约束 | ✅ | ✅ | ❌ | ❌ |
| 工具验证 | ✅ verify_changes | ❌ | ❌ | ❌ |
| 循环检测 | ✅ | ❌ | ❌ | ❌ |
| 自我修正 | ✅ fuzzyApply | ✅ | ❌ | ❌ |
| 人工审查 | ✅ Proposed Edit | ❌ | ❌ | ❌ |
| 事后评估 | ❌ | ❌ | ✅ | ✅ |

**亮点**：MiniCodeIDE 的幻觉防护是"运行时"的（在Agent执行过程中），而不是"事后"的（输出后再评估）。这更实用，因为能在错误发生时就拦截。

**不足**：没有"事后幻觉评估"——即对最终输出做事实一致性检查。

---

## 三、LLM Provider 抽象层

### 3.1 双 Provider 架构

```
                 ┌─ isAnthropicEndpoint()? ─┐
                 │                          │
            Yes  │                          │ No
                 ▼                          ▼
        AnthropicProvider          OpenAICompatProvider
        (原生协议)                 (OpenAI兼容协议)
             │                          │
             ├─ system→顶层字段         ├─ 标准messages数组
             ├─ tool_result合并到user   ├─ function_calling格式
             ├─ cache_control           ├─ json_object mode
             └─ thinking blocks         └─ vision支持推断
```

### 3.2 Anthropic 原生 Provider 关键适配

```typescript
// Anthropic API的特殊之处
class AnthropicProvider {
  chatStream(messages, opts) {
    // 1. system消息提取到顶层
    const system = extractSystemMessages(messages);
    const nonSystem = messages.filter(m => m.role !== 'system');

    // 2. tool消息合并到user角色
    // Anthropic: tool_result 是 user 消息的 content block
    const adapted = mergeToolResultsToUser(nonSystem);

    // 3. Prompt Cache
    // system + tools 数组末尾标记 cache_control: { type: 'ephemeral' }
    if (system) {
      system.blocks.push({ type: 'text', text: system.text, cache_control: { type: 'ephemeral' } });
    }

    // 4. Extended Thinking
    // Claude 3.7+ 支持 thinking content blocks
    // 流式输出中：content_block_start(type='thinking') + content_block_delta(type='thinking_delta')
  }
}
```

### 3.3 OpenAI 兼容 Provider 关键适配

```typescript
class OpenAICompatProvider {
  chatStream(messages, opts) {
    // 兼容: DeepSeek / Moonshot / Ollama / OpenRouter / DashScope

    // 1. 400错误 + 有图片 → 自动剥离图片重试
    // (DashScope只有qwen-vl-*支持image_url)

    // 2. Vision支持自动推断
    const supportsVision = model.includes('vl-') || model.includes('vision');

    // 3. 结构化输出: json_object mode
    if (opts.responseFormat === 'json') {
      body.response_format = { type: 'json_object' };
    }
  }
}
```

### 3.4 两段式超时设计

```typescript
interface LLMChatOptions {
  fetchTimeoutMs?: number;       // Phase 1: 首帧等待（默认5分钟）
  streamIdleTimeoutMs?: number;  // Phase 2: 流中途idle检测（默认2分钟）
}
```

**为什么需要两段式？**
- Phase 1（首帧）：LLM 可能需要长时间思考（尤其大模型），5分钟等待合理
- Phase 2（idle）：流开始后，如果中间停顿超过2分钟，说明连接有问题

### 3.5 结构化输出 (callStructured)

```typescript
async function callStructured<T>(llm, opts): Promise<T> {
  // 1. zod schema → JSON Schema + prompt hint
  const jsonSchema = zodToJsonSchema(opts.schema);
  const hint = `Respond with JSON matching this schema:\n${JSON.stringify(jsonSchema)}`;

  // 2. Anthropic → prompt-only模式; OpenAI → json_object mode
  const provider = opts.provider ?? 'openai';
  const responseFormat = provider === 'anthropic' ? undefined : 'json';

  // 3. 解析失败 → 把错误塞回messages让LLM修，最多重试N次
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const text = await callLLM(llm, [...messages, { role: 'user', content: hint }]);
    try {
      const parsed = extractJSON(text); // 兼容 ```json fence / 裸JSON / 前置散文中的JSON
      return opts.schema.parse(parsed);
    } catch (e) {
      // 塞回错误让LLM修正
      messages.push({ role: 'assistant', content: text });
      messages.push({ role: 'user', content: `JSON parse error: ${e.message}. Fix it.` });
    }
  }
}

// JSON提取的三种模式
function extractJSON(text: string) {
  // 1. ```json ... ``` 代码块
  const fenced = text.match(/```json\s*([\s\S]*?)```/);
  if (fenced) return JSON.parse(fenced[1]);

  // 2. 裸JSON（{...} 或 [...]）
  const bare = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (bare) return JSON.parse(bare[0]);

  // 3. 前置散文中的JSON
  // "Here's the result: {..." → 提取{...}
  const withProse = text.match(/\{[\s\S]*\}/);
  if (withProse) return JSON.parse(withProse[0]);
}
```

---

## 四、LLMRouter 多 Provider 路由

### 4.1 路由策略

```
LLMRouter
  profiles: [primary, fallback1, fallback2, ...]

调用流程:
1. 尝试 primary profile
2. 429/529/timeout → 指数退避 + 切到下一个 fallback
3. 同profile内多apiKey轮换（429时自动切key冷却）
4. 已开始流式输出后不再重试（保持一致性）
```

### 4.2 API Key 轮换

```typescript
// 多API Key轮换策略
class KeyPool {
  private keys: { key: string; coolUntil: number }[];

  next(): string {
    const now = Date.now();
    // 找一个没冷却的key
    const available = this.keys.filter(k => k.coolUntil <= now);
    if (available.length > 0) return available[0].key;

    // 全部冷却 → 等最短的
    const earliest = this.keys.reduce((a, b) => a.coolUntil < b.coolUntil ? a : b);
    return earliest.key; // 会触发429，但别无选择
  }

  coolDown(key: string, durationMs: number) {
    const entry = this.keys.find(k => k.key === key);
    if (entry) entry.coolUntil = Date.now() + durationMs;
  }
}
```

### 4.3 与主流路由方案对比

| 维度 | MiniCodeIDE | LiteLLM | OpenRouter | Portkey |
|------|-------------|---------|------------|---------|
| 多Provider | ✅ | ✅ | ✅ | ✅ |
| Fallback | ✅ 自动 | ✅ 自动 | ✅ | ✅ |
| Key轮换 | ✅ 冷却池 | ✅ | ✅ | ✅ |
| 负载均衡 | ❌ | ✅ | ✅ | ✅ |
| 健康检查 | ❌ | ✅ | ✅ | ✅ |
| 计费 | ❌ | ✅ | ✅ | ✅ |
| Circuit Breaker | ❌ | ✅ | ❌ | ✅ |

**不足**：
1. 没有健康检查和Circuit Breaker
2. 没有负载均衡（只做fallback，不做round-robin）
3. 没有计费统计
4. 没有延迟监控

---

## 五、模型领域涉及

### 5.1 模型选型策略

| 用途 | 推荐模型 | 原因 |
|------|---------|------|
| 主对话（Chat） | Claude 3.5 Sonnet / GPT-4o | 推理强、代码好 |
| 快速补全（Complete） | GPT-4o-mini / Haiku | 低延迟、低成本 |
| 结构化输出 | GPT-4o (json_object) | 原生JSON mode |
| Embedding | text-embedding-3-small | 性价比高 |
| 摘要压缩 | Haiku / GPT-4o-mini | 成本低 |

### 5.2 模型能力适配

```typescript
// 不同模型有不同的能力边界
const MODEL_CAPABILITIES = {
  'claude-3.5-sonnet': {
    thinking: true,        // Extended Thinking
    cacheControl: true,    // Prompt Cache
    parallelToolCalls: true,
    maxTokens: 8192,
    contextWindow: 200000,
  },
  'gpt-4o': {
    thinking: false,
    cacheControl: false,
    parallelToolCalls: true,
    jsonMode: true,
    maxTokens: 16384,
    contextWindow: 128000,
  },
  'deepseek-coder': {
    thinking: false,
    cacheControl: false,
    parallelToolCalls: false,
    maxTokens: 4096,
    contextWindow: 64000,
  },
};
```

### 5.3 模型切换对Agent行为的影响

| 模型变化 | Agent行为变化 | 处理策略 |
|---------|-------------|---------|
| 上下文窗口变小 | 需要更频繁压缩 | 触发阈值随模型调整 |
| 不支持工具调用 | Agent无法工作 | 降级为纯对话模式 |
| maxTokens变小 | 输出更短 | 自动调小每个工具的输出限制 |
| 不支持并行工具 | 串行执行 | 不影响正确性，只影响速度 |

---

## 六、改进方向

### 6.1 幻觉评估指标

增加事后幻觉评估：
- **事实一致性**：LLM声称的代码变更是否真实执行了
- **引用准确性**：LLM提到的文件/函数是否存在
- **逻辑一致性**：前后推理是否自洽

### 6.2 LLM Router 增强

1. **Circuit Breaker**：连续5次失败 → 熔断30s → 半开探活
2. **TTFB监控**：首token延迟持续>10s → 降级到更快的fallback
3. **成本追踪**：按模型统计input/output/cache token

### 6.3 流式中间件

```typescript
interface StreamMiddleware {
  // 每个text delta经过这里
  onTextDelta(delta: string): string | null; // null=过滤
  // 每个tool_call经过这里
  onToolCall(call: ToolCall): ToolCall | null; // null=拦截
  // 流结束
  onDone(reason: string): void;
}
```

应用场景：
- 敏感信息脱敏（API Key、密码等）
- 流式幻觉检测（检测到不一致时标记）
- 流式格式化（自动补全代码块）
