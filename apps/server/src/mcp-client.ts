
/**
 * MCP (Model Context Protocol) Client —— 借鉴自 docs/learn-claude-code/s19_mcp_plugin。
 *
 * MCP 已成为 Anthropic / Cursor / Cline / Continue 的事实标准，社区有 100+ MCP server。
 * 本模块用最小依赖实现一个 stdio JSON-RPC client：
 *   1. spawn server 子进程（命令在 .minicodeide/mcp.json 配置）
 *   2. 调用 initialize → tools/list 拿到工具清单
 *   3. tools/call 实际执行
 *
 * 工具命名约定：mcp__<server>__<tool>，避免不同 server 的工具名冲突。
 *
 * 配置文件示例（<workspace>/.minicodeide/mcp.json）：
 *   {
 *     "servers": {
 *       "filesystem": {
 *         "command": "npx",
 *         "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
 *         "env": {}
 *       }
 *     }
 *   }
 */
import { spawn, type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { z, type Tool, type ToolRegistry } from '@mini/core';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: any;
}
interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: any;
  error?: { code: number; message: string; data?: any };
}

export interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  /** 可选：禁用某些 tool */
  disabledTools?: string[];
}

export interface McpConfig {
  servers: Record<string, McpServerConfig>;
}

/**
 * 安全白名单：决定哪些 command 被允许 spawn，哪些 args 被禁止。
 * 配置文件：<workspace>/.minicodeide/mcp-allowlist.json
 * 不存在时使用 DEFAULT_ALLOWLIST（仅 npx/uvx/node/python3）。
 */
export interface McpAllowlist {
  allowedCommands: string[];
  /** args 包含任一关键字即拒绝（小写匹配） */
  denyArgs?: string[];
}

export const DEFAULT_ALLOWLIST: McpAllowlist = {
  allowedCommands: ['npx', 'uvx', 'node', 'python3', 'python', 'bunx', 'pnpm', 'docker'],
  denyArgs: ['--allow-shell', '--unsafe', '--rm-rf'],
};

function loadAllowlist(workspace: string): McpAllowlist {
  const f = path.join(workspace, '.minicodeide', 'mcp-allowlist.json');
  if (!fs.existsSync(f)) return DEFAULT_ALLOWLIST;
  try {
    const raw = JSON.parse(fs.readFileSync(f, 'utf8')) as Partial<McpAllowlist>;
    return {
      allowedCommands: raw.allowedCommands ?? DEFAULT_ALLOWLIST.allowedCommands,
      denyArgs: raw.denyArgs ?? DEFAULT_ALLOWLIST.denyArgs,
    };
  } catch {
    return DEFAULT_ALLOWLIST;
  }
}

/** 校验单个 server 配置是否通过 allowlist。返回 null 即通过，否则给拒绝原因。 */
export function validateServerAgainstAllowlist(
  cfg: McpServerConfig,
  allow: McpAllowlist,
): string | null {
  // command 取 basename 比较（用户写 'npx' 或 '/usr/local/bin/npx' 都行）
  const base = path.basename(cfg.command).toLowerCase();
  if (!allow.allowedCommands.map((c) => c.toLowerCase()).includes(base)) {
    return `command "${cfg.command}" not in allowedCommands. Add it to .minicodeide/mcp-allowlist.json`;
  }
  const argsLower = (cfg.args ?? []).map((a) => String(a).toLowerCase());
  for (const deny of allow.denyArgs ?? []) {
    const dl = deny.toLowerCase();
    if (argsLower.some((a) => a.includes(dl))) {
      return `args contain forbidden token "${deny}"`;
    }
  }
  return null;
}

export interface McpToolDef {
  name: string;
  description?: string;
  inputSchema?: any;
}

export class McpClient {
  private proc: ChildProcess | null = null;
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>();
  private buf = '';
  private readyPromise: Promise<void> | null = null;
  public tools: McpToolDef[] = [];
  public connected = false;
  /** P2 修复：自动重连状态 */
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT = 3;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  /** 重连成功/失败回调（McpManager 用于更新工具注册和通知前端） */
  public onReconnect?: (ok: boolean, attempt: number, error?: string) => void;

  constructor(public name: string, public config: McpServerConfig) {}

