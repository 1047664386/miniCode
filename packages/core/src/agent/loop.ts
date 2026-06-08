/**
 * Agent Loop：核心 ReAct 循环。
 *
 * 一轮 = 一次 LLM 调用 + 多个 tool 执行：
 *  1. 把当前 messages 发给 LLM（带工具 schema），流式拉文本和 tool_call deltas
 *  2. 没有 tool_call → 视为 done，退出
 *  3. 有 tool_call → 切成 [并发段, 串行段, ...] 执行，结果回填到 messages
 *  4. 继续下一轮，直到 done 或 maxSteps
 *
 * 扩展点（不再侵入循环）：
 *  - HookBus：UserPromptSubmit / PreToolUse / PostToolUse / Stop
 *  - RecoveryState：分类错误 → 升级 maxTokens / 续写 / reactive compact / backoff
 *  - softCompact：每轮 LLM 调用前跑 L1+L2+L3 廉价压缩
 */
import type { ChatMessage, LLMProvider, ToolCall } from '../llm/types.js';
import type { ToolRegistry, ToolContext } from './tool-registry.js';
import { isContextOverflow, hardCompact } from '../context/hard-compact.js';
import { compactPipeline } from '../context/soft-compact.js';
import { HookBus } from './hooks.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import {
  classifyError,
  createRecoveryState,
  decideBackoffAction,
  decideOverflowAction,
  decideTruncatedAction,
  type RecoveryState,
} from './error-recovery.js';

export interface AgentEvent {
  type: 'text' | 'tool_call' | 'tool_result' | 'done' | 'error' | 'usage' | 'plan';
  text?: string;
  toolCall?: ToolCall;
  toolResult?: unknown;
  error?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    cachedPromptTokens?: number;
  };
  plan?: import('./tool-registry.js').PlanState;
}

export interface RunAgentOptions {
  llm: LLMProvider;
  registry: ToolRegistry;
  messages: ChatMessage[];   // 已经包含 system + history + user
  toolCtx: ToolContext;
  maxSteps?: number;
  model?: string;
  signal?: AbortSignal;
  /** Hook 总线（可选，不传则等同于无 hook） */
  hooks?: HookBus;
  /** 工作区目录（用于 L3 spillLargeToolResults 落盘） */
  workspace?: string;
  /** 关闭主动 soft compact（调试用） */
  disableSoftCompact?: boolean;
  /** Tool description 运行时占位符替换（如 {roles} → "code-reviewer, test-writer, debugger"） */
  toolDescSubstitutions?: Record<string, string>;
}

