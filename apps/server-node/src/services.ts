
/**
 * services.ts —— 手动 services container（替代 Nest DI）
 * ---------------------------------------------------------------
 * 设计：
 *   一个简单的 `class Services` 持有所有共享 service 实例。
 *   构造时按顺序 new 出来，handler 通过 `services.xxx` 访问。
 *
 *   - 没有装饰器，没有反射，没有元数据
 *   - 没有 Module 边界，没有 Global 概念
 *   - "依赖注入" = 构造函数参数 + 闭包
 *
 * 这种"手动组装"的好处（参考 CodeFlicker）：
 *   - 启动 <50ms（Nest 启动 ~1s）
 *   - 体积小（无 reflect-metadata / @nestjs/core）
 *   - 依赖关系一目了然（不需要 IDE 跳转看 @Inject）
 *   - 易测试（直接 new 一个，传 mock 即可）
 */
import path from 'node:path';
import {
  ToolRegistry, registerBuiltinTools,
  OpenAICompatProvider, MemoryStore, InjectionCache,
  RecentActivityTracker,
  type LLMProvider,
} from '@mini/core';
import {
  buildIndex, createEmbedder,
  type CodebaseIndex, type Embedder,
} from '@mini/indexer';
import { PendingEditStore } from '../../server/src/pending-edit.js';
import { CheckpointStore } from '../../server/src/checkpoint.js';
import { RulesStore } from '../../server/src/rules.js';
import { ProjectMemoryStore } from '../../server/src/project-memory.js';
import { SlashCommandRegistry } from '../../server/src/slash-commands.js';
import { ProviderStore } from '../../server/src/providers.js';
import { SessionStore } from '../../server/src/session-store.js';
import { SkillStore } from '../../server/src/skill-store.js';
import { SubagentManager } from '../../server/src/subagent-manager.js';
import { McpManager } from '../../server/src/mcp-client.js';
import { LLMRouter } from '../../server/src/llm-router.js';
import { buildReranker, type Reranker } from '../../server/src/reranker.js';
import { hybridRetrieve } from '../../server/src/retrieval.js';
import { decideCommand } from '../../server/src/exec-policy.js';
import { IndexWatcher } from '../../server/src/watcher.js';
import { ApprovalsStore } from './approvals.js';
import { env } from './env.js';

export class Services {
  workspace: string;

  providers!: ProviderStore;
  memory!: MemoryStore;
  injectionCache!: InjectionCache;
  recentActivity!: RecentActivityTracker;
  registry!: ToolRegistry;
  pendingEdits!: PendingEditStore;
  checkpoints!: CheckpointStore;
  rules!: RulesStore;
  projectMemory!: ProjectMemoryStore;
  slash!: SlashCommandRegistry;
  sessions!: SessionStore;
  skills!: SkillStore;
  subagents!: SubagentManager;
  mcpManager!: McpManager;
  approvals!: ApprovalsStore;

  llmChat!: LLMProvider;
  llmComplete!: LLMProvider;
  llmFast!: LLMProvider;
  embedder!: Embedder;
  reranker!: Reranker;
  vectorPath!: string;

  index: CodebaseIndex | null = null;
  private indexing = false;
  watcher!: IndexWatcher;
  /** 文件变更 SSE 客户端集合 */
  fsEventClients = new Set<import('http').ServerResponse>();

  constructor(workspace: string) {
    this.workspace = workspace;
  }

