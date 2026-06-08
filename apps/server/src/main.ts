
/**
 * MiniCodeIDE Server 入口（HTTP + WebSocket）
 * ----------------------------------------------------------------
 * 职责：
 *  1. 提供编辑器需要的文件系统 API（/api/tree、/api/file）
 *  2. 提供索引/检索 API（/api/symbols、/api/semantic-search、/api/hybrid-search、/api/references）
 *  3. 提供 AI Chat（/api/chat SSE）与 Inline Complete（/api/complete）
 *  4. 提供 Pending Edits、Checkpoints、Rules、Slash、Providers 的 REST 端点
 *  5. 通过 chokidar 监听工作区，增量更新三层索引（BM25 / SymbolGraph / Vectors）
 *  6. WebSocket 转发到 typescript-language-server 提供 LSP 能力
 *
 * 关键设计：
 *  - LLM/Embedder 实例**根据 ProviderStore 当前 active 动态重建**，无需重启切换 provider
 *  - 所有写文件类的 Agent 工具都经过 PendingEditStore 走"提议 → 用户审核 → 落盘 → checkpoint"
 *  - Agent 循环支持 parallel tool calls（在 packages/core 里）
 */
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import {
  authMiddleware,
  rateLimitMiddleware,
  chatRateLimitMiddleware,
  metricsMiddleware,
  requestLogMiddleware,
  snapshot as metricsSnapshot,
  sseTrack,
  logger,
  printStartupBanner,
} from './middleware.js';
import {
  OpenAICompatProvider,
  ToolRegistry,
  registerBuiltinTools,
  runAgent,
  buildMessages,
  MemoryStore,
  InjectionCache,
  considerAutoMemory,
  RecentActivityTracker,
  callStructured,
  HookBus,
  type ChatMessage,
  type LLMProvider,
} from '@mini/core';
import {
  buildIndex,
  createEmbedder,
  type CodebaseIndex,
} from '@mini/indexer';
import { PendingEditStore } from './pending-edit.js';
import { CheckpointStore } from './checkpoint.js';
import { attachLspBridge } from './lsp-bridge.js';
import { attachTerminalBridge } from './terminal-bridge.js';
import { hybridRetrieve } from './retrieval.js';
import { buildReranker, type Reranker } from './reranker.js';
import { RulesStore } from './rules.js';
import { ProjectMemoryStore } from './project-memory.js';
import { VerifyAfterAcceptStore } from './verify-after-accept.js';
import { SlashCommandRegistry } from './slash-commands.js';
import { ProviderStore, type ProviderProfile } from './providers.js';
import { IndexWatcher } from './watcher.js';
import { SessionStore } from './session-store.js';
import { SkillStore } from './skill-store.js';
import { SubagentManager } from './subagent-manager.js';
import { permissionAwareDecide } from './permission-aware-policy.js';
import { LLMRouter, createProvider } from './llm-router.js';
import { parseMentions } from './mentions.js';
import {
  isGitRepo,
  gitStatus,
  gitDiff,
  gitBranch,
  gitLog,
  gitCommit,
} from './git-helpers.js';
import { createSystemHookBus } from './system-hooks.js';
import { BackgroundTaskManager } from './bg-tasks.js';
import { McpManager } from './mcp-client.js';
import { WorktreeManager } from './worktree-manager.js';

const PORT = Number(process.env.PORT ?? 5174);
const WORKSPACE = process.env.WORKSPACE
  ? path.resolve(process.env.WORKSPACE)
  : process.cwd();

console.log(`[server] workspace = ${WORKSPACE}`);

// ----- Providers ----------------------------------
const providers = new ProviderStore(WORKSPACE);
await providers.load();
console.log(`[providers] ${providers.list().profiles.length} profiles loaded`);

/**
 * 构造某个 role 的 LLM。
 * 内部用 LLMRouter：拿到 [primary, ...fallbacks] profile 链，按顺序尝试。
 * onSwitch 可选 —— 没传就静默切换（用于 inline complete 等无 SSE 场景）。
 */
/**
 * 检测 user message 是否包含多步骤意图，如是则返回一段 dynamic system hint，
 * 提示 LLM 在开始之前先调 update_plan。
 *
 * 触发关键词（覆盖最常见的中英文模式）：
 *   - 列表：1) 2) / A. B. / 先…再… / then / and then
 *   - 量词：all / every / 所有 / 全部 / 批量 / each
 *   - 并行意图："分别" / "parallel" / "同时"
 *   - 多文件意图：message 里提到 3 个以上独立文件路径
 */
function detectMultiStepHint(userMessage: string): string | null {
  const patterns = [
    /\b(all|every|each)\b.*\b(file|function|class|method)\b/i,
    /(\d+[.)]\s+.+){2,}/,           // "1. xxx  2. xxx"
    /\b(then|and then|after that|next)\b/i,
    /先.{2,20}再.{2,20}/,           // 先…再…
    /分别|并行|同时|批量|全部|所有/,
    /parallel|simultaneously/i,
  ];
  const isMultiStep = patterns.some((p) => p.test(userMessage));
  // 文件路径数量（出现 3+ 个 .ext 形式的文件引用）
  const pathMatches = userMessage.match(/\b[\w\/.-]+\.\w{1,6}\b/g) ?? [];
  const uniquePaths = new Set(pathMatches);
  const hasMultiFile = uniquePaths.size >= 3;

  if (!isMultiStep && !hasMultiFile) return null;

  return (
    '\n[context] This user message appears to involve multiple steps or files. ' +
    'IMPORTANT: Before executing, call `update_plan` to list all steps with status=pending, ' +
    'set the first step to in_progress, then execute. ' +
    'Update after each step. This improves transparency and prevents drift.'
  );
}

function buildLlmFor(
  role: 'chat' | 'complete' | 'fast' = 'chat',
  onSwitch?: (info: any) => void,
): LLMProvider {
  const chain = providers.getRoleChain(role);
  if (chain.length === 0) {
    // 没有任何 profile 配置：返回一个 mock provider（旧行为，避免崩）
    return new OpenAICompatProvider({
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: 'sk-mock',
      defaultModel: 'deepseek-chat',
      embedModel: 'text-embedding-3-small',
    });
  }
  return new LLMRouter({
    profiles: chain,
    onSwitch,
  });
}

function buildEmbedderFor() {
  const p = providers.getActive('embed');
  if (!p || p.hash) {
    return createEmbedder({ provider: 'hash' });
  }
  return createEmbedder({
    provider: 'openai',
    baseUrl: p.baseUrl,
    apiKey: p.apiKey,
    model: p.embedModel ?? 'text-embedding-3-small',
    dim: p.embedDim,
  });
}

// 当前生效的实例（providers 变更时重建）
let llmChat = buildLlmFor('chat');
let llmComplete = buildLlmFor('complete');
let llmFast = buildLlmFor('fast');
let embedder = buildEmbedderFor();
let reranker: Reranker = buildReranker(); // 由 RERANKER env 控制；默认 identity（无影响）
let vectorPath = path.join(
  WORKSPACE,
  '.minicodeide',
  `vectors.${embedder.name.replace(/[^a-z0-9]+/gi, '_')}.jsonl`,
);

providers.onChange = () => {
  llmChat = buildLlmFor('chat');
  llmComplete = buildLlmFor('complete');
  llmFast = buildLlmFor('fast');
  const oldName = embedder.name;
  embedder = buildEmbedderFor();
  if (embedder.name !== oldName) {
    vectorPath = path.join(
      WORKSPACE,
      '.minicodeide',
      `vectors.${embedder.name.replace(/[^a-z0-9]+/gi, '_')}.jsonl`,
    );
    // 重置索引让下次自动重建
    index = null;
    console.log(`[providers] embedder changed → ${embedder.name}; index will rebuild on demand`);
    ensureIndex();
  } else {
    console.log('[providers] rebuilt llm/embedder instances');
  }
  // 同步切换 memory embedder
  memory.setEmbedder(buildMemoryEmbedder());
};

/**
 * 包装 indexer.Embedder（Float32Array[]）为 MemoryEmbedder（number[][]）。
 * 用于给 MemoryStore 注入语义召回能力。
 */
function buildMemoryEmbedder() {
  const emb = embedder;
  return {
    name: emb.name,
    async embed(texts: string[]): Promise<number[][]> {
      const vecs = await emb.embed(texts);
      return vecs.map((v) => Array.from(v));
    },
  };
}

const memory = new MemoryStore({
  projectPath: WORKSPACE,
  embedder: buildMemoryEmbedder(),
});
/**
 * 全局 InjectionCache：所有 chat 请求共享，按 sessionId 内部分桶。
 * 作用：同一会话里反复 recall 出的同一条 memory / context chunk 不再重复注入。
 * 详见 packages/core/src/context/injection-cache.ts。
 */
const injectionCache = new InjectionCache({ perSessionCap: 100, maxSessions: 64 });

/**
 * RecentActivityTracker：跨 turn 记录用户的"最近活动"（edit/read/search/view），
 * 召回时拼成 system 提示注入，让 LLM 理解"刚才那个 bug"/"这个文件"等指代。
 */
const recentActivity = new RecentActivityTracker({ perSessionCap: 30, ttlMs: 30 * 60 * 1000 });

/**
 * Memory 后台 maintenance：启动时跑一次（清理过老归档 + 去重），随后每 6h 一次。
 * best-effort，失败不影响主流程。
 */
memory.maintain()
  .then((r) => logger.info('[memory] maintain on startup', r))
  .catch((e) => logger.warn('[memory] maintain failed', { err: String(e) }));
const memoryMaintenanceTimer = setInterval(() => {
  memory.maintain()
    .then((r) => logger.info('[memory] maintain scheduled', r))
    .catch((e) => logger.warn('[memory] maintain failed', { err: String(e) }));
}, 6 * 60 * 60 * 1000);
memoryMaintenanceTimer.unref?.();
const registry = new ToolRegistry();
registerBuiltinTools(registry);

const pendingEdits = new PendingEditStore(WORKSPACE);
const checkpoints = new CheckpointStore(WORKSPACE);
await checkpoints.init();

