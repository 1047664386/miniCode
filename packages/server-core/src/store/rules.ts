
/**
 * Rules 系统：用户在 .minicodeide/rules/*.md 写规则，自动注入到 Agent 的 system prompt。
 *
 * 每个 rule 文件 frontmatter 控制触发行为：
 *   ---
 *   name: TypeScript style
 *   mode: always | auto | manual
 *   globs: ["**\/*.ts", "**\/*.tsx"]   # auto 模式按此匹配 attachments
 *   description: short summary
 *   ---
 *   <markdown body>
 *
 *  - always: 每个请求都注入
 *  - auto: 当用户消息或 attachments 命中 globs 时注入
 *  - manual: 仅在用户主动 @rule:<name> 时注入
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

const DIR = '.minicodeide/rules';

export type RuleMode = 'always' | 'auto' | 'manual';
export interface Rule {
  file: string;
  name: string;
  mode: RuleMode;
  globs: string[];
  description?: string;
  body: string;
}

export class RulesStore {
  private rules: Rule[] = [];
  private dir: string;

  constructor(private cwd: string) {
    this.dir = path.join(cwd, DIR);
  }

  async load() {
    this.rules = [];
    try {
      await fs.mkdir(this.dir, { recursive: true });
      const files = await fs.readdir(this.dir);
      for (const f of files) {
        if (!f.endsWith('.md')) continue;
        try {
          const raw = await fs.readFile(path.join(this.dir, f), 'utf-8');
          this.rules.push(parseRule(f, raw));
        } catch (e) {
          console.warn(`[rules] failed to load ${f}:`, (e as Error).message);
        }
      }
    } catch {
      /* dir might not exist */
    }
    return this.rules;
  }

  list(): Rule[] {
    return [...this.rules];
  }

  /** 选出当前消息+触及文件应当激活的规则 */
  pickForRequest(opts: {
    userMessage: string;
    touchedPaths?: string[];
    manual?: string[]; // 用户 @rule:<name>
  }): Rule[] {
    const out: Rule[] = [];
    for (const r of this.rules) {
      if (r.mode === 'always') {
        out.push(r);
        continue;
      }
      if (r.mode === 'manual') {
        if (opts.manual?.includes(r.name)) out.push(r);
        continue;
      }
      // auto: glob match
      if (r.globs.length === 0) continue;
      const targets = [...(opts.touchedPaths ?? []), ...extractPathLike(opts.userMessage)];
      if (targets.some((p) => r.globs.some((g) => matchGlob(g, p)))) out.push(r);
    }
    return out;
  }

  /** 把激活规则拼成 system 段落 */
  renderForSystem(rules: Rule[]): string {
    if (!rules.length) return '';
    const sections = rules.map(
      (r) => `### Rule: ${r.name}\n${r.description ? r.description + '\n\n' : ''}${r.body.trim()}`,
    );
    return `## Project Rules\nThe following rules apply to this project. Follow them strictly.\n\n${sections.join('\n\n')}`;
  }
}

function parseRule(file: string, raw: string): Rule {
  let mode: RuleMode = 'always';
  let name = file.replace(/\.md$/, '');
  let globs: string[] = [];
  let description: string | undefined;
  let body = raw;

  const fm = /^---\n([\s\S]*?)\n---\n?/m.exec(raw);
  if (fm) {
    body = raw.slice(fm[0].length);
    for (const line of fm[1].split('\n')) {
      const m = /^(\w+):\s*(.+)$/.exec(line.trim());
      if (!m) continue;
      const [, k, v] = m;
      if (k === 'mode') {
        const x = v.trim();
        if (x === 'always' || x === 'auto' || x === 'manual') mode = x;
      } else if (k === 'name') name = v.trim();
      else if (k === 'description') description = v.trim();
      else if (k === 'globs') {
        // 支持 "a, b" 或 JSON 数组
        const t = v.trim();
        if (t.startsWith('[')) {
          try {
            globs = JSON.parse(t);
          } catch {
            globs = [];
          }
        } else {
          globs = t
            .split(',')
            .map((s) => s.trim().replace(/^["']|["']$/g, ''))
            .filter(Boolean);
        }
      }
    }
  }
  return { file, name, mode, globs, description, body };
}

/** 极简 glob：支持 **、*、? */
function matchGlob(glob: string, p: string): boolean {
  const re = new RegExp(
    '^' +
      glob
        .replace(/[.+^$()|{}\[\]]/g, '\\$&')
        .replace(/\*\*/g, '___DOUBLESTAR___')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '.')
        .replace(/___DOUBLESTAR___/g, '.*') +
      '$',
  );
  return re.test(p);
}

/** 从用户消息里抠出 file path 字样的 token（粗糙启发式） */
function extractPathLike(msg: string): string[] {
  const out = new Set<string>();
  const re = /[\w./\\-]+\.[a-zA-Z]{1,6}\b/g;
  let m;
  while ((m = re.exec(msg))) out.add(m[0]);
  return [...out];
}