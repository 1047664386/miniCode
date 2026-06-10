
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
import chokidar, { type FSWatcher } from 'chokidar';

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
  /** 触发关键词列表（来自 frontmatter triggers 字段），用于自动匹配用户输入 */
  triggers: string[];
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
  private watcher: FSWatcher | null = null;
  /** 文件变更导致自动重载后的回调（用于 SSE 通知前端） */
  onChange?: () => void;

  constructor(workspace: string) {
    this.workspace = workspace;
  }

  async load(): Promise<void> {
    this.cache.clear();
    this.fullCache.clear();
    const projectDir = await findExistingDir(this.workspace, '.minicodeide', 'skills');
    const userDir = await findExistingDir(os.homedir(), '.minicodeide', 'skills');
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

  /**
   * 启动文件监听，skills 目录变更时自动重新 load()。
   * 与 Agent Profile 的 _startProfileWatcher 设计对齐。
   */
  async startWatch(): Promise<void> {
    if (this.watcher) return;
    const projectDir = await findExistingDir(this.workspace, '.minicodeide', 'skills');
    const userDir = await findExistingDir(os.homedir(), '.minicodeide', 'skills');
    const dirs = [projectDir, userDir].filter((d) => d !== '');

    // 如果 skills 目录不存在但 .minicodeide 父目录存在，确保 skills 子目录存在
    // （这样 chokidar 能 watch 到一个真实存在的目录，新建 skill 时能触发事件）
    if (!projectDir) {
      const created = await ensureSkillsDir(this.workspace, '.minicodeide', 'skills');
      if (created) dirs.push(created);
    }
    if (!userDir) {
      const created = await ensureSkillsDir(os.homedir(), '.minicodeide', 'skills');
      if (created) dirs.push(created);
    }

    // 如果 dirs 仍为空（连 .minicodeide 都不存在），watch workspace 根目录作为兜底
    // 用户首次创建 .minicodeide/skills/ 目录时 chokidar 才能检测到
    if (dirs.length === 0) {
      dirs.push(this.workspace);
    }

    this.watcher = chokidar.watch(dirs, {
      ignoreInitial: true,
      depth: 3,
      ignored: (p: string) => {
        const base = path.basename(p);
        // SKILL.md → 永远关注
        if (base === 'SKILL.md') return false;
        // 没有扩展名 → 可能是目录，让 chokidar 递归进去
        if (!path.extname(base)) return false;
        // 其他文件（.json, .ts, .md 非 SKILL.md 等）→ 忽略
        return true;
      },
    });
    const reload = () => {
      this.load().then(() => {
        this.onChange?.();
      }).catch((e) => console.warn('[skills] hot-reload failed:', e));
    };
    this.watcher.on('add', reload).on('change', reload).on('unlink', reload).on('addDir', reload);
    console.log('[skills] watching for changes in', dirs.join(', '));
  }

  stopWatch(): void {
    this.watcher?.close();
    this.watcher = null;
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
   * 根据用户输入匹配可能需要自动触发的 skill。
   * 匹配策略：用户输入中的 token 与 skill 的 triggers 列表做子串/全词匹配。
   * 返回匹配到的 skill meta 列表（按匹配数降序）。
   *
   * 使用场景：在 buildMessages() 中检测用户意图，自动加载匹配 skill 全文，
   * 而不是完全依赖 LLM 看到概览后主动调 use_skill。
   */
  matchForInput(input: string): SkillMeta[] {
    if (!input || !input.trim()) return [];
    const inputLower = input.toLowerCase();
    // 简单 tokenize：按空格/标点切，保留中文连续序列
    const inputTokens = tokenizeInput(inputLower);
    const matched: Array<{ meta: SkillMeta; score: number }> = [];

    for (const meta of this.cache.values()) {
      let score = 0;

      // ── triggers 匹配（权重最高） ──
      if (meta.triggers.length > 0) {
        for (const trigger of meta.triggers) {
          const tLower = trigger.toLowerCase();
          if (inputLower.includes(tLower)) {
            score += tLower.length >= 3 ? 2 : 1;
            continue;
          }
          for (const token of inputTokens) {
            if (token === tLower || (tLower.length >= 3 && token.includes(tLower))) {
              score += 1;
              break;
            }
          }
        }
      }

      // ── 兜底：name / description 匹配 ──
      // 当 triggers 为空或 triggers 未命中时，用 name 和 description 做兜底
      if (score === 0) {
        const nameLower = meta.name.toLowerCase();
        const descLower = meta.description.toLowerCase();
        // name 子串包含（用户输入完整 skill name 的场景）
        if (nameLower.length >= 2 && inputLower.includes(nameLower)) {
          score += 2;
        }
        // name token 匹配
        for (const token of inputTokens) {
          if (token.length >= 3 && nameLower.includes(token)) {
            score += 2; // name 匹配权重高于 description
            break;
          }
        }
        // description 关键词匹配（权重低，且需要至少 2 个 token 命中才算）
        let descHits = 0;
        for (const token of inputTokens) {
          if (token.length >= 3 && descLower.includes(token)) {
            descHits++;
          }
        }
        if (descHits >= 2) {
          score += 1; // 至少 2 个 token 命中 description 才加分
        }
      }

      if (score > 0) {
        matched.push({ meta, score });
      }
    }

    return matched
      .sort((a, b) => b.score - a.score)
      .map((m) => m.meta);
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
      const triggerHint = s.triggers.length > 0 ? ` (triggers: ${s.triggers.slice(0, 5).join(', ')})` : '';
      lines.push(`- **${s.name}** [${s.source}]: ${s.description.slice(0, 120)}${triggerHint}`);
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
      // 解析 triggers：支持数组 [a, b] 或逗号分隔字符串 "a, b"
      let triggers: string[] = [];
      const rawTriggers = frontmatter.triggers;
      if (Array.isArray(rawTriggers)) {
        triggers = rawTriggers.map(String).filter((s) => s.length > 0);
      } else if (typeof rawTriggers === 'string' && rawTriggers.length > 0) {
        triggers = rawTriggers.split(/[,，]\s*/).map((s) => s.trim()).filter((s) => s.length > 0);
      }
      const meta: SkillMeta = {
        name: skillName,
        description,
        userInvocable,
        source,
        filePath: skillMd,
        directory: skillDir,
        triggers,
      };
      this.cache.set(skillName, meta);
    }
  }
}