  async connect(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = (async () => {
      const proc = spawn(this.config.command, this.config.args ?? [], {
        env: { ...process.env, ...(this.config.env ?? {}) },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      this.proc = proc;
      proc.stdout!.setEncoding('utf8');
      proc.stdout!.on('data', (chunk: string) => this.onStdout(chunk));
      proc.stderr!.on('data', (c: Buffer) => {
        // MCP servers 通常用 stderr 打日志，避开 stdout JSON-RPC 通道
        // 这里 swallow，避免污染 server 主日志
      });
      proc.on('exit', (code) => {
        this.connected = false;
        for (const [, p] of this.pending) {
          p.reject(new Error(`MCP server "${this.name}" exited (code=${code})`));
        }
        this.pending.clear();
        // P2 修复：异常退出（code !== 0）时尝试自动重连
        if (code !== 0 && this.reconnectAttempts < this.MAX_RECONNECT) {
          this.scheduleReconnect();
        }
      });
      proc.on('error', (e) => {
        for (const [, p] of this.pending) p.reject(e);
        this.pending.clear();
      });

      // 1. initialize
      await this.request('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'minicodeide', version: '0.1' },
      });
      // 2. notifications/initialized （不需要回包）
      this.notify('notifications/initialized', {});
      // 3. tools/list
      const r = await this.request('tools/list', {});
      this.tools = (r?.tools ?? []) as McpToolDef[];
      if (this.config.disabledTools?.length) {
        const disabled = new Set(this.config.disabledTools);
        this.tools = this.tools.filter((t) => !disabled.has(t.name));
      }
      this.connected = true;
      this.reconnectAttempts = 0; // 连接成功后重置重连计数
    })();
    return this.readyPromise;
  }

  async callTool(name: string, args: any): Promise<any> {
    if (!this.connected) await this.connect();
    const r = await this.request('tools/call', { name, arguments: args ?? {} });
    // MCP 返回 { content: [{type:'text', text:'...'}], isError? }
    return r;
  }

  async close() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = this.MAX_RECONNECT; // 阻止 exit handler 触发重连
    if (this.proc) {
      try { this.proc.kill('SIGTERM'); } catch {/* ignore */}
      this.proc = null;
    }
    this.connected = false;
  }

