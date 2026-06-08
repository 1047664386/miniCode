
/**
 * Slash commands: 内置 + 用户自定义（.minicodeide/commands/*.md）。
 *
 * 内置命令：
 *   /explain [target]   解释代码或概念
 *   /test    [target]   生成单测
 *   /refactor [target] [goal]
 *   /docs    [target]
 *   /fix     [error]    根据报错修复
 *
 * 用户自定义文件 frontmatter：
 *   ---
 *   name: my-cmd
 *   description: ...
 *   ---
 *   Template body with $ARG placeholder
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

const DIR = '.minicodeide/commands';

export interface SlashCommand {
  name: string;
  description: string;
  /** 把原始用户输入（不含 /name 前缀）展开成最终 prompt 文本 */
  expand(rawArg: string): string;
  /** 来源：builtin / user */
  source: 'builtin' | 'user';
}

const BUILTIN: SlashCommand[] = [
  {
    name: 'explain',
    description: 'Explain the given code, file, or concept in plain language.',
    source: 'builtin',
    expand: (arg) =>
      arg.trim()
        ? `Please explain the following in clear, structured terms, with examples and important caveats:\n\n${arg}`
        : 'Please explain the current open file and what it does, step by step.',
  },
  {
    name: 'test',
    description: 'Generate unit tests for the given target.',
    source: 'builtin',
    expand: (arg) =>
      `Generate thorough unit tests for: ${arg || 'the current open file'}.\n\n` +
      `Requirements:\n` +
      `- Cover happy path + edge cases + error cases.\n` +
      `- Use the testing framework already in use in this project (detect via package.json or existing tests).\n` +
      `- Create new test file(s) via write_file, do NOT inline.\n`,
  },
  {
    name: 'refactor',
    description: 'Refactor target code per stated goal, preserving behavior.',
    source: 'builtin',
    expand: (arg) =>
      `Refactor as instructed below. Preserve external behavior; add or update tests if any exist.\n\n` +
      `Goal / target: ${arg || '(none specified — analyze the open file and propose a refactor first)'}\n` +
      `Use edit_file or write_file for the changes.`,
  },
  {
    name: 'docs',
    description: 'Add or improve documentation comments for the target.',
    source: 'builtin',
    expand: (arg) =>
      `Add or improve doc comments (TSDoc / JSDoc / docstrings) for: ${arg || 'the current open file'}.\n` +
      `- Don't change behavior.\n- Don't add trivial comments to obvious code.\n- Apply changes via edit_file.`,
  },
  {
    name: 'fix',
    description: 'Diagnose and fix the given error.',
    source: 'builtin',
    expand: (arg) =>
      `Diagnose root cause and propose a fix for the following error:\n\n${arg || '(please paste the error message)'}\n\n` +
      `Steps:\n1) Identify the file(s) involved.\n2) Read relevant code.\n3) Propose a fix via edit_file.\n4) Briefly explain why.`,
  },
  {
    name: 'plan',
    description: 'Switch to Plan Mode and produce a structured 5-phase plan.',
    source: 'builtin',
    expand: (arg) =>
      `[Plan Mode requested]\n\n` +
      `Goal: ${arg || '(no goal supplied — analyze the open file / current task and propose one)'}\n\n` +
      `Follow Plan Mode protocol strictly:\n` +
      `1. Initial Understanding — restate the goal, list assumptions, flag ambiguity.\n` +
      `2. Design — at least 2 candidate approaches with trade-offs.\n` +
      `3. Review — find the gaps and risks in your own design.\n` +
      `4. Final Plan — concrete ordered steps with file paths.\n` +
      `5. Approval — STOP and wait for the user. Do NOT execute.`,
  },
  {
    name: 'mcp',
    description: 'List connected MCP servers and tools.',
    source: 'builtin',
    expand: () =>
      `List all connected MCP (Model Context Protocol) servers in this workspace.\n` +
      `For each: name, command, status, and the tools it exposes (mcp__<server>__<tool>).\n` +
      `If none: explain that the user can configure them in .minicodeide/mcp.json (see mcp.example.json).`,
  },
  {
    name: 'cost',
    description: 'Report cumulative LLM cost / token usage for this session.',
    source: 'builtin',
    expand: () =>
      `Summarize this session's LLM usage:\n` +
      `- input tokens / output tokens / cached tokens\n` +
      `- estimated cost (use Anthropic / OpenAI public pricing as appropriate)\n` +
      `- cache hit ratio and approximate savings\n` +
      `Be concrete, no hedging.`,
  },
  {
    name: 'compact',
    description: 'Manually trigger a soft-compact of the conversation history.',
    source: 'builtin',
    expand: () =>
      `[Manual compact requested]\n\n` +
      `Produce a tight handoff summary of the conversation so far covering:\n` +
      `- The user's overall goal\n- Decisions made\n- Files / functions touched\n- Outstanding TODOs (if any)\n` +
      `Then continue from the current step.`,
  },
];

export class SlashCommandRegistry {
  private cmds = new Map<string, SlashCommand>();
  constructor(private cwd: string) {
    for (const c of BUILTIN) this.cmds.set(c.name, c);
  }

  list(): SlashCommand[] {
    return [...this.cmds.values()];
  }
  get(name: string) {
    return this.cmds.get(name);
  }

  async loadUser() {
    const dir = path.join(this.cwd, DIR);
    try {
      await fs.mkdir(dir, { recursive: true });
      const files = await fs.readdir(dir);
      for (const f of files) {
        if (!f.endsWith('.md')) continue;
        try {
          const raw = await fs.readFile(path.join(dir, f), 'utf-8');
          const cmd = parseUserCommand(f, raw);
          this.cmds.set(cmd.name, cmd);
        } catch (e) {
          console.warn(`[slash] failed to load ${f}:`, (e as Error).message);
        }
      }
    } catch {
      /* */
    }
  }

  /** 检查消息是否以 / 开头，是的话展开。返回 null 表示无需处理。 */
  maybeExpand(message: string): { command: string; expanded: string } | null {
    if (!message.startsWith('/')) return null;
    const m = /^\/(\w[\w-]*)\s*([\s\S]*)$/.exec(message);
    if (!m) return null;
    const [, name, arg] = m;
    const cmd = this.cmds.get(name);
    if (!cmd) return null;
    return { command: name, expanded: cmd.expand(arg) };
  }
}

function parseUserCommand(file: string, raw: string): SlashCommand {
  let name = file.replace(/\.md$/, '');
  let description = '';
  let body = raw;
  const fm = /^---\n([\s\S]*?)\n---\n?/m.exec(raw);
  if (fm) {
    body = raw.slice(fm[0].length);
    for (const line of fm[1].split('\n')) {
      const m = /^(\w+):\s*(.+)$/.exec(line.trim());
      if (!m) continue;
      const [, k, v] = m;
      if (k === 'name') name = v.trim();
      else if (k === 'description') description = v.trim();
    }
  }
  const template = body.trim();
  return {
    name,
    description: description || '(user command)',
    source: 'user',
    expand: (arg) => template.replace(/\$ARG/g, arg.trim()),
  };
}