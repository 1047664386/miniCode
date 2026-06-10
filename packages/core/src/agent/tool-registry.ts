import { z, ZodType } from 'zod';
import type { ToolSchema } from '../llm/types.js';

export interface ToolContext {
  cwd: string;
  /** 用户确认。返回 false 表示拒绝执行 */
  approve?: (info: { tool: string; args: unknown }) => Promise<boolean>;
  /** 待审查编辑钩子；若提供，则 write_file/edit_file 走 propose 而非直接落盘 */
  proposeEdit?: (req: {
    path: string;
    newContent: string;
    tool: string;
  }) => Promise<{ id: string }>;
  /** 读取最新虚拟内容（叠加 pending edit） */
  virtualRead?: (relPath: string) => Promise<string>;
  /** 代码图谱/向量检索钩子（由 server 注入） */
  codeIntel?: {
    findSymbol(query: string, limit?: number): Promise<any[]>;
    findReferences(name: string): Promise<any[]>;
    semanticSearch(query: string, k?: number): Promise<any[]>;
    listFileSymbols(path: string): Promise<any[]>;
  };
  /** Plan / TodoList 回调（update_plan tool 用） */
  updatePlan?: (plan: PlanState) => Promise<void> | void;
  /** Skill 加载钩子（use_skill tool 用） */
  skills?: {
    list(): Array<{ name: string; description: string; source: string }>;
    loadFull(name: string): Promise<{
      name: string;
      description: string;
      body: string;
      directory: string;
      supportFiles: string[];
    } | null>;
  };
  /** Subagent 调度钩子（dispatch_subagent tool 用） */
  dispatchSubagent?: (req: {
    task: string;
    label?: string;
    /** 角色名（来自 .minicodeide/agents/<name>.md） */
    role?: string;
    /** 调用者 sessionId（parent），announce 时回路用 */
    parentSessionId?: string;
    /** 主 turn 当前 turnId（用于关联） */
    parentTurnId?: string;
  }) => Promise<{ runId: string; childSessionId: string }>;
  /** 当前 depth（防嵌套） */
  subagentDepth?: number;
  /**
   * Exec 安全策略：判定一条命令是否可直接执行 / 需审批 / 禁止。
   * server 注入；不存在则按 "ask" 默认（沿用 requiresApproval 老路径）。
   */
  execPolicy?: (command: string) => {
    verdict: 'auto' | 'ask' | 'deny';
    reason: string;
    matchedRule?: string;
  };
  /**
   * 后台任务管理器。提供给 run_command + 后台 tool 用：
   *   - start(command, cwd)    立即返回 bg_id
   *   - list()                 列所有 task
   *   - get(id)                取详情
   *   - cancel(id)             取消运行中的任务
   */
  backgroundTasks?: {
    start(command: string, cwd: string): { id: string; status: string; startedAt: number };
    list(): Array<{ id: string; command: string; status: string; startedAt: number; finishedAt?: number; exitCode?: number | null }>;
    get(id: string): { id: string; command: string; status: string; stdout: string; stderr: string; exitCode?: number | null; startedAt: number; finishedAt?: number } | undefined;
    cancel(id: string): boolean;
  };
  /**
   * P1 修复：run_command 执行前的 checkpoint 钩子。
   * 对文件修改类命令（cp/mv/touch/mkdir/sed 等），在执行前快照目标文件，
   * 使用户可以通过 checkpoint revert 撤销 run_command 的副作用。
   */
  checkpoint?: (opts: { label: string; trigger: string; files: { path: string; newContent: string }[] }) => Promise<void>;
}

export interface PlanItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  /** 优先级（可选）：high / medium / low */
  priority?: 'high' | 'medium' | 'low';
  /** 父任务 id，用于嵌套子任务（可选） */
  parentId?: string;
  /** 备注（可选）：附加上下文 / 阻塞原因 */
  note?: string;
}

export interface PlanState {
  items: PlanItem[];
  /** 可选总体说明 */
  summary?: string;
}

