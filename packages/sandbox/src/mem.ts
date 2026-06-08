/**
 * MemSandboxProvider —— 本地零配置实现
 *
 * 特性：
 *  - 每个 sessionId 对应一个 ${rootDir}/sandbox-${sessionId} 目录
 *  - exec 用 Node.js child_process.spawn 在该目录下执行
 *  - list/read/write 都是真实 fs 操作
 *
 * 限制（明确告诉用户）：
 *  - 不安全：跑在 server-cloud 进程同权限下，**只用于本地开发或可信单租户**
 *  - 不要在公网部署 SANDBOX_KIND=mem
 *  - 想给陌生人用 → 切到 E2B
 */
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type {
  SandboxProvider, SandboxHandle, SandboxFile, ExecOpts, ExecResult, ExecStreamChunk,
} from './index.js';

interface MemOpts {
  /** 沙箱根目录，默认 os.tmpdir()/mci-sandboxes */
  rootDir?: string;
}

class MemHandle implements SandboxHandle {
  constructor(public readonly id: string, private root: string) {}

  private resolve(p?: string): string {
    if (!p || p === '/' || p === '') return this.root;
    // 把"/workspace/foo"这种绝对路径映射到沙箱根
    const cleaned = p.replace(/^\/+/, '').replace(/^workspace\/?/, '');
    const full = path.join(this.root, cleaned);
    if (!full.startsWith(this.root)) throw new Error(`path escape: ${p}`);
    return full;
  }

  async list(opts: { path?: string; recursive?: boolean } = {}): Promise<SandboxFile[]> {
    const base = this.resolve(opts.path);
    try { await fs.access(base); } catch { return []; }
    const out: SandboxFile[] = [];
    const walk = async (dir: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.name === 'node_modules' || e.name === '.git' || e.name === '.uploads') continue;
        const full = path.join(dir, e.name);
        const rel = '/' + path.relative(this.root, full);
        const st = await fs.stat(full);
        out.push({ path: rel, size: st.size, isDir: e.isDirectory(), mtime: st.mtimeMs });
        if (opts.recursive && e.isDirectory()) await walk(full);
      }
    };
    await walk(base);
    return out;
  }

  async read(p: string) {
    const full = this.resolve(p);
    const buf = await fs.readFile(full);
    // 试着按 utf-8 读，二进制就 base64
    const isBinary = buf.includes(0);
    return isBinary
      ? { content: buf.toString('base64'), encoding: 'base64' as const }
      : { content: buf.toString('utf-8'), encoding: 'utf-8' as const };
  }

  async write(p: string, content: string, encoding: 'utf-8' | 'base64' = 'utf-8') {
    const full = this.resolve(p);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, Buffer.from(content, encoding));
  }

  async exec(cmd: string, opts: ExecOpts = {}): Promise<ExecResult> {
    let stdout = '';
    let stderr = '';
    let exitCode = 0;
    for await (const c of this.execStream(cmd, opts)) {
      if (c.kind === 'stdout') stdout += c.data ?? '';
      else if (c.kind === 'stderr') stderr += c.data ?? '';
      else if (c.kind === 'exit') exitCode = c.exitCode ?? 0;
    }
    return { exitCode, stdout, stderr };
  }

  execStream(cmd: string, opts: ExecOpts = {}): AsyncIterable<ExecStreamChunk> {
    const cwd = this.resolve(opts.cwd ?? '/workspace');
    const queue: ExecStreamChunk[] = [];
    let resolveWaiter: ((v: void) => void) | null = null;
    const wait = () => new Promise<void>((r) => { resolveWaiter = r; });
    const flush = () => { resolveWaiter?.(); resolveWaiter = null; };

    let done = false;
    const proc = spawn('sh', ['-lc', cmd], {
      cwd,
      env: { ...process.env, ...opts.env },
    });
    proc.stdout.on('data', (b) => { queue.push({ kind: 'stdout', data: b.toString() }); flush(); });
    proc.stderr.on('data', (b) => { queue.push({ kind: 'stderr', data: b.toString() }); flush(); });
    proc.on('close', (code) => {
      queue.push({ kind: 'exit', exitCode: code ?? 0 });
      done = true;
      flush();
    });
    proc.on('error', (e) => {
      queue.push({ kind: 'stderr', data: `spawn error: ${e.message}\n` });
      queue.push({ kind: 'exit', exitCode: 127 });
      done = true;
      flush();
    });
    const onAbort = () => { try { proc.kill('SIGTERM'); } catch { /* */ } };
    opts.signal?.addEventListener('abort', onAbort);
    const timer = setTimeout(() => onAbort(), (opts.timeoutSec ?? 60) * 1000);

    return {
      [Symbol.asyncIterator]() {
        return {
          async next(): Promise<IteratorResult<ExecStreamChunk>> {
            while (queue.length === 0 && !done) await wait();
            if (queue.length === 0 && done) {
              clearTimeout(timer);
              opts.signal?.removeEventListener('abort', onAbort);
              return { value: undefined, done: true };
            }
            return { value: queue.shift()!, done: false };
          },
        };
      },
    };
  }

  async destroy() {
    try {
      await fs.rm(this.root, { recursive: true, force: true });
    } catch { /* ignore */ }
  }
}

export class MemSandboxProvider implements SandboxProvider {
  private handles = new Map<string, MemHandle>();
  private rootBase: string;

  constructor(opts: MemOpts = {}) {
    this.rootBase = opts.rootDir ?? path.join(os.tmpdir(), 'mci-sandboxes');
  }

  async getOrCreate(sessionId: string): Promise<SandboxHandle> {
    const exist = this.handles.get(sessionId);
    if (exist) return exist;
    const dir = path.join(this.rootBase, `sandbox-${sessionId}`);
    await fs.mkdir(path.join(dir, 'workspace'), { recursive: true });
    const h = new MemHandle(sessionId, path.join(dir, 'workspace'));
    this.handles.set(sessionId, h);
    return h;
  }

  async remove(sessionId: string): Promise<void> {
    const h = this.handles.get(sessionId);
    if (h) {
      await h.destroy();
      this.handles.delete(sessionId);
    }
  }
}