
/**
 * Terminal-over-WebSocket：
 *  - 每个 WS 连接 spawn 一个 shell（默认 /bin/zsh，跟系统一致；Windows 下 powershell）
 *  - 没用 node-pty —— 避免原生依赖、跨平台编译麻烦
 *  - 启动时解析 login shell 的完整环境变量（PATH 等），解决 GUI 应用找不到 git/npm/pnpm 的问题
 *  - pipe 模式下 zsh job control（setopt monitor）不可用，通过环境变量禁用 gitstatus 避免报错
 *
 * 协议（前后端各自 JSON.parse + JSON.stringify）：
 *   client → server:
 *     { type: 'input', data: string }   // 用户键入（含换行）
 *     { type: 'resize', cols, rows }    // 暂忽略（无 PTY），保留协议
 *     { type: 'signal', sig: 'SIGINT' } // Ctrl+C
 *   server → client:
 *     { type: 'data', data: string }    // 来自 child stdout/stderr
 *     { type: 'exit', code: number }    // shell 退出
 *
 * 安全：
 *  - cwd 固定在 WORKSPACE
 *  - 不开 shell:true（spawn 本身就是 shell 进程，stdin 才是用户输入）
 *  - 仍能跑任何命令 —— 这是终端的本意，不是 sandbox
 */
import { spawn, execFile, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { WebSocketServer, type WebSocket } from 'ws';
import type { Server } from 'node:http';

/**
 * 解析用户 login shell 的完整环境变量（PATH 等）。
 * ----------------------------------------------------------------
 * macOS / Linux GUI 应用从 Launchpad / Dock 启动时继承的 PATH 极精简
 * （通常只有 /usr/bin:/bin:/usr/sbin:/sbin），导致 git、npm、pnpm 等
 * 工具找不到。VS Code / Cursor 的做法是：启动时用 login shell 跑一次
 * `env`，拿到完整环境后缓存复用。这里用同样的方案。
 *
 * 结果会缓存，整个进程生命周期只解析一次。
 */
let _cachedEnv: Record<string, string> | null = null;

async function resolveShellEnv(): Promise<Record<string, string>> {
  if (_cachedEnv) return _cachedEnv;

  const shell = process.env.SHELL || (process.platform === 'win32' ? 'powershell.exe' : '/bin/sh');

  _cachedEnv = await new Promise<Record<string, string>>((resolve) => {
    // -i = interactive（加载 .zshrc / .bashrc）
    // -l = login（加载 .zprofile / .bash_profile / .profile）
    // env -0 = 以 NUL 字节分隔输出，避免值中含换行导致解析错误
    execFile(shell, ['-ilc', 'env -0'], { timeout: 10_000 }, (err, stdout) => {
      if (err) {
        console.warn('[terminal] failed to resolve shell env:', err.message);
        resolve({});
        return;
      }
      const env: Record<string, string> = {};
      for (const line of stdout.split('\0')) {
        const idx = line.indexOf('=');
        if (idx > 0) env[line.slice(0, idx)] = line.slice(idx + 1);
      }
      resolve(env);
    });
  });

  console.log('[terminal] shell env resolved (PATH entries:',
    (_cachedEnv.PATH || '').split(':').length, ')');
  return _cachedEnv;
}

export interface TerminalBridgeOptions {
  path?: string;
  cwd: string;
  /** 默认 shell；优先用 SHELL env，否则按平台 fallback */
  shell?: string;
}

export function attachTerminalBridge(httpServer: Server, opts: TerminalBridgeOptions) {
  const pathPrefix = opts.path ?? '/terminal';
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    const url = req.url ?? '';
    if (!url.startsWith(pathPrefix)) return;
    wss.handleUpgrade(req, socket as any, head, (ws) => {
      handleConnection(ws, opts);
    });
  });

  console.log(`[terminal] bridge ready on ws://host${pathPrefix}`);
}

function pickShell(override?: string): { cmd: string; args: string[] } {
  if (override) return { cmd: override, args: [] };
  const envShell = process.env.SHELL;
  if (envShell) return { cmd: envShell, args: ['-i'] };
  if (process.platform === 'win32') {
    return { cmd: 'powershell.exe', args: ['-NoLogo'] };
  }
  return { cmd: '/bin/sh', args: ['-i'] };
}

function handleConnection(ws: WebSocket, opts: TerminalBridgeOptions) {
  let child: ChildProcessWithoutNullStreams | null = null;

  // WS 可能在 env 解析完成前就被关闭，标记一下
  let wsClosed = false;
  ws.on('close', () => { wsClosed = true; });

  // 异步解析 shell 环境再 spawn，避免 GUI 启动时 PATH 不完整
  resolveShellEnv().then((resolvedEnv) => {
    // 如果 WS 在 env 解析期间就断了，不要再 spawn
    if (wsClosed) return;

    try {
      const { cmd, args } = pickShell(opts.shell);
      child = spawn(cmd, args, {
        cwd: opts.cwd,
        env: {
          ...process.env,      // 基础环境（保底）
          ...resolvedEnv,      // login shell 解析出的完整 PATH 等
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
          // pipe 模式不支持 job control，禁用 gitstatus 避免 setopt monitor 报错
          GITSTATUS_DISABLE: '1',
          POWERLEVEL9K_DISABLE_GITSTATUS: 'true',
        },
      });
      console.log(`[terminal] spawned ${cmd} (pid=${child.pid}) cwd=${opts.cwd}`);
    } catch (e: any) {
      safeSend(ws, { type: 'data', data: `\r\n[terminal] failed to spawn shell: ${e?.message ?? e}\r\n` });
      ws.close(1011, 'spawn failed');
      return;
    }

    child.on('error', (err) => {
      safeSend(ws, { type: 'data', data: `\r\n[terminal] shell error: ${err.message}\r\n` });
    });

    // ----- WS → child stdin -----
    ws.on('message', (raw) => {
      if (!child) return;
      let msg: any;
      try {
        msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf-8'));
      } catch {
        return;
      }
      switch (msg.type) {
        case 'input': {
          if (child.stdin.writable && typeof msg.data === 'string') {
            try {
              child.stdin.write(msg.data);
            } catch {
              /* */
            }
          }
          break;
        }
        case 'signal': {
          try {
            child.kill(msg.sig === 'SIGTERM' ? 'SIGTERM' : 'SIGINT');
          } catch {
            /* */
          }
          break;
        }
        case 'resize': {
          // 无 PTY，暂不支持 TIOCSWINSZ，前端可自适应 cols/rows
          break;
        }
      }
    });

    // ----- child stdout/stderr → WS -----
    const forward = (data: Buffer) => {
      safeSend(ws, { type: 'data', data: data.toString('utf-8') });
    };
    child.stdout.on('data', forward);
    child.stderr.on('data', forward);

    child.on('exit', (code) => {
      safeSend(ws, { type: 'exit', code: code ?? 0 });
      try {
        ws.close();
      } catch {
        /* */
      }
    });

    ws.on('error', () => {
      try {
        child?.kill();
      } catch {
        /* */
      }
    });

    // 关闭 WS 时杀掉子进程（ws.on('close') 已在上面注册过 wsClosed 标记，
    // 这里追加 kill 逻辑）
    ws.on('close', () => {
      try {
        child?.kill();
      } catch {
        /* */
      }
    });
  });
}

function safeSend(ws: WebSocket, obj: unknown) {
  if (ws.readyState !== ws.OPEN) return;
  try {
    ws.send(JSON.stringify(obj));
  } catch {
    /* */
  }
}