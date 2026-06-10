
/**
 * @-mentions 解析器
 * --------------------------------------------------------------------
 * 用户在输入框里可以用 @ 显式声明上下文：
 *
 *   @file:src/main.ts          → 整个文件
 *   @file:src/main.ts:10-50    → 文件指定行段
 *   @symbol:MyClass            → 符号定义（来自 SymbolGraph）
 *   @selection:src/main.ts:10-50  → 等同于 @file:...:N-M（前端使用）
 *   @docs:react-hooks          → 项目内 docs/<name>.md（如果存在）
 *   @web:query                 → 占位：未实现 web search 时变 noop
 *
 * 这个解析层做两件事：
 *  1. 从 userMessage 里抽出所有 mention，留下纯文本
 *  2. 把每个 mention 解析成 ExplicitContextItem[]（直接喂给 buildMessages）
 *
 * 没有 mention → 行为完全不变（backward compat）。
 *
 * 设计权衡：
 *  - 用 simple regex 而非正式 parser：mentions 语义简单且容错友好
 *  - 找不到的文件/符号 → 静默忽略（不报错打断 chat）
 *  - 大文件按行段截断，避免一个 @file 直接撑爆上下文
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ExplicitContextItem } from '@mini/core';
import type { CodebaseIndex } from '@mini/indexer';

const MENTION_REGEX = /@(file|symbol|selection|docs|web):([^\s]+)/g;
const MAX_FILE_LINES = 400; // 单个 @file 最大注入行数（防过载）

export interface MentionResolveCtx {
  workspace: string;
  index: CodebaseIndex | null;
}

export interface MentionParseResult {
  /** 移除 mention 后的纯文本 */
  cleanText: string;
  /** 解析出来的 explicit context items */
  items: ExplicitContextItem[];
  /** 解析失败但用户写过的引用（用于提示） */
  unresolved: { kind: string; arg: string; reason: string }[];
}

export async function parseMentions(
  text: string,
  ctx: MentionResolveCtx,
): Promise<MentionParseResult> {
  const items: ExplicitContextItem[] = [];
  const unresolved: MentionParseResult['unresolved'] = [];

  // Step 1: 抽取所有 mention（不修改原文）
  const matches: { kind: string; arg: string; raw: string }[] = [];
  for (const m of text.matchAll(MENTION_REGEX)) {
    matches.push({ kind: m[1], arg: m[2], raw: m[0] });
  }

  // Step 2: 逐个解析（顺序保留 → 注入顺序与用户书写顺序一致）
  for (const { kind, arg, raw } of matches) {
    try {
      switch (kind) {
        case 'file':
        case 'selection': {
          // path[:start-end]
          const m = arg.match(/^(.+?)(?::(\d+)-(\d+))?$/);
          if (!m) {
            unresolved.push({ kind, arg, reason: 'invalid syntax' });
            break;
          }
          const rel = m[1];
          const startLine = m[2] ? Number(m[2]) : undefined;
          const endLine = m[3] ? Number(m[3]) : undefined;
          const item = await resolveFile(ctx.workspace, rel, startLine, endLine);
          if (item) items.push(item);
          else unresolved.push({ kind, arg, reason: 'file not found' });
          break;
        }
        case 'symbol': {
          if (!ctx.index) {
            unresolved.push({ kind, arg, reason: 'index not ready' });
            break;
          }
          const found = ctx.index.symbols.fuzzyFind(arg, 1);
          if (!found.length) {
            unresolved.push({ kind, arg, reason: 'symbol not found' });
            break;
          }
          const sym = found[0];
          // 把符号定义所在行段截下来
          const item = await resolveFile(
            ctx.workspace,
            sym.path,
            Math.max(1, sym.startLine - 2),
            sym.endLine + 30,
          );
          if (item) {
            item.type = 'symbol';
            item.label = `${sym.name} (${sym.kind})`;
            items.push(item);
          } else {
            unresolved.push({ kind, arg, reason: 'cannot read symbol file' });
          }
          break;
        }
        case 'docs': {
          // 优先 docs/<name>.md，其次 <name>.md（项目根）
          const candidates = [`docs/${arg}.md`, `${arg}.md`];
          let found: ExplicitContextItem | null = null;
          for (const rel of candidates) {
            const item = await resolveFile(ctx.workspace, rel);
            if (item) {
              found = item;
              break;
            }
          }
          if (found) items.push(found);
          else unresolved.push({ kind, arg, reason: 'doc not found' });
          break;
        }
        case 'web': {
          // 占位：未来接入 web search 时填充
          unresolved.push({ kind, arg, reason: 'web search not enabled' });
          break;
        }
        default:
          unresolved.push({ kind, arg, reason: `unknown mention kind: ${kind}` });
      }
    } catch (e: any) {
      unresolved.push({ kind, arg, reason: e?.message ?? String(e) });
    }
  }

  // Step 3: 从 text 里移除所有 mention（用单空格替换，避免单词粘连）
  const cleanText = text.replace(MENTION_REGEX, ' ').replace(/\s+/g, ' ').trim();

  return { cleanText, items, unresolved };
}

async function resolveFile(
  workspace: string,
  rel: string,
  startLine?: number,
  endLine?: number,
): Promise<ExplicitContextItem | null> {
  const safeRel = rel.replace(/^\/+/, '').replace(/\.\.\//g, '');
  const abs = path.join(workspace, safeRel);
  let raw: string;
  try {
    raw = await fs.readFile(abs, 'utf-8');
  } catch {
    return null;
  }
  const lines = raw.split('\n');
  const total = lines.length;
  let start = startLine ?? 1;
  let end = endLine ?? Math.min(total, MAX_FILE_LINES);
  if (!startLine && total > MAX_FILE_LINES) {
    end = MAX_FILE_LINES;
  }
  start = Math.max(1, start);
  end = Math.min(total, end);
  const slice = lines.slice(start - 1, end).join('\n');
  const label =
    startLine && endLine ? `${safeRel}:${startLine}-${endLine}` : safeRel;
  return {
    type: 'file',
    label,
    content: slice + (end < total && !endLine ? `\n... (truncated, total ${total} lines)` : ''),
  };
}