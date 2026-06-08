
/**
 * Permission-aware exec policy —— 把 Permission Profile (sandbox/approval) 和原 exec-policy 融合。
 *
 * 原逻辑：decideCommand(cmd) → auto/ask/deny
 * 新逻辑：permissionAwareDecide(cmd, { sandbox, approval }) → 在原结果基础上按 profile 调整。
 *
 * 融合规则：
 *   sandbox=read_only:
 *     - 原本 auto 的写类命令（git commit, npm install 等）→ deny
 *     - 原本 ask 的写类命令 → deny
 *     - 只保留纯读命令（ls/cat/grep/git-log 等）为 auto
 *
 *   approval=never:
 *     - 原本 ask 的 → deny（因为 "never" = 不弹审批）
 *   approval=unless_trusted:
 *     - 原本 auto 的 → auto；原本 ask 的 → ask（不变）
 *   approval=on_failure:
 *     - 原本 auto 的 → auto；原本 ask 的 → ask（不变）
 *   approval=on_request:
 *     - 原本 auto 的 → auto；原本 ask 的 → ask（不变）
 *   approval=granular:
 *     - 原本 auto 的 → ask（全部都要审批）
 *
 * 注意：deny 永远不变（安全底线不降级）。
 */

import { decideCommand, type ExecPolicyDecision } from './exec-policy.js';
import type { SandboxMode, ApprovalPolicy } from '@mini/core';

/** 写类程序名（read_only 模式下要拦的） */
const WRITE_CLASS_PROGRAMS = new Set([
  // 包管理（会写 node_modules / 全局目录）
  'npm', 'pnpm', 'yarn', 'pip', 'pip3', 'brew', 'apt', 'apt-get',
  // git 写操作（由 exec-policy 的 isGitReadOnly 判断）
  // 这里只标记 git 写类子命令 → 在 isGitWrite 里判断
  // 编译/构建（会写 dist / out 目录）
  'tsc', 'eslint', 'prettier', 'vitest', 'jest', 'mocha',
]);

/** git 只读子命令（read_only 下的放行名单） */
const GIT_READONLY_SUBS = new Set([
  'status', 'diff', 'log', 'show', 'blame', 'branch', 'remote', 'config',
  'rev-parse', 'rev-list', 'ls-files', 'ls-tree', 'describe', 'tag', 'stash',
]);

function isGitWrite(cmd: string): boolean {
  const tokens = cmd.trim().split(/\s+/);
  if (tokens[0] !== 'git') return false;
  const sub = tokens[1];
  if (!sub) return true; // git 单独执行 = 可能写
  return !GIT_READONLY_SUBS.has(sub);
}

function isWriteCommand(cmd: string): boolean {
  // 直接判断写类命令
  const tokens = cmd.trim().split(/\s+/);
  let prog = tokens[0] || '';
  // env VAR=xxx command → 跳过赋值
  while (/^[A-Z_][A-Z0-9_]*=/.test(prog) && tokens.length > 1) {
    tokens.shift();
    prog = tokens[0];
  }
  const slash = prog.lastIndexOf('/');
  if (slash >= 0) prog = prog.slice(slash + 1);

  // git 特殊判断
  if (prog === 'git') return isGitWrite(cmd);

  return WRITE_CLASS_PROGRAMS.has(prog);
}

/**
 * Permission-aware 命令判定。
 * 在原有 decideCommand 基础上叠加 sandbox/approval profile 约束。
 */
export function permissionAwareDecide(
  command: string,
  profile: { sandbox?: SandboxMode; approval?: ApprovalPolicy },
): ExecPolicyDecision {
  const base = decideCommand(command);

  // 1. deny 永远不降级
  if (base.verdict === 'deny') return base;

  // 2. sandbox=read_only → 拦写类命令
  if (profile.sandbox === 'read_only') {
    if (isWriteCommand(command)) {
      return {
        verdict: 'deny',
        reason: `read_only sandbox: write-class command "${command.slice(0, 60)}" denied`,
        matchedRule: 'sandbox-read_only',
      };
    }
    // read_only 下：原本 ask 的也升级为 deny（只允许纯读 auto）
    if (base.verdict === 'ask') {
      return {
        verdict: 'deny',
        reason: `read_only sandbox: non-auto command needs approval, but read_only blocks it: ${base.reason}`,
        matchedRule: 'sandbox-read_only-ask-upgrade',
      };
    }
  }

  // 3. approval=never → ask 升级为 deny（不弹审批，直接拒）
  if (profile.approval === 'never' && base.verdict === 'ask') {
    return {
      verdict: 'deny',
      reason: `approval=never: would-ask command denied without prompting: ${base.reason}`,
      matchedRule: 'approval-never',
    };
  }

  // 4. approval=granular → auto 降级为 ask（全部都要审批）
  if (profile.approval === 'granular' && base.verdict === 'auto') {
    return {
      verdict: 'ask',
      reason: `approval=granular: auto command requires explicit approval: ${base.reason}`,
      matchedRule: 'approval-granular',
    };
  }

  // 5. 其他情况保持原判
  return base;
}