  /**
   * P2 修复：指数退避自动重连。
   * 延迟 = 1s * 2^attempt（1s → 2s → 4s），最多 MAX_RECONNECT 次。
   */
  private scheduleReconnect() {
    const attempt = this.reconnectAttempts + 1;
    const delay = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s
    console.log(`[mcp:${this.name}] Scheduling reconnect attempt ${attempt}/${this.MAX_RECONNECT} in ${delay}ms`);
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectAttempts = attempt;
      // 重置 readyPromise 以允许重新 connect
      this.readyPromise = null;
      try {
        await this.connect();
        console.log(`[mcp:${this.name}] Reconnected successfully (attempt ${attempt})`);
        this.onReconnect?.(true, attempt);
      } catch (e: any) {
        console.warn(`[mcp:${this.name}] Reconnect failed (attempt ${attempt}): ${e?.message ?? e}`);
        this.onReconnect?.(false, attempt, e?.message ?? String(e));
        // 如果还有重试机会，exit handler 会再次触发 scheduleReconnect
      }
    }, delay);
  }

  private request(method: string, params: any): Promise<any> {
    const id = this.nextId++;
    const req: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP request "${method}" timeout (30s)`));
      }, 30_000);
      this.pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      this.proc!.stdin!.write(JSON.stringify(req) + '\n');
    });
  }

  private notify(method: string, params: any) {
    const req = { jsonrpc: '2.0', method, params };
    try {
      this.proc!.stdin!.write(JSON.stringify(req) + '\n');
    } catch {/* ignore */}
  }

  private onStdout(chunk: string) {
    this.buf += chunk;
    // MCP 用 newline-delimited JSON
    let nl: number;
    while ((nl = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, nl).trim();
      this.buf = this.buf.slice(nl + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line) as JsonRpcResponse;
        if (typeof msg.id === 'number' && this.pending.has(msg.id)) {
          const p = this.pending.get(msg.id)!;
          this.pending.delete(msg.id);
          if (msg.error) p.reject(new Error(`${msg.error.code}: ${msg.error.message}`));
          else p.resolve(msg.result);
        }
      } catch {
        // 非 JSON 行：日志或 bom，忽略
      }
    }
  }
}

export class McpManager {
  private clients = new Map<string, McpClient>();
  constructor(private workspace: string) {}

  async loadAndConnect(): Promise<{ name: string; ok: boolean; error?: string; toolCount?: number }[]> {
    const cfgPath = path.join(this.workspace, '.minicodeide', 'mcp.json');
    if (!fs.existsSync(cfgPath)) return [];
    let cfg: McpConfig;
    try {
      cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    } catch (e: any) {
      return [{ name: '<config>', ok: false, error: `mcp.json parse error: ${e?.message ?? e}` }];
    }
    const allow = loadAllowlist(this.workspace);
    const out: { name: string; ok: boolean; error?: string; toolCount?: number }[] = [];
    for (const [name, sc] of Object.entries(cfg.servers ?? {})) {
      const reject = validateServerAgainstAllowlist(sc, allow);
      if (reject) {
        out.push({ name, ok: false, error: `denied by allowlist: ${reject}` });
        continue;
      }
      const client = new McpClient(name, sc);
      try {
        await client.connect();
        this.clients.set(name, client);
        out.push({ name, ok: true, toolCount: client.tools.length });
      } catch (e: any) {
        out.push({ name, ok: false, error: e?.message ?? String(e) });
      }
    }
    return out;
  }

  list(): McpClient[] { return [...this.clients.values()]; }
  get(name: string) { return this.clients.get(name); }

  async closeAll() {
    for (const c of this.clients.values()) await c.close();
    this.clients.clear();
  }

  /**
   * 把所有已连接的 MCP tools 注册到 ToolRegistry。
   * 命名：mcp__<server>__<tool>
   *
   * 修复（P1）：将 MCP inputSchema（JSON Schema）转换为 zod schema，
   * 使 LLM 能通过 tool parameters 字段获得结构化的参数信息，
   * 而非之前的 z.record(z.string(), z.any()) 万能占位。
   */
  registerToolsTo(registry: ToolRegistry) {
    for (const client of this.clients.values()) {
      for (const tool of client.tools) {
        const fqName = `mcp__${client.name}__${tool.name}`;
        const desc = (tool.description ?? '').slice(0, 1000) || `MCP tool ${tool.name} from "${client.name}".`;

        // 将 inputSchema 转换为 zod schema，让 LLM 能看到结构化参数
        let zodSchema: any;
        try {
          zodSchema = tool.inputSchema ? jsonSchemaToZod(tool.inputSchema) : z.record(z.string(), z.any());
        } catch {
          // 转换失败时 fallback 到万能 schema + description 中注入 schema
          zodSchema = z.record(z.string(), z.any());
        }

        // description 中不再冗余 inputSchema JSON（已由 zod schema 提供结构化参数信息）
        const t: Tool = {
          name: fqName,
          description: `[MCP:${client.name}] ${desc}`.slice(0, 4000),
          schema: zodSchema,
          parallelSafe: false, // 保守：未知副作用 → 串行
          async execute(input: any) {
            const r = await client.callTool(tool.name, input);
            // 标准 MCP 返回 content[]，把 text 拼接做返回（给 LLM 看）
            if (r?.content && Array.isArray(r.content)) {
              const text = r.content
                .map((c: any) => {
                  if (c?.type === 'text') return c.text;
                  if (c?.type === 'image') return `[image ${c.mimeType}]`;
                  if (c?.type === 'resource') return `[resource ${c.resource?.uri}]`;
                  return JSON.stringify(c);
                })
                .join('\n');
              return { ok: !r.isError, content: text, raw: r };
            }
            return r;
          },
        };
        registry.register(t);
      }
    }
  }
}

/**
 * 将 JSON Schema 转换为 zod schema。
 * 覆盖常见 JSON Schema 类型，复杂场景 fallback 到 z.any()。
 *
 * 目的：让 ToolRegistry.toLLMSchemas() 中的 zodToJsonSchema 能产出
 * 正确的结构化参数描述，而非之前的 { type: "object" } 空泛 schema。
 */
function jsonSchemaToZod(schema: any): z.ZodTypeAny {
  if (!schema || typeof schema !== 'object') return z.any();

  const type = schema.type;

  // anyOf / oneOf → z.union（简化为取第一个可行类型，避免过度复杂）
  if (schema.anyOf || schema.oneOf) {
    const variants = (schema.anyOf || schema.oneOf) as any[];
    if (variants.length === 1) return jsonSchemaToZod(variants[0]);
    // 对 "type + null" 模式（nullable），用 .nullable()
    if (variants.length === 2 && variants.some((v: any) => v.type === 'null')) {
      const nonNull = variants.find((v: any) => v.type !== 'null');
      if (nonNull) return jsonSchemaToZod(nonNull).nullable();
    }
    // 其他 union 场景：用 z.any() 避免过度复杂
    return z.any();
  }

  // enum
  if (schema.enum) {
    const values = schema.enum.filter((v: any) => v !== null);
    if (values.length > 0 && values.every((v: any) => typeof v === 'string')) {
      const [first, ...rest] = values as [string, ...string[]];
      let zodEnum = z.enum([first, ...rest] as [string, ...string[]]);
      if (schema.enum.includes(null)) zodEnum = zodEnum.nullable() as any;
      return zodEnum;
    }
    return z.any();
  }

  switch (type) {
    case 'object': {
      const properties = schema.properties ?? {};
      const required = new Set(schema.required ?? []);
      const shape: Record<string, z.ZodTypeAny> = {};

      for (const [key, propSchema] of Object.entries(properties)) {
        let fieldSchema = jsonSchemaToZod(propSchema);
        // 附加 description
        if ((propSchema as any)?.description) {
          fieldSchema = fieldSchema.describe((propSchema as any).description);
        }
        if (!required.has(key)) {
          shape[key] = fieldSchema.optional();
        } else {
          shape[key] = fieldSchema;
        }
      }

      let obj = z.object(shape);

      // additionalProperties 处理
      if (schema.additionalProperties === false) {
        obj = obj.strict();
      }
      // 如果 properties 为空但有 additionalProperties schema，用 z.record
      if (Object.keys(properties).length === 0 && schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        return z.record(z.string(), jsonSchemaToZod(schema.additionalProperties));
      }

      return obj;
    }

    case 'array': {
      if (schema.items) {
        return z.array(jsonSchemaToZod(schema.items));
      }
      return z.array(z.any());
    }

    case 'string':
      return z.string();

    case 'number':
    case 'integer':
      return z.number();

    case 'boolean':
      return z.boolean();

    case 'null':
      return z.null();

    default:
      // unknown type → z.any()，不做强制校验
      return z.any();
  }
}