// 系统级 Hook 总线（PreToolUse / PostToolUse / Stop / UserPromptSubmit）
const { bus: hookBus, metrics: hookMetrics } = createSystemHookBus({ checkpoints });
console.log('[hooks] system bus ready');

// 后台任务管理器（run_command run_in_background=true）
const bgTasks = new BackgroundTaskManager({ workspace: WORKSPACE });
console.log('[bg-tasks] manager ready');

// 给所有 SSE 订阅者群发后台任务完成事件（连接到当前 SSE 框架时自然推送；这里仅 emit log）
bgTasks.on('task_complete', (t) => {
  logger.info(`[bg-tasks] ${t.id} ${t.status} (exit=${t.exitCode}) cmd="${t.command}"`);
});

// MCP 客户端：扫 .minicodeide/mcp.json，启动 server 子进程，把工具注册到 registry
const mcpManager = new McpManager(WORKSPACE);
const mcpResults = await mcpManager.loadAndConnect();
if (mcpResults.length) {
  for (const r of mcpResults) {
    if (r.ok) console.log(`[mcp] connected "${r.name}" (${r.toolCount} tools)`);
    else console.warn(`[mcp] failed "${r.name}": ${r.error}`);
  }
  mcpManager.registerToolsTo(registry);
}

const rules = new RulesStore(WORKSPACE);
await rules.load();
console.log(`[rules] loaded ${rules.list().length} rules`);

// Project Memory（AGENTS.md / CLAUDE.md / MEMORY.md，路径冒泡 + 用户级）
const projectMemory = new ProjectMemoryStore(WORKSPACE);
await projectMemory.load();
console.log(
  `[project-memory] loaded ${projectMemory.list().length} memory files (AGENTS.md / CLAUDE.md / MEMORY.md)`,
);

const slash = new SlashCommandRegistry(WORKSPACE);
await slash.loadUser();
console.log(`[slash] loaded ${slash.list().length} commands (builtin + user)`);

// Auto-verify on accept (Claude-Code-style typecheck-after-edit, SWE-bench killer)
const verifyAfterAccept = new VerifyAfterAcceptStore(WORKSPACE);

// Sessions 持久化（jsonl 每会话一个）
const sessions = new SessionStore(WORKSPACE);
await sessions.load();
console.log(`[sessions] loaded ${sessions.list().length} historical sessions`);

// Skills 加载（progressive disclosure；project + user 两层）
const skills = new SkillStore(WORKSPACE);
await skills.load();
console.log(`[skills] loaded ${skills.list().length} skills`);

// Worktree 管理器（subagent 并行写文件时的目录隔离）
const worktrees = new WorktreeManager(WORKSPACE);
const _isGitRepoForWorktree = await worktrees.isGitRepo();
if (_isGitRepoForWorktree) console.log('[worktrees] git repo detected, isolation available');
else console.log('[worktrees] not a git repo, subagents will share workspace');

// Subagent 调度器（单 Agent + 多 Worker 层级模式，push-announce）
const subagents = new SubagentManager({
  // 优先用 fast profile（便宜模型），未配置则用 chat
  llm: () => llmFast ?? llmChat,
  sessions,
  defaultModel: () =>
    providers.getActive('fast')?.model ?? providers.getActive('chat')?.model,
  worktrees: _isGitRepoForWorktree ? worktrees : undefined,
  workspaceRoot: WORKSPACE,
  childToolCtxFactory: () => ({
    cwd: WORKSPACE,
    execPolicy: (cmd) => permissionAwareDecide(cmd, { sandbox: 'read_only', approval: 'unless_trusted' }),
    codeIntel: {
      async findSymbol(q, limit) {
        return index ? index.symbols.fuzzyFind(q, limit ?? 15) : [];
      },
      async findReferences(name) {
        return index ? index.symbols.findReferences(name) : [];
      },
      async semanticSearch(q, k) {
        return index ? hybridRetrieve(index, embedder, q, k ?? 8, reranker) : [];
      },
      async listFileSymbols(p) {
        return index ? index.symbols.symbolsInFile(p) : [];
      },
    },
    skills: {
      list: () =>
        skills.list().map((s) => ({
          name: s.name,
          description: s.description,
          source: s.source,
        })),
      loadFull: async (name) => {
        const f = await skills.loadFull(name);
        if (!f) return null;
        return {
          name: f.name,
          description: f.description,
          body: f.body,
          directory: f.directory,
          supportFiles: f.supportFiles,
        };
      },
    },
  }),
});

// Subagent real-time progress → SSE bridge
subagents.on('child_text', (p) => { /* text events are frequent; skip SSE for now to reduce bandwidth */ });
subagents.on('child_tool', (p) => { /* tool calls already handled via spawned event */ });
subagents.on('child_tool_result', (p) => {
  // 将 subagent tool_result 进度事件广播给所有 SSE 连接
  // 目前暂存到 pendingProgress，在 chat SSE 循环中 flush
  subagentProgressBuffer.push({ ...p, ts: Date.now() });
});

/** 缓存 subagent 进度事件，供 chat SSE flush */
const subagentProgressBuffer: Array<{ runId: string; tool: string; resultPreview: string; ts: number }> = [];

// 任何 accept 前自动 snapshot
pendingEdits.onBeforeWrite = async (edits) => {
  if (!edits.length) return;
  await checkpoints.create({
    label: edits.length === 1 ? `accept ${edits[0].path}` : `accept ${edits.length} files`,
    trigger: edits.length === 1 ? 'accept' : 'accept_all',
    files: edits.map((e) => ({ path: e.path, newContent: e.newContent })),
  });
  await checkpoints.prune(100);
};

let index: CodebaseIndex | null = null;
let indexing = false;

async function ensureIndex() {
  if (index || indexing) return;
  indexing = true;
  console.log(`[indexer] start (embedder=${embedder.name})`);
  try {
    index = await buildIndex(
      WORKSPACE,
      { embedder, vectorPath, reuseVectors: true },
      (p) => {
        if (p.scanned % 100 === 0)
          console.log(`[indexer/${p.phase}] ${p.scanned}/${p.total}`);
      },
    );
    console.log(
      `[indexer] done: ${index.fileCount} files, ${index.chunkCount} chunks, ${index.symbolCount} symbols, vectors=${index.vectors.size()}`,
    );
  } catch (e) {
    console.error('[indexer] failed', e);
  } finally {
    indexing = false;
  }
}
ensureIndex();

// ---- File watcher: 启动增量索引 ----
const watcher = new IndexWatcher({
  root: WORKSPACE,
  index: () => index,
  embedder: () => embedder,
  vectorPath: () => vectorPath,
  onProgress: (m) => console.log(m),
});
watcher.start();

// ----- HTTP -------------------------------------------------------
const app = express();
app.use(cors());
app.use(express.json({ limit: '4mb' }));

// ----- Auth + RateLimit + 日志 + Metrics（P9 部署体系）-----
// 默认全部 disable，行为与之前一致。生产部署通过环境变量启用。详见 docs/DEPLOYMENT.md
app.use(requestLogMiddleware);
app.use(metricsMiddleware);
app.use(rateLimitMiddleware);
app.use(authMiddleware);

// ----- Health / Metrics 端点（bypass auth）-----
app.get('/health', (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    indexReady: !!index,
    workspace: WORKSPACE,
    ts: Date.now(),
  });
});
app.get('/api/version', (_req, res) => {
  res.json({
    version: process.env.npm_package_version ?? '0.0.0-dev',
    node: process.version,
    platform: `${os.platform()} ${os.arch()}`,
  });
});
app.get('/api/metrics', (_req, res) => {
  res.json(metricsSnapshot());
});

app.get('/api/hooks/metrics', (_req, res) => {
  res.json({ tools: hookMetrics.snapshot(), hooks: {
    UserPromptSubmit: hookBus.list('UserPromptSubmit'),
    PreToolUse: hookBus.list('PreToolUse'),
    PostToolUse: hookBus.list('PostToolUse'),
    Stop: hookBus.list('Stop'),
  }});
});

app.get('/api/mcp/status', (_req, res) => {
  res.json({
    servers: mcpManager.list().map((c) => ({
      name: c.name,
      connected: c.connected,
      tools: c.tools.map((t) => t.name),
    })),
  });
});

// ---- MCP 配置文件读写（前端 settings UI 用） ----
app.get('/api/mcp/config', async (_req, res) => {
  try {
    const fs = await import('node:fs/promises');
    const cfgPath = path.join(WORKSPACE, '.minicodeide', 'mcp.json');
    let raw = '';
    let exists = false;
    try {
      raw = await fs.readFile(cfgPath, 'utf-8');
      exists = true;
    } catch {
      // 不存在 → 返回示例
      try {
        const ex = path.join(WORKSPACE, '.minicodeide', 'mcp.example.json');
        raw = await fs.readFile(ex, 'utf-8');
      } catch {
        raw = JSON.stringify({ servers: {} }, null, 2);
      }
    }
    res.json({ exists, content: raw, path: cfgPath });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) });
  }
});

app.put('/api/mcp/config', express.json({ limit: '512kb' }), async (req, res) => {
  try {
    const content = (req.body?.content ?? '') as string;
    // 校验 JSON
    try {
      JSON.parse(content);
    } catch (e: any) {
      return res.status(400).json({ error: `invalid JSON: ${e?.message}` });
    }
    const fs = await import('node:fs/promises');
    const dir = path.join(WORKSPACE, '.minicodeide');
    await fs.mkdir(dir, { recursive: true });
    const cfgPath = path.join(dir, 'mcp.json');
    await fs.writeFile(cfgPath, content, 'utf-8');
    res.json({ ok: true, path: cfgPath, hint: 'Restart server to apply MCP changes (or POST /api/mcp/reconnect).' });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) });
  }
});

app.post('/api/mcp/reconnect', async (_req, res) => {
  try {
    // 简单实现：close all + 重新 loadAndConnect
    const closeAll = (mcpManager as any).closeAll?.bind(mcpManager);
    if (typeof closeAll === 'function') await closeAll();
    const results = await mcpManager.loadAndConnect();
    mcpManager.registerToolsTo(registry);
    res.json({ ok: true, results });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) });
  }
});

