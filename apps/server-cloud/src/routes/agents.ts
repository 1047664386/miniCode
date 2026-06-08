
/**
 * /api/agents/* —— 云沙箱真实路由（M3 路线 D）
 *
 * 协议与桌面 server 保持一致：
 *   GET  /api/agents/files?ws=...                    列文件树
 *   GET  /api/agents/file?ws=...&path=...            读单文件
 *   PUT  /api/agents/file                            写单文件 { ws, path, content, encoding? }
 *   POST /api/agents/exec                            执行命令（一次性返回）{ ws, cmd, cwd?, timeoutSec? }
 *   POST /api/agents/exec/stream                     执行命令（SSE 流）
 *   GET  /api/agents/git/branch?ws=...               git 分支
 *   POST /api/agents/git/clone                       { ws, repo, branch? }
 *   POST /api/agents/sandbox/init                    显式启动沙箱
 *   DELETE /api/agents/sandbox                       销毁
 *
 * "ws" 实际作用：让前端复用桌面接口，但云端 ws 字符串 = sessionId
 * （前端会从 useAgentsStore 拿到 workspaceRoot 当作 ws 传过来，
 *  云端把 ws 映射成"用 ws 字段当 sandboxKey"的策略；M3 我们简化成
 *  「忽略 ws，直接用 sessionId 作为沙箱 key」，所以前端可以传任意 ws 字符串）。
 */
import type { FastifyPluginAsync } from 'fastify';
import type { SandboxProvider } from '@mini/sandbox';
import JSZip from 'jszip';

interface Deps {
  sandbox: SandboxProvider;
}

/**
 * 云端策略：sandboxKey = req.userId（一个用户一个沙箱，与会话无关）
 * —— 这样切换会话不会丢失工作目录，与桌面 IDE 体感一致。
 * 后续可改成 sessionId 维度。
 */
function sandboxKey(req: any) {
  return `u_${req.userId}`;
}

