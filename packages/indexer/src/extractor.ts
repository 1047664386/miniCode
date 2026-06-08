/**
 * 符号抽取：遍历 AST，抽取顶层 + 类内部的 declarations、imports、calls、extends。
 * 这是个 "够用版" 实现：覆盖 80% 常见的 TS/JS 写法，不追求完美准确。
 */
import { parseSource } from './parsers.js';

export type SymbolKind =
  | 'function'
  | 'class'
  | 'interface'
  | 'type'
  | 'enum'
  | 'method'
  | 'variable'
  | 'arrow_function';

export interface SymbolInfo {
  /** 唯一 id: `${path}#${name}@${startLine}` */
  id: string;
  name: string;
  kind: SymbolKind;
  path: string;
  /** 1-indexed */
  startLine: number;
  endLine: number;
  /** 在 class 内部时填父 class 名 */
  container?: string;
  /** 是否 export */
  exported: boolean;
  /** 一段签名（用前两行 / 截 200 字符） */
  signature: string;
}

export interface ImportInfo {
  fromPath: string; // 源文件
  source: string; // 'react' / './foo'
  names: string[]; // 具名 imports
  isDefault: boolean;
}

export interface CallInfo {
  fromPath: string;
  callerSymbol?: string; // 哪个函数里发起调用
  callee: string; // 被调用函数名
  line: number;
}

export interface FileFacts {
  path: string;
  symbols: SymbolInfo[];
  imports: ImportInfo[];
  calls: CallInfo[];
}

export function extractFacts(path: string, content: string): FileFacts | null {
  const parsed = parseSource(path, content);
  if (!parsed) return null;
  const root = parsed.tree.rootNode;
  const symbols: SymbolInfo[] = [];
  const imports: ImportInfo[] = [];
  const calls: CallInfo[] = [];

  const lines = content.split('\n');
  const sigOf = (n: any): string => {
    const s = n.startPosition.row;
    const e = Math.min(n.endPosition.row, s + 1);
    return lines.slice(s, e + 1).join('\n').slice(0, 200);
  };
  const sym = (
    name: string,
    kind: SymbolKind,
    n: any,
    exported: boolean,
    container?: string,
  ): SymbolInfo => ({
    id: `${path}#${name}@${n.startPosition.row + 1}`,
    name,
    kind,
    path,
    startLine: n.startPosition.row + 1,
    endLine: n.endPosition.row + 1,
    container,
    exported,
    signature: sigOf(n),
  });

  // ---- 顶层遍历 ----
  for (let i = 0; i < root.childCount; i++) {
    const node = root.child(i);
    if (!node) continue;
    visitTopLevel(node, false);
  }

  function isExported(node: any): { inner: any; exported: boolean } {
    if (node.type === 'export_statement') {
      // export const x = 1; / export function f() {} / export default ...
      const decl = node.childForFieldName('declaration') ?? findChild(node, [
        'function_declaration',
        'class_declaration',
        'interface_declaration',
        'type_alias_declaration',
        'enum_declaration',
        'lexical_declaration',
        'variable_declaration',
      ]);
      return { inner: decl ?? node, exported: true };
    }
    return { inner: node, exported: false };
  }

  function visitTopLevel(rawNode: any, parentExported: boolean) {
    const { inner: node, exported } = isExported(rawNode);
    const isExp = parentExported || exported;
    switch (node.type) {
      case 'function_declaration': {
        const n = nameOf(node);
        if (n) symbols.push(sym(n, 'function', node, isExp));
        collectCalls(node, n);
        break;
      }
      case 'class_declaration': {
        const cls = nameOf(node);
        if (cls) {
          symbols.push(sym(cls, 'class', node, isExp));
          // 方法
          const body = node.childForFieldName('body');
          if (body) {
            for (let i = 0; i < body.childCount; i++) {
              const m = body.child(i);
              if (!m) continue;
              if (m.type === 'method_definition') {
                const mn = nameOf(m);
                if (mn) symbols.push(sym(mn, 'method', m, false, cls));
                collectCalls(m, mn);
              }
            }
          }
        }
        break;
      }
      case 'interface_declaration': {
        const n = nameOf(node);
        if (n) symbols.push(sym(n, 'interface', node, isExp));
        break;
      }
      case 'type_alias_declaration': {
        const n = nameOf(node);
        if (n) symbols.push(sym(n, 'type', node, isExp));
        break;
      }
      case 'enum_declaration': {
        const n = nameOf(node);
        if (n) symbols.push(sym(n, 'enum', node, isExp));
        break;
      }
      case 'lexical_declaration':
      case 'variable_declaration': {
        // const foo = () => {} / const Bar = function() {} 等
        for (let i = 0; i < node.childCount; i++) {
          const decl = node.child(i);
          if (!decl || decl.type !== 'variable_declarator') continue;
          const name = decl.childForFieldName('name');
          const value = decl.childForFieldName('value');
          const n = name?.text;
          if (!n) continue;
          let kind: SymbolKind = 'variable';
          if (value && (value.type === 'arrow_function' || value.type === 'function_expression' || value.type === 'function')) {
            kind = 'arrow_function';
            collectCalls(value, n);
          }
          symbols.push(sym(n, kind, decl, isExp));
        }
        break;
      }
      case 'import_statement': {
        imports.push(parseImport(node, path));
        break;
      }
      case 'export_statement': {
        // 兜底：上面 isExported 已处理具名 export
        break;
      }
    }
  }

  return { path, symbols, imports, calls };

  function collectCalls(scope: any, callerName?: string) {
    walk(scope, (n: any) => {
      if (n.type === 'call_expression') {
        const fn = n.childForFieldName('function');
        if (fn) {
          let callee = '';
          if (fn.type === 'identifier') callee = fn.text;
          else if (fn.type === 'member_expression') {
            const prop = fn.childForFieldName('property');
            callee = prop?.text ?? fn.text;
          }
          if (callee && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(callee)) {
            calls.push({
              fromPath: path,
              callerSymbol: callerName,
              callee,
              line: n.startPosition.row + 1,
            });
          }
        }
      }
    });
  }
}

function nameOf(node: any): string | undefined {
  const n = node.childForFieldName?.('name');
  return n?.text;
}

function findChild(node: any, types: string[]): any | null {
  for (let i = 0; i < node.childCount; i++) {
    const c = node.child(i);
    if (c && types.includes(c.type)) return c;
  }
  return null;
}

function parseImport(node: any, fromPath: string): ImportInfo {
  const src = node.childForFieldName?.('source');
  const source = src?.text?.replace(/^['"]|['"]$/g, '') ?? '';
  const names: string[] = [];
  let isDefault = false;
  walk(node, (n: any) => {
    if (n.type === 'import_clause') {
      for (let i = 0; i < n.childCount; i++) {
        const c = n.child(i);
        if (!c) continue;
        if (c.type === 'identifier') {
          // default import
          isDefault = true;
          names.push(c.text);
        } else if (c.type === 'named_imports') {
          for (let j = 0; j < c.childCount; j++) {
            const spec = c.child(j);
            if (spec?.type === 'import_specifier') {
              const nm = spec.childForFieldName('name');
              if (nm) names.push(nm.text);
            }
          }
        } else if (c.type === 'namespace_import') {
          const nm = c.child(c.childCount - 1);
          if (nm) names.push(nm.text);
        }
      }
    }
  });
  return { fromPath, source, names, isDefault };
}

function walk(node: any, cb: (n: any) => void) {
  cb(node);
  for (let i = 0; i < node.childCount; i++) {
    const c = node.child(i);
    if (c) walk(c, cb);
  }
}