// ---- Subagent profiles 列表（前端 role picker 用） ----
app.get('/api/subagents/profiles', (_req, res) => {
  res.json({ profiles: subagents.getProfileNames() });
});

// ---- 直接派发 subagent（不走 LLM）：前端 role picker 用 ----
app.post('/api/subagents/spawn', express.json({ limit: '256kb' }), async (req, res) => {
  try {
    const { task, label, role, parentSessionId } = req.body ?? {};
    if (!task || typeof task !== 'string') {
      return res.status(400).json({ error: 'task (string) is required' });
    }
    const r = await subagents.spawn({
      task,
      label,
      role,
      parentSessionId: parentSessionId ?? 'manual-' + Date.now(),
      parentDepth: 0,
    });
    res.json({ ok: true, runId: r.runId, childSessionId: r.childSessionId });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) });
  }
});

app.get('/api/bg/list', (_req, res) => {
  res.json({ tasks: bgTasks.list() });
});

// /api/chat 单独限流（在路由声明前装一次中间件即可）
app.use('/api/chat', chatRateLimitMiddleware);

// ---- Exec approval pending pool (P5) ----
// 一个挂起的 approve 请求；前端通过 /api/approve/:id 决定 ok=true/false
interface PendingApproval {
  id: string;
  tool: string;
  args: any;
  reason?: string;
  matchedRule?: string;
  resolve: (ok: boolean) => void;
  createdAt: number;
}
const pendingApprovals = new Map<string, PendingApproval>();
let approvalSeq = 0;
function createApproveRequest(req: {
  tool: string;
  args: any;
  reason?: string;
  matchedRule?: string;
}): { id: string; promise: Promise<boolean> } {
  const id = `appr_${Date.now()}_${++approvalSeq}`;
  let resolve!: (ok: boolean) => void;
  const promise = new Promise<boolean>((r) => (resolve = r));
  pendingApprovals.set(id, {
    id,
    tool: req.tool,
    args: req.args,
    reason: req.reason,
    matchedRule: req.matchedRule,
    resolve,
    createdAt: Date.now(),
  });
  // 60s 自动 reject 防泄漏
  setTimeout(() => {
    const p = pendingApprovals.get(id);
    if (p) {
      pendingApprovals.delete(id);
      p.resolve(false);
    }
  }, 60_000);
  return { id, promise };
}
app.get('/api/approvals', (_req, res) => {
  res.json(
    [...pendingApprovals.values()].map((p) => ({
      id: p.id,
      tool: p.tool,
      args: p.args,
      reason: p.reason,
      matchedRule: p.matchedRule,
      createdAt: p.createdAt,
    })),
  );
});
app.post('/api/approve/:id', (req, res) => {
  const p = pendingApprovals.get(req.params.id);
  if (!p) {
    res.status(404).json({ error: 'not found or expired' });
    return;
  }
  pendingApprovals.delete(req.params.id);
  p.resolve(req.body?.ok === true);
  res.json({ ok: true });
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    workspace: WORKSPACE,
    indexReady: !!index,
    indexing,
    fileCount: index?.fileCount,
    chunkCount: index?.chunkCount,
    symbolCount: index?.symbolCount,
    vectorCount: index?.vectors.size(),
    embedder: index?.embedderName ?? embedder.name,
    reranker: reranker.name,
  });
});

// ---- VSCode 模式探测（避开浏览器 CORS + Node fetch 的 localhost→IPv6 坑）----
const VSCODE_TARGET = process.env.VSCODE_URL ?? 'http://127.0.0.1:8000';
app.get('/api/vscode/health', async (_req, res) => {
  try {
    const r = await fetch(VSCODE_TARGET + '/', { redirect: 'manual' });
    // code-server 通常返回 200 / 302 / 307
    res.json({ ok: r.status < 500, status: r.status, url: VSCODE_TARGET });
  } catch (e: any) {
    res.json({ ok: false, error: e?.message ?? String(e), url: VSCODE_TARGET });
  }
});

