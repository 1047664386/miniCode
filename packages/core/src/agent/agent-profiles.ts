/**
 * Agent Profile Loader — .minicodeide/agents/<name>.md 角色配置加载器
 * 参考 Claude Code 的 `.claude/agents/<role>.md` 设计
 * 项目可以在 .minicodeide/agents/ 下定义专属角色，每个角色包含：
 *  - 自定义 system prompt (body)
 *  - YAML frontmatter 控制：allowed_tools / denied_tools / sandbox / max_steps / description
 *
 * 当父 Agent 调用 `dispatch_subagent({ role: 'code-reviewer' })` 时，
 * 会自动加载对应 profile，注入到子 Agent 的 system prompt + 裁剪工具集。
 *
 * Frontmatter 格式示例：
 * ---
 * name: code-reviewer
 * description: Reviews code for bugs, style, and best practices
 * allowed_tools: [read_file, list_files, grep, find_symbol, find_references, semantic_search, list_file_symbols]
 * sandbox: read-only
 * max_steps: 6
 * ---
 * You are a code reviewer. Focus on ...
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * 角色配置接口
 */
export interface AgentProfile {
  /** 角色名（从 frontmatter 或文件名推导） */
  name: string;
  /** 人类可读描述（用于 UI 展示 + tool description 里列角色清单） */
  description: string;
  /** 工具白名单。不设 = 子 Agent 用全工具集（再由子 Agent registry 默认裁剪） */
  allowedTools?: string[];
  /** 工具黑名单。和 allowedTools 互斥，优先用 allowedTools */
  deniedTools?: string[];
  /** 子 Agent sandbox 模式（覆盖 SubagentManager 默认） */
  sandbox?: 'read-only' | 'workspace_write';
  /** 子 Agent 最大步数（覆盖 SubagentManager 默认 8） */
  maxSteps?: number;
  /** 角色 system prompt body（frontmatter 下方的内容） */
  systemPrompt: string;
  /** 来源文件路径（debug 用） */
  sourceFile: string;
}

/**
 * 解析 .md 文件的 YAML frontmatter + body
 * 极简实现：不引入 gray-matter，手写 22 行解析
 * @param raw 原始文件内容
 * @returns { attrs: 解析后的配置对象, body: 正文内容 }
 */
function parseFrontMatter(raw: string): {
  attrs: Record<string, unknown>;
  body: string;
} {
  const trimmed = raw.trimStart();
  // 没有 frontmatter 标记，直接返回空配置和原内容
  if (!trimmed.startsWith('---')) {
    return { attrs: {}, body: raw };
  }

  // 找到 frontmatter 结束标记（第二个 ---）
  const end = trimmed.indexOf('---', 3);
  if (end === -1) return { attrs: {}, body: raw };

  // 解析 frontmatter 部分和正文部分
  const fmStr = trimmed.slice(3, end).trim();
  const body = trimmed.slice(end + 3).trim();
  const attrs: Record<string, unknown> = {};

  // 逐行解析 frontmatter
  for (const line of fmStr.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    let val: unknown = line.slice(colonIdx + 1).trim();

    // 解析数组格式，如 allowed_tools: [read_file, list_files]
    if (typeof val === 'string' && val.startsWith('[') && val.endsWith(']')) {
      val = val
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    }

    // 解析布尔值
    if (val === 'true') val = true;
    if (val === 'false') val = false;

    // 解析数字
    if (typeof val === 'string' && /^\d+$/.test(val)) val = Number(val);

    attrs[key] = val;
  }

  return { attrs, body };
}

/**
 * 把可能为字符串或数组的值转为字符串数组
 * @param v 待转换的值
 * @returns 转换后的字符串数组，或 undefined
 */
function attrsToStringArray(v: unknown): string[] | undefined {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean);
  return undefined;
}

/**
 * 将原始文件内容转换为 AgentProfile 对象
 * @param raw 原始文件内容
 * @param filePath 文件路径
 * @returns 解析后的 AgentProfile
 */
function rawToProfile(raw: string, filePath: string): AgentProfile {
  const { attrs, body } = parseFrontMatter(raw);
  // 从文件名推导角色名（如 code-reviewer.md → code-reviewer）
  const nameFromPath = path.basename(filePath, '.md');

  return {
    name: (attrs.name as string) ?? nameFromPath,
    description: (attrs.description as string) ?? '',
    allowedTools: attrsToStringArray(attrs.allowed_tools ?? attrs.allowedTools),
    deniedTools: attrsToStringArray(attrs.denied_tools ?? attrs.deniedTools),
    sandbox: (attrs.sandbox as AgentProfile['sandbox']) ?? undefined,
    maxSteps: typeof attrs.max_steps === 'number' ? attrs.max_steps : typeof attrs.maxSteps === 'number' ? attrs.maxSteps : undefined,
    systemPrompt: body,
    sourceFile: filePath,
  };
}

/**
 * 从 workspace 的 .minicodeide/agents/ 目录加载所有角色文件
 * @param workspaceRoot 工作区根目录
 * @returns 角色名到 AgentProfile 的 Map，目录不存在返回空 Map
 */
export async function loadAgentProfiles(workspaceRoot: string): Promise<Map<string, AgentProfile>> {
  const profiles = new Map<string, AgentProfile>();
  const agentsDir = path.join(workspaceRoot, '.minicodeide', 'agents');
  let entries: string[];

  try {
    // 读取 agents 目录下的所有文件
    entries = await fs.readdir(agentsDir);
  } catch {
    // 目录不存在，正常返回空 Map
    return profiles;
  }

  // 遍历所有文件，只处理 .md 文件
  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue;
    const fp = path.join(agentsDir, entry);

    try {
      const raw = await fs.readFile(fp, 'utf-8');
      const profile = rawToProfile(raw, fp);
      profiles.set(profile.name, profile);
    } catch {
      // 单个文件读取失败不阻塞整体加载
    }
  }

  return profiles;
}

/**
 * 同步版：在启动时预加载角色清单（description + name），用于 tool description
 * 完整 profile 加载仍是异步（loadAgentProfiles）
 * @param workspaceRoot 工作区根目录
 * @returns 角色名称和描述的数组
 */
export async function listAgentProfileNames(workspaceRoot: string): Promise<Array<{ name: string; description: string }>> {
  const profiles = await loadAgentProfiles(workspaceRoot);
  return [...profiles.values()].map((p) => ({ name: p.name, description: p.description }));
}

/**
 * 根据 role name 加载单个 profile（从预加载的 Map 里查）
 * 外部应在 server 启动时 loadAgentProfiles 一次，后续直接查 Map
 * @param profiles 预加载的角色 Map
 * @param roleName 角色名
 * @returns 对应的 AgentProfile，不存在返回 undefined
 */
export function getProfile(profiles: Map<string, AgentProfile>, roleName: string): AgentProfile | undefined {
  return profiles.get(roleName);
}