  /** Live workspace switch (used by POST /api/workspace/switch).
   *  - 重置 workspace 字段
   *  - 停掉旧 watcher
   *  - 把指向 workspace 路径的子 store 重新指过去
   *  - 重新构建 index（异步）
   *
   *  注意：LSP / terminal bridge 是 ws upgrade 在主进程已经绑定 cwd，热切换需要前端
   *  断开重连这些 ws；目前我们仅热切换 file APIs + index，足够 explorer / chat 用。
   */
  async switchWorkspace(next: string): Promise<void> {
    if (!next || next === this.workspace) return;
    console.log(`[server-node] switching workspace: ${this.workspace} -> ${next}`);
    try { this.watcher?.stop?.(); } catch { /* ignore */ }
    this.workspace = next;

    // 重新建 path-scoped stores
    this.providers = new ProviderStore(this.workspace);
    await this.providers.load();
    this.vectorPath = path.join(
      this.workspace, '.minicodeide',
      `vectors.${this.embedder.name.replace(/[^a-z0-9]+/gi, '_')}.jsonl`,
    );
    this.pendingEdits = new PendingEditStore(this.workspace);
    this.checkpoints = new CheckpointStore(this.workspace);
    await this.checkpoints.init();
    this.rules = new RulesStore(this.workspace);
    await this.rules.load();
    this.projectMemory = new ProjectMemoryStore(this.workspace);
    await this.projectMemory.load();
    this.slash = new SlashCommandRegistry(this.workspace);
    await this.slash.loadUser();
    this.sessions = new SessionStore(this.workspace);
    await this.sessions.load();
    this.skills = new SkillStore(this.workspace);
    await this.skills.load();

    // 重建 MCP
    try { await this.mcpManager?.closeAll(); } catch { /* ignore */ }
    this.mcpManager = new McpManager(this.workspace);
    await this.mcpManager.loadAndConnect();
    this.mcpManager.registerToolsTo(this.registry);

    // 重建 watcher / index
    this.index = null;
    this.watcher = new IndexWatcher({
      root: this.workspace,
      index: () => this.index,
      embedder: () => this.embedder,
      vectorPath: () => this.vectorPath,
      onProgress: (m) => console.log(m),
      onFileChange: (events) => {
        const data = JSON.stringify({ type: 'fs_change', events });
        for (const client of this.fsEventClients) {
          try { client.write(`data: ${data}\n\n`); } catch { /* client disconnected */ }
        }
      },
    });
    this.watcher.start();
    void this.ensureIndex();
  }

  async init() {
    // ----- Providers ----------------------------------
    this.providers = new ProviderStore(this.workspace);
    await this.providers.load();

    this.llmChat = this.buildLlmFor('chat');
    this.llmComplete = this.buildLlmFor('complete');
    this.llmFast = this.buildLlmFor('fast');
    this.embedder = this.buildEmbedderFor();
    this.reranker = buildReranker();
    this.vectorPath = path.join(
      this.workspace, '.minicodeide',
      `vectors.${this.embedder.name.replace(/[^a-z0-9]+/gi, '_')}.jsonl`,
    );

    this.providers.onChange = () => {
      this.llmChat = this.buildLlmFor('chat');
      this.llmComplete = this.buildLlmFor('complete');
      this.llmFast = this.buildLlmFor('fast');
      const oldName = this.embedder.name;
      this.embedder = this.buildEmbedderFor();
      if (this.embedder.name !== oldName) {
        this.vectorPath = path.join(
          this.workspace, '.minicodeide',
          `vectors.${this.embedder.name.replace(/[^a-z0-9]+/gi, '_')}.jsonl`,
        );
        this.index = null;
        void this.ensureIndex();
      }
      this.memory.setEmbedder(this.buildMemoryEmbedder());
    };

    // ----- Memory --------------------------------------
    this.memory = new MemoryStore({
      projectPath: this.workspace,
      embedder: this.buildMemoryEmbedder(),
    });
    this.injectionCache = new InjectionCache({ perSessionCap: 100, maxSessions: 64 });
    this.recentActivity = new RecentActivityTracker({ perSessionCap: 30, ttlMs: 30 * 60 * 1000 });

    this.memory.maintain().catch(() => undefined);
    const t = setInterval(() => { this.memory.maintain().catch(() => undefined); },
      6 * 60 * 60 * 1000);
    t.unref?.();

    // ----- Tools / Edits / Checkpoints -----------------
    this.registry = new ToolRegistry();
    registerBuiltinTools(this.registry);
    this.pendingEdits = new PendingEditStore(this.workspace);
    this.checkpoints = new CheckpointStore(this.workspace);
    await this.checkpoints.init();
    // accept 前自动 snapshot
    this.pendingEdits.onBeforeWrite = async (edits) => {
      if (!edits.length) return;
      await this.checkpoints.create({
        label: edits.length === 1 ? `accept ${edits[0].path}` : `accept ${edits.length} files`,
        trigger: edits.length === 1 ? 'accept' : 'accept_all',
        files: edits.map((e) => ({ path: e.path, newContent: e.newContent })),
      });
      await this.checkpoints.prune(100);
    };

    // ----- Rules / Slash / Sessions / Skills -----------
    this.rules = new RulesStore(this.workspace);
    await this.rules.load();
    this.projectMemory = new ProjectMemoryStore(this.workspace);
    await this.projectMemory.load();
    this.slash = new SlashCommandRegistry(this.workspace);
    await this.slash.loadUser();
    this.sessions = new SessionStore(this.workspace);
    await this.sessions.load();
    this.skills = new SkillStore(this.workspace);
    await this.skills.load();

    // ----- Approvals -----------------------------------
    this.approvals = new ApprovalsStore();

    // ----- Subagents -----------------------------------
    this.subagents = new SubagentManager({
      llm: () => this.llmFast ?? this.llmChat,
      sessions: this.sessions,
      workspaceRoot: this.workspace,
      defaultModel: () =>
        this.providers.getActive('fast')?.model ?? this.providers.getActive('chat')?.model,
      childToolCtxFactory: () => ({
        cwd: this.workspace,
        execPolicy: (cmd) => decideCommand(cmd),
        codeIntel: {
          findSymbol: async (q, limit) =>
            this.index ? this.index.symbols.fuzzyFind(q, limit ?? 15) : [],
          findReferences: async (name) =>
            this.index ? this.index.symbols.findReferences(name) : [],
          semanticSearch: async (q, k) =>
            this.index ? hybridRetrieve(this.index, this.embedder, q, k ?? 8, this.reranker) : [],
          listFileSymbols: async (p) =>
            this.index ? this.index.symbols.symbolsInFile(p) : [],
        },
        skills: {
          list: () => this.skills.list().map((s) => ({
            name: s.name, description: s.description, source: s.source,
          })),
          loadFull: async (name) => {
            const f = await this.skills.loadFull(name);
            if (!f) return null;
            return {
              name: f.name, description: f.description, body: f.body,
              directory: f.directory, supportFiles: f.supportFiles,
            };
          },
        },
      }),
    });

    // ----- MCP Manager -----------------------------------
    this.mcpManager = new McpManager(this.workspace);
    const mcpResults = await this.mcpManager.loadAndConnect();
    if (mcpResults.length) {
      for (const r of mcpResults) {
        if (r.ok) console.log(`[MCP] ${r.name} connected (${r.toolCount ?? 0} tools)`);
        else console.log(`[MCP] ${r.name} failed: ${r.error}`);
      }
      this.mcpManager.registerToolsTo(this.registry);
    }

    // ----- File watcher --------------------------------
    this.watcher = new IndexWatcher({
      root: this.workspace,
      index: () => this.index,
      embedder: () => this.embedder,
      vectorPath: () => this.vectorPath,
      onProgress: (m) => console.log(m),
      onFileChange: (events) => {
        const data = JSON.stringify({ type: 'fs_change', events });
        for (const client of this.fsEventClients) {
          try { client.write(`data: ${data}\n\n`); } catch { /* client disconnected */ }
        }
      },
    });
    this.watcher.start();
    void this.ensureIndex();
  }

