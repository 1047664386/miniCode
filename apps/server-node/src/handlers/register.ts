
/**
 * handlers/register.ts —— 在 Router 上注册所有 HTTP endpoints
 * ---------------------------------------------------------------
 * 与 apps/server/src/main.ts 的 express 实现一一对应，只是把
 *   app.get/.post('/api/xxx', (req, res) => ...)
 * 换成
 *   r.get/.post('/api/xxx', async (ctx) => ...)
 *
 * services 由 Services container 提供（手动 new，无 DI）。
 * read body 用 readBody(ctx.req)，response 用 sendJson(ctx.res, ...)。
 */
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import type { Services } from '../services.js';
import type { Router } from '../router/router.js';
import { sendJson, sendText, readBody, openSse } from '../router/http-utils.js';
import {
  buildMessages, ToolRegistry, runAgent, considerAutoMemory,
  callStructured,
  type ChatMessage,
} from '@mini/core';
import { hybridRetrieve } from '../../../server/src/retrieval.js';
import { decideCommand } from '../../../server/src/exec-policy.js';
import { parseMentions } from '../../../server/src/mentions.js';
import { isGitRepo, gitStatus, gitDiff, gitBranch, gitLog, gitCommit } from '../../../server/src/git-helpers.js';
import { createProvider } from '../../../server/src/llm-router.js';
import { McpManager } from '../../../server/src/mcp-client.js';
import type { ProviderProfile } from '../../../server/src/providers.js';

function detectMultiStepHint(userMessage: string): string | null {
  const patterns = [
    /\b(all|every|each)\b.*\b(file|function|class|method)\b/i,
    /(\d+[.)]\s+.+){2,}/,
    /\b(then|and then|after that|next)\b/i,
    /先.{2,20}再.{2,20}/,
    /分别|并行|同时|批量|全部|所有/,
    /parallel|simultaneously/i,
  ];
  const isMultiStep = patterns.some((p) => p.test(userMessage));
  const pathMatches = userMessage.match(/\b[\w\/.-]+\.\w{1,6}\b/g) ?? [];
  const hasMultiFile = new Set(pathMatches).size >= 3;
  if (!isMultiStep && !hasMultiFile) return null;
  return (
    '\n[context] This user message appears to involve multiple steps or files. ' +
    'IMPORTANT: Before executing, call `update_plan` to list all steps with status=pending, ' +
    'set the first step to in_progress, then execute. Update after each step.'
  );
}

function globToRegex(glob: string): RegExp {
  let out = '^'; let i = 0;
  while (i < glob.length) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') { out += '.*'; i += 2; }
      else { out += '[^/]*'; i++; }
    } else if (c === '?') { out += '.'; i++; }
    else if (c === '{') {
      const end = glob.indexOf('}', i);
      if (end < 0) { out += '\\{'; i++; }
      else {
        const opts = glob.slice(i + 1, end).split(',').map((x) => x.replace(/[.+^$()|[\]\\]/g, '\\$&'));
        out += '(?:' + opts.join('|') + ')';
        i = end + 1;
      }
    } else if (/[.+^$()|[\]\\]/.test(c)) { out += '\\' + c; i++; }
    else { out += c; i++; }
  }
  out += '$';
  return new RegExp(out);
}

const VSCODE_TARGET = process.env.VSCODE_URL ?? 'http://127.0.0.1:8000';

