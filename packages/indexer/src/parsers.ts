/**
 * tree-sitter 解析层：拿一个 (path, content)，返回 SyntaxNode tree。
 * 按文件扩展名自动选 language。Parser 实例做了 LRU 复用。
 */
// @ts-ignore - tree-sitter 包没出 ts 类型
import Parser from 'tree-sitter';
// @ts-ignore
import TS from 'tree-sitter-typescript';
// @ts-ignore
import JS from 'tree-sitter-javascript';

export type Lang = 'ts' | 'tsx' | 'js' | 'jsx';

let cachedParsers: Partial<Record<Lang, any>> | null = null;

function getParser(lang: Lang): any {
  if (!cachedParsers) cachedParsers = {};
  if (cachedParsers[lang]) return cachedParsers[lang];
  const p = new Parser();
  switch (lang) {
    case 'ts':
      p.setLanguage(TS.typescript);
      break;
    case 'tsx':
      p.setLanguage(TS.tsx);
      break;
    case 'js':
    case 'jsx':
      p.setLanguage(JS);
      break;
  }
  cachedParsers[lang] = p;
  return p;
}

export function detectLang(path: string): Lang | null {
  if (path.endsWith('.ts')) return 'ts';
  if (path.endsWith('.tsx')) return 'tsx';
  if (path.endsWith('.mts') || path.endsWith('.cts')) return 'ts';
  if (path.endsWith('.js') || path.endsWith('.mjs') || path.endsWith('.cjs')) return 'js';
  if (path.endsWith('.jsx')) return 'jsx';
  return null;
}

export function parseSource(path: string, content: string): { lang: Lang; tree: any } | null {
  const lang = detectLang(path);
  if (!lang) return null;
  const parser = getParser(lang);
  const tree = parser.parse(content);
  return { lang, tree };
}

