
/**
 * Project Memory（AGENTS.md / CLAUDE.md / MEMORY.md）
 * --------------------------------------------------
 * 仿 Codex CLI（AGENTS.md）+ Claude Code（CLAUDE.md）的项目级记忆机制。
 *
 * 设计：
 *   1. 三种文件名都接受（AGENTS.md / CLAUDE.md / MEMORY.md），先到先得。
 *   2. 路径冒泡：从 workspace 起一路 walk up 到 user home，每层都读一次。
 *      - 这样 monorepo 子包也能继承根的 AGENTS.md
 *      - 同时子包可以用自己的 AGENTS.md 覆盖/补充
 *   3. 用户级：~/.minicodeide/AGENTS.md（也兼顾 ~/.codex/AGENTS.md / ~/.claude/CLAUDE.md 如果存在）
 *   4. 无 frontmatter 直接当 always rule 用——比 Rules 系统更轻、上手即用。
 *   5. 总 token 预算：8000（多余截断头尾保留），防止把 system prompt 撑爆。
 *
 * 注入位置：作为 `systemExtras` 的一段，紧跟在 STABLE-CORE 之后、Rules/Skills 之前。
 *
 * Naming（跟既有 RulesStore 区分开）：
 *   - RulesStore: .minicodeide/rules/*.md，frontmatter + glob，**项目作者写给 LLM 的硬约束**
 *   - ProjectMemory: AGENTS.md / CLAUDE.md，**项目作者写给所有 AI Agent 看的项目说明**（README 之外的"AI 友好版"）
 *   两者并存：RulesStore 偏"约束"，ProjectMemory 偏"上下文"。
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const FILENAMES = ['AGENTS.md', 'CLAUDE.md', 'MEMORY.md'] as const;
const USER_DIRS = ['.minicodeide', '.codex', '.claude'] as const;
const MAX_TOTAL_CHARS = 24000; // ~8k tokens

export interface MemoryFile {
  /** 绝对路径 */
  path: string;
  /** 来源类型 */
  scope: 'user' | 'project';
  /** 距离 workspace 的层级（0 = workspace 自身） */
  depth: number;
  /** 文件原文 */
  body: string;
}

export class ProjectMemoryStore {
  private files: MemoryFile[] = [];

  constructor(private cwd: string) {}

  /** 扫描全部文件并加载。idempotent，可热重载。 */
  async load(): Promise<MemoryFile[]> {
    const out: MemoryFile[] = [];
    const homeDir = os.homedir();

    // 1) 用户级（~/.minicodeide/AGENTS.md > ~/.codex/AGENTS.md > ~/.claude/CLAUDE.md）
    for (const dir of USER_DIRS) {
      for (const fn of FILENAMES) {
        const p = path.join(homeDir, dir, fn);
        const body = await tryRead(p);
        if (body) {
          out.push({ path: p, scope: 'user', depth: -1, body });
          break; // 同 dir 下只取一个文件
        }
      }
    }

    // 2) 项目级：从 workspace 一路 walk up 到 home
    let cur = path.resolve(this.cwd);
    let depth = 0;
    const stop = path.resolve(homeDir);
    while (true) {
      for (const fn of FILENAMES) {
        const p = path.join(cur, fn);
        const body = await tryRead(p);
        if (body) {
          out.push({ path: p, scope: 'project', depth, body });
          break;
        }
      }
      if (cur === stop || cur === path.dirname(cur)) break;
      cur = path.dirname(cur);
      depth++;
      if (depth > 8) break; // 安全上限
    }

    this.files = out;
    return out;
  }

  list(): MemoryFile[] {
    return [...this.files];
  }

  /**
   * 渲染成 system prompt 段落。
   * 顺序：用户级在最前（最稳定 + 高优先级 cache），项目级按 depth 由远到近（workspace 自身在最后 → 离用户当前任务最近）。
   */
  renderForSystem(): string {
    if (this.files.length === 0) return '';

    // [Hierarchical AGENTS.md rule, from Codex prompts/templates/agents/hierarchical.md]
    // 排序原则：把"会被覆盖"的放前面、"覆盖者"放后面。
    //   1. user-level 最弱 → 最先
    //   2. project 按 depth 大→小：根目录最弱（depth 大），workspace 自身（depth=0）最强
    //   后写覆盖前写：LLM 阅读到后面会自然以最后一份为准。
    const ordered = [...this.files].sort((a, b) => {
      if (a.scope !== b.scope) return a.scope === 'user' ? -1 : 1;
      return b.depth - a.depth;
    });

    const sections: string[] = [];
    let used = 0;
    for (const f of ordered) {
      const header =
        f.scope === 'user'
          ? `### Memory (user-level, weakest): ${shortPath(f.path)}`
          : `### Memory (project, depth=${f.depth}${f.depth === 0 ? ', strongest' : ''}): ${shortPath(f.path)}`;
      const body = f.body.trim();
      const seg = `${header}\n\n${body}`;
      if (used + seg.length > MAX_TOTAL_CHARS) {
        const left = MAX_TOTAL_CHARS - used;
        if (left > 200) {
          sections.push(seg.slice(0, left) + `\n...[truncated ${seg.length - left} chars]`);
        }
        break;
      }
      sections.push(seg);
      used += seg.length;
    }

    return [
      '## Project Memory (AGENTS.md / CLAUDE.md / MEMORY.md)',
      'The following memory files describe long-lived facts about this project (architecture, conventions, gotchas).',
      'Treat them as authoritative. They were written by the project author for AI agents like you.',
      '',
      '**Precedence rule (when files conflict):**',
      '  1. System / developer / user prompts in this conversation > ALL memory files.',
      '  2. Among memory files: **the deeper file overrides the shallower one**. Workspace-root memory > parent-dir memory > user-level (`~/.minicodeide/...`) memory.',
      '  3. Files are listed below from WEAKEST to STRONGEST — when you spot a contradiction, the LATER section wins.',
      '',
      sections.join('\n\n'),
    ].join('\n');
  }
}

async function tryRead(p: string): Promise<string | null> {
  try {
    const stat = await fs.stat(p);
    if (!stat.isFile()) return null;
    const body = await fs.readFile(p, 'utf-8');
    if (!body.trim()) return null;
    return body;
  } catch {
    return null;
  }
}

function shortPath(p: string): string {
  const home = os.homedir();
  return p.startsWith(home) ? '~' + p.slice(home.length) : p;
}