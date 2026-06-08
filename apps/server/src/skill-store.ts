
/**
 * SkillStore —— Skills 管理（仿 CodeFlicker 设计）
 * ----------------------------------------------------------
 *
 * 什么是 Skill？
 *   一个可复用的"领域知识包"，由 SKILL.md 描述触发条件 + 操作步骤，
 *   LLM 在 system prompt 看到概览（progressive disclosure），需要时调
 *   `use_skill(name)` 把全文加载到 context。
 *
 * 目录结构：
 *   <workspace>/.minicodeide/skills/<name>/SKILL.md      # project-level（仓库内共享）
 *   ~/.minicodeide/skills/<name>/SKILL.md                # user-level（跨仓库）
 *
 * SKILL.md 格式（frontmatter + body）：
 *   ---
 *   name: my-skill
 *   description: 当用户要 xxx / 触发关键词
 *   user_invocable: true
 *   ---
 *   # 这里写 skill 的完整指引
 *   ...
 *
 * 为什么 Progressive Disclosure？
 *   skill 全文可能很长（几千字），全塞 system prompt 会爆 context。
 *   只塞 概要（name + description）让模型决定是否调 use_skill；
 *   命中再加载全文。这是 CodeFlicker / Claude Code 的标准做法。
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface SkillMeta {
  name: string;
  description: string;
  /** 是否允许用户主动调用（reserved，用于未来 /skill 命令） */
  userInvocable: boolean;
  /** 源：'project' = workspace 内 / 'user' = 用户 home */
  source: 'project' | 'user';
  /** SKILL.md 绝对路径 */
  filePath: string;
  /** skill 根目录绝对路径（用于读取 support files） */
  directory: string;
}

export interface SkillFull extends SkillMeta {
  /** SKILL.md 的全文 body（去掉 frontmatter） */
  body: string;
  /** 目录下其他支持文件路径列表（相对 directory） */
  supportFiles: string[];
}

export class SkillStore {
  private workspace: string;
  private cache = new Map<string, SkillMeta>();
  private fullCache = new Map<string, SkillFull>();

  constructor(workspace: string) {
    this.workspace = workspace;
  }

  async load(): Promise<void> {
    this.cache.clear();
    this.fullCache.clear();
    const projectDir = path.join(this.workspace, '.minicodeide', 'skills');
    const userDir = path.join(os.homedir(), '.minicodeide', 'skills');
    // 注意先加载 user 再加载 project，让 project 同名覆盖 user
    await this.scanDir(userDir, 'user');
    await this.scanDir(projectDir, 'project');
  }

  list(): SkillMeta[] {
    return [...this.cache.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  get(name: string): SkillMeta | undefined {
    return this.cache.get(name);
  }

  /** 加载 skill 全文（懒加载 + 缓存） */
  async loadFull(name: string): Promise<SkillFull | null> {
    const cached = this.fullCache.get(name);
    if (cached) return cached;
    const meta = this.cache.get(name);
    if (!meta) return null;
    const raw = await fs.readFile(meta.filePath, 'utf-8').catch(() => '');
    const { body } = parseFrontmatter(raw);
    const supportFiles = await listSupportFiles(meta.directory).catch(() => []);
    const full: SkillFull = { ...meta, body, supportFiles };
    this.fullCache.set(name, full);
    return full;
  }

  /**
   * 生成 system prompt 注入文本：仅概览（name + description），不含全文
   *
   * 设计：每条 skill 1 行，最多 30 行；超出截断告知 LLM 用 `/api/skills` 查更多
   */
  renderForSystem(): string {
    const all = this.list();
    if (all.length === 0) return '';
    const lines = ['# Available Skills (call `use_skill(name=...)` to load full instructions)'];
    const cap = 30;
    for (const s of all.slice(0, cap)) {
      lines.push(`- **${s.name}** [${s.source}]: ${s.description.slice(0, 160)}`);
    }
    if (all.length > cap) {
      lines.push(`- ... ${all.length - cap} more available; use \`use_skill\` with the exact name.`);
    }
    return lines.join('\n');
  }

  private async scanDir(dir: string, source: 'project' | 'user'): Promise<void> {
    let entries: string[] = [];
    try {
      entries = await fs.readdir(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const skillDir = path.join(dir, name);
      let stat;
      try {
        stat = await fs.stat(skillDir);
      } catch {
        continue;
      }
      if (!stat.isDirectory()) continue;
      const skillMd = path.join(skillDir, 'SKILL.md');
      let raw: string;
      try {
        raw = await fs.readFile(skillMd, 'utf-8');
      } catch {
        continue; // 没有 SKILL.md 跳过
      }
      const { frontmatter } = parseFrontmatter(raw);
      const skillName = (frontmatter.name as string) ?? name;
      const description = (frontmatter.description as string) ?? '';
      const userInvocable = frontmatter.user_invocable !== false; // 默认 true
      const meta: SkillMeta = {
        name: skillName,
        description,
        userInvocable,
        source,
        filePath: skillMd,
        directory: skillDir,
      };
      this.cache.set(skillName, meta);
    }
  }
}

/** 解析 YAML-lite frontmatter（只支持 key: value，不递归） */
function parseFrontmatter(raw: string): { frontmatter: Record<string, unknown>; body: string } {
  if (!raw.startsWith('---')) return { frontmatter: {}, body: raw };
  const end = raw.indexOf('\n---', 3);
  if (end < 0) return { frontmatter: {}, body: raw };
  const headerBlock = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).replace(/^\n/, '');
  const fm: Record<string, unknown> = {};
  for (const line of headerBlock.split('\n')) {
    const m = line.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    let value: unknown = m[2].trim();
    if (value === 'true') value = true;
    else if (value === 'false') value = false;
    else if (typeof value === 'string' && /^-?\d+$/.test(value)) value = Number(value);
    // 去掉引号
    if (typeof value === 'string' && /^["'].*["']$/.test(value)) value = value.slice(1, -1);
    fm[m[1]] = value;
  }
  return { frontmatter: fm, body };
}

async function listSupportFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (cur: string, rel: string) => {
    const entries = await fs.readdir(cur, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      const child = path.join(cur, e.name);
      const childRel = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (e.name.startsWith('.') || e.name === 'node_modules') continue;
        await walk(child, childRel);
      } else if (e.isFile() && e.name !== 'SKILL.md') {
        out.push(childRel);
      }
    }
  };
  await walk(dir, '');
  return out.slice(0, 100); // 防 explode
}