// ---- 文件树 / 文件读写 ----
app.get('/api/files', async (req, res) => {
  const rel = String(req.query.path ?? '.');
  const abs = path.resolve(WORKSPACE, rel);
  if (!abs.startsWith(WORKSPACE)) return res.status(400).json({ error: 'escape' });
  try {
    const entries = await fs.readdir(abs, { withFileTypes: true });
    res.json(
      entries
        .filter((e) => !['node_modules', '.git', 'dist'].includes(e.name))
        .map((e) => ({
          name: e.name,
          path: path.relative(WORKSPACE, path.join(abs, e.name)),
          isDir: e.isDirectory(),
        }))
        .sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1)),
    );
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/file', async (req, res) => {
  const rel = String(req.query.path ?? '');
  const abs = path.resolve(WORKSPACE, rel);
  if (!abs.startsWith(WORKSPACE)) return res.status(400).json({ error: 'escape' });
  try {
    const text = await fs.readFile(abs, 'utf-8');
    res.json({ path: rel, content: text });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/file', async (req, res) => {
  const { path: rel, content } = req.body ?? {};
  const abs = path.resolve(WORKSPACE, rel);
  if (!abs.startsWith(WORKSPACE)) return res.status(400).json({ error: 'escape' });
  try {
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content ?? '', 'utf-8');
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ---- Agents Window 只读命名空间 -----------------------------------------------
// 关键：所有接口都要求 ?ws=<绝对路径>，与主 IDE 的 WORKSPACE 完全隔离，
// Agents Window 切换工作区不会影响主 IDE 当前打开的目录。
function safeJoinAgents(rootAbs: string, rel: string): string | null {
  const target = path.resolve(rootAbs, rel || '.');
  return target === rootAbs || target.startsWith(rootAbs + path.sep) ? target : null;
}
app.get('/api/agents/files', async (req, res) => {
  const ws = String(req.query.ws ?? '');
  if (!ws || !path.isAbsolute(ws)) return res.status(400).json({ error: 'absolute ws required' });
  const target = safeJoinAgents(ws, String(req.query.path ?? '.'));
  if (!target) return res.status(400).json({ error: 'escape' });
  try {
    const entries = await fs.readdir(target, { withFileTypes: true });
    res.json(
      entries
        .filter((e) => !['node_modules', '.git', 'dist', '.next', '.turbo'].includes(e.name))
        .map((e) => ({
          name: e.name,
          path: path.relative(ws, path.join(target, e.name)),
          isDir: e.isDirectory(),
        }))
        .sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1)),
    );
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
app.get('/api/agents/file', async (req, res) => {
  const ws = String(req.query.ws ?? '');
  if (!ws || !path.isAbsolute(ws)) return res.status(400).json({ error: 'absolute ws required' });
  const target = safeJoinAgents(ws, String(req.query.path ?? ''));
  if (!target) return res.status(400).json({ error: 'escape' });
  try {
    const st = await fs.stat(target);
    if (st.size > 2 * 1024 * 1024) return res.status(413).json({ error: 'file too large (>2MB)' });
    const text = await fs.readFile(target, 'utf-8');
    res.json({ path: String(req.query.path ?? ''), content: text, size: st.size });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
app.get('/api/agents/git/branch', async (req, res) => {
  const ws = String(req.query.ws ?? '');
  if (!ws || !path.isAbsolute(ws)) return res.status(400).json({ error: 'absolute ws required' });
  try {
    if (!(await isGitRepo(ws))) return res.json({ isRepo: false });
    const branch = await gitBranch(ws);
    res.json({ isRepo: true, branch });
  } catch (e: any) { res.status(500).json({ error: e?.message ?? String(e) }); }
});
app.get('/api/agents/list-dirs', async (req, res) => {
  const parent = String(req.query.parent ?? os.homedir());
  if (!path.isAbsolute(parent)) return res.status(400).json({ error: 'absolute parent required' });
  try {
    const entries = await fs.readdir(parent, { withFileTypes: true });
    const dirs = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => ({ name: e.name, path: path.join(parent, e.name) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json({ parent, home: os.homedir(), dirs });
  } catch (e: any) { res.status(500).json({ error: e?.message ?? String(e) }); }
});

// ---- Codebase search（BM25） ----
app.get('/api/search', (req, res) => {
  const q = String(req.query.q ?? '');
  if (!index) return res.json({ ready: false, hits: [] });
  const hits = index.bm25.search(q, 8);
  res.json({ ready: true, hits });
});

// ---- Text grep（前端全局搜索面板用） ----
// 与 builtin grep_search 工具同源，但简化掉 glob、做成纯 HTTP；
// 命中里附带前后 1 行上下文，按文件分组返回。
app.get('/api/grep', async (req, res) => {
  const pattern = String(req.query.pattern ?? '');
  const caseInsensitive = req.query.ci === '1' || req.query.ci === 'true';
  const includeGlob = req.query.include ? String(req.query.include) : '';
  const maxHits = Math.min(500, Number(req.query.limit ?? 200));
  if (!pattern) return res.json({ ready: true, hits: [] });
  let re: RegExp;
  try {
    re = new RegExp(pattern, caseInsensitive ? 'i' : '');
  } catch (e: any) {
    return res.status(400).json({ error: `Invalid regex: ${e?.message ?? e}` });
  }
  const globRe = includeGlob ? globToRegex(includeGlob) : null;
  type Hit = { file: string; line: number; text: string; before?: string; after?: string };
  const hits: Hit[] = [];
  let scanned = 0;
  const skipDirs = new Set(['node_modules', 'dist', 'build', '.git', '.next', '.cache']);
  const walk = async (dir: string) => {
    if (hits.length >= maxHits) return;
    let entries: any[] = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (hits.length >= maxHits) return;
      if (e.name.startsWith('.') || skipDirs.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        await walk(full);
      } else {
        if (globRe && !globRe.test(e.name)) continue;
        scanned++;
        try {
          const text = await fs.readFile(full, 'utf-8');
          const lines = text.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (re.test(lines[i])) {
              const rel = path.relative(WORKSPACE, full);
              hits.push({
                file: rel,
                line: i + 1,
                text: lines[i].slice(0, 400),
                before: i > 0 ? lines[i - 1].slice(0, 400) : undefined,
                after: i < lines.length - 1 ? lines[i + 1].slice(0, 400) : undefined,
              });
              if (hits.length >= maxHits) return;
            }
          }
        } catch {
          /* binary / unreadable */
        }
      }
    }
  };
  await walk(WORKSPACE);
  res.json({ ready: true, hits, scanned, truncated: hits.length >= maxHits });
});

/** 简易 glob → RegExp（支持 *, ?, **, {a,b}） */
function globToRegex(glob: string): RegExp {
  let out = '^';
  let i = 0;
  while (i < glob.length) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        out += '.*';
        i += 2;
      } else {
        out += '[^/]*';
        i++;
      }
    } else if (c === '?') {
      out += '.';
      i++;
    } else if (c === '{') {
      const end = glob.indexOf('}', i);
      if (end < 0) {
        out += '\\{';
        i++;
      } else {
        const opts = glob.slice(i + 1, end).split(',').map((x) => x.replace(/[.+^$()|[\]\\]/g, '\\$&'));
        out += '(?:' + opts.join('|') + ')';
        i = end + 1;
      }
    } else if (/[.+^$()|[\]\\]/.test(c)) {
      out += '\\' + c;
      i++;
    } else {
      out += c;
      i++;
    }
  }
  out += '$';
  return new RegExp(out);
}

// ---- Semantic search（embedding） ----
app.get('/api/semantic-search', async (req, res) => {
  const q = String(req.query.q ?? '');
  const k = Math.min(20, Number(req.query.k ?? 10));
  if (!index) return res.json({ ready: false, hits: [] });
  if (index.vectors.size() === 0) return res.json({ ready: true, hits: [], note: 'no vectors' });
  const [v] = await embedder.embed([q]);
  const hits = index.vectors.search(v, k);
  res.json({ ready: true, hits, embedder: embedder.name });
});

// ---- Hybrid search（BM25 + 向量 RRF） ----
app.get('/api/hybrid-search', async (req, res) => {
  const q = String(req.query.q ?? '');
  const k = Math.min(20, Number(req.query.k ?? 10));
  if (!index) return res.json({ ready: false, hits: [] });
  const hits = await hybridRetrieve(index, embedder, q, k, reranker);
  res.json({ ready: true, hits });
});

// ---- 符号图谱 ----
app.get('/api/symbols', (req, res) => {
  if (!index) return res.json({ ready: false });
  const q = String(req.query.q ?? '').trim();
  const filePath = req.query.path ? String(req.query.path) : null;
  if (filePath) return res.json({ ready: true, symbols: index.symbols.symbolsInFile(filePath) });
  if (!q) return res.json({ ready: true, symbols: [] });
  res.json({ ready: true, symbols: index.symbols.fuzzyFind(q, 30) });
});

app.get('/api/references', (req, res) => {
  if (!index) return res.json({ ready: false });
  const name = String(req.query.name ?? '').trim();
  if (!name) return res.json({ ready: true, refs: [] });
  res.json({ ready: true, refs: index.symbols.findReferences(name) });
});

// ---- Inline completion (FIM-style) ----
// 输入：当前文件路径、光标前文 prefix、光标后文 suffix、语言
// 输出：JSON { completion: string }
app.post('/api/complete', async (req, res) => {
  const {
    path: filePath,
    prefix = '',
    suffix = '',
    language = 'typescript',
    maxTokens = 80,
  } = req.body as {
    path?: string;
    prefix?: string;
    suffix?: string;
    language?: string;
    maxTokens?: number;
  };

  // 截断防止 prompt 爆掉
  const PRE_LIMIT = 2000;
  const SUF_LIMIT = 600;
  const pre = prefix.length > PRE_LIMIT ? prefix.slice(prefix.length - PRE_LIMIT) : prefix;
  const suf = suffix.length > SUF_LIMIT ? suffix.slice(0, SUF_LIMIT) : suffix;

  // 召回相关片段（用 prefix 的最后 200 字 + 后续 100 字做 query）
  const queryText = (pre.slice(-200) + ' ' + suf.slice(0, 100)).trim();
  let snippets = '';
  if (index && queryText) {
    try {
      const hits = await hybridRetrieve(index, embedder, queryText, 3, reranker);
      snippets = hits
        .filter((h) => h.path !== filePath)
        .slice(0, 3)
        .map((h) => `// ${h.path}:${h.startLine}-${h.endLine}\n${h.text.slice(0, 400)}`)
        .join('\n\n');
    } catch {
      /* ignore */
    }
  }

  const sys = `You are an expert code completion engine. Given the code BEFORE the cursor and the code AFTER the cursor, output ONLY the text that should be inserted at the cursor — no explanations, no markdown fences, no leading newline. Keep the completion short (a single statement, expression, or up to a few lines). Match the existing style and indentation. If nothing useful to add, output an empty string.`;

  const user = [
    snippets ? `### Related context\n${snippets}\n` : '',
    `### File: ${filePath ?? '<unknown>'} (${language})`,
    `### Code before cursor`,
    '```',
    pre,
    '```',
    `### Code after cursor`,
    '```',
    suf,
    '```',
    `### Completion to insert at <CURSOR>`,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    // 非流式（前端 inline completion 一次性显示更顺）
    let full = '';
    const ctl = new AbortController();
    req.on('close', () => ctl.abort());
    for await (const chunk of llmComplete.chatStream(
      [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      { temperature: 0.1, signal: ctl.signal },
    )) {
      if (chunk.delta) full += chunk.delta;
      if (full.length > maxTokens * 6) break; // 粗略保护
    }
    // 清理 fence、首行 leading newline
    let out = full
      .replace(/^```[a-zA-Z]*\n?/, '')
      .replace(/```\s*$/, '')
      .replace(/^\n+/, '');
    res.json({ completion: out });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) });
  }
});

/**
 * /api/inline-edit (SSE)
 * --------------------------------------------------------------
 * Cmd+K 内联编辑：根据用户的自然语言指令，重写当前 selection 为新的代码片段。
 * Body:
 *   path: string         — 文件路径（用于召回上下文 / 最终落 PendingEdit）
 *   selection: string    — 选中的原始代码
 *   instruction: string  — 用户指令（如 "rename to bar / add error handling"）
 *   language?: string    — 语言提示
 *   contextBefore/After  — 选中前后的代码（保持上下文一致）
 *   apply?: boolean      — true 时 server 直接生成 PendingEdit（按整个文件替换 selection 后落盘）
 *   fullText?: string    — apply 模式必须传：用于把替换结果写回 PendingEdit
 *
 * 输出（SSE）：
 *   data: {"type":"text","text":"..."}    流式新代码
 *   data: {"type":"done","newSelection":"...","pendingEditId":"..."?}
 */
app.post('/api/inline-edit', async (req, res) => {
  const {
    path: filePath,
    selection = '',
    instruction = '',
    language = 'typescript',
    contextBefore = '',
    contextAfter = '',
    apply = false,
    fullText,
  } = req.body as {
    path?: string;
    selection?: string;
    instruction?: string;
    language?: string;
    contextBefore?: string;
    contextAfter?: string;
    apply?: boolean;
    fullText?: string;
  };

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders?.();
  sseTrack.inc();
  req.on('close', () => sseTrack.dec());
  const sse = (evt: any) => res.write(`data: ${JSON.stringify(evt)}\n\n`);

  const sys =
    'You are an inline code editor. Given the code BEFORE the selection, the SELECTION itself, the code AFTER the selection, and the user instruction, output ONLY the rewritten selection. ' +
    'No explanations, no markdown fences, no leading or trailing newlines. Preserve indentation style and surrounding context. If the instruction is unclear, output the selection unchanged.';
  const user = [
    `### File: ${filePath ?? '<unknown>'} (${language})`,
    contextBefore ? `### Code BEFORE selection\n\`\`\`\n${contextBefore.slice(-1500)}\n\`\`\`` : '',
    `### Original SELECTION\n\`\`\`\n${selection}\n\`\`\``,
    contextAfter ? `### Code AFTER selection\n\`\`\`\n${contextAfter.slice(0, 800)}\n\`\`\`` : '',
    `### Instruction\n${instruction}`,
    '### Rewritten SELECTION',
  ]
    .filter(Boolean)
    .join('\n');

  let full = '';
  const ctl = new AbortController();
  req.on('close', () => ctl.abort());

  try {
    for await (const chunk of llmComplete.chatStream(
      [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      { temperature: 0.2, signal: ctl.signal },
    )) {
      if (chunk.delta) {
        full += chunk.delta;
        sse({ type: 'text', text: chunk.delta });
      }
      if (chunk.done || chunk.finishReason) break;
    }
    // 清理 fence
    const cleaned = full
      .replace(/^```[a-zA-Z]*\n?/, '')
      .replace(/```\s*$/, '')
      .replace(/^\n+/, '')
      .replace(/\n+$/, '');

    let pendingEditId: string | undefined;
    if (apply && filePath && typeof fullText === 'string' && selection) {
      // 用 selection 在 fullText 里第一次出现的位置做替换 → 生成 PendingEdit
      const idx = fullText.indexOf(selection);
      if (idx >= 0) {
        const newContent = fullText.slice(0, idx) + cleaned + fullText.slice(idx + selection.length);
        const edit = await pendingEdits.propose({
          path: filePath,
          newContent,
          tool: 'inline-edit',
        });
        pendingEditId = edit.id;
      }
    }

    sse({ type: 'done', newSelection: cleaned, pendingEditId });
    res.end();
  } catch (e: any) {
    sse({ type: 'error', error: e?.message ?? String(e) });
    res.end();
  }
});

// ---- Memory ----
app.get('/api/memory', async (_req, res) => {
  res.json({
    user: await memory.list('user'),
    project: await memory.list('project'),
  });
});

app.post('/api/memory', async (req, res) => {
  const item = await memory.upsert(req.body.scope ?? 'user', req.body);
  res.json(item);
});

app.delete('/api/memory/:scope/:id', async (req, res) => {
  const ok = await memory.delete(req.params.scope as any, req.params.id);
  res.json({ ok });
});

// 手动触发 memory 维护（去重 + 归档低价值条目）
app.post('/api/memory/maintain', async (req, res) => {
  try {
    const report = await memory.maintain(req.body ?? {});
    res.json({ ok: true, report });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
});

// 前端通知"用户当前正在看 file" → 写入 recent-activity
app.post('/api/recent-activity', (req, res) => {
  const { sessionId, kind, target, meta } = req.body ?? {};
  if (!sessionId || !kind || !target) {
    return res.status(400).json({ error: 'sessionId, kind, target required' });
  }
  if (!['edit', 'read', 'search', 'view'].includes(kind)) {
    return res.status(400).json({ error: 'invalid kind' });
  }
  recentActivity.record(sessionId, { kind, target, meta });
  res.json({ ok: true });
});

// ---- LLM Judge（给 evals 用） ----
// 评估一个 answer 是否回答了 question，返回 {score, pass, reasoning, missing[]}
app.post('/api/judge', async (req, res) => {
  try {
    const { z } = await import('zod');
    const body = req.body ?? {};
    const question = String(body.question ?? '').trim();
    const answer = String(body.answer ?? '');
    const expectedConcepts: string[] = Array.isArray(body.expectedConcepts) ? body.expectedConcepts : [];
    const context: string = typeof body.context === 'string' ? body.context : '';
    const passThreshold: number = Number(body.passThreshold ?? 7);
    if (!question) return res.status(400).json({ error: 'question required' });

    const schema = z.object({
      score: z.number().min(0).max(10),
      pass: z.boolean(),
      reasoning: z.string().min(1),
      missing: z.array(z.string()).optional(),
    });

    const system =
      'You are a strict but fair evaluator of code-assistant outputs. ' +
      'Score from 0 to 10 based on how well the answer addresses the question. ' +
      'Do NOT reward fluff or hedging. Do NOT reward correct-but-irrelevant content. ' +
      'Score >= 7 means the answer is acceptable for production use.';
    const conceptsBlock = expectedConcepts.length
      ? `\n\nExpected concepts to cover (each missing concept reduces score):\n${expectedConcepts.map((c) => '  - ' + c).join('\n')}`
      : '';
    const ctxBlock = context ? `\n\nReference context:\n${context}` : '';
    const user =
      `Question: ${question}\n\n` +
      `Answer to evaluate:\n"""\n${answer.trim() || '(empty)'}\n"""` +
      conceptsBlock +
      ctxBlock;

    let result: { data: any; attempts: number };
    try {
      result = await callStructured(llmFast, {
        schema,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        schemaName: 'judge_output',
        temperature: 0,
        maxRetries: 1,
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message ?? String(e) });
    }
    // 后端兜底校正 pass（防止 LLM 给 score=8 却 pass=false 之类）
    const expected = result.data.score >= passThreshold;
    res.json({
      ...result.data,
      pass: expected,
      threshold: passThreshold,
      attempts: result.attempts,
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) });
  }
});

// ---- Diagnostics（Problems 面板用） ----
// 后台跑 typecheck（pnpm -r typecheck），结构化提取 errors，结果缓存 30s
interface Diagnostic {
  file: string;
  line: number;
  col: number;
  severity: 'error' | 'warning';
  message: string;
  code?: string;
}
let diagCache: { ts: number; running: boolean; result: Diagnostic[]; lastError?: string; durationMs?: number } = {
  ts: 0,
  running: false,
  result: [],
};
const DIAG_TTL_MS = 30_000;
async function runDiagnostics(): Promise<Diagnostic[]> {
  if (diagCache.running) return diagCache.result;
  diagCache.running = true;
  const t0 = Date.now();
  try {
    const { exec } = await import('node:child_process');
    const hasPnpm = await fs.access(path.join(WORKSPACE, 'pnpm-workspace.yaml')).then(() => true).catch(() => false);
    const pkgJson = await fs.readFile(path.join(WORKSPACE, 'package.json'), 'utf-8').catch(() => '{}');
    const scripts = (JSON.parse(pkgJson).scripts ?? {}) as Record<string, string>;
    let cmd: string;
    if (hasPnpm && scripts.typecheck) cmd = 'pnpm -r typecheck';
    else if (scripts.typecheck) cmd = 'npm run typecheck';
    else cmd = 'npx tsc --noEmit';
    const result = await new Promise<{ out: string }>((resolve) => {
      const p = exec(
        cmd,
        { cwd: WORKSPACE, maxBuffer: 8 * 1024 * 1024, timeout: 120_000 },
        (_e: any, so: string, se: string) => resolve({ out: (so ?? '') + '\n' + (se ?? '') }),
      );
      (p as any).on?.('error', () => undefined);
    });
    const diagnostics: Diagnostic[] = [];
    const tscRe = /(.+?)\((\d+),(\d+)\):\s*(error|warning)\s+(TS\d+):\s*(.+)/g;
    for (const m of result.out.matchAll(tscRe)) {
      // 把绝对路径转为 workspace 相对路径
      let file = m[1];
      if (path.isAbsolute(file)) file = path.relative(WORKSPACE, file);
      diagnostics.push({
        file,
        line: Number(m[2]),
        col: Number(m[3]),
        severity: m[4] as 'error' | 'warning',
        message: m[6].slice(0, 300),
        code: m[5],
      });
      if (diagnostics.length >= 200) break;
    }
    diagCache = {
      ts: Date.now(),
      running: false,
      result: diagnostics,
      durationMs: Date.now() - t0,
    };
  } catch (e: any) {
    diagCache = {
      ts: Date.now(),
      running: false,
      result: [],
      lastError: e?.message ?? String(e),
      durationMs: Date.now() - t0,
    };
  }
  return diagCache.result;
}
app.get('/api/diagnostics', async (req, res) => {
  const force = req.query.force === '1' || req.query.force === 'true';
  const stale = Date.now() - diagCache.ts > DIAG_TTL_MS;
  if (force || (stale && !diagCache.running)) {
    // fire-and-forget: 立即返回当前缓存，新结果后续轮询取
    runDiagnostics().catch(() => undefined);
  }
  res.json({
    diagnostics: diagCache.result,
    ts: diagCache.ts,
    running: diagCache.running,
    durationMs: diagCache.durationMs,
    error: diagCache.lastError,
    stale,
  });
});

// ---- Pending Edits ----
app.get('/api/edits', (_req, res) => {
  res.json(pendingEdits.list());
});

// Dev helper: 直接 propose 一个 pending edit（方便 UI 实测，不经过 Agent）
app.post('/api/edits', async (req, res) => {
  const { path: p, newContent, tool = 'manual' } = req.body ?? {};
  if (!p || typeof newContent !== 'string')
    return res.status(400).json({ error: 'path and newContent required' });
  const e = await pendingEdits.propose({ path: p, newContent, tool });
  res.json(e);
});

app.get('/api/edits/:id', (req, res) => {
  const e = pendingEdits.get(req.params.id);
  if (!e) return res.status(404).json({ error: 'not found' });
  res.json(e);
});

app.post('/api/edits/:id/accept', async (req, res) => {
  try {
    const e = await pendingEdits.accept(req.params.id);
    verifyAfterAccept.trigger([e.path]);
    res.json(e);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/edits/:id/reject', (req, res) => {
  try {
    const e = pendingEdits.reject(req.params.id);
    res.json(e);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/edits/accept-all', async (_req, res) => {
  const out = await pendingEdits.acceptAll();
  verifyAfterAccept.trigger(out.map((e) => e.path));
  res.json(out);
});

app.post('/api/edits/reject-all', (_req, res) => {
  const all = pendingEdits.list();
  const out = all.map((e) => pendingEdits.reject(e.id));
  res.json(out);
});

// ---- Checkpoints ----
app.get('/api/checkpoints', (_req, res) => {
  res.json(
    checkpoints.list().map((c) => ({
      id: c.id,
      label: c.label,
      trigger: c.trigger,
      createdAt: c.createdAt,
      reverted: c.reverted,
      fileCount: c.files.length,
      files: c.files.map((f) => f.path),
    })),
  );
});

app.get('/api/checkpoints/:id', (req, res) => {
  const cp = checkpoints.get(req.params.id);
  if (!cp) return res.status(404).json({ error: 'not found' });
  res.json(cp);
});

app.post('/api/checkpoints/:id/revert', async (req, res) => {
  try {
    const r = await checkpoints.revert(req.params.id);
    res.json(r);
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? String(e) });
  }
});

// ---- Rules ----
app.get('/api/rules', (_req, res) => {
  res.json(
    rules.list().map((r) => ({
      file: r.file,
      name: r.name,
      mode: r.mode,
      globs: r.globs,
      description: r.description,
      length: r.body.length,
    })),
  );
});
app.post('/api/rules/reload', async (_req, res) => {
  await rules.load();
  res.json({ ok: true, count: rules.list().length });
});

// ---- Project Memory（AGENTS.md / CLAUDE.md / MEMORY.md）----
app.get('/api/project-memory', (_req, res) => {
  res.json(
    projectMemory.list().map((m) => ({
      path: m.path,
      scope: m.scope,
      depth: m.depth,
      bytes: m.body.length,
    })),
  );
});
app.post('/api/project-memory/reload', async (_req, res) => {
  await projectMemory.load();
  res.json({ ok: true, count: projectMemory.list().length });
});

// ---- Slash commands ----
app.get('/api/slash', (_req, res) => {
  res.json(
    slash.list().map((c) => ({
      name: c.name,
      description: c.description,
      source: c.source,
    })),
  );
});
app.post('/api/slash/reload', async (_req, res) => {
  await slash.loadUser();
  res.json({ ok: true, count: slash.list().length });
});

// ---- Providers ----
app.get('/api/providers', (_req, res) => {
  res.json(providers.list());
});
app.post('/api/providers', async (req, res) => {
  try {
    const body = req.body as Partial<ProviderProfile> & { name: string; baseUrl: string };
    if (!body?.name || typeof body.baseUrl !== 'string')
      return res.status(400).json({ error: 'name and baseUrl required' });
    const p = await providers.upsert(body);
    res.json(p);
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? String(e) });
  }
});
app.delete('/api/providers/:id', async (req, res) => {
  try {
    await providers.remove(req.params.id);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? String(e) });
  }
});
app.post('/api/providers/active', async (req, res) => {
  try {
    const { role, id } = req.body as {
      role: 'chat' | 'complete' | 'embed' | 'fast';
      id: string | null;
    };
    if (!role) return res.status(400).json({ error: 'role required' });
    await providers.setActive(role, id);
    res.json(providers.list());
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? String(e) });
  }
});
// 设置某 role 的 fallback 链（顺序数组）
app.post('/api/providers/fallbacks', async (req, res) => {
  try {
    const { role, ids } = req.body as {
      role: 'chat' | 'complete' | 'embed' | 'fast';
      ids: string[];
    };
    if (!role || !Array.isArray(ids)) {
      return res.status(400).json({ error: 'role and ids required' });
    }
    await providers.setFallbacks(role, ids);
    res.json(providers.list());
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? String(e) });
  }
});
// 测试连通性（kind 自动判定）
app.post('/api/providers/test', async (req, res) => {
  try {
    const { id } = req.body as { id: string };
    const profile = providers.get(id);
    if (!profile) return res.status(404).json({ error: 'profile not found' });
    const provider = createProvider(profile);
    // 发一个极短 prompt
    const t0 = Date.now();
    let first = 0;
    let text = '';
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
    res.json({ ok: true, firstTokenMs: first, totalMs: Date.now() - t0, sample: text.slice(0, 64) });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
});

// ---- Sessions ----
app.get('/api/sessions', (req, res) => {
  const mode = (req.query.mode as 'work' | 'code' | undefined);
  const ws = req.query.workspace ? String(req.query.workspace) : null;
  let list = sessions.list();
  if (mode) list = list.filter((x: any) => (x.mode ?? 'code') === mode);
  if (ws) list = list.filter((x: any) => x.workspaceRoot === ws);
  res.json(list);
});
app.get('/api/sessions/:id', (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'not found' });
  res.json({ meta: s.meta, messages: s.messages });
});
app.post('/api/sessions', async (req, res) => {
  const body = req.body ?? {};
  const opts = typeof body === 'object'
    ? { title: body.title, mode: body.mode, workspaceRoot: body.workspaceRoot }
    : { title: String(body) };
  const meta = await sessions.create(opts);
  res.json(meta);
});
app.patch('/api/sessions/:id', async (req, res) => {
  try {
    const meta = await sessions.rename(req.params.id, String(req.body?.title ?? ''));
    res.json(meta);
  } catch (e: any) {
    res.status(404).json({ error: e?.message ?? String(e) });
  }
});
app.delete('/api/sessions/:id', async (req, res) => {
  await sessions.delete(req.params.id);
  res.json({ ok: true });
});
app.post('/api/sessions/:id/fork', async (req, res) => {
  try {
    const idx = Number(req.body?.untilIndex ?? -1);
    const meta = await sessions.fork(req.params.id, idx, req.body?.title);
    res.json(meta);
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? String(e) });
  }
});

