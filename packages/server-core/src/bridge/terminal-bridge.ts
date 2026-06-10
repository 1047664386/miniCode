
/**
 * Terminal-over-WebSocket：
 *  - 每个 WS 连接 spawn 一个 shell（默认 /bin/zsh，跟系统一致；Windows 下 powershell）
 *  - 没用 node-pty —— 避免原生依赖、跨平台编译麻烦
 *  - 退化方案：用 child_process.spawn 通过 PIPE 接 stdin/stdout/stderr
 *    缺点：失去 PTY 行为（无 TIOCSWINSZ、无 isatty、ANSI color 仍可用，但交互式 TUI 体验差）
 *    够用场景：跑 build/test/install 等命令行任务（覆盖 IDE 90% 用途）
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
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { WebSocketServer, type WebSocket } from 'ws';
import type { Server } from 'node:http';

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
  if (envShell) return { cmd: envShell, args: ['-i'] }; // -i 让 zsh/bash 加载交互配置（.zshrc 别名/PATH）
  if (process.platform === 'win32') {
    return { cmd: 'powershell.exe', args: ['-NoLogo'] };
  }
  return { cmd: '/bin/sh', args: ['-i'] };
}

function handleConnection(ws: WebSocket, opts: TerminalBridgeOptions) {
  let child: ChildProcessWithoutNullStreams | null = null;
  try {
    const { cmd, args } = pickShell(opts.shell);
    child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
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
        // 没 PTY，先 noop。前端可以 update displayed cols/rows 即可。
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

  ws.on('close', () => {
    try {
      child?.kill();
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
}

function safeSend(ws: WebSocket, obj: unknown) {
  if (ws.readyState !== ws.OPEN) return;
  try {
    ws.send(JSON.stringify(obj));
  } catch {
    /* */
  }
}