export function registerHandlers(r: Router, s: Services) {
  
  // ---- health / version ----
  r.get('/health', (c) => sendJson(c.res, 200, { ok: true, ts: Date.now() }));
  r.get('/api/health', (c) => sendJson(c.res, 200, {
    ok: true, indexReady: !!s.index, workspace: s.workspace,
    fileCount: s.index?.fileCount, chunkCount: s.index?.chunkCount,
    symbolCount: s.index?.symbolCount, vectorCount: s.index?.vectors.size(),
    embedder: s.index?.embedderName ?? s.embedder.name,
    reranker: s.reranker.name, ts: Date.now(),
  }));
  r.get('/api/version', (c) => sendJson(c.res, 200, {
    version: process.env.npm_package_version ?? '0.0.0-dev',
    node: process.version, platform: `${os.platform()} ${os.arch()}`,
  }));
  r.get('/api/metrics', (c) => sendJson(c.res, 200, { ok: true, ts: Date.now() }));

  // ---- approvals ----
  r.get('/api/approvals', (c) => sendJson(c.res, 200, s.approvals.list()));
  r.post('/api/approve/:id', async (c) => {
    const body = await readBody(c.req);
    const decision = body?.ok === true ? 'allow' : 'deny';
    const ok = s.approvals.decide(c.params.id, decision);
    if (!ok) return sendJson(c.res, 404, { error: 'not found or expired' });
    sendJson(c.res, 200, { ok: true });
  });

  // ---- composer bridge: VSCode ext (code-server) → main shell ----
  // 简单的 in-memory pub/sub：VSCode 扩展通过 POST /api/composer/forward 发事件，
  // 主壳通过 GET /api/composer/events (SSE) 监听并把 payload 派发给 React Composer。
  const composerSubscribers = new Set<(ev: { event: string; payload: any }) => void>();
  r.post('/api/composer/forward', async (c) => {
    const body = await readBody(c.req);
    if (!body?.event) return sendJson(c.res, 400, { error: 'missing event' });
    const ev = { event: String(body.event), payload: body.payload ?? {} };
    composerSubscribers.forEach((fn) => { try { fn(ev); } catch { /* ignore */ } });
    sendJson(c.res, 200, { ok: true, subscribers: composerSubscribers.size });
  });
  r.get('/api/composer/events', async (c) => {
    const sse = openSse(c.req, c.res);
    const handler = (ev: { event: string; payload: any }) => sse.send(ev);
    composerSubscribers.add(handler);
    sse.send({ event: 'ready', payload: {} });
    c.req.on('close', () => composerSubscribers.delete(handler));
  });

  // ---- vscode ----
  r.get('/api/vscode/health', async (c) => {
    try {
      const resp = await fetch(VSCODE_TARGET + '/', { redirect: 'manual' });
      sendJson(c.res, 200, { ok: resp.status < 500, status: resp.status, url: VSCODE_TARGET });
    } catch (e: any) {
      sendJson(c.res, 200, { ok: false, error: e?.message ?? String(e), url: VSCODE_TARGET });
    }
  });

  // ---- files ----
  r.get('/api/files', async (c) => {
    const rel = c.query.path ?? '.';
    const abs = path.resolve(s.workspace, rel);
    if (!abs.startsWith(s.workspace)) return sendJson(c.res, 400, { error: 'escape' });
    try {
      const entries = await fs.readdir(abs, { withFileTypes: true });
      sendJson(c.res, 200, entries
        .filter((e) => !['node_modules', '.git', 'dist'].includes(e.name))
        .map((e) => ({
          name: e.name,
          path: path.relative(s.workspace, path.join(abs, e.name)),
          isDir: e.isDirectory(),
        }))
        .sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1)));
    } catch (e: any) { sendJson(c.res, 500, { error: e.message }); }
  });
  r.get('/api/file', async (c) => {
    const rel = c.query.path ?? '';
    const abs = path.resolve(s.workspace, rel);
    if (!abs.startsWith(s.workspace)) return sendJson(c.res, 400, { error: 'escape' });
    try {
      const text = await fs.readFile(abs, 'utf-8');
      sendJson(c.res, 200, { path: rel, content: text });
    } catch (e: any) { sendJson(c.res, 500, { error: e.message }); }
  });
  r.post('/api/file', async (c) => {
    const body = await readBody(c.req);
    const { path: rel, content } = body ?? {};
    const abs = path.resolve(s.workspace, rel);
    if (!abs.startsWith(s.workspace)) return sendJson(c.res, 400, { error: 'escape' });
    try {
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, content ?? '', 'utf-8');
      sendJson(c.res, 200, { ok: true });
    } catch (e: any) { sendJson(c.res, 500, { error: e.message }); }
  });
  // delete file or folder
  r.delete('/api/file', async (c) => {
    const rel = c.query.path ?? '';
    if (!rel || rel === '.' || rel === '/') return sendJson(c.res, 400, { error: 'invalid path' });
    const abs = path.resolve(s.workspace, rel);
    if (!abs.startsWith(s.workspace) || abs === s.workspace) return sendJson(c.res, 400, { error: 'escape' });
    try {
      await fs.rm(abs, { recursive: true, force: true });
      sendJson(c.res, 200, { ok: true });
    } catch (e: any) { sendJson(c.res, 500, { error: e.message }); }
  });
  // rename / move
  r.post('/api/file/rename', async (c) => {
    const body = await readBody(c.req);
    const { from, to } = body ?? {};
    if (!from || !to) return sendJson(c.res, 400, { error: 'from/to required' });
    const fromAbs = path.resolve(s.workspace, from);
    const toAbs = path.resolve(s.workspace, to);
    if (!fromAbs.startsWith(s.workspace) || !toAbs.startsWith(s.workspace)) return sendJson(c.res, 400, { error: 'escape' });
    try {
      // 防止覆盖已有文件
      try { await fs.access(toAbs); return sendJson(c.res, 409, { error: 'target exists' }); } catch {}
      await fs.mkdir(path.dirname(toAbs), { recursive: true });
      await fs.rename(fromAbs, toAbs);
      sendJson(c.res, 200, { ok: true });
    } catch (e: any) { sendJson(c.res, 500, { error: e.message }); }
  });
  // create folder
  r.post('/api/folder', async (c) => {
    const body = await readBody(c.req);
    const { path: rel } = body ?? {};
    if (!rel) return sendJson(c.res, 400, { error: 'path required' });
    const abs = path.resolve(s.workspace, rel);
    if (!abs.startsWith(s.workspace)) return sendJson(c.res, 400, { error: 'escape' });
    try {
      await fs.mkdir(abs, { recursive: true });
      sendJson(c.res, 200, { ok: true });
    } catch (e: any) { sendJson(c.res, 500, { error: e.message }); }
  });
  // reveal in finder (mac/win/linux)
  r.post('/api/file/reveal', async (c) => {
    const body = await readBody(c.req);
    const { path: rel } = body ?? {};
    const abs = path.resolve(s.workspace, rel ?? '');
    if (!abs.startsWith(s.workspace)) return sendJson(c.res, 400, { error: 'escape' });
    try {
      const { spawn } = await import('child_process');
      const platform = process.platform;
      if (platform === 'darwin') spawn('open', ['-R', abs], { detached: true }).unref();
      else if (platform === 'win32') spawn('explorer', ['/select,', abs], { detached: true }).unref();
      else spawn('xdg-open', [path.dirname(abs)], { detached: true }).unref();
      sendJson(c.res, 200, { ok: true });
    } catch (e: any) { sendJson(c.res, 500, { error: e.message }); }
  });

  // ---- absolute-path FS browser (for "Open Folder" modal in web mode) ----
  r.get('/api/fs/list-abs', async (c) => {
    const os = await import('node:os');
    let abs = c.query.path ?? os.homedir();
    abs = path.resolve(abs);
    try {
      const entries = await fs.readdir(abs, { withFileTypes: true });
      const dirs = entries
        .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
        .map((e) => ({ name: e.name, path: path.join(abs, e.name) }))
        .sort((a, b) => a.name.localeCompare(b.name));
      sendJson(c.res, 200, {
        path: abs,
        parent: path.dirname(abs) === abs ? null : path.dirname(abs),
        home: os.homedir(),
        dirs,
      });
    } catch (e: any) { sendJson(c.res, 500, { error: e.message, path: abs }); }
  });

  // ---- workspace hot-switch (web mode) ----
  r.get('/api/workspace', (c) => {
    sendJson(c.res, 200, { path: s.workspace });
  });
  r.post('/api/workspace/switch', async (c) => {
    const body = await readBody(c.req);
    const { path: next } = body ?? {};
    if (!next || typeof next !== 'string') return sendJson(c.res, 400, { error: 'path required' });
    const abs = path.resolve(next);
    try {
      const st = await fs.stat(abs);
      if (!st.isDirectory()) return sendJson(c.res, 400, { error: 'not a directory' });
      await s.switchWorkspace(abs);
      sendJson(c.res, 200, { ok: true, workspace: s.workspace });
    } catch (e: any) { sendJson(c.res, 500, { error: e?.message ?? String(e) }); }
  });

  // ---- agents-window read-only namespace ------------------------------------
  // Agents Window 切换 workspace 不应该影响主 IDE，因此这些接口都用 ?ws= 显式传入
  // 绝对路径的工作区根，单独一套只读浏览/读取。
  function safeJoin(rootAbs: string, rel: string): string | null {
    const target = path.resolve(rootAbs, rel || '.');
    return target === rootAbs || target.startsWith(rootAbs + path.sep) ? target : null;
  }
  r.get('/api/agents/files', async (c) => {
    const ws = c.query.ws;
    if (!ws || !path.isAbsolute(ws)) return sendJson(c.res, 400, { error: 'absolute ws required' });
    const target = safeJoin(ws, c.query.path ?? '.');
    if (!target) return sendJson(c.res, 400, { error: 'escape' });
    try {
      const entries = await fs.readdir(target, { withFileTypes: true });
      sendJson(c.res, 200, entries
        .filter((e) => !['node_modules', '.git', 'dist', '.next', '.turbo'].includes(e.name))
        .map((e) => ({
          name: e.name,
          path: path.relative(ws, path.join(target, e.name)),
          isDir: e.isDirectory(),
        }))
        .sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1)));
    } catch (e: any) { sendJson(c.res, 500, { error: e.message }); }
  });
  r.get('/api/agents/file', async (c) => {
    const ws = c.query.ws;
    if (!ws || !path.isAbsolute(ws)) return sendJson(c.res, 400, { error: 'absolute ws required' });
    const target = safeJoin(ws, c.query.path ?? '');
    if (!target) return sendJson(c.res, 400, { error: 'escape' });
    try {
      const st = await fs.stat(target);
      if (st.size > 2 * 1024 * 1024) return sendJson(c.res, 413, { error: 'file too large (>2MB)' });
      const text = await fs.readFile(target, 'utf-8');
      sendJson(c.res, 200, { path: c.query.path ?? '', content: text, size: st.size });
    } catch (e: any) { sendJson(c.res, 500, { error: e.message }); }
  });
  r.get('/api/agents/git/branch', async (c) => {
    const ws = c.query.ws;
    if (!ws || !path.isAbsolute(ws)) return sendJson(c.res, 400, { error: 'absolute ws required' });
    try {
      if (!(await isGitRepo(ws))) return sendJson(c.res, 200, { isRepo: false });
      const branch = await gitBranch(ws);
      sendJson(c.res, 200, { isRepo: true, branch });
    } catch (e: any) { sendJson(c.res, 500, { error: e?.message ?? String(e) }); }
  });
  // 列出某父目录下的子目录（用于"打开工作空间"对话框，浏览器 fallback）
  r.get('/api/agents/list-dirs', async (c) => {
    const parent = c.query.parent || os.homedir();
    if (!path.isAbsolute(parent)) return sendJson(c.res, 400, { error: 'absolute parent required' });
    try {
      const entries = await fs.readdir(parent, { withFileTypes: true });
      const dirs = entries
        .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
        .map((e) => ({ name: e.name, path: path.join(parent, e.name) }))
        .sort((a, b) => a.name.localeCompare(b.name));
      sendJson(c.res, 200, { parent, home: os.homedir(), dirs });
    } catch (e: any) { sendJson(c.res, 500, { error: e?.message ?? String(e) }); }
  });


  // ---- search ----
  r.get('/api/search', (c) => {
    if (!s.index) return sendJson(c.res, 200, { ready: false, hits: [] });
    const hits = s.index.bm25.search(c.query.q ?? '', 8);
    sendJson(c.res, 200, { ready: true, hits });
  });

  r.get('/api/grep', async (c) => {
    const pattern = c.query.pattern ?? '';
    const caseInsensitive = c.query.ci === '1' || c.query.ci === 'true';
    const includeGlob = c.query.include ?? '';
    const maxHits = Math.min(500, Number(c.query.limit ?? 200));
    if (!pattern) return sendJson(c.res, 200, { ready: true, hits: [] });
    let re: RegExp;
    try { re = new RegExp(pattern, caseInsensitive ? 'i' : ''); }
    catch (e: any) { return sendJson(c.res, 400, { error: `Invalid regex: ${e?.message ?? e}` }); }
    const globRe = includeGlob ? globToRegex(includeGlob) : null;
    type Hit = { file: string; line: number; text: string; before?: string; after?: string };
    const hits: Hit[] = [];
    let scanned = 0;
    const skipDirs = new Set(['node_modules', 'dist', 'build', '.git', '.next', '.cache']);
    const walk = async (dir: string) => {
      if (hits.length >= maxHits) return;
      let entries: any[] = [];
      try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        if (hits.length >= maxHits) return;
        if (e.name.startsWith('.') || skipDirs.has(e.name)) continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) await walk(full);
        else {
          if (globRe && !globRe.test(e.name)) continue;
          scanned++;
          try {
            const text = await fs.readFile(full, 'utf-8');
            const lines = text.split('\n');
            for (let i = 0; i < lines.length; i++) {
              if (re.test(lines[i])) {
                hits.push({
                  file: path.relative(s.workspace, full),
                  line: i + 1,
                  text: lines[i].slice(0, 400),
                  before: i > 0 ? lines[i - 1].slice(0, 400) : undefined,
                  after: i < lines.length - 1 ? lines[i + 1].slice(0, 400) : undefined,
                });
                if (hits.length >= maxHits) return;
              }
            }
          } catch { /* binary */ }
        }
      }
    };
    await walk(s.workspace);
    sendJson(c.res, 200, { ready: true, hits, scanned, truncated: hits.length >= maxHits });
  });

  r.get('/api/semantic-search', async (c) => {
    const q = c.query.q ?? '';
    const k = Math.min(20, Number(c.query.k ?? 10));
    if (!s.index) return sendJson(c.res, 200, { ready: false, hits: [] });
    if (s.index.vectors.size() === 0)
      return sendJson(c.res, 200, { ready: true, hits: [], note: 'no vectors' });
    const [v] = await s.embedder.embed([q]);
    const hits = s.index.vectors.search(v, k);
    sendJson(c.res, 200, { ready: true, hits, embedder: s.embedder.name });
  });

  r.get('/api/hybrid-search', async (c) => {
    const q = c.query.q ?? '';
    const k = Math.min(20, Number(c.query.k ?? 10));
    if (!s.index) return sendJson(c.res, 200, { ready: false, hits: [] });
    const hits = await hybridRetrieve(s.index, s.embedder, q, k, s.reranker);
    sendJson(c.res, 200, { ready: true, hits });
  });

  r.get('/api/symbols', (c) => {
    if (!s.index) return sendJson(c.res, 200, { ready: false });
    const q = (c.query.q ?? '').trim();
    const filePath = c.query.path ?? null;
    if (filePath) return sendJson(c.res, 200, { ready: true, symbols: s.index.symbols.symbolsInFile(filePath) });
    if (!q) return sendJson(c.res, 200, { ready: true, symbols: [] });
    sendJson(c.res, 200, { ready: true, symbols: s.index.symbols.fuzzyFind(q, 30) });
  });

  // ---- flat file list (for QuickPick fuzzy file search) ----
  r.get('/api/files/all', (c) => {
    if (!s.index) return sendJson(c.res, 200, { ready: false, files: [] });
    const q = (c.query.q ?? '').trim().toLowerCase();
    const all = s.index.symbols.allFiles();
    if (!q) return sendJson(c.res, 200, { ready: true, files: all.slice(0, 200) });
    // simple subseq fuzzy: char order preserved
    const score = (p: string) => {
      const lp = p.toLowerCase();
      let i = 0, j = 0, gaps = 0, lastHit = -1;
      while (i < q.length && j < lp.length) {
        if (q[i] === lp[j]) { if (lastHit !== -1 && j - lastHit > 1) gaps += j - lastHit; lastHit = j; i++; }
        j++;
      }
      if (i < q.length) return -1;
      // shorter & with basename hit beats long
      const base = lp.split('/').pop() ?? lp;
      const baseHit = base.includes(q) ? 100 : 0;
      return baseHit + 1000 - gaps - lp.length;
    };
    const ranked = all
      .map((p) => ({ p, s: score(p) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 50)
      .map((x) => x.p);
    sendJson(c.res, 200, { ready: true, files: ranked });
  });

  r.get('/api/references', (c) => {
    if (!s.index) return sendJson(c.res, 200, { ready: false });
    const name = (c.query.name ?? '').trim();
    if (!name) return sendJson(c.res, 200, { ready: true, refs: [] });
    sendJson(c.res, 200, { ready: true, refs: s.index.symbols.findReferences(name) });
  });

  // ---- inline complete ----
  r.post('/api/complete', async (c) => {
    const body = await readBody(c.req);
    const { path: filePath, prefix = '', suffix = '', language = 'typescript', maxTokens = 80 } = body ?? {};
    const PRE_LIMIT = 2000, SUF_LIMIT = 600;
    const pre = prefix.length > PRE_LIMIT ? prefix.slice(prefix.length - PRE_LIMIT) : prefix;
    const suf = suffix.length > SUF_LIMIT ? suffix.slice(0, SUF_LIMIT) : suffix;
    const queryText = (pre.slice(-200) + ' ' + suf.slice(0, 100)).trim();
    let snippets = '';
    if (s.index && queryText) {
      try {
        const hits = await hybridRetrieve(s.index, s.embedder, queryText, 3, s.reranker);
        snippets = hits.filter((h) => h.path !== filePath).slice(0, 3)
          .map((h) => `// ${h.path}:${h.startLine}-${h.endLine}\n${h.text.slice(0, 400)}`).join('\n\n');
      } catch { /* */ }
    }
    const sys = `You are an expert code completion engine. Given the code BEFORE the cursor and the code AFTER the cursor, output ONLY the text that should be inserted at the cursor — no explanations, no markdown fences, no leading newline. Keep the completion short (a single statement, expression, or up to a few lines). Match the existing style and indentation. If nothing useful to add, output an empty string.`;
    const user = [
      snippets ? `### Related context\n${snippets}\n` : '',
      `### File: ${filePath ?? '<unknown>'} (${language})`,
      `### Code before cursor`, '```', pre, '```',
      `### Code after cursor`, '```', suf, '```',
      `### Completion to insert at <CURSOR>`,
    ].filter(Boolean).join('\n');
    try {
      let full = '';
      const ctl = new AbortController();
      c.req.on('close', () => ctl.abort());
      for await (const chunk of s.llmComplete.chatStream(
        [{ role: 'system', content: sys }, { role: 'user', content: user }],
        { temperature: 0.1, signal: ctl.signal },
      )) {
        if (chunk.delta) full += chunk.delta;
        if (full.length > maxTokens * 6) break;
      }
      const out = full.replace(/^```[a-zA-Z]*\n?/, '').replace(/```\s*$/, '').replace(/^\n+/, '');
      sendJson(c.res, 200, { completion: out });
    } catch (e: any) {
      sendJson(c.res, 500, { error: e?.message ?? String(e) });
    }
  });

  // ---- inline edit (SSE) ----
  r.post('/api/inline-edit', async (c) => {
    const body = await readBody(c.req);
    const { path: filePath, selection = '', instruction = '', language = 'typescript',
      contextBefore = '', contextAfter = '', apply = false, fullText } = body ?? {};
    const sse = openSse(c.req, c.res);
    const sys = 'You are an inline code editor. Given the code BEFORE the selection, the SELECTION itself, the code AFTER the selection, and the user instruction, output ONLY the rewritten selection. No explanations, no markdown fences, no leading or trailing newlines. Preserve indentation style and surrounding context. If the instruction is unclear, output the selection unchanged.';
    const user = [
      `### File: ${filePath ?? '<unknown>'} (${language})`,
      contextBefore ? `### Code BEFORE selection\n\`\`\`\n${contextBefore.slice(-1500)}\n\`\`\`` : '',
      `### Original SELECTION\n\`\`\`\n${selection}\n\`\`\``,
      contextAfter ? `### Code AFTER selection\n\`\`\`\n${contextAfter.slice(0, 800)}\n\`\`\`` : '',
      `### Instruction\n${instruction}`,
      '### Rewritten SELECTION',
    ].filter(Boolean).join('\n');
    let full = '';
    try {
      for await (const chunk of s.llmComplete.chatStream(
        [{ role: 'system', content: sys }, { role: 'user', content: user }],
        { temperature: 0.2, signal: sse.signal },
      )) {
        if (chunk.delta) { full += chunk.delta; sse.send({ type: 'text', text: chunk.delta }); }
        if (chunk.done || chunk.finishReason) break;
      }
      const cleaned = full.replace(/^```[a-zA-Z]*\n?/, '').replace(/```\s*$/, '')
        .replace(/^\n+/, '').replace(/\n+$/, '');
      let pendingEditId: string | undefined;
      if (apply && filePath && typeof fullText === 'string' && selection) {
        const idx = fullText.indexOf(selection);
        if (idx >= 0) {
          const newContent = fullText.slice(0, idx) + cleaned + fullText.slice(idx + selection.length);
          const edit = await s.pendingEdits.propose({ path: filePath, newContent, tool: 'inline-edit' });
          pendingEditId = edit.id;
        }
      }
      sse.send({ type: 'done', newSelection: cleaned, pendingEditId });
    } catch (e: any) {
      sse.send({ type: 'error', error: e?.message ?? String(e) });
    } finally { sse.end(); }
  });

  // ---- memory ----
  r.get('/api/memory', async (c) => sendJson(c.res, 200, {
    user: await s.memory.list('user'),
    project: await s.memory.list('project'),
  }));
  r.post('/api/memory', async (c) => {
    const body = await readBody(c.req);
    sendJson(c.res, 200, await s.memory.upsert(body?.scope ?? 'user', body));
  });
  r.delete('/api/memory/:scope/:id', async (c) => {
    sendJson(c.res, 200, { ok: await s.memory.delete(c.params.scope as any, c.params.id) });
  });
  r.post('/api/memory/maintain', async (c) => {
    try {
      const body = await readBody(c.req);
      sendJson(c.res, 200, { ok: true, report: await s.memory.maintain(body ?? {}) });
    } catch (e: any) { sendJson(c.res, 500, { ok: false, error: e?.message ?? String(e) }); }
  });
  r.post('/api/recent-activity', async (c) => {
    const body = await readBody(c.req);
    const { sessionId, kind, target, meta } = body ?? {};
    if (!sessionId || !kind || !target) return sendJson(c.res, 400, { error: 'sessionId, kind, target required' });
    if (!['edit', 'read', 'search', 'view'].includes(kind)) return sendJson(c.res, 400, { error: 'invalid kind' });
    s.recentActivity.record(sessionId, { kind, target, meta });
    sendJson(c.res, 200, { ok: true });
  });

  // ---- judge ----
  r.post('/api/judge', async (c) => {
    try {
      const { z } = await import('zod');
      const body = (await readBody(c.req)) ?? {};
      const question = String(body.question ?? '').trim();
      const answer = String(body.answer ?? '');
      const expectedConcepts: string[] = Array.isArray(body.expectedConcepts) ? body.expectedConcepts : [];
      const context: string = typeof body.context === 'string' ? body.context : '';
      const passThreshold = Number(body.passThreshold ?? 7);
      if (!question) return sendJson(c.res, 400, { error: 'question required' });
      const schema = z.object({
        score: z.number().min(0).max(10), pass: z.boolean(),
        reasoning: z.string().min(1), missing: z.array(z.string()).optional(),
      });
      const system = 'You are a strict but fair evaluator of code-assistant outputs. Score from 0 to 10 based on how well the answer addresses the question. Do NOT reward fluff or hedging. Do NOT reward correct-but-irrelevant content. Score >= 7 means the answer is acceptable for production use.';
      const conceptsBlock = expectedConcepts.length
        ? `\n\nExpected concepts to cover (each missing concept reduces score):\n${expectedConcepts.map((x) => '  - ' + x).join('\n')}` : '';
      const ctxBlock = context ? `\n\nReference context:\n${context}` : '';
      const user = `Question: ${question}\n\nAnswer to evaluate:\n"""\n${answer.trim() || '(empty)'}\n"""` + conceptsBlock + ctxBlock;
      const result = await callStructured(s.llmFast, {
        schema,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        schemaName: 'judge_output', temperature: 0, maxRetries: 1,
      });
      const expected = result.data.score >= passThreshold;
      sendJson(c.res, 200, { ...result.data, pass: expected, threshold: passThreshold, attempts: result.attempts });
    } catch (e: any) { sendJson(c.res, 500, { error: e?.message ?? String(e) }); }
  });

  // ---- diagnostics (cached typecheck) ----
  interface Diagnostic { file: string; line: number; col: number; severity: 'error' | 'warning'; message: string; code?: string; }
  let diagCache: { ts: number; running: boolean; result: Diagnostic[]; lastError?: string; durationMs?: number } = {
    ts: 0, running: false, result: [],
  };
  const DIAG_TTL_MS = 30_000;
  async function runDiagnostics(): Promise<Diagnostic[]> {
    if (diagCache.running) return diagCache.result;
    diagCache.running = true;
    const t0 = Date.now();
    try {
      const { exec } = await import('node:child_process');
      const hasPnpm = await fs.access(path.join(s.workspace, 'pnpm-workspace.yaml')).then(() => true).catch(() => false);
      const pkgJson = await fs.readFile(path.join(s.workspace, 'package.json'), 'utf-8').catch(() => '{}');
      const scripts = (JSON.parse(pkgJson).scripts ?? {}) as Record<string, string>;
      let cmd: string;
      if (hasPnpm && scripts.typecheck) cmd = 'pnpm -r typecheck';
      else if (scripts.typecheck) cmd = 'npm run typecheck';
      else cmd = 'npx tsc --noEmit';
      const result = await new Promise<{ out: string }>((resolve) => {
        const p = exec(cmd, { cwd: s.workspace, maxBuffer: 8 * 1024 * 1024, timeout: 120_000 },
          (_e: any, so: string, se: string) => resolve({ out: (so ?? '') + '\n' + (se ?? '') }));
        (p as any).on?.('error', () => undefined);
      });
      const diagnostics: Diagnostic[] = [];
      const tscRe = /(.+?)\((\d+),(\d+)\):\s*(error|warning)\s+(TS\d+):\s*(.+)/g;
      for (const m of result.out.matchAll(tscRe)) {
        let file = m[1];
        if (path.isAbsolute(file)) file = path.relative(s.workspace, file);
        diagnostics.push({
          file, line: Number(m[2]), col: Number(m[3]),
          severity: m[4] as any, message: m[6].slice(0, 300), code: m[5],
        });
        if (diagnostics.length >= 200) break;
      }
      diagCache = { ts: Date.now(), running: false, result: diagnostics, durationMs: Date.now() - t0 };
    } catch (e: any) {
      diagCache = { ts: Date.now(), running: false, result: [], lastError: e?.message ?? String(e), durationMs: Date.now() - t0 };
    }
    return diagCache.result;
  }
  r.get('/api/diagnostics', async (c) => {
    const force = c.query.force === '1' || c.query.force === 'true';
    const stale = Date.now() - diagCache.ts > DIAG_TTL_MS;
    if (force || (stale && !diagCache.running)) runDiagnostics().catch(() => undefined);
    sendJson(c.res, 200, {
      diagnostics: diagCache.result, ts: diagCache.ts, running: diagCache.running,
      durationMs: diagCache.durationMs, error: diagCache.lastError, stale,
    });
  });

  // ---- pending edits ----
  r.get('/api/edits', (c) => sendJson(c.res, 200, s.pendingEdits.list()));
  r.post('/api/edits', async (c) => {
    const body = await readBody(c.req);
    const { path: p, newContent, tool = 'manual' } = body ?? {};
    if (!p || typeof newContent !== 'string') return sendJson(c.res, 400, { error: 'path and newContent required' });
    sendJson(c.res, 200, await s.pendingEdits.propose({ path: p, newContent, tool }));
  });
  r.get('/api/edits/:id', (c) => {
    const e = s.pendingEdits.get(c.params.id);
    if (!e) return sendJson(c.res, 404, { error: 'not found' });
    sendJson(c.res, 200, e);
  });
  r.post('/api/edits/:id/accept', async (c) => {
    try { sendJson(c.res, 200, await s.pendingEdits.accept(c.params.id)); }
    catch (e: any) { sendJson(c.res, 400, { error: e.message }); }
  });
  r.post('/api/edits/:id/reject', (c) => {
    try { sendJson(c.res, 200, s.pendingEdits.reject(c.params.id)); }
    catch (e: any) { sendJson(c.res, 400, { error: e.message }); }
  });
  r.post('/api/edits/accept-all', async (c) => sendJson(c.res, 200, await s.pendingEdits.acceptAll()));
  r.post('/api/edits/reject-all', (c) => {
    const all = s.pendingEdits.list();
    sendJson(c.res, 200, all.map((e) => s.pendingEdits.reject(e.id)));
  });

  // ---- checkpoints ----
  r.get('/api/checkpoints', (c) => sendJson(c.res, 200,
    s.checkpoints.list().map((cp) => ({
      id: cp.id, label: cp.label, trigger: cp.trigger,
      createdAt: cp.createdAt, reverted: cp.reverted,
      fileCount: cp.files.length, files: cp.files.map((f) => f.path),
    }))));
  r.get('/api/checkpoints/:id', (c) => {
    const cp = s.checkpoints.get(c.params.id);
    if (!cp) return sendJson(c.res, 404, { error: 'not found' });
    sendJson(c.res, 200, cp);
  });
  r.post('/api/checkpoints/:id/revert', async (c) => {
    try { sendJson(c.res, 200, await s.checkpoints.revert(c.params.id)); }
    catch (e: any) { sendJson(c.res, 400, { error: e?.message ?? String(e) }); }
  });

  // ---- rules ----
  r.get('/api/rules', (c) => sendJson(c.res, 200,
    s.rules.list().map((rl) => ({ file: rl.file, name: rl.name, mode: rl.mode, globs: rl.globs, description: rl.description, length: rl.body.length }))));
  r.post('/api/rules/reload', async (c) => {
    await s.rules.load();
    sendJson(c.res, 200, { ok: true, count: s.rules.list().length });
  });

  // ---- project memory (AGENTS.md / CLAUDE.md / MEMORY.md) ----
  r.get('/api/project-memory', (c) => sendJson(c.res, 200,
    s.projectMemory.list().map((m) => ({ path: m.path, scope: m.scope, depth: m.depth, bytes: m.body.length }))));
  r.post('/api/project-memory/reload', async (c) => {
    await s.projectMemory.load();
    sendJson(c.res, 200, { ok: true, count: s.projectMemory.list().length });
  });

  // ---- slash ----
  r.get('/api/slash', (c) => sendJson(c.res, 200,
    s.slash.list().map((cmd) => ({ name: cmd.name, description: cmd.description, source: cmd.source }))));
  r.post('/api/slash/reload', async (c) => {
    await s.slash.loadUser();
    sendJson(c.res, 200, { ok: true, count: s.slash.list().length });
  });

  // ---- providers ----
  r.get('/api/providers', (c) => sendJson(c.res, 200, s.providers.list()));
  // 内部端点：返回完整 provider 配置（含明文 apiKey），仅供本机 syncToCloud 使用
  r.get('/api/providers/raw', (c) => {
    const cfg = s.providers.getConfig();
    sendJson(c.res, 200, cfg);
  });
  r.post('/api/providers', async (c) => {
    try {
      const body = (await readBody(c.req)) as Partial<ProviderProfile> & { name: string; baseUrl: string };
      if (!body?.name || typeof body.baseUrl !== 'string') return sendJson(c.res, 400, { error: 'name and baseUrl required' });
      sendJson(c.res, 200, await s.providers.upsert(body));
    } catch (e: any) { sendJson(c.res, 400, { error: e?.message ?? String(e) }); }
  });
  r.delete('/api/providers/:id', async (c) => {
    try { await s.providers.remove(c.params.id); sendJson(c.res, 200, { ok: true }); }
    catch (e: any) { sendJson(c.res, 400, { error: e?.message ?? String(e) }); }
  });
  r.post('/api/providers/active', async (c) => {
    try {
      const body = await readBody(c.req);
      if (!body?.role) return sendJson(c.res, 400, { error: 'role required' });
      await s.providers.setActive(body.role, body.id);
      sendJson(c.res, 200, s.providers.list());
    } catch (e: any) { sendJson(c.res, 400, { error: e?.message ?? String(e) }); }
  });
  r.post('/api/providers/fallbacks', async (c) => {
    try {
      const body = await readBody(c.req);
      if (!body?.role || !Array.isArray(body.ids)) return sendJson(c.res, 400, { error: 'role and ids required' });
      await s.providers.setFallbacks(body.role, body.ids);
      sendJson(c.res, 200, s.providers.list());
    } catch (e: any) { sendJson(c.res, 400, { error: e?.message ?? String(e) }); }
  });
  r.post('/api/providers/test', async (c) => {
    try {
      const body = await readBody(c.req);
      const profile = s.providers.get(body.id);
      if (!profile) return sendJson(c.res, 404, { error: 'profile not found' });
      const provider = createProvider(profile);
      const t0 = Date.now(); let first = 0; let text = '';
      for await (const chunk of provider.chatStream(
        [{ role: 'user', content: 'Reply with exactly: OK' }],
        { temperature: 0, model: profile.model },
      )) {
        if (chunk.delta) {
          if (!first) first = Date.now() - t0;
          text += chunk.delta;
          if (text.length > 32) break;
        }
        if (chunk.done) break;
      }
      sendJson(c.res, 200, { ok: true, firstTokenMs: first, totalMs: Date.now() - t0, sample: text.slice(0, 64) });
    } catch (e: any) { sendJson(c.res, 500, { ok: false, error: e?.message ?? String(e) }); }
  });

  // ---- sessions ----
  r.get('/api/sessions', (c) => {
    const url = new URL(c.req.url ?? '/', 'http://x');
    const mode = url.searchParams.get('mode') as 'work' | 'code' | null;
    const ws = url.searchParams.get('workspace');
    const remote = url.searchParams.get('remote');  // 'true' | 'false' | null
    let list = s.sessions.list();
    if (mode) list = list.filter((x) => (x.mode ?? 'code') === mode);
    if (ws) list = list.filter((x) => x.workspaceRoot === ws);
    if (remote === 'true') list = list.filter((x) => !!x.remoteUser);
    if (remote === 'false') list = list.filter((x) => !x.remoteUser);
    sendJson(c.res, 200, list);
  });
  r.get('/api/sessions/:id', (c) => {
    const sess = s.sessions.get(c.params.id);
    if (!sess) return sendJson(c.res, 404, { error: 'not found' });
    sendJson(c.res, 200, { meta: sess.meta, messages: sess.messages });
  });
  r.post('/api/sessions', async (c) => {
    const body = await readBody(c.req);
    const mode = body?.mode === 'work' ? 'work' : body?.mode === 'code' ? 'code' : undefined;
    const workspaceRoot =
      mode === 'code' ? (body?.workspaceRoot ?? s.workspace) : body?.workspaceRoot;
    sendJson(
      c.res,
      200,
      await s.sessions.create({
        title: body?.title,
        mode,
        workspaceRoot,
        remoteUser: body?.remoteUser,
      }),
    );
  });
  r.patch('/api/sessions/:id', async (c) => {
    try {
      const body = await readBody(c.req);
      sendJson(c.res, 200, await s.sessions.rename(c.params.id, String(body?.title ?? '')));
    } catch (e: any) { sendJson(c.res, 404, { error: e?.message ?? String(e) }); }
  });
  r.delete('/api/sessions/:id', async (c) => {
    await s.sessions.delete(c.params.id);
    sendJson(c.res, 200, { ok: true });
  });
  r.post('/api/sessions/:id/fork', async (c) => {
    try {
      const body = await readBody(c.req);
      sendJson(c.res, 200, await s.sessions.fork(c.params.id, Number(body?.untilIndex ?? -1), body?.title));
    } catch (e: any) { sendJson(c.res, 400, { error: e?.message ?? String(e) }); }
  });
  r.get('/api/sessions/:id/resume-info', (c) => {
    const sess = s.sessions.get(c.params.id);
    if (!sess) return sendJson(c.res, 404, { error: 'not found' });
    const it = sess.meta.interruptedTurn;
    if (!it) return sendJson(c.res, 200, { interrupted: false });
    const hint = `[RESUME] 上一次对话在执行中被中断。你已经输出了以下部分内容：\n\n----- 已输出（截断）-----\n${it.partialAssistant.slice(-2000)}\n----- 已输出结束 -----\n\n原始任务："${it.userMessage}"\n\n请继续完成这个任务。`;
    sendJson(c.res, 200, {
      interrupted: true, turnId: it.turnId, originalUserMessage: it.userMessage,
      partialAssistant: it.partialAssistant, startedAt: it.startedAt,
      suggestedResumePrompt: hint, history: sess.messages,
    });
  });
  r.post('/api/sessions/:id/resume-discard', async (c) => {
    const sess = s.sessions.get(c.params.id);
    if (!sess) return sendJson(c.res, 404, { error: 'not found' });
    if (sess.meta.interruptedTurn) {
      await s.sessions.interruptTurn(c.params.id, sess.meta.interruptedTurn.turnId, 'user_discard').catch(() => undefined);
      sess.meta.interruptedTurn = undefined;
    }
    sendJson(c.res, 200, { ok: true });
  });

  // ---- remote (WeChat / 其它远程通道) ----
  // 为 mci-remote 桥接进程预留的 API 命名空间。和现有 /api/* 物理隔离，
  // 但底层共用 SessionStore / agent runner。
  r.post('/api/remote/sessions', async (c) => {
    try {
      const body = await readBody(c.req);
      const wxUserId = String(body?.wxUserId ?? '').trim();
      if (!wxUserId) return sendJson(c.res, 400, { error: 'wxUserId required' });
      const meta = await s.sessions.findOrCreateForRemote(wxUserId, {
        title: body?.title,
        workspace: body?.workspace ?? s.workspace,
      });
      sendJson(c.res, 200, meta);
    } catch (e: any) {
      sendJson(c.res, 500, { error: e?.message ?? String(e) });
    }
  });
  r.get('/api/remote/sessions', (c) => {
    const url = new URL(c.req.url ?? '/', 'http://x');
    const wxUserId = url.searchParams.get('wxUserId');
    let list = s.sessions.list().filter((x) => !!x.remoteUser);
    if (wxUserId) list = list.filter((x) => x.remoteUser === wxUserId);
    sendJson(c.res, 200, list);
  });

  // ---- skills ----
  r.get('/api/skills', (c) => sendJson(c.res, 200,
    s.skills.list().map((sk) => ({ name: sk.name, description: sk.description, source: sk.source, userInvocable: sk.userInvocable }))));
  r.get('/api/skills/:name', async (c) => {
    const f = await s.skills.loadFull(c.params.name);
    if (!f) return sendJson(c.res, 404, { error: 'not found' });
    sendJson(c.res, 200, {
      name: f.name, description: f.description, source: f.source,
      directory: f.directory, supportFiles: f.supportFiles, body: f.body,
    });
  });
  r.post('/api/skills/reload', async (c) => {
    await s.skills.load();
    sendJson(c.res, 200, { ok: true, count: s.skills.list().length });
  });

  // ---- MCP status / config / reconnect ----
  r.get('/api/mcp/status', (c) => {
    const mgr = s.mcpManager;
    if (!mgr) return sendJson(c.res, 200, { servers: [] });
    sendJson(c.res, 200, {
      servers: mgr.list().map((cl: any) => ({
        name: cl.name,
        connected: cl.connected,
        tools: cl.tools.map((t: any) => t.name),
      })),
    });
  });
  r.get('/api/mcp/config', async (c) => {
    try {
      const cfgPath = path.join(s.workspace, '.minicodeide', 'mcp.json');
      let raw = '';
      let exists = false;
      try {
        raw = await fs.readFile(cfgPath, 'utf-8');
        exists = true;
      } catch {
        try {
          const ex = path.join(s.workspace, '.minicodeide', 'mcp.example.json');
          raw = await fs.readFile(ex, 'utf-8');
        } catch {
          raw = JSON.stringify({ servers: {} }, null, 2);
        }
      }
      sendJson(c.res, 200, { exists, content: raw, path: cfgPath });
    } catch (e: any) { sendJson(c.res, 500, { error: e?.message ?? String(e) }); }
  });
  r.put('/api/mcp/config', async (c) => {
    try {
      const body = await readBody(c.req);
      const content = (body?.content ?? '') as string;
      try { JSON.parse(content); } catch (e: any) {
        return sendJson(c.res, 400, { error: `invalid JSON: ${e?.message}` });
      }
      const dir = path.join(s.workspace, '.minicodeide');
      await fs.mkdir(dir, { recursive: true });
      const cfgPath = path.join(dir, 'mcp.json');
      await fs.writeFile(cfgPath, content, 'utf-8');
      sendJson(c.res, 200, { ok: true, path: cfgPath, hint: 'Restart server to apply MCP changes (or POST /api/mcp/reconnect).' });
    } catch (e: any) { sendJson(c.res, 500, { error: e?.message ?? String(e) }); }
  });
  r.post('/api/mcp/reconnect', async (c) => {
    try {
      const mgr = s.mcpManager;
      if (!mgr) return sendJson(c.res, 200, { ok: true, results: [], hint: 'MCP not initialized' });
      await mgr.closeAll();
      const results = await mgr.loadAndConnect();
      mgr.registerToolsTo(s.registry);
      sendJson(c.res, 200, { ok: true, results });
    } catch (e: any) { sendJson(c.res, 500, { error: e?.message ?? String(e) }); }
  });

  // ---- subagents ----
  r.get('/api/subagents', (c) => sendJson(c.res, 200, s.subagents.list(c.query.parent || undefined)));

  // ---- mentions ----
  r.get('/api/mentions/suggest', async (c) => {
    const q = c.query.q ?? '';
    const m = q.match(/^(file|symbol|docs|selection|web):(.*)$/);
    if (!m) return sendJson(c.res, 200, { items: [] });
    const kind = m[1]; const arg = m[2].toLowerCase();
    const items: { kind: string; label: string; insert: string; hint?: string }[] = [];
    try {
      if (kind === 'file' || kind === 'selection') {
        if (s.index) {
          const collected: { path: string; score: number }[] = [];
          for (const p of s.index.symbols.allFiles()) {
            if (!arg) collected.push({ path: p, score: 0 });
            else {
              const idx = p.toLowerCase().indexOf(arg);
              if (idx >= 0) {
                const base = p.split('/').pop()!.toLowerCase();
                const inBase = base.includes(arg) ? 1000 : 0;
                collected.push({ path: p, score: inBase + (-idx) + (-Math.min(p.length, 100)) });
              }
            }
          }
          collected.sort((a, b) => b.score - a.score);
          for (const cc of collected.slice(0, 20))
            items.push({ kind, label: cc.path, insert: `@${kind}:${cc.path}` });
        }
      } else if (kind === 'symbol') {
        if (s.index)
          for (const sym of s.index.symbols.fuzzyFind(arg, 20))
            items.push({ kind, label: `${sym.name} · ${sym.path}:${sym.startLine}`, insert: `@symbol:${sym.name}`, hint: sym.kind });
      } else if (kind === 'docs') {
        try {
          const dir = path.join(s.workspace, 'docs');
          for (const f of await fs.readdir(dir)) {
            if (!f.endsWith('.md')) continue;
            const name = f.replace(/\.md$/, '');
            if (!arg || name.toLowerCase().includes(arg))
              items.push({ kind, label: `docs/${f}`, insert: `@docs:${name}` });
          }
        } catch { /* */ }
      }
    } catch (e: any) { return sendJson(c.res, 500, { error: e?.message ?? String(e) }); }
    sendJson(c.res, 200, { items: items.slice(0, 30) });
  });

  // ---- git ----
  r.get('/api/git/status', async (c) => {
    if (!(await isGitRepo(s.workspace))) return sendJson(c.res, 200, { isRepo: false });
    try {
      const [status, branch] = await Promise.all([gitStatus(s.workspace), gitBranch(s.workspace)]);
      sendJson(c.res, 200, { isRepo: true, branch, files: status });
    } catch (e: any) { sendJson(c.res, 500, { error: e?.message ?? String(e) }); }
  });
  r.get('/api/git/diff', async (c) => {
    if (!(await isGitRepo(s.workspace))) return sendJson(c.res, 200, { isRepo: false, diff: '' });
    try {
      const diff = await gitDiff(s.workspace, { path: c.query.path || undefined, staged: c.query.staged === '1' });
      sendText(c.res, 200, diff);
    } catch (e: any) { sendJson(c.res, 500, { error: e?.message ?? String(e) }); }
  });
  r.get('/api/git/log', async (c) => {
    if (!(await isGitRepo(s.workspace))) return sendJson(c.res, 200, []);
    try {
      const n = Math.min(Number(c.query.n ?? 20), 100);
      sendJson(c.res, 200, await gitLog(s.workspace, n));
    } catch (e: any) { sendJson(c.res, 500, { error: e?.message ?? String(e) }); }
  });
  r.post('/api/git/generate-message', async (c) => {
    if (!(await isGitRepo(s.workspace))) return sendJson(c.res, 400, { error: 'not a git repo' });
    const body = await readBody(c.req);
    const paths: string[] = body?.paths ?? [];
    try {
      let diff = '';
      if (paths.length) for (const p of paths) diff += await gitDiff(s.workspace, { path: p });
      else diff = (await gitDiff(s.workspace, { staged: true })) + '\n' + (await gitDiff(s.workspace, {}));
      if (!diff.trim()) return sendJson(c.res, 200, { message: '', reason: 'no changes detected' });
      const truncated = diff.length > 12000 ? diff.slice(0, 12000) + '\n... (truncated)' : diff;
      const sys = 'You are a commit message generator. Given a unified diff, write ONE conventional commit message:\n  - First line: <type>(<scope>): <subject> (<= 72 chars; type ∈ feat|fix|docs|refactor|chore|test|perf|style|ci)\n  - Optional body: 2-5 bullet lines starting with "- " explaining what & why (not how)\nNo fences, no quotes, no extra prose. Output ONLY the message.';
      let out = '';
      for await (const chunk of s.llmComplete.chatStream(
        [{ role: 'system', content: sys }, { role: 'user', content: '### Diff\n' + truncated }],
        { temperature: 0.2 },
      )) {
        if (chunk.delta) out += chunk.delta;
        if (chunk.done || chunk.finishReason) break;
      }
      sendJson(c.res, 200, { message: out.trim() });
    } catch (e: any) { sendJson(c.res, 500, { error: e?.message ?? String(e) }); }
  });
  r.post('/api/git/commit', async (c) => {
    if (!(await isGitRepo(s.workspace))) return sendJson(c.res, 400, { error: 'not a git repo' });
    const body = await readBody(c.req);
    const { message, paths = [] } = body as { message: string; paths?: string[] };
    if (!message?.trim()) return sendJson(c.res, 400, { error: 'message required' });
    try { sendJson(c.res, 200, { ok: true, ...(await gitCommit(s.workspace, message, paths)) }); }
    catch (e: any) { sendJson(c.res, 500, { error: e?.message ?? String(e) }); }
  });

  // ---- chat (SSE) ----
  r.post('/api/chat', async (c) => {
    const body = (await readBody(c.req, { limit: 10 * 1024 * 1024 })) ?? {};
    const { messages = [], userMessage: rawUserMessage,
      mode = 'agent', sessionId: rawSessionId,
      images = [],
    } = body as {
      messages: ChatMessage[]; userMessage: string;
      mode?: 'ask' | 'agent'; sessionId?: string;
      images?: Array<{ type: 'image'; media_type: string; data: string }>;
    };
    const persistSession = rawSessionId && s.sessions.get(rawSessionId);
    const chatSessionId = rawSessionId ||
      `anon:${(c.req.headers['x-forwarded-for'] as string) ?? c.req.socket.remoteAddress ?? 'local'}`;

    // Slash command 预处理
    let userMessage = rawUserMessage;
    let slashName: string | null = null;
    const slashed = s.slash.maybeExpand(rawUserMessage);
    if (slashed) { userMessage = slashed.expanded; slashName = slashed.command; }

    // manual rule
    const manualRules: string[] = [];
    userMessage = userMessage.replace(/@rule:([\w-]+)/g, (_m, n) => { manualRules.push(n); return ''; }).trim();

    // mentions
    const mentionResult = await parseMentions(userMessage, { workspace: s.workspace, index: s.index });
    userMessage = mentionResult.cleanText || userMessage;
    const explicitContext = mentionResult.items;

    const sse = openSse(c.req, c.res);
    if (slashName) sse.send({ type: 'slash', command: slashName });
    if (mentionResult.items.length || mentionResult.unresolved.length) {
      sse.send({
        type: 'mentions',
        resolved: mentionResult.items.map((i) => ({ type: i.type, label: i.label })),
        unresolved: mentionResult.unresolved,
      });
    }
    for (const it of mentionResult.items)
      if (it.type === 'file' && it.label)
        s.recentActivity.record(chatSessionId, { kind: 'view', target: it.label });

    let currentTurnId: string | null = null;
    if (persistSession) {
      await s.sessions.append(rawSessionId!, { role: 'user', content: rawUserMessage ?? '' }).catch(() => undefined);
      currentTurnId = await s.sessions.startTurn(rawSessionId!, rawUserMessage ?? '').catch(() => null as any);
    }

    let assistantBuf = '';
    let userAbort = false;

    const autoCtx = s.index
      ? (await hybridRetrieve(s.index, s.embedder, userMessage, 6, s.reranker)).map((h) => ({
          file: `${h.path}:${h.startLine}-${h.endLine}`, text: h.text,
        }))
      : [];
    if (autoCtx.length) {
      sse.send({
        type: 'retrieval', query: userMessage.slice(0, 200),
        hits: autoCtx.map((cc, i) => ({ rank: i + 1, file: cc.file })),
      });
    }
    for (const cc of autoCtx.slice(0, 3)) {
      const f = cc.file.split(':')[0];
      if (f) s.recentActivity.record(chatSessionId, { kind: 'read', target: f });
    }

    const touched = autoCtx.map((cc) => cc.file.split(':')[0]);
    const activeRules = s.rules.pickForRequest({ userMessage, touchedPaths: touched, manual: manualRules });
    const ruleExtra = s.rules.renderForSystem(activeRules);
    if (activeRules.length) sse.send({ type: 'rules', activated: activeRules.map((rl) => rl.name) });

    const chatProfile = s.providers.getActive('chat');
    const chatModel = chatProfile?.model;

    const llmSummarize = async (middle: ChatMessage[]) => {
      const sys = 'You are a compaction assistant. Summarize the following conversation excerpt for context preservation.\nPreserve: file paths, commands, errors, decisions, TODOs, open questions.\nDo NOT copy raw tool outputs or large logs. Output a concise paragraph (max 400 tokens).';
      const userBlock = middle.map((m) => `[${m.role}] ${(m.content ?? '').toString().slice(0, 1000)}`).join('\n');
      let out = '';
      for await (const chunk of s.llmComplete.chatStream(
        [{ role: 'system', content: sys }, { role: 'user', content: userBlock }],
        { model: s.providers.getActive('complete')?.model },
      )) {
        if (chunk.delta) out += chunk.delta;
        if (chunk.done || chunk.finishReason) break;
      }
      return out.trim() || '(empty summary)';
    };

    const initial = await buildMessages({
      userMessage, history: messages, autoContext: autoCtx, explicitContext,
      memory: s.memory,
      meta: { cwd: s.workspace, os: `${os.platform()} ${os.release()}` },
      images,
      systemExtras: [
        s.projectMemory.renderForSystem(),
        s.skills.renderForSystem(),
        ruleExtra,
        detectMultiStepHint(userMessage),
        s.recentActivity.render(chatSessionId),
      ].filter(Boolean) as string[],
      providerFlavor:
        chatProfile?.kind === 'anthropic' ? 'anthropic' :
        chatProfile?.kind === 'openai' ? 'openai' :
        /gemini/i.test(chatProfile?.model ?? '') ? 'gemini' :
        'generic',
      injectionCache: s.injectionCache,
      sessionId: chatSessionId,
      compaction: { model: chatModel, summarize: llmSummarize },
      onMemoryRecalled: (items) => { if (items.length) sse.send({ type: 'memory_recalled', items }); },
    });

    const compactDbg = (initial as any).__compactDebug;
    if (compactDbg) sse.send({ type: 'context_stats', ...compactDbg });

    try {
      const abort = new AbortController();
      c.req.on('close', () => { userAbort = true; abort.abort(); });

      const llmRouted = s.buildLlmFor('chat', (info) => sse.send({ type: 'provider_switch', ...info }));

      if (mode === 'ask') {
        const noToolRegistry = new ToolRegistry();
        for await (const ev of runAgent({
          llm: llmRouted, registry: noToolRegistry, messages: initial,
          toolCtx: { cwd: s.workspace }, signal: abort.signal, maxSteps: 1,
        })) {
          if (ev.type === 'text' && ev.text) {
            assistantBuf += ev.text;
            if (persistSession && currentTurnId)
              s.sessions.appendChunk(rawSessionId!, currentTurnId, ev.text).catch(() => undefined);
          }
          sse.send(ev);
        }
      } else {
        for await (const ev of runAgent({
          llm: llmRouted, registry: s.registry, messages: initial,
          toolCtx: {
            cwd: s.workspace,
            approve: async (info) => {
              // 走 ApprovalsStore，前端通过 /api/approve/:id 决议
              const id = `appr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
              const p = new Promise<'allow' | 'deny'>((resolve) => {
                (s.approvals as any).waiting.set(id, { id, cmd: info.tool, ts: Date.now(), resolver: resolve });
              });
              sse.send({ type: 'approve_request', id, tool: info.tool, args: info.args });
              return (await p) === 'allow';
            },
            execPolicy: (cmd) => decideCommand(cmd),
            proposeEdit: async (req) => {
              const e = await s.pendingEdits.propose(req);
              sse.send({ type: 'pending_edit', edit: e });
              return { id: e.id };
            },
            virtualRead: (p) => s.pendingEdits.virtualRead(p),
            updatePlan: (plan) => sse.send({ type: 'plan', plan }),
            codeIntel: {
              findSymbol: async (q, limit) => s.index ? s.index.symbols.fuzzyFind(q, limit ?? 15) : [],
              findReferences: async (name) => s.index ? s.index.symbols.findReferences(name) : [],
              semanticSearch: async (q, k) => s.index ? hybridRetrieve(s.index, s.embedder, q, k ?? 8, s.reranker) : [],
              listFileSymbols: async (p) => s.index ? s.index.symbols.symbolsInFile(p) : [],
            },
            skills: {
              list: () => s.skills.list().map((sk) => ({ name: sk.name, description: sk.description, source: sk.source })),
              loadFull: async (name) => {
                const f = await s.skills.loadFull(name);
                if (!f) return null;
                return { name: f.name, description: f.description, body: f.body, directory: f.directory, supportFiles: f.supportFiles };
              },
            },
            subagentDepth: 0,
            dispatchSubagent: async (req) => {
              const rr = await s.subagents.spawn({
                task: req.task, label: req.label, role: req.role,
                parentSessionId: rawSessionId ?? 'no-session',
                parentTurnId: currentTurnId ?? undefined,
                parentDepth: 0,
              });
              sse.send({
                type: 'subagent_spawned', runId: rr.runId, childSessionId: rr.childSessionId,
                label: req.label, role: req.role, task: req.task,
              });
              return rr;
            },
          },
          signal: abort.signal,
          toolDescSubstitutions: {
            roles: (() => {
              const names = s.subagents.getProfileNames();
              if (!names.length) return '(no role profiles found in .minicodeide/agents/)';
              return names.map((p) => `${p.name}${p.description ? ` (${p.description})` : ''}`).join('; ');
            })(),
          },
        })) {
          if (ev.type === 'text' && ev.text) {
            assistantBuf += ev.text;
            if (persistSession && currentTurnId)
              s.sessions.appendChunk(rawSessionId!, currentTurnId, ev.text).catch(() => undefined);
          }
          if (ev.type === 'tool_call' && persistSession && currentTurnId) {
            s.sessions.appendTool(rawSessionId!, currentTurnId, {
              name: (ev as any).name, args: (ev as any).args,
              result: (ev as any).result, error: (ev as any).error,
            }).catch(() => undefined);
          }
          if (ev.type === 'tool_call') {
            const name = (ev as any).name as string | undefined;
            const args = (ev as any).args as any;
            if (name && args) {
              if ((name === 'edit_file' || name === 'write_file') && args.path)
                s.recentActivity.record(chatSessionId, { kind: 'edit', target: args.path });
              else if (name === 'read_file' && args.path)
                s.recentActivity.record(chatSessionId, { kind: 'read', target: args.path });
              else if (name === 'grep_search' && args.regex)
                s.recentActivity.record(chatSessionId, { kind: 'search', target: args.regex });
            }
          }
          sse.send(ev);
        }
      }
    } catch (e: any) {
      sse.send({ type: 'error', error: e?.message ?? String(e) });
      if (persistSession && currentTurnId)
        await s.sessions.interruptTurn(rawSessionId!, currentTurnId, e?.message ?? String(e)).catch(() => undefined);
    } finally {
      if (rawSessionId) {
        try { await s.subagents.awaitAllForParent(rawSessionId, 60_000); } catch { /* */ }
        const pending = s.subagents.pickPendingAnnouncements(rawSessionId);
        for (const ann of pending) sse.send({ type: 'subagent_announce', message: ann });
      }
      if (persistSession && currentTurnId) {
        if (userAbort)
          await s.sessions.interruptTurn(rawSessionId!, currentTurnId, 'user_stop').catch(() => undefined);
        else
          await s.sessions.endTurn(rawSessionId!, currentTurnId, assistantBuf).catch(() => undefined);
      }
      if (!userAbort && assistantBuf.length > 0 && (s.llmFast ?? s.llmChat)) {
        considerAutoMemory({
          llm: s.llmFast ?? s.llmChat, memory: s.memory,
          userMessage: rawUserMessage ?? '', assistantReply: assistantBuf,
          sessionId: chatSessionId,
          model: s.providers.getActive('fast')?.model ?? s.providers.getActive('chat')?.model,
          workspace: s.workspace,
          onSaved: (it) => { try { sse.send({ type: 'memory_saved', title: it.title, category: it.category, scope: it.scope }); } catch { /* */ } },
        }).catch(() => undefined);
      }
      sse.send({ type: 'done' });
      sse.end();
    }
  });
}