/**
 * Resume 准备：返回前端用于"继续"的载荷。
 *
 * 设计：让前端拿到 { userMessage, history, partialAssistant, hint }，
 * 然后由前端**像普通 chat 一样**调 /api/chat（带 sessionId、userMessage）。
 *
 * 为什么不直接做 internal redirect？
 *  - chat handler 用 SSE，复用很麻烦
 *  - 前端拿到 partial 后可以选「继续 / 编辑 / 放弃」三种模式，决策权在用户
 */
app.get('/api/sessions/:id/resume-info', (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'not found' });
  const it = s.meta.interruptedTurn;
  if (!it) return res.json({ interrupted: false });
  // 前端发起 chat 时，建议 history 用已落盘的 messages（不含 partial）
  // userMessage 用 hint 模板（让 LLM 知道这是续接而非新对话）
  const hint =
    `[RESUME] 上一次对话在执行中被中断。你已经输出了以下部分内容：\n\n` +
    '----- 已输出（截断）-----\n' +
    it.partialAssistant.slice(-2000) +
    '\n----- 已输出结束 -----\n\n' +
    `原始任务："${it.userMessage}"\n\n` +
    `请继续完成这个任务。如果上面输出已经完整就只补充收尾；否则从中断处接着写或重新执行剩余步骤。`;
  res.json({
    interrupted: true,
    turnId: it.turnId,
    originalUserMessage: it.userMessage,
    partialAssistant: it.partialAssistant,
    startedAt: it.startedAt,
    suggestedResumePrompt: hint,
    history: s.messages, // 不含 partial
  });
});