  buildLlmFor(role: 'chat' | 'complete' | 'fast', onSwitch?: (info: any) => void): LLMProvider {
    const chain = this.providers.getRoleChain(role);
    if (chain.length === 0) {
      return new OpenAICompatProvider({
        baseURL: 'https://api.deepseek.com/v1',
        apiKey: 'sk-mock',
        defaultModel: 'deepseek-chat',
        embedModel: 'text-embedding-3-small',
      });
    }
    return new LLMRouter({ profiles: chain, onSwitch });
  }

  buildEmbedderFor(): Embedder {
    const p = this.providers.getActive('embed');
    if (!p || p.hash) return createEmbedder({ provider: 'hash' });
    return createEmbedder({
      provider: 'openai',
      baseUrl: p.baseUrl,
      apiKey: p.apiKey,
      model: p.embedModel ?? 'text-embedding-3-small',
      dim: p.embedDim,
    });
  }

  buildMemoryEmbedder() {
    const emb = this.embedder;
    return {
      name: emb.name,
      async embed(texts: string[]): Promise<number[][]> {
        const vecs = await emb.embed(texts);
        return vecs.map((v) => Array.from(v));
      },
    };
  }

  async ensureIndex() {
    if (this.index || this.indexing) return;
    this.indexing = true;
    try {
      this.index = await buildIndex(
        this.workspace,
        { embedder: this.embedder, vectorPath: this.vectorPath, reuseVectors: true },
        () => undefined,
      );
      console.log(`[indexer] done: ${this.index.fileCount} files, ${this.index.chunkCount} chunks`);
    } catch (e) {
      console.error('[indexer] failed', e);
    } finally {
      this.indexing = false;
    }
  }
}

export { env };