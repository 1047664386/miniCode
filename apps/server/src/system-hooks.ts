
/**
 * 系统级 Hook 注册：把项目内置的"非循环本职"逻辑都挂到 HookBus 上。
 *
 * 当前接入：
 *   - PostToolUse  → 监控指标（tool 调用次数 / 平均耗时 / 错误率），便于观测
 *   - PostToolUse  → write_file / edit_file 后自动触发 checkpoint snapshot 标记
 *   - PreToolUse   → run_command 前 exec-policy 已在 builtin tool 内做了，这里不重复
 *
 * 用户级 hook（扫 .minicodeide/hooks/*.ts）—— 留作后续扩展（保持 stub）。
 */
import { HookBus } from '@mini/core';
import type { CheckpointStore } from './checkpoint.js';
import { logger } from './middleware.js';

export interface ToolMetric {
  count: number;
  errors: number;
  totalMs: number;
  lastErrorAt?: number;
  lastErrorMsg?: string;
}

export class HookMetrics {
  private metrics = new Map<string, ToolMetric>();

  record(toolName: string, ok: boolean, durationMs: number, errorMsg?: string) {
    const m = this.metrics.get(toolName) ?? { count: 0, errors: 0, totalMs: 0 };
    m.count++;
    m.totalMs += durationMs;
    if (!ok) {
      m.errors++;
      m.lastErrorAt = Date.now();
      m.lastErrorMsg = errorMsg?.slice(0, 200);
    }
    this.metrics.set(toolName, m);
  }

  snapshot(): Record<string, ToolMetric & { avgMs: number; errorRate: number }> {
    const out: Record<string, ToolMetric & { avgMs: number; errorRate: number }> = {};
    for (const [k, v] of this.metrics) {
      out[k] = {
        ...v,
        avgMs: v.count ? Math.round(v.totalMs / v.count) : 0,
        errorRate: v.count ? +(v.errors / v.count).toFixed(3) : 0,
      };
    }
    return out;
  }

  reset() {
    this.metrics.clear();
  }
}

export interface SystemHooksDeps {
  checkpoints?: CheckpointStore;
  /** 是否打开 verbose tool log（默认 true）*/
  logTools?: boolean;
}

export function createSystemHookBus(deps: SystemHooksDeps = {}): {
  bus: HookBus;
  metrics: HookMetrics;
} {
  const bus = new HookBus();
  const metrics = new HookMetrics();
  const logTools = deps.logTools !== false;

  // 1. 全局指标埋点
  bus.on('PostToolUse', 'system:metrics', (p) => {
    metrics.record(p.call.name, p.ok, p.durationMs, p.error);
    if (logTools) {
      const tag = p.ok ? 'ok' : 'err';
      logger.info(`[tool] ${p.call.name} ${tag} ${p.durationMs}ms`);
    }
  });

  // 2. 写类工具完成后，记录到 checkpoint（非阻塞）
  if (deps.checkpoints) {
    bus.on('PostToolUse', 'system:auto-checkpoint-mark', (p) => {
      if (!p.ok) return;
      if (p.call.name === 'write_file' || p.call.name === 'edit_file') {
        const target = (p.call.arguments as any)?.path;
        if (target) {
          // 仅记日志，真正的 snapshot 在 acceptEdit / approve 阶段已做
          logger.info(`[hook] post-write ${target} (tool=${p.call.name})`);
        }
      }
    });
  }

  // 3. UserPromptSubmit：示例 — 检测危险关键词时给 LLM 注入提醒
  bus.on('UserPromptSubmit', 'system:safety-hint', (p) => {
    const t = (p.userText ?? '').toLowerCase();
    if (/\brm\s+-rf\s+\//.test(t) || /\bsudo\b/.test(t)) {
      return {
        injectSystem:
          '[safety-hint] User mentioned a destructive shell command. ' +
          'Never run it via run_command without explicit user approval, ' +
          'and prefer dry-run or git-based alternatives.',
      };
    }
  });

  return { bus, metrics };
}