/** 显式放弃续接：清除 interruptedTurn 标记 */
app.post('/api/sessions/:id/resume-discard', async (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'not found' });
  if (s.meta.interruptedTurn) {
    await sessions
      .interruptTurn(req.params.id, s.meta.interruptedTurn.turnId, 'user_discard')
      .catch(() => undefined);
    s.meta.interruptedTurn = undefined;
  }
  res.json({ ok: true });
});

// ---- Skills ----
app.get('/api/skills', (_req, res) => {
  res.json(
    skills.list().map((s) => ({
      name: s.name,
      description: s.description,
      source: s.source,
      userInvocable: s.userInvocable,
    })),
  );
});
app.get('/api/skills/:name', async (req, res) => {
  const f = await skills.loadFull(req.params.name);
  if (!f) return res.status(404).json({ error: 'not found' });
  res.json({
    name: f.name,
    description: f.description,
    source: f.source,
    directory: f.directory,
    supportFiles: f.supportFiles,
    body: f.body,
  });
});
app.post('/api/skills/reload', async (_req, res) => {
  await skills.load();
  res.json({ ok: true, count: skills.list().length });
});

// ---- Subagents 监控 ----
app.get('/api/subagents', (req, res) => {
  const parentSessionId = req.query.parent as string | undefined;
  res.json(subagents.list(parentSessionId));
});

// ---- @-mention 补全（供前端 popup 用） ----
// q 形如 "file:src/m" / "symbol:Foo" / "docs:arch"
app.get('/api/mentions/suggest', async (req, res) => {
  const q = String(req.query.q ?? '');
  const m = q.match(/^(file|symbol|docs|selection|web):(.*)$/);
  if (!m) return res.json({ items: [] });
  const kind = m[1];
  const arg = m[2].toLowerCase();
  const items: { kind: string; label: string; insert: string; hint?: string }[] = [];
  try {
    if (kind === 'file' || kind === 'selection') {
      // 模糊匹配文件路径：先收集所有命中，按匹配位置（越靠前越好）+ 路径短的优先
      if (index) {
        const collected: { path: string; score: number }[] = [];
        for (const p of index.symbols.allFiles()) {
          if (!arg) {
            collected.push({ path: p, score: 0 });
          } else {
            const idx = p.toLowerCase().indexOf(arg);
            if (idx >= 0) {
              // 分数：basename 命中 > 路径前部命中 > 任意位置命中；路径短的微弱加分
              const base = p.split('/').pop()!.toLowerCase();
              const inBase = base.includes(arg) ? 1000 : 0;
              const earlyHit = -idx;
              const shortBonus = -Math.min(p.length, 100);
              collected.push({ path: p, score: inBase + earlyHit + shortBonus });
            }
          }
        }
        collected.sort((a, b) => b.score - a.score);
        for (const c of collected.slice(0, 20)) {
          items.push({ kind, label: c.path, insert: `@${kind}:${c.path}` });
        }
      }
    } else if (kind === 'symbol') {
      if (index) {
        for (const sym of index.symbols.fuzzyFind(arg, 20)) {
          items.push({
            kind,
            label: `${sym.name} · ${sym.path}:${sym.startLine}`,
            insert: `@symbol:${sym.name}`,
            hint: sym.kind,
          });
        }
      }
    } else if (kind === 'docs') {
      // 扫 docs/*.md
      try {
        const dir = path.join(WORKSPACE, 'docs');
        const files = await fs.readdir(dir);
        for (const f of files) {
          if (!f.endsWith('.md')) continue;
          const name = f.replace(/\.md$/, '');
          if (!arg || name.toLowerCase().includes(arg)) {
            items.push({ kind, label: `docs/${f}`, insert: `@docs:${name}` });
          }
        }
      } catch {
        /* no docs dir */
      }
    }
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? String(e) });
  }
  res.json({ items: items.slice(0, 30) });
});

// ---- Git ----
app.get('/api/git/status', async (_req, res) => {
  if (!(await isGitRepo(WORKSPACE))) return res.json({ isRepo: false });
  try {
    const [status, branch] = await Promise.all([
      gitStatus(WORKSPACE),
      gitBranch(WORKSPACE),
    ]);
    res.json({ isRepo: true, branch, files: status });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) });
  }
});
app.get('/api/git/diff', async (req, res) => {
  if (!(await isGitRepo(WORKSPACE))) return res.json({ isRepo: false, diff: '' });
  try {
    const diff = await gitDiff(WORKSPACE, {
      path: req.query.path ? String(req.query.path) : undefined,
      staged: req.query.staged === '1',
    });
    res.type('text/plain').send(diff);
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) });
  }
});
app.get('/api/git/log', async (req, res) => {
  if (!(await isGitRepo(WORKSPACE))) return res.json([]);
  try {
    const n = Math.min(Number(req.query.n ?? 20), 100);
    res.json(await gitLog(WORKSPACE, n));
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) });
  }
});
/**
 * Generate Commit Message：把当前 diff 喂给 LLM，返回 conventional commit message。
 * 输入可选 paths（限定文件），不传 → 全部 staged + unstaged 改动。
 */
