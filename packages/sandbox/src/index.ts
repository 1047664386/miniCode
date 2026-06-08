/**
 * @mini/sandbox — 云沙箱抽象层（M3 路线 D）
 *
 * 为什么要有这个抽象：
 *  - 前端 UI（agents-window）只认 /api/agents/{files,file,exec,...}
 *  - 后端可以用三种实现：
 *      1) Mem  —— 进程内 Map + Node.js child_process（开发本地零配置，0 费用，但不安全）
 *      2) E2B  —— Hosted SaaS，sub-second 启动，$100 一次性 credit（生产推荐）
 *      3) E2B Self-Hosted —— 你买台支持 KVM 的物理机自己跑 e2b orchestrator（规模化）
 *  - 切换：env SANDBOX_KIND=mem | e2b
 *
 * 协议要点：
 *  - 一个 sandbox 跟一个 sessionId 挂钩（多人聊天 → 多个 sandbox）
 *  - sandbox 是惰性创建的：第一次 listFiles/exec 时才 lazy spawn
 *  - 闲置自动回收（mem 立即；e2b 默认 5 分钟 idle timeout）
 */

export interface SandboxFile {
  path: string;       // 沙箱内绝对路径，例: "/workspace/src/index.ts"
  size: number;
  isDir: boolean;
  mtime?: number;
}

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface ExecStreamChunk {
  /** 'stdout' | 'stderr' | 'exit' */
  kind: 'stdout' | 'stderr' | 'exit';
  data?: string;
  exitCode?: number;
}

export interface ExecOpts {
  /** 工作目录（沙箱内），默认 "/workspace" */
  cwd?: string;
  /** 环境变量补丁 */
  env?: Record<string, string>;
  /** 允许中断 */
  signal?: AbortSignal;
  /** 超时（秒），默认 60 */
  timeoutSec?: number;
}

/**
 * 一个 Sandbox 实例的生命周期接口。
 * - 真实实现可以是远程 E2B sandbox / 本地 child_process；
 * - 调用方不感知差异。
 */
export interface SandboxHandle {
  readonly id: string;
  /** 列目录（递归 false → 仅一级，递归 true → 全部，注意大仓慎用） */
  list(opts?: { path?: string; recursive?: boolean }): Promise<SandboxFile[]>;
  read(path: string): Promise<{ content: string; encoding: 'utf-8' | 'base64' }>;
  write(path: string, content: string, encoding?: 'utf-8' | 'base64'): Promise<void>;
  /** 一次性执行，返回最终结果 */
  exec(cmd: string, opts?: ExecOpts): Promise<ExecResult>;
  /** 流式执行，逐 chunk yield */
  execStream(cmd: string, opts?: ExecOpts): AsyncIterable<ExecStreamChunk>;
  /** 显式关闭沙箱（释放资源/CPU 计费停止） */
  destroy(): Promise<void>;
}

export interface SandboxProvider {
  /** 获取（或惰性创建）某 sessionId 对应的沙箱实例 */
  getOrCreate(sessionId: string): Promise<SandboxHandle>;
  /** 删除某沙箱（删 session 时调用） */
  remove(sessionId: string): Promise<void>;
}

export { MemSandboxProvider } from './mem.js';
// E2B provider 留作未来开关
// export { E2BSandboxProvider } from './e2b.js';

import { MemSandboxProvider } from './mem.js';

/**
 * 单例工厂：根据 SANDBOX_KIND 环境变量返回对应 Provider。
 * server-cloud 启动时调一次即可。
 */
export function createSandboxProvider(): SandboxProvider {
  const kind = (process.env.SANDBOX_KIND ?? 'mem').toLowerCase();
  switch (kind) {
    case 'mem':
      return new MemSandboxProvider({
        rootDir: process.env.SANDBOX_MEM_ROOT, // 不传则用 os.tmpdir()
      });
    case 'e2b':
      throw new Error('e2b provider not yet wired (set SANDBOX_KIND=mem for now)');
    default:
      throw new Error(`Unknown SANDBOX_KIND=${kind}`);
  }
}