/** 解析 YAML-lite frontmatter（支持 key: value 和 key: [a, b, c] 数组） */
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
    // 数组格式：key: [item1, item2] 或 key: [item1, "item2 with spaces"]
    if (typeof value === 'string' && /^\[.*\]$/.test(value)) {
      const inner = value.slice(1, -1);
      value = inner
        .split(/,\s*/)
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter((s) => s.length > 0);
    } else {
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (typeof value === 'string' && /^-?\d+$/.test(value)) value = Number(value);
      // 去掉引号
      if (typeof value === 'string' && /^["'].*["']$/.test(value)) value = value.slice(1, -1);
    }
    fm[m[1]] = value;
  }
  return { frontmatter: fm, body };
}

/** 简单 tokenize：按非词字符切，保留中文连续序列；用于 trigger 匹配 */
function tokenizeInput(s: string): string[] {
  const out: string[] = [];
  // 英文/数字 token
  for (const m of s.matchAll(/[a-z0-9_]{2,}/g)) out.push(m[0]);
  // 中文：按字 + 二字 bigram
  const cjk = [...s].filter((c) => /[\u4e00-\u9fff]/.test(c));
  for (let i = 0; i < cjk.length; i++) {
    out.push(cjk[i]);
    if (i + 1 < cjk.length) out.push(cjk[i] + cjk[i + 1]);
  }
  return out;
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

/**
 * 大小写不敏感地查找目录。
 * 先尝试精确路径，再遍历父目录找大小写不同的同名目录。
 * 找不到返回空字符串（scanDir 会静默跳过）。
 *
 * 例如：findExistingDir('/home/user', '.minicodeide', 'skills')
 *   → 先试 /home/user/.minicodeide/skills
 *   → 再试 /home/user/.MiniCodeIde/skills / .minicodeIde/skills 等变体
 */
async function findExistingDir(parent: string, dirName: string, subDir: string): Promise<string> {
  const exact = path.join(parent, dirName, subDir);
  try {
    const stat = await fs.stat(exact);
    if (stat.isDirectory()) return exact;
  } catch { /* not found */ }

  // 遍历 parent 下的直接子目录，寻找大小写不同的匹配
  try {
    const entries = await fs.readdir(parent, { withFileTypes: true });
    const matched = entries.find(
      (e) => e.isDirectory() && e.name.toLowerCase() === dirName.toLowerCase() && e.name !== dirName,
    );
    if (matched) {
      const alt = path.join(parent, matched.name, subDir);
      try {
        const stat = await fs.stat(alt);
        if (stat.isDirectory()) return alt;
      } catch { /* not found */ }
    }
  } catch { /* parent doesn't exist */ }

  // 都没找到，返回原始路径（scanDir 会 graceful 处理不存在的目录）
  return exact;
}

/**
 * 如果 parent/dirName/ 是一个已存在的目录，但其中没有 subDir 子目录，
 * 则创建 subDir 并返回完整路径。不存在的 parent 不会创建。
 * 返回空字符串表示没有创建（parent 不存在或已存在 subDir）。
 */
async function ensureSkillsDir(parent: string, dirName: string, subDir: string): Promise<string> {
  const parentDir = path.join(parent, dirName);
  try {
    const stat = await fs.stat(parentDir);
    if (!stat.isDirectory()) return '';
  } catch {
    return ''; // parent/dirName 不存在，不创建
  }
  const target = path.join(parentDir, subDir);
  try {
    const stat = await fs.stat(target);
    if (stat.isDirectory()) return target; // 已存在
  } catch { /* 不存在 */ }
  try {
    await fs.mkdir(target, { recursive: false }); // 只创建 skills，不递归创建 .minicodeide
    return target;
  } catch {
    return '';
  }
}