export function makeAgentsRoutes({ sandbox }: Deps): FastifyPluginAsync {
  return async (app) => {
    // ---- 文件树（与桌面 /api/agents/files 协议一致：直接返回 array） ----
    // 桌面端按 path 参数浏览单层目录；云端忠实复刻
    app.get('/files', async (req) => {
      const q = req.query as any;
      const sb = await sandbox.getOrCreate(sandboxKey(req));
      const requestedPath = q.path ?? '/';
      const files = await sb.list({ path: requestedPath, recursive: false });
      // 转成桌面格式：[{ name, path, isDir }]
      const arr = files.map((f) => {
        const segments = f.path.replace(/^\//, '').split('/');
        return {
          name: segments[segments.length - 1] ?? f.path,
          path: f.path.replace(/^\//, ''), // 相对沙箱根
          isDir: f.isDir,
        };
      });
      arr.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
      return arr;
    });

    // ---- 读单文件（与桌面协议对齐） ----
    app.get('/file', async (req, reply) => {
      const q = req.query as any;
      if (!q.path) return reply.code(400).send({ error: 'path required' });
      const sb = await sandbox.getOrCreate(sandboxKey(req));
      try {
        const r = await sb.read(q.path);
        return { path: q.path, content: r.content, size: r.content.length, encoding: r.encoding };
      } catch (e: any) {
        return reply.code(404).send({ error: 'not_found', message: e?.message });
      }
    });

    // ---- 写单文件 ----
    app.put('/file', async (req, reply) => {
      const body = (req.body ?? {}) as any;
      if (!body.path) return reply.code(400).send({ error: 'path required' });
      const sb = await sandbox.getOrCreate(sandboxKey(req));
      await sb.write(body.path, String(body.content ?? ''), body.encoding ?? 'utf-8');
      return { ok: true };
    });

    // ---- 批量上传（用户从浏览器选本地文件夹时用） ----
    // body: { files: [{ path, content, encoding? }] }
    app.post('/upload', async (req, reply) => {
      const body = (req.body ?? {}) as any;
      const files = Array.isArray(body.files) ? body.files : [];
      if (!files.length) return reply.code(400).send({ error: 'files[] required' });
      const sb = await sandbox.getOrCreate(sandboxKey(req));
      let written = 0;
      let skipped = 0;
      for (const f of files) {
        if (!f?.path) { skipped++; continue; }
        try {
          await sb.write(String(f.path), String(f.content ?? ''), f.encoding ?? 'utf-8');
          written++;
        } catch {
          skipped++;
        }
      }
      return { ok: true, written, skipped };
    });

    // ---- exec (one-shot) ----
    app.post('/exec', async (req, reply) => {
      const body = (req.body ?? {}) as any;
      if (!body.cmd) return reply.code(400).send({ error: 'cmd required' });
      const sb = await sandbox.getOrCreate(sandboxKey(req));
      const r = await sb.exec(body.cmd, {
        cwd: body.cwd, timeoutSec: body.timeoutSec ?? 60,
      });
      return r;
    });

    // ---- exec (SSE stream) ----
    app.post('/exec/stream', async (req, reply) => {
      const body = (req.body ?? {}) as any;
      if (!body.cmd) return reply.code(400).send({ error: 'cmd required' });
      const sb = await sandbox.getOrCreate(sandboxKey(req));
      reply.raw.setHeader('content-type', 'text/event-stream');
      reply.raw.setHeader('cache-control', 'no-cache');
      reply.raw.flushHeaders?.();
      const ctl = new AbortController();
      req.raw.on('close', () => ctl.abort());
      const write = (event: string, data: any) => {
        reply.raw.write(`event: ${event}\n`);
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
      };
      try {
        for await (const chunk of sb.execStream(body.cmd, {
          cwd: body.cwd, timeoutSec: body.timeoutSec ?? 120, signal: ctl.signal,
        })) {
          if (chunk.kind === 'exit') write('exit', { exitCode: chunk.exitCode });
          else write(chunk.kind, { data: chunk.data });
        }
      } catch (e: any) {
        write('error', { message: e?.message ?? 'exec failed' });
      } finally {
        reply.raw.end();
      }
    });

    // ---- git ----
    app.get('/git/branch', async (req) => {
      const sb = await sandbox.getOrCreate(sandboxKey(req));
      const r = await sb.exec('git rev-parse --abbrev-ref HEAD 2>/dev/null', { timeoutSec: 5 });
      const branch = r.stdout.trim();
      return { isRepo: r.exitCode === 0 && !!branch, branch: branch || null };
    });

    app.post('/git/clone', async (req, reply) => {
      const body = (req.body ?? {}) as any;
      if (!body.repo) return reply.code(400).send({ error: 'repo required' });
      const sb = await sandbox.getOrCreate(sandboxKey(req));
      const branchArg = body.branch ? `-b ${JSON.stringify(body.branch)}` : '';
      // 避免覆盖已有 .git
      const r = await sb.exec(
        `if [ -d .git ]; then echo "already a repo"; exit 0; fi && git clone ${branchArg} ${JSON.stringify(body.repo)} .`,
        { timeoutSec: 120 },
      );
      return { ok: r.exitCode === 0, stdout: r.stdout, stderr: r.stderr };
    });

    // ---- git status (porcelain) ----
    // 返回结构化的变更列表 [{ path, status: 'M'|'A'|'D'|'??'|'R'|'U' }]
    // 让前端"变更"tab 直接渲染
    app.get('/git/status', async (req) => {
      const sb = await sandbox.getOrCreate(sandboxKey(req));
      // 先判断是不是 git 仓库
      const head = await sb.exec('git rev-parse --git-dir 2>/dev/null', { timeoutSec: 5 });
      if (head.exitCode !== 0) return { isRepo: false, changes: [] };
      // -z 不友好（NUL 分隔），用普通 porcelain 行
      const r = await sb.exec('git status --porcelain=v1 -uall', { timeoutSec: 15 });
      const lines = r.stdout.split('\n').filter(Boolean);
      const changes = lines.map((ln) => {
        // 形如 " M src/a.ts" / "?? new.ts" / "R  old -> new"
        const idx = ln[0];
        const wt = ln[1];
        const rest = ln.slice(3);
        let status: string;
        if (idx === '?' && wt === '?') status = '??';
        else if (idx === 'A' || wt === 'A') status = 'A';
        else if (idx === 'D' || wt === 'D') status = 'D';
        else if (idx === 'R' || wt === 'R') status = 'R';
        else if (idx === 'M' || wt === 'M') status = 'M';
        else status = (idx + wt).trim() || 'M';
        // 处理 rename: "old -> new"
        let path = rest;
        const arrow = rest.indexOf(' -> ');
        if (arrow > -1) path = rest.slice(arrow + 4);
        return { path, status, raw: ln };
      });
      return { isRepo: true, changes };
    });

    // ---- git diff for a single file ----
    // 返回 unified diff 文本（前端自己渲染高亮）
    // 对未跟踪文件用 git diff --no-index /dev/null <path>
    app.get('/git/diff', async (req, reply) => {
      const q = req.query as any;
      const p = String(q?.path ?? '').trim();
      if (!p) return reply.code(400).send({ error: 'path required' });
      const sb = await sandbox.getOrCreate(sandboxKey(req));
      const head = await sb.exec('git rev-parse --git-dir 2>/dev/null', { timeoutSec: 5 });
      if (head.exitCode !== 0) return { isRepo: false, diff: '' };

      const safe = JSON.stringify(p); // 简单转义
      // 1) 先看是不是 untracked
      const ls = await sb.exec(`git ls-files --error-unmatch ${safe} 2>/dev/null`, { timeoutSec: 5 });
      let cmd: string;
      if (ls.exitCode !== 0) {
        // untracked: 用 --no-index 对比 /dev/null（exit code != 0 是预期）
        cmd = `git --no-pager diff --no-color --no-index -- /dev/null ${safe} || true`;
      } else {
        cmd = `git --no-pager diff --no-color HEAD -- ${safe}`;
      }
      const r = await sb.exec(cmd, { timeoutSec: 15 });
      return { isRepo: true, path: p, diff: r.stdout };
    });

    // ---- git revert（撤回单文件改动） ----
    // body: { path, status }
    //   - status 'M' / 'D'  → git checkout HEAD -- <path>
    //   - status '??'       → rm -- <path>（未跟踪的新文件）
    //   - status 'A'        → git rm -f --cached + rm   (已 staged)
    app.post('/git/revert', async (req, reply) => {
      const body = (req.body ?? {}) as any;
      const p = String(body?.path ?? '').trim();
      const status = String(body?.status ?? '').trim();
      if (!p) return reply.code(400).send({ error: 'path required' });
      const sb = await sandbox.getOrCreate(sandboxKey(req));
      const head = await sb.exec('git rev-parse --git-dir 2>/dev/null', { timeoutSec: 5 });
      if (head.exitCode !== 0) return reply.code(400).send({ error: 'not a git repo' });

      const safe = JSON.stringify(p);
      let cmd: string;
      if (status === '??') {
        cmd = `rm -rf -- ${safe}`;
      } else if (status === 'A') {
        cmd = `git rm -f --cached -- ${safe} && rm -f -- ${safe}`;
      } else {
        // M / D / R / U 等 → checkout 回 HEAD
        cmd = `git checkout HEAD -- ${safe}`;
      }
      const r = await sb.exec(cmd, { timeoutSec: 15 });
      return { ok: r.exitCode === 0, stdout: r.stdout, stderr: r.stderr };
    });

    // ---- git add（接受/暂存一个文件，让它"不再是变更"） ----
    // 我们的"接受"语义：git add + git commit -m "ai: ..."  让 HEAD 前进
    app.post('/git/accept', async (req, reply) => {
      const body = (req.body ?? {}) as any;
      const p = String(body?.path ?? '').trim();
      const message = String(body?.message ?? `ai: changes to ${p}`).slice(0, 200);
      if (!p) return reply.code(400).send({ error: 'path required' });
      const sb = await sandbox.getOrCreate(sandboxKey(req));
      const head = await sb.exec('git rev-parse --git-dir 2>/dev/null', { timeoutSec: 5 });
      if (head.exitCode !== 0) return reply.code(400).send({ error: 'not a git repo' });

      const safe = JSON.stringify(p);
      const safeMsg = JSON.stringify(message);
      // 配置一个临时 author（沙箱里大概率没设 user.name/user.email）
      const cmd = [
        `git add -A -- ${safe}`,
        `git -c user.email=ai@sandbox.local -c user.name="AI Sandbox" commit -m ${safeMsg} --only -- ${safe}`,
      ].join(' && ');
      const r = await sb.exec(cmd, { timeoutSec: 15 });
      return { ok: r.exitCode === 0, stdout: r.stdout, stderr: r.stderr };
    });

    // ---- sandbox lifecycle ----
    app.post('/sandbox/init', async (req) => {
      const sb = await sandbox.getOrCreate(sandboxKey(req));
      return { id: sb.id };
    });

    // ---- git log（commit 历史） ----
    // ?limit=50  → 最近 50 条提交
    app.get('/git/log', async (req) => {
      const q = req.query as any;
      const limit = Math.min(200, Math.max(1, Number(q?.limit ?? 50)));
      const sb = await sandbox.getOrCreate(sandboxKey(req));
      const head = await sb.exec('git rev-parse --git-dir 2>/dev/null', { timeoutSec: 5 });
      if (head.exitCode !== 0) return { isRepo: false, commits: [] };
      // 用 \x1f (US) 分隔字段，\x1e (RS) 分隔记录
      const FMT = '%H%x1f%h%x1f%an%x1f%ae%x1f%at%x1f%s%x1e';
      const r = await sb.exec(`git --no-pager log -n ${limit} --pretty=format:'${FMT}'`, { timeoutSec: 15 });
      const records = r.stdout.split('\x1e').map((s) => s.trim()).filter(Boolean);
      const commits = records.map((rec) => {
        const [hash, short, an, ae, at, subject] = rec.split('\x1f');
        return {
          hash,
          short,
          author: an,
          email: ae,
          ts: parseInt(at, 10) * 1000,
          subject: subject ?? '',
          isAi: an === 'AI Sandbox' || ae === 'ai@sandbox.local',
        };
      });
      return { isRepo: true, commits };
    });

    // ---- git show（单个 commit 的 diff） ----
    app.get('/git/show', async (req, reply) => {
      const q = req.query as any;
      const hash = String(q?.hash ?? '').trim();
      if (!hash || !/^[0-9a-f]{4,40}$/.test(hash)) return reply.code(400).send({ error: 'bad hash' });
      const sb = await sandbox.getOrCreate(sandboxKey(req));
      const r = await sb.exec(`git --no-pager show --no-color --stat -p ${hash}`, { timeoutSec: 30 });
      return { ok: r.exitCode === 0, hash, diff: r.stdout };
    });

    app.delete('/sandbox', async (req) => {
      await sandbox.remove(sandboxKey(req));
      return { ok: true };
    });

    // ---- 导出沙箱为 ZIP ----
    // GET /api/agents/export?path=/  → application/zip
    // 可选 ?path=/some/sub 只导出子目录
    app.get('/export', async (req, reply) => {
      const q = req.query as any;
      const sub = typeof q?.path === 'string' && q.path ? q.path : '/';
      const sb = await sandbox.getOrCreate(sandboxKey(req));
      const list = await sb.list({ path: sub, recursive: true });
      const zip = new JSZip();
      let added = 0;
      for (const entry of list) {
        if (entry.isDir) continue;
        try {
          const r = await sb.read(entry.path);
          // entry.path 形如 "/src/index.ts"，去掉前导 "/"
          const rel = entry.path.replace(/^\/+/, '');
          if (r.encoding === 'base64') {
            zip.file(rel, r.content, { base64: true });
          } else {
            zip.file(rel, r.content);
          }
          added++;
        } catch {
          /* 单文件失败不影响其它 */
        }
      }
      const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const name = `sandbox-${ts}.zip`;
      reply
        .header('content-type', 'application/zip')
        .header('content-disposition', `attachment; filename="${name}"`)
        .header('x-file-count', String(added));
      return reply.send(buf);
    });
  };
}