app.post('/api/git/generate-message', async (req, res) => {
  if (!(await isGitRepo(WORKSPACE)))
    return res.status(400).json({ error: 'not a git repo' });
  const paths = (req.body?.paths ?? []) as string[];
  try {
    let diff = '';
    if (paths.length) {
      for (const p of paths) {
        diff += await gitDiff(WORKSPACE, { path: p });
      }
    } else {
      diff = (await gitDiff(WORKSPACE, { staged: true })) + '\n' + (await gitDiff(WORKSPACE, {}));
    }
    if (!diff.trim()) {
      return res.json({ message: '', reason: 'no changes detected' });
    }
    // 截断防止 prompt 爆掉
    const truncated = diff.length > 12000 ? diff.slice(0, 12000) + '\n... (truncated)' : diff;
    const sys =
      'You are a commit message generator. Given a unified diff, write ONE conventional commit message:\n' +
      '  - First line: <type>(<scope>): <subject> (<= 72 chars; type ∈ feat|fix|docs|refactor|chore|test|perf|style|ci)\n' +
      '  - Optional body: 2-5 bullet lines starting with "- " explaining what & why (not how)\n' +
      'No fences, no quotes, no extra prose. Output ONLY the message.';
    let out = '';
    for await (const chunk of llmComplete.chatStream(
      [
        { role: 'system', content: sys },
        { role: 'user', content: '### Diff\n' + truncated },
      ],
      { temperature: 0.2 },
    )) {
      if (chunk.delta) out += chunk.delta;
      if (chunk.done || chunk.finishReason) break;
    }
    res.json({ message: out.trim() });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) });
  }
});
app.post('/api/git/commit', async (req, res) => {
  if (!(await isGitRepo(WORKSPACE)))
    return res.status(400).json({ error: 'not a git repo' });
  const { message, paths = [] } = req.body as { message: string; paths?: string[] };
  if (!message?.trim()) return res.status(400).json({ error: 'message required' });
  try {
    const out = await gitCommit(WORKSPACE, message, paths);
    res.json({ ok: true, ...out });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) });
  }
});

