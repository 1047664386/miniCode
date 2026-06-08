/**
 * SymbolGraph：聚合所有文件抽取的 facts，提供快速查询。
 * 这是个"轻量代码图谱"，不像 ctags 那么 SQL/索引重，纯内存哈希就够 IDE 用了。
 */
import type { CallInfo, FileFacts, ImportInfo, SymbolInfo } from './extractor.js';

export interface Reference {
  path: string;
  line: number;
  /** 哪个 symbol 引用了它 */
  fromSymbol?: string;
}

export class SymbolGraph {
  /** name → SymbolInfo[]（同名重复） */
  private byName = new Map<string, SymbolInfo[]>();
  /** id → SymbolInfo */
  private byId = new Map<string, SymbolInfo>();
  /** path → file facts */
  private byPath = new Map<string, FileFacts>();
  /** callee name → Reference[] */
  private callIndex = new Map<string, Reference[]>();
  /** importedName → ImportInfo[]（粗略：用 imported name 反查使用方文件） */
  private importIndex = new Map<string, ImportInfo[]>();

  upsert(facts: FileFacts) {
    // 先剔除旧的
    this.remove(facts.path);
    this.byPath.set(facts.path, facts);
    for (const s of facts.symbols) {
      this.byId.set(s.id, s);
      const arr = this.byName.get(s.name) ?? [];
      arr.push(s);
      this.byName.set(s.name, arr);
    }
    for (const c of facts.calls) {
      const arr = this.callIndex.get(c.callee) ?? [];
      arr.push({ path: c.fromPath, line: c.line, fromSymbol: c.callerSymbol });
      this.callIndex.set(c.callee, arr);
    }
    for (const im of facts.imports) {
      for (const n of im.names) {
        const arr = this.importIndex.get(n) ?? [];
        arr.push(im);
        this.importIndex.set(n, arr);
      }
    }
  }

  remove(path: string) {
    const prev = this.byPath.get(path);
    if (!prev) return;
    this.byPath.delete(path);
    for (const s of prev.symbols) {
      this.byId.delete(s.id);
      const arr = this.byName.get(s.name);
      if (arr) {
        const left = arr.filter((x) => x.id !== s.id);
        if (left.length) this.byName.set(s.name, left);
        else this.byName.delete(s.name);
      }
    }
    for (const c of prev.calls) {
      const arr = this.callIndex.get(c.callee);
      if (arr) {
        const left = arr.filter((r) => !(r.path === c.fromPath && r.line === c.line));
        if (left.length) this.callIndex.set(c.callee, left);
        else this.callIndex.delete(c.callee);
      }
    }
    for (const im of prev.imports) {
      for (const n of im.names) {
        const arr = this.importIndex.get(n);
        if (arr) {
          const left = arr.filter((x) => x.fromPath !== im.fromPath || x.source !== im.source);
          if (left.length) this.importIndex.set(n, left);
          else this.importIndex.delete(n);
        }
      }
    }
  }

  // ---- 查询 ----
  findByName(name: string): SymbolInfo[] {
    return this.byName.get(name) ?? [];
  }
  fuzzyFind(query: string, limit = 30): SymbolInfo[] {
    const q = query.toLowerCase();
    const result: { s: SymbolInfo; score: number }[] = [];
    for (const arr of this.byName.values()) {
      for (const s of arr) {
        const name = s.name.toLowerCase();
        let score = 0;
        if (name === q) score = 100;
        else if (name.startsWith(q)) score = 60;
        else if (name.includes(q)) score = 30;
        else if (subsequenceMatch(q, name)) score = 10;
        if (score > 0) {
          if (s.exported) score += 5;
          result.push({ s, score });
        }
      }
    }
    result.sort((a, b) => b.score - a.score);
    return result.slice(0, limit).map((x) => x.s);
  }
  symbolsInFile(path: string): SymbolInfo[] {
    return this.byPath.get(path)?.symbols ?? [];
  }
  /** 所有已索引的文件路径（供 @file 补全等使用） */
  allFiles(): string[] {
    return [...this.byPath.keys()];
  }
  findReferences(name: string): Reference[] {
    const out: Reference[] = [];
    const calls = this.callIndex.get(name);
    if (calls) out.push(...calls);
    const imps = this.importIndex.get(name);
    if (imps) {
      for (const im of imps) out.push({ path: im.fromPath, line: 1, fromSymbol: '<import>' });
    }
    return out;
  }
  /** name → 哪些文件 import 了它 */
  findImporters(name: string): ImportInfo[] {
    return this.importIndex.get(name) ?? [];
  }

  stats() {
    return {
      files: this.byPath.size,
      symbols: this.byId.size,
      callRefs: Array.from(this.callIndex.values()).reduce((a, b) => a + b.length, 0),
    };
  }
}

function subsequenceMatch(q: string, s: string): boolean {
  let i = 0;
  for (const c of s) {
    if (c === q[i]) i++;
    if (i === q.length) return true;
  }
  return false;
}