/** 单次 Agent 运行：流式 yield 所有事件，并把最终 messages 推到 messages 数组里 */
export async function* runAgent(opts: RunAgentOptions): AsyncGenerator<AgentEvent> {
  const {
    llm,
    registry,
    messages,
    toolCtx,
    maxSteps = 25,
    model,
    signal,
    hooks,
    workspace,
    disableSoftCompact,
    toolDescSubstitutions,
  } = opts;
  const tools = registry.toLLMSchemas(toolDescSubstitutions);

  /** 循环检测 / tool 错误预算 */
  const recentSigs: string[] = [];
  const toolErrorCount: Record<string, number> = {};
  const TOOL_ERROR_BUDGET = 3;

  /** 错误恢复状态 */
  const recovery: RecoveryState = createRecoveryState();

  /** UserPromptSubmit hook：在第一轮 LLM 调用前跑一次 */
  if (hooks) {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUser) {
      const r = await hooks.triggerUserPromptSubmit({
        userText: lastUser.content ?? '',
        messages,
      });
      if (r.block) {
        yield { type: 'error', error: `[hook-block] ${r.blockReason ?? 'blocked'}` };
        yield { type: 'done' };
        return;
      }
      if (r.injectSystem) {
        messages.push({ role: 'system', content: r.injectSystem });
      }
    }
  }

  for (let step = 0; step < maxSteps; step++) {
    // L1+L2+L3 软压缩（每轮跑一次，不调 LLM）
    if (!disableSoftCompact) {
      const before = messages.length;
      const compacted = compactPipeline(messages, { workspace });
      if (compacted !== messages && compacted.length !== before) {
        // 把压缩结果回填回原数组（保持引用）
        messages.splice(0, messages.length, ...compacted);
      } else if (compacted !== messages) {
        // 内容变化但条数不变：替换内容
        messages.splice(0, messages.length, ...compacted);
      }
    }

    let textBuf = '';
    let finishReason: string | undefined;
    const toolBuffers: Record<number, { id?: string; name?: string; args: string }> = {};

    // ----- LLM 流式调用 + 错误恢复 -----
    let stream: AsyncIterable<any> | undefined;
    let llmCallOk = false;
    while (!llmCallOk) {
      try {
        stream = llm.chatStream(messages, { tools, model, signal });
        // 拉第一帧探活，让 catch 能捕获 "立即报错"
        const it = (stream as any)[Symbol.asyncIterator]();
        const first = await it.next();
        stream = (async function* () {
          if (!first.done) yield first.value;
          while (true) {
            const { value, done } = await it.next();
            if (done) return;
            yield value;
          }
        })();
        llmCallOk = true;
      } catch (e) {
        const cls = classifyError(e);
        if (cls === 'prompt_too_long' || isContextOverflow(e)) {
          const action = decideOverflowAction(recovery);
          if (action.kind === 'fatal') {
            yield { type: 'error', error: `[fatal] ${action.reason}` };
            return;
          }
          // reactive compact = hardCompact
          const before = messages.length;
          const compacted = hardCompact(messages, { keepLast: 3 });
          messages.splice(0, messages.length, ...compacted);
          yield {
            type: 'error',
            error: `[reactive-compact] context overflow; collapsed ${before - messages.length} messages and retrying.`,
          };
          continue;
        }
        if (cls === 'rate_limit' || cls === 'overloaded' || cls === 'timeout') {
          const action = decideBackoffAction(recovery, cls);
          if (action.kind === 'fatal') {
            yield { type: 'error', error: `[fatal] ${action.reason}` };
            return;
          }
          if (action.kind === 'backoff') {
            yield {
              type: 'error',
              error: `[backoff] ${cls}; waiting ${action.delayMs}ms (attempt ${action.attempt})${action.switchModel ? ' (switch-model hint)' : ''}`,
            };
            await sleep(action.delayMs, signal);
            continue;
          }
        }
        // 其他错误 → 直接抛
        throw e;
      }
    }

    // ----- 消费流 -----
    try {
      for await (const chunk of stream!) {
        if (chunk.delta) {
          textBuf += chunk.delta;
          yield { type: 'text', text: chunk.delta };
        }
        if (chunk.toolCallDelta) {
          const i = chunk.toolCallDelta.index ?? 0;
          const slot = (toolBuffers[i] ??= { args: '' });
          if (chunk.toolCallDelta.id) slot.id = chunk.toolCallDelta.id;
          if (chunk.toolCallDelta.name) slot.name = chunk.toolCallDelta.name;
          if (typeof (chunk.toolCallDelta as any).arguments === 'string') {
            slot.args += (chunk.toolCallDelta as any).arguments;
          }
        }
        if (chunk.usage) {
          yield { type: 'usage', usage: chunk.usage };
        }
        if (chunk.finishReason) finishReason = chunk.finishReason;
        if (chunk.done || chunk.finishReason) break;
      }
    } catch (e) {
      // 流中途抛错：不重试（用户已看到部分内容），转成 error 事件
      yield { type: 'error', error: `[stream-error] ${(e as any)?.message ?? e}` };
      return;
    }

    const toolCalls: ToolCall[] = Object.values(toolBuffers)
      .filter((b) => b.name)
      .map((b, idx) => ({
        id: b.id ?? `call_${Date.now()}_${idx}`,
        name: b.name!,
        arguments: safeJSONParse(b.args),
      }));

    const assistantMsg: ChatMessage = {
      role: 'assistant',
      content: textBuf,
      ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
    };

    // ----- max_tokens 截断恢复 -----
    if (finishReason === 'length' && !toolCalls.length) {
      const action = decideTruncatedAction(recovery);
      if (action.kind === 'truncated_escalate') {
        // 第一次：不 push 截断的 assistant，重试同一请求（理论上 provider 该层透出 maxTokens 控制）
        yield {
          type: 'error',
          error: `[truncated-escalate] hit max_tokens; retrying with larger budget (${action.nextMaxTokens})`,
        };
        // 注意：当前 LLMChatOptions 没有 maxTokens 字段，先保留 hint 给上层。
        // 如果上层 provider 已硬编码，这一档会无效；但下一档"续写"仍能兜底。
        continue;
      }
      if (action.kind === 'truncated_continue') {
        messages.push(assistantMsg);
        messages.push({ role: 'user', content: action.injectMessage });
        yield { type: 'error', error: '[truncated-continue] resume directly' };
        continue;
      }
      if (action.kind === 'fatal') {
        messages.push(assistantMsg);
        yield { type: 'error', error: `[fatal] ${action.reason}` };
        await maybeStop(hooks, 'error', step, messages);
        yield { type: 'done' };
        return;
      }
    }

    messages.push(assistantMsg);

    if (!toolCalls.length) {
      // ----- Stop hook：可能强制续跑 -----
      if (hooks) {
        const r = await hooks.triggerStop({ reason: 'done', step, messages });
        if (r.forceContinue && r.injectUserMessage) {
          messages.push({ role: 'user', content: r.injectUserMessage });
          continue;
        }
      }
      yield { type: 'done' };
      return;
    }

    // ----- 循环检测 -----
    const sig = toolCalls
      .map((c) => `${c.name}::${stableStringify(c.arguments)}`)
      .sort()
      .join('|');
    recentSigs.push(sig);
    if (recentSigs.length > 3) recentSigs.shift();
    if (
      recentSigs.length === 3 &&
      recentSigs[0] === recentSigs[1] &&
      recentSigs[1] === recentSigs[2]
    ) {
      const brake =
        '[loop-breaker] You have called the same tool(s) with identical arguments for 3 consecutive turns. ' +
        'STOP and use the `think` tool to reconsider strategy.';
      messages.push({ role: 'system', content: brake });
      yield { type: 'error', error: brake };
      recentSigs.length = 0;
    }

    // ----- 切并发/串行段 -----
    // LLM 可能一次返回多个 tool_call，有些可以并发（parallelSafe=true），有些必须串行。
    // 策略：把连续的 parallelSafe calls 合成一段用 Promise.all 并发执行；
    //       非 parallelSafe calls 单独一段串行执行。
    //       段间保持顺序（先并发段 → 串行段 → ...）。
    //
    // 注意：段内的 parallelSafe calls 并发执行后，它们的 tool_result 顺序
    //       仍然是按 tool_calls 数组里的原始顺序回填到 messages，
    //       以保证 Anthropic API 要求的 tool_call_id 顺序一致性。
    const segments: ToolCall[][] = [];
    let buf: ToolCall[] = [];
    for (const call of toolCalls) {
      const t = registry.get(call.name);
      const safe = !!t?.parallelSafe;
      if (safe) {
        buf.push(call);
      } else {
        if (buf.length) segments.push(buf);
        segments.push([call]);
        buf = [];
      }
    }
    if (buf.length) segments.push(buf);

    for (const seg of segments) {
      const settled = await Promise.all(
        seg.map(async (call) => {
          const t0 = Date.now();
          // ----- PreToolUse hook -----
          if (hooks) {
            const r = await hooks.triggerPreToolUse({ call, step });
            if (r.block) {
              const dur = Date.now() - t0;
              await hooks.triggerPostToolUse({
                call,
                ok: false,
                error: r.blockReason ?? 'blocked by hook',
                step,
                durationMs: dur,
              });
              return { call, ok: false, error: r.blockReason ?? 'blocked by hook' } as const;
            }
            if (r.rewriteArguments) call.arguments = r.rewriteArguments;
          }
          try {
            const result = await registry.execute(call.name, call.arguments, toolCtx);
            const dur = Date.now() - t0;
            if (hooks) {
              await hooks.triggerPostToolUse({ call, ok: true, result, step, durationMs: dur });
            }
            return { call, ok: true, result } as const;
          } catch (e: any) {
            const dur = Date.now() - t0;
            const errMsg = e?.message ?? String(e);
            if (hooks) {
              await hooks.triggerPostToolUse({ call, ok: false, error: errMsg, step, durationMs: dur });
            }
            return { call, ok: false, error: errMsg } as const;
          }
        }),
      );

      for (const s of settled) {
        yield { type: 'tool_call', toolCall: s.call };
        if (s.ok) {
          toolErrorCount[s.call.name] = 0;
          // --- Immediate spill: large tool results written to disk before entering messages ---
          let resultContent = typeof s.result === 'string' ? s.result : JSON.stringify(s.result);
          const resultBytes = Buffer.byteLength(resultContent, 'utf8');
          const SPILL_THRESHOLD = 4 * 1024; // 4KB
          if (workspace && resultBytes >= SPILL_THRESHOLD) {
            const spillDir = path.join(workspace, '.minicodeide', 'spill');
            try {
              fs.mkdirSync(spillDir, { recursive: true });
              const hash = crypto.createHash('sha1').update(resultContent).digest('hex').slice(0, 12);
              const spillFile = path.join(spillDir, `${s.call.name}-${hash}.txt`);
              if (!fs.existsSync(spillFile)) fs.writeFileSync(spillFile, resultContent, 'utf8');
              const rel = path.relative(workspace, spillFile).replace(/\\/g, '/');
              const head = resultContent.slice(0, 400).replace(/\s+/g, ' ');
              resultContent =
                `[large tool result spilled to disk: ${rel} (${resultBytes} bytes)]\n` +
                `Preview: ${head}...\n` +
                `If you need the full content, call read_file with path="${rel}".`;
              yield {
                type: 'tool_result',
                toolCall: s.call,
                toolResult: resultContent,
                spilledTo: rel,
              } as any;
            } catch {
              // spill failed → keep full result in messages
              yield { type: 'tool_result', toolCall: s.call, toolResult: s.result };
            }
          } else {
            yield { type: 'tool_result', toolCall: s.call, toolResult: s.result };
          }
          // --- Multimodal image injection ---
          // 当 tool result 包含 __image 字段（来自 read_image / screenshot tool），
          // 在 messages 里用多模态格式替代纯文本（Anthropic content block / OpenAI image_url）
          const imgData = (s.result as any)?.__image;
          if (imgData && imgData.type === 'image') {
            // Anthropic 格式：content 是数组，包含 image block
            // OpenAI 格式：content 是数组，包含 image_url block
            // 两者都兼容 —— 在 tool result 的 content 字段里用 multimodal content blocks
            messages.push({
              role: 'tool',
              tool_call_id: s.call.id,
              name: s.call.name,
              content: resultContent,
              // multimodal 扩展：provider 适配层会读取这个字段
              _multimodal: [
                { type: 'text', text: resultContent },
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: imgData.media_type,
                    data: imgData.data,
                  },
                },
              ],
            } as any);
          } else {
            messages.push({
              role: 'tool',
              tool_call_id: s.call.id,
              name: s.call.name,
              content: resultContent,
            });
          }
        } else {
          toolErrorCount[s.call.name] = (toolErrorCount[s.call.name] ?? 0) + 1;
          yield { type: 'error', error: s.error, toolCall: s.call };
          const cnt = toolErrorCount[s.call.name];
          let extraHint = '';
          if (cnt >= TOOL_ERROR_BUDGET) {
            extraHint =
              `\n\n[tool-budget] \`${s.call.name}\` has failed ${cnt} times in a row in this run; ` +
              'STOP retrying it with the same approach. Either:\n' +
              '  (a) call `think` to analyze why, then try a DIFFERENT tool / different args, OR\n' +
              '  (b) explain the blocker to the user and stop.';
          }
          messages.push({
            role: 'tool',
            tool_call_id: s.call.id,
            name: s.call.name,
            content: `ERROR: ${s.error}${extraHint}`,
          });
        }
      }
    }
  }

  // 达到 maxSteps：触发 Stop hook
  if (hooks) {
    const r = await hooks.triggerStop({ reason: 'max_steps', step: maxSteps, messages });
    if (r.forceContinue && r.injectUserMessage) {
      // 用户显式要继续？这里我们只记一行，避免无限递归。
      yield { type: 'error', error: '[max-steps] reached but Stop hook requested forceContinue (ignored to prevent runaway).' };
    }
  }
  yield { type: 'done' };
}

async function maybeStop(hooks: HookBus | undefined, reason: 'done' | 'max_steps' | 'error', step: number, messages: ChatMessage[]) {
  if (!hooks) return;
  await hooks.triggerStop({ reason, step, messages });
}

function safeJSONParse(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s || '{}');
  } catch {
    return {};
  }
}

/** 稳定 stringify：键按字母排序，确保 {a:1,b:2} 和 {b:2,a:1} 同签名 */
function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  const keys = Object.keys(v as Record<string, unknown>).sort();
  return (
    '{' +
    keys.map((k) => JSON.stringify(k) + ':' + stableStringify((v as any)[k])).join(',') +
    '}'
  );
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('aborted'));
    const t = setTimeout(() => resolve(), ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new Error('aborted'));
    });
  });
}