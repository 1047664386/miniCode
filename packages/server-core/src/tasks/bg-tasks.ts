
/**
 * Background Task Manager —— 借鉴自 docs/learn-claude-code/s13_background_tasks。
 *
 * 用途：让 `run_command` 等慢工具可选地丢到后台执行，立即返回 bg_id；
 * Agent 继续干别的，后台完成后通过 SSE 推 bg_complete 事件，
 * 下一轮主动调用 list_background_tasks / get_background_result 拉结果。
 *
 * 设计要点：
 *   - 每个任务一个 child process，daemon 风格（不阻塞 server 退出）
 *   - 状态机：running → completed / failed / cancelled
 *   - 结果留存到磁盘（.minicodeide/bg-tasks/<id>.json），跨重启可查（轻量）
 *   - 注入主 Agent 的方式：每轮 LLM 调用前看是否有 just-completed 任务，把通知合成 user message
 */
import { spawn, type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { EventEmitter } from 'node:events';

export type BgStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export interface BgTask {
  id: string;
  command: string;
  cwd: string;
  status: BgStatus;
  startedAt: number;
  finishedAt?: number;
  exitCode?: number | null;
  /** stdout 累计（最多保留 maxBufferBytes） */
  stdout: string;
  stderr: string;
  /** 上层是否已读取并通知模型；通知后此 flag 置为 true */
  notified: boolean;
}

export interface BgManagerOptions {
  workspace: string;
  maxConcurrent?: number;
  maxBufferBytes?: number;
}

export class BackgroundTaskManager extends EventEmitter {
  private tasks = new Map<string, BgTask>();
  private procs = new Map<string, ChildProcess>();
  private cacheDir: string;
  private counter = 0;
  private maxConcurrent: number;
  private maxBuffer: number;

  constructor(opts: BgManagerOptions) {
    super();
    this.cacheDir = path.join(opts.workspace, '.minicodeide', 'bg-tasks');
    this.maxConcurrent = opts.maxConcurrent ?? 5;
    this.maxBuffer = opts.maxBufferBytes ?? 256 * 1024;
    try {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    } catch {
      /* ignore */
    }
  }

  list(): BgTask[] {
    return [...this.tasks.values()].sort((a, b) => b.startedAt - a.startedAt);
  }

  get(id: string): BgTask | undefined {
    return this.tasks.get(id);
  }

  /** 启动一个后台命令；立即返回 task 元数据 */
  start(command: string, cwd: string): BgTask {
    const running = [...this.tasks.values()].filter((t) => t.status === 'running').length;
    if (running >= this.maxConcurrent) {
      throw new Error(
        `Too many concurrent background tasks (${running}/${this.maxConcurrent}). ` +
          'Wait for some to finish or call cancel_background.',
      );
    }
    this.counter++;
    const id = `bg_${Date.now().toString(36)}_${this.counter}`;
    const task: BgTask = {
      id,
      command,
      cwd,
      status: 'running',
      startedAt: Date.now(),
      stdout: '',
      stderr: '',
      notified: false,
    };
    this.tasks.set(id, task);

    // 实际 spawn
    const proc = spawn('sh', ['-c', command], { cwd, detached: false });
    this.procs.set(id, proc);

    proc.stdout?.on('data', (chunk: Buffer) => {
      task.stdout = appendCapped(task.stdout, chunk.toString('utf8'), this.maxBuffer);
    });
    proc.stderr?.on('data', (chunk: Buffer) => {
      task.stderr = appendCapped(task.stderr, chunk.toString('utf8'), this.maxBuffer);
    });
    proc.on('error', (err) => {
      task.status = 'failed';
      task.finishedAt = Date.now();
      task.stderr = appendCapped(task.stderr, `\n[spawn-error] ${err.message}`, this.maxBuffer);
      this.persist(task);
      this.emit('task_complete', task);
    });
    proc.on('exit', (code, signal) => {
      task.exitCode = code;
      task.finishedAt = Date.now();
      if (task.status === 'cancelled') {
        // already cancelled, keep status
      } else if (signal) {
        task.status = 'failed';
        task.stderr = appendCapped(task.stderr, `\n[exit-signal] ${signal}`, this.maxBuffer);
      } else {
        task.status = code === 0 ? 'completed' : 'failed';
      }
      this.persist(task);
      this.procs.delete(id);
      this.emit('task_complete', task);
    });

    this.persist(task);
    return task;
  }

  /** 取消一个运行中的后台任务 */
  cancel(id: string): boolean {
    const task = this.tasks.get(id);
    if (!task || task.status !== 'running') return false;
    const proc = this.procs.get(id);
    if (proc) {
      task.status = 'cancelled';
      try {
        proc.kill('SIGTERM');
        // 兜底：3s 没退就 SIGKILL
        setTimeout(() => {
          try {
            proc.kill('SIGKILL');
          } catch {
            /* ignore */
          }
        }, 3000).unref?.();
      } catch {
        /* ignore */
      }
    }
    return true;
  }

  /** 取出所有 just-finished 且未通知过的任务（用于主 loop 注入） */
  drainPendingNotifications(): BgTask[] {
    const out: BgTask[] = [];
    for (const t of this.tasks.values()) {
      if (t.status !== 'running' && !t.notified) {
        t.notified = true;
        out.push(t);
      }
    }
    return out;
  }

  private persist(task: BgTask) {
    try {
      fs.writeFileSync(
        path.join(this.cacheDir, `${task.id}.json`),
        JSON.stringify(task, null, 2),
        'utf8',
      );
    } catch {
      /* ignore */
    }
  }
}

function appendCapped(prev: string, add: string, cap: number): string {
  const next = prev + add;
  if (next.length <= cap) return next;
  return '[...truncated...]' + next.slice(next.length - cap + 20);
}