// ---- Chat (SSE) ----
app.post('/api/chat', async (req, res) => {
  const {
    messages = [],
    userMessage: rawUserMessage,
    mode = 'agent',
    sessionId: rawSessionId,
    profileId: requestedProfileId,
    images = [],
  } = req.body as {
    messages: ChatMessage[];
    userMessage: string;
    mode?: 'ask' | 'agent' | 'plan';
    sessionId?: string;
    profileId?: string;
    images?: Array<{ type: string; media_type: string; data: string }>;
  };

  // chatSessionId：用于 InjectionCache 跨轮去重的 key。
  // 优先使用真实持久化的 session id（前端传 sess_xxx）。
  // 没传 → 用 IP+UA 简易哈希做 fallback（同一用户的连续对话能共享 cache，但不持久化）。
  const persistSession = rawSessionId && sessions.get(rawSessionId);
  const chatSessionId =
    rawSessionId ||
    `anon:${(req.headers['x-forwarded-for'] as string) ?? req.ip ?? 'local'}`;

  // Slash command 预处理
  let userMessage = rawUserMessage;
  let slashName: string | null = null;
  const slashed = slash.maybeExpand(rawUserMessage);
  if (slashed) {
    userMessage = slashed.expanded;
    slashName = slashed.command;
  }

  // 解析 manual rule 引用 @rule:<name>
  const manualRules: string[] = [];
  userMessage = userMessage.replace(/@rule:([\w-]+)/g, (_m, n) => {
    manualRules.push(n);
    return '';
  }).trim();

  // 解析 @-mentions（@file: / @symbol: / @docs: / @selection: / @web:）
  const mentionResult = await parseMentions(userMessage, {
    workspace: WORKSPACE,
    index,
  });
  userMessage = mentionResult.cleanText || userMessage;
  const explicitContext = mentionResult.items;

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders?.();
  sseTrack.inc();
  req.on('close', () => sseTrack.dec());

  const sse = (evt: any) => res.write(`data: ${JSON.stringify(evt)}\n\n`);
  if (slashName) sse({ type: 'slash', command: slashName });

  // 把 mention 解析结果广播给前端，便于显示"已注入哪些上下文"
  if (mentionResult.items.length || mentionResult.unresolved.length) {
    sse({
      type: 'mentions',
      resolved: mentionResult.items.map((i) => ({ type: i.type, label: i.label })),
      unresolved: mentionResult.unresolved,
    });
  }

  // 记录用户的 mention 当作 'view' 活动 → 下一轮自动注入 recent-activity
  for (const it of mentionResult.items) {
    if (it.type === 'file' && it.label) {
      recentActivity.record(chatSessionId, { kind: 'view', target: it.label });
    }
  }

  // 持久化 user 消息（如果是真实 session）+ 开新 turn
  let currentTurnId: string | null = null;
  if (persistSession) {
    await sessions
      .append(rawSessionId!, { role: 'user', content: rawUserMessage ?? '' })
      .catch((e) => console.warn('[sessions] append user failed', e));
    currentTurnId = await sessions
      .startTurn(rawSessionId!, rawUserMessage ?? '')
      .catch((e) => {
        console.warn('[sessions] startTurn failed', e);
        return null as any;
      });
  }

  // 收集本轮 assistant 输出（用于落盘 & 触发 tool 消息记录）
  let assistantBuf = '';
  // userAbort 提到外层，让 finally 也能读
  let userAbort = false;

  // 自动召回：BM25 + 向量 RRF 混合
  const autoCtx = index
    ? (await hybridRetrieve(index, embedder, userMessage, 6, reranker)).map((h) => ({
        file: `${h.path}:${h.startLine}-${h.endLine}`,
        text: h.text,
      }))
    : [];

  // 把 retrieval 结果（仅 file:lines，不含正文）推给前端 / eval runner，便于评测召回质量
  if (autoCtx.length) {
    sse({
      type: 'retrieval',
      query: userMessage.slice(0, 200),
      hits: autoCtx.map((c, i) => ({ rank: i + 1, file: c.file })),
    });
  }

  // retrieval 命中的文件 → 'read' 活动（前 3 个）
  for (const c of autoCtx.slice(0, 3)) {
    const f = c.file.split(':')[0];
    if (f) recentActivity.record(chatSessionId, { kind: 'read', target: f });
  }

  // 激活 rules
  const touched = autoCtx.map((c) => c.file.split(':')[0]);
  const activeRules = rules.pickForRequest({
    userMessage,
    touchedPaths: touched,
    manual: manualRules,
  });
  const ruleExtra = rules.renderForSystem(activeRules);
  if (activeRules.length) {
    sse({ type: 'rules', activated: activeRules.map((r) => r.name) });
  }

  // 当前 chat profile 的模型名 → 用来推断 contextWindow 触发阈值
  const chatProfile = providers.getActive('chat');
  const chatModel = chatProfile?.model;

  /**
   * L2 LLM 摘要器：用便宜的 complete model 给中间段做摘要。
   * 失败 / 用户没配 complete provider 时 → compactor 自动 fallback 到启发式摘要。
   */
  const llmSummarize = async (middle: ChatMessage[]) => {
    const sys =
      'You are a compaction assistant. Summarize the following conversation excerpt for context preservation.\n' +
      'Preserve: file paths, commands, errors, decisions, TODOs, open questions.\n' +
      'Do NOT copy raw tool outputs or large logs. Output a concise paragraph (max 400 tokens).';
    const userBlock = middle
      .map((m) => `[${m.role}] ${(m.content ?? '').toString().slice(0, 1000)}`)
      .join('\n');
    let out = '';
    for await (const chunk of llmComplete.chatStream(
      [
        { role: 'system', content: sys },
        { role: 'user', content: userBlock },
      ],
      { model: providers.getActive('complete')?.model },
    )) {
      if (chunk.delta) out += chunk.delta;
      if (chunk.done || chunk.finishReason) break;
    }
    return out.trim() || '(empty summary)';
  };

  const initial = await buildMessages({
    userMessage,
    history: messages,
    autoContext: autoCtx,
    explicitContext,
    memory,
    meta: { cwd: WORKSPACE, os: `${os.platform()} ${os.release()}` },
    mode,
    // Provider flavor：让 system prompt 里 tone 段落按 anthropic / openai 走最佳实践
    providerFlavor:
      chatProfile?.kind === 'anthropic' ? 'anthropic' :
      chatProfile?.kind === 'openai' ? 'openai' :
      /gemini/i.test(chatProfile?.model ?? '') ? 'gemini' :
      'generic',
    // Codex Permission Profile：让 LLM 显式知道当前 sandbox / approval 边界
    // 默认 workspace_write + on_failure；在 plan mode 下限制为 read_only
    sandbox: mode === 'plan' ? 'read_only' : 'workspace_write',
    approvalPolicy: 'on_failure',
    systemExtras: [
      // Project Memory（AGENTS.md / CLAUDE.md / MEMORY.md，路径冒泡 + 用户级）
      // 放在最前：作为"项目作者写给所有 AI 的说明"，优先级最高
      projectMemory.renderForSystem(),
      // 自动 verify 结果（用户刚 Accept 后跑过 tsc 的失败/成功反馈）
      // 一次性消费：渲染过即清空，避免 stale
      verifyAfterAccept.consumeForSystem(),
      // Skills 概览（progressive disclosure）—— stable，受 prompt cache 保护
      skills.renderForSystem(),
      // Rules（用户/项目级规则）
      ruleExtra,
      // 自动检测：multi-step user message → 提示 LLM 一开头就 update_plan
      detectMultiStepHint(userMessage),
      // 最近活动：让 LLM 理解"这个文件"/"刚才那个 bug" 等指代
      recentActivity.render(chatSessionId),
    ].filter(Boolean) as string[],
    // 跨轮注入去重：同一 chatSession 里反复 recall 到的同一条 memory / chunk
    // 只在第一次注入，后续轮次自动跳过，省 token + 防过度关注。
    injectionCache,
    sessionId: chatSessionId,
    // 按 token budget 压缩 history（按 chatModel 的 contextWindow 自动算阈值）
    compaction: {
      model: chatModel,
      // Context Window 自适应：优先用 profile 里设置的 contextWindow，
      // 否则走 MODEL_CONTEXT_WINDOWS 注册表自动匹配
      tokenOpts: {
        contextWindowOverride: chatProfile?.contextWindow,
      },
      summarize: llmSummarize,
    },
    onMemoryRecalled: (items) => {
      if (items.length) sse({ type: 'memory_recalled', items });
    },
  });

  // 把压缩 debug 信息推给前端，让用户能看到 token 消耗（生产级体验）
  const compactDbg = (initial as any).__compactDebug;
  if (compactDbg) sse({ type: 'context_stats', ...compactDbg });

  try {
    const abort = new AbortController();
    req.on('close', () => {
      userAbort = true;
      abort.abort();
    });

    // 每次 chat 请求现场构造带 onSwitch 回调的 router，把 provider 切换事件推到前端
    // 如果前端指定了 profileId，构造单 profile router（不走 auto-routing）
    let llmRouted: LLMProvider;
    if (requestedProfileId) {
      const requested = providers.get(requestedProfileId);
      if (requested) {
        llmRouted = createProvider(requested);
      } else {
        sse({ type: 'error', error: `requested profile "${requestedProfileId}" not found, falling back to auto-routing` });
        llmRouted = buildLlmFor('chat', (info) => {
          sse({ type: 'provider_switch', ...info });
        });
      }
    } else {
      llmRouted = buildLlmFor('chat', (info) => {
        sse({ type: 'provider_switch', ...info });
      });
    }

    if (mode === 'ask') {
      // Ask 模式：不绑定工具
      const noToolRegistry = new ToolRegistry();
      for await (const ev of runAgent({
        llm: llmRouted,
        registry: noToolRegistry,
        messages: initial,
        toolCtx: { cwd: WORKSPACE },
        signal: abort.signal,
        maxSteps: 1,
        hooks: hookBus,
        workspace: WORKSPACE,
      })) {
        if (ev.type === 'text' && ev.text) {
          assistantBuf += ev.text;
          if (persistSession && currentTurnId) {
            sessions.appendChunk(rawSessionId!, currentTurnId, ev.text).catch(() => undefined);
          }
        }
        // Flush subagent progress events to SSE client
        while (subagentProgressBuffer.length > 0) {
          const p = subagentProgressBuffer.shift()!;
          sse({ type: 'subagent_progress', ...p });
        }
        sse(ev);
      }
    } else {
      for await (const ev of runAgent({
        llm: llmRouted,
        registry,
        messages: initial,
        toolCtx: {
          cwd: WORKSPACE,
          approve: async (info) => {
            // 推一条 SSE 事件让前端弹审批 UI；REST 回写决议
            const { id, promise } = createApproveRequest({
              tool: info.tool,
              args: info.args,
              reason: (info.args as any)?.reason,
              matchedRule: (info.args as any)?.matchedRule,
            });
            sse({
              type: 'approve_request',
              id,
              tool: info.tool,
              args: info.args,
            });
            return promise;
          },
          execPolicy: (cmd) => permissionAwareDecide(cmd, {
            sandbox: mode === 'plan' ? 'read_only' : 'workspace_write',
            approval: mode === 'plan' ? 'unless_trusted' : 'on_failure',
          }),
          proposeEdit: async (req) => {
            const e = await pendingEdits.propose(req);
            // 主动推一条 pending_edit 事件给前端，让 UI 立刻切到 diff
            sse({ type: 'pending_edit', edit: e });
            return { id: e.id };
          },
          virtualRead: (p) => pendingEdits.virtualRead(p),
          updatePlan: (plan) => {
            // 把 Agent 声明的任务计划广播给前端 PlanPanel
            sse({ type: 'plan', plan });
          },
          codeIntel: {
            async findSymbol(q, limit) {
              return index ? index.symbols.fuzzyFind(q, limit ?? 15) : [];
            },
            async findReferences(name) {
              return index ? index.symbols.findReferences(name) : [];
            },
            async semanticSearch(q, k) {
              return index ? hybridRetrieve(index, embedder, q, k ?? 8, reranker) : [];
            },
            async listFileSymbols(p) {
              return index ? index.symbols.symbolsInFile(p) : [];
            },
          },
          skills: {
            list: () =>
              skills.list().map((s) => ({
                name: s.name,
                description: s.description,
                source: s.source,
              })),
            loadFull: async (name) => {
              const f = await skills.loadFull(name);
              if (!f) return null;
              return {
                name: f.name,
                description: f.description,
                body: f.body,
                directory: f.directory,
                supportFiles: f.supportFiles,
              };
            },
          },
          subagentDepth: 0,
          dispatchSubagent: async (req) => {
            const r = await subagents.spawn({
              task: req.task,
              label: req.label,
              role: req.role,
              parentSessionId: rawSessionId ?? 'no-session',
              parentTurnId: currentTurnId ?? undefined,
              parentDepth: 0,
            });
            sse({
              type: 'subagent_spawned',
              runId: r.runId,
              childSessionId: r.childSessionId,
              label: req.label,
              role: req.role,
              task: req.task,
            });
            return r;
          },
          backgroundTasks: {
            start: (cmd, cwd) => {
              const t = bgTasks.start(cmd, cwd);
              return { id: t.id, status: t.status, startedAt: t.startedAt };
            },
            list: () => bgTasks.list().map((t) => ({
              id: t.id,
              command: t.command,
              status: t.status,
              startedAt: t.startedAt,
              finishedAt: t.finishedAt,
              exitCode: t.exitCode,
            })),
            get: (id) => bgTasks.get(id),
            cancel: (id) => bgTasks.cancel(id),
          },
        },
        signal: abort.signal,
        hooks: hookBus,
        workspace: WORKSPACE,
        toolDescSubstitutions: {
          // 把 .minicodeide/agents/ 下的 role 列表填到 dispatch_subagent 的 description 里
          roles: (() => {
            const names = subagents.getProfileNames();
            if (!names.length) return '(no role profiles found in .minicodeide/agents/)';
            return names.map((p) => `${p.name}${p.description ? ` (${p.description})` : ''}`).join('; ');
          })(),
        },
      })) {
        if (ev.type === 'text' && ev.text) {
          assistantBuf += ev.text;
          if (persistSession && currentTurnId) {
            sessions.appendChunk(rawSessionId!, currentTurnId, ev.text).catch(() => undefined);
          }
        }
        if (ev.type === 'tool_call' && persistSession && currentTurnId) {
          sessions
            .appendTool(rawSessionId!, currentTurnId, {
              name: (ev as any).name,
              args: (ev as any).args,
              result: (ev as any).result,
              error: (ev as any).error,
            })
            .catch(() => undefined);
        }
        // 把 edit/grep/read 工具调用记录到 recent-activity
        if (ev.type === 'tool_call') {
          const name = (ev as any).name as string | undefined;
          const args = (ev as any).args as any;
          if (name && args) {
            if ((name === 'edit_file' || name === 'write_file') && args.path) {
              recentActivity.record(chatSessionId, { kind: 'edit', target: args.path });
            } else if (name === 'read_file' && args.path) {
              recentActivity.record(chatSessionId, { kind: 'read', target: args.path });
            } else if (name === 'grep_search' && args.regex) {
              recentActivity.record(chatSessionId, { kind: 'search', target: args.regex });
            }
          }
        }
        sse(ev);
      }
    }
  } catch (e: any) {
    sse({ type: 'error', error: e?.message ?? String(e) });
    // 标记 turn 异常中断（保留 partial，前端能 resume）
    if (persistSession && currentTurnId) {
      await sessions
        .interruptTurn(rawSessionId!, currentTurnId, e?.message ?? String(e))
        .catch(() => undefined);
    }
  } finally {
    // === Subagent push-announce ===
    // 父 turn 跑完后等所有子 Agent 完成（最多 60s），把累积的 announce 推给前端
    if (rawSessionId) {
      try {
        await subagents.awaitAllForParent(rawSessionId, 60_000);
      } catch {
        /* ignore */
      }
      const pending = subagents.pickPendingAnnouncements(rawSessionId);
      for (const ann of pending) {
        sse({ type: 'subagent_announce', message: ann });
      }
    }
    // 正常结束 → endTurn（把 partial 升级为正式 msg 并清除 interrupt 标记）
    // 用户主动 abort → 标记 interrupted 不写正式 msg
    if (persistSession && currentTurnId) {
      // 区分 userAbort：abort 也是正常结束的一种（用户点 stop），用 interruptTurn
      // 否则若 assistantBuf 非空且没异常，正常 endTurn
      // 但 catch 已经处理异常分支了，这里只剩"成功"和"用户 stop"两种
      // 简化：if abort.signal.aborted → interruptTurn；else endTurn
      if (userAbort) {
        await sessions
          .interruptTurn(rawSessionId!, currentTurnId, 'user_stop')
          .catch(() => undefined);
      } else {
        await sessions
          .endTurn(rawSessionId!, currentTurnId, assistantBuf)
          .catch(() => undefined);
      }
    }
    // === Auto-Memory ===
    // turn 正常结束（非用户主动 stop、非空响应、有 fast/chat provider）→ 异步抽取长期记忆
    if (!userAbort && assistantBuf.length > 0 && (llmFast ?? llmChat)) {
      considerAutoMemory({
        llm: llmFast ?? llmChat,
        memory,
        userMessage: rawUserMessage ?? '',
        assistantReply: assistantBuf,
        sessionId: chatSessionId,
        model: providers.getActive('fast')?.model ?? providers.getActive('chat')?.model,
        workspace: WORKSPACE,
        onSaved: (it) => {
          // 通过 SSE 提示前端，让用户能看到"已记住"
          try {
            sse({ type: 'memory_saved', title: it.title, category: it.category, scope: it.scope });
          } catch { /* sse 可能已经关 */ }
        },
      })
        .then((n) => { if (n > 0) logger.info('[auto-memory] saved', { count: n }); })
        .catch((e) => logger.warn('[auto-memory] failed', { err: String(e) }));
    }
    sse({ type: 'done' });
    res.end();
  }
});

const httpServer = http.createServer(app);
attachLspBridge(httpServer, { path: '/lsp', cwd: WORKSPACE });
attachTerminalBridge(httpServer, { path: '/terminal', cwd: WORKSPACE });

httpServer.listen(PORT, () => {
  printStartupBanner(PORT, WORKSPACE);
  logger.info(`Server listening on http://localhost:${PORT}`);
});

// 优雅退出：关闭 HTTP，等 SSE 排空，最多等 5s 强退
function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully`);
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  setTimeout(() => {
    logger.warn('Forced exit after 5s');
    process.exit(1);
  }, 5000).unref?.();
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));