export interface Tool<I = any, O = any> {
  name: string;
  description: string;
  schema: ZodType<I>;
  execute(input: I, ctx: ToolContext): Promise<O>;
  requiresApproval?: boolean;
  /**
   * 是否可与其他 parallelSafe=true 的 tool 并发执行。
   * 纯读类工具（read_file/list_files/grep/find_symbol/...）应为 true；
   * 写类（write_file/edit_file/run_command）应为 false 或省略，会强制串行。
   */
  parallelSafe?: boolean;
}

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register<I, O>(tool: Tool<I, O>) {
    this.tools.set(tool.name, tool as Tool);
    return this;
  }

  unregister(name: string) {
    this.tools.delete(name);
    return this;
  }

  list(): Tool[] {
    return [...this.tools.values()];
  }

  get(name: string) {
    return this.tools.get(name);
  }

  toLLMSchemas(substitutions?: Record<string, string>): ToolSchema[] {
    return this.list().map((t) => {
      let desc = t.description;
      // 运行时占位符替换：{key} → substitutions[key]（subagent role 列表等动态内容）
      if (substitutions) {
        for (const [k, v] of Object.entries(substitutions)) {
          desc = desc.split(`{${k}}`).join(v);
        }
      }
      return {
        name: t.name,
        description: desc,
        parameters: zodToJsonSchema(t.schema),
      };
    });
  }

  /**
   * 创建一个仅包含指定 tool 名的子 registry（不深拷贝 tool 本身）。
   * 用于 Agents Window 的 Work 模式（只暴露读类工具）。
   * - names 中找不到的名字会被忽略
   * - 共享同一份 tool 实例（execute 行为完全一致）
   */
  filter(names: string[]): ToolRegistry {
    const sub = new ToolRegistry();
    for (const n of names) {
      const t = this.tools.get(n);
      if (t) sub.register(t);
    }
    return sub;
  }

  /** 预设：只读 / 通用咨询 用的精简 profile */
  static readonly CHAT_ONLY_PROFILE = [
    'read_file',
    'list_files',
    'grep_search',
    'find_symbol',
    'search_web',
  ];

  async execute(name: string, rawArgs: unknown, ctx: ToolContext) {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool not found: ${name}`);
    const parsed = tool.schema.safeParse(rawArgs);
    if (!parsed.success) {
      throw new Error(`Tool ${name} args invalid: ${parsed.error.message}`);
    }
    if (tool.requiresApproval && ctx.approve) {
      const ok = await ctx.approve({ tool: name, args: parsed.data });
      if (!ok) throw new Error(`User rejected tool: ${name}`);
    }
    return tool.execute(parsed.data, ctx);
  }
}

/** 简易 zod → JSON Schema 转换（够 LLM 用即可，不做完美兼容） */
function zodToJsonSchema(schema: ZodType): Record<string, unknown> {
  const def: any = (schema as any)._def;
  if (def.typeName === 'ZodObject') {
    const shape = def.shape();
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [k, v] of Object.entries<any>(shape)) {
      properties[k] = zodToJsonSchema(v);
      if (!v.isOptional?.()) required.push(k);
    }
    return { type: 'object', properties, required };
  }
  if (def.typeName === 'ZodString') return { type: 'string', description: def.description };
  if (def.typeName === 'ZodNumber') return { type: 'number', description: def.description };
  if (def.typeName === 'ZodBoolean') return { type: 'boolean', description: def.description };
  if (def.typeName === 'ZodArray') return { type: 'array', items: zodToJsonSchema(def.type) };
  if (def.typeName === 'ZodOptional') return zodToJsonSchema(def.innerType);
  if (def.typeName === 'ZodDefault') return zodToJsonSchema(def.innerType);
  if (def.typeName === 'ZodEnum') return { type: 'string', enum: def.values };
  return { type: 'string' };
}

// re-export zod for tool definitions
export { z };