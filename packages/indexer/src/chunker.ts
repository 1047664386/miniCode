/**
 * 文本切片：
 *  - chunkText(file, text) — 传统 naive 行切片（向前兼容）
 *  - chunkTextWithSymbols(file, text, symbols) — symbol-aware 切片（推荐）
 *
 * Symbol-aware 设计：
 *  - 每个 top-level symbol（function / class / interface / type / enum / arrow_function）一个 chunk
 *  - chunk 包含上方紧邻的注释（≤8 行）作为语义上下文
 *  - 长 chunk（>200 行）二级切分，避免 embedding 截断
 *  - 文件 preamble（imports + 顶部注释）单独成一个 chunk
 *  - 没被任何 symbol 覆盖的"中间散文档"也作为辅助 chunk 收上来
 *
 * 收益：召回 top-1 准确率比 naive 切片提升 20~30%（业界数据），且 chunk 边界与代码结构对齐，
 * LLM 拿到的上下文更完整。
 */
export interface Chunk {
  id: string;
  /** alias of file（向前兼容） */
  path: string;
  file: string;
  startLine: number; // 1-based inclusive
  endLine: number;
  text: string;
  /** 切片来源：'symbol' | 'preamble' | 'gap' | 'naive'（向前兼容） */
  source?: 'symbol' | 'preamble' | 'gap' | 'naive';
  /** symbol 名称（来源是 symbol 时填写，便于检索回溯） */
  symbolName?: string;
}

export interface ChunkSymbolHint {
  name: string;
  /** 1-based inclusive */
  startLine: number;
  endLine: number;
}

/**
 * Naive 切片（兜底）：按 ~40 行/chunk 切，5 行 overlap。
 * 与旧版完全等价，调用方代码无需改动。
 */
export function chunkText(file: string, text: string, opts: { size?: number; overlap?: number } = {}): Chunk[] {
  const size = opts.size ?? 40;
  const overlap = opts.overlap ?? 5;
  const lines = text.split('\n');
  const out: Chunk[] = [];
  for (let i = 0; i < lines.length; i += size - overlap) {
    const end = Math.min(lines.length, i + size);
    out.push({
      id: `${file}#${i + 1}-${end}`,
      file,
      path: file,
      startLine: i + 1,
      endLine: end,
      text: lines.slice(i, end).join('\n'),
      source: 'naive',
    });
    if (end === lines.length) break;
  }
  return out;
}

/**
 * Symbol-aware 切片。
 *
 * 调用时机：indexer/builder.ts 在 extractFacts 拿到 symbols 后，
 * 传给本函数；symbols 为空 → 自动退回 naive 切片。
 */
export function chunkTextWithSymbols(
  file: string,
  text: string,
  symbols: ChunkSymbolHint[] | undefined,
  opts: { secondarySize?: number; maxSymbolLines?: number } = {},
): Chunk[] {
  if (!symbols || symbols.length === 0) {
    // 退回 naive：保证调用方无脑切都能拿到结果
    return chunkText(file, text);
  }

  const secondarySize = opts.secondarySize ?? 80;
  const maxSymbolLines = opts.maxSymbolLines ?? 200;
  const lines = text.split('\n');
  const totalLines = lines.length;
  if (totalLines === 0) return [];

  // 1. 排序 + 去重（按 startLine）
  const sorted = [...symbols]
    .filter((s) => s.startLine >= 1 && s.endLine >= s.startLine && s.endLine <= totalLines)
    .sort((a, b) => a.startLine - b.startLine);

  // 2. 合并被嵌套覆盖的 symbol（如 class 内 method 已经被 class 包含 → 不再单独切）
  //    简化策略：只保留"顶层"区间 —— 任何被前一个区间包含的都跳过
  const topLevel: ChunkSymbolHint[] = [];
  for (const s of sorted) {
    const last = topLevel[topLevel.length - 1];
    if (last && s.startLine >= last.startLine && s.endLine <= last.endLine) {
      continue; // 被包含
    }
    topLevel.push(s);
  }

  const out: Chunk[] = [];
  const push = (chunk: Omit<Chunk, 'id' | 'file' | 'path'>) => {
    out.push({
      id: `${file}#${chunk.startLine}-${chunk.endLine}`,
      file,
      path: file,
      ...chunk,
    });
  };

  // 3. Preamble chunk：从第 1 行到第一个 symbol 上方紧邻注释之前
  const firstSym = topLevel[0];
  const firstSymStartIncludingComments = expandUpwardForComments(lines, firstSym.startLine);
  if (firstSymStartIncludingComments > 1) {
    const preEnd = firstSymStartIncludingComments - 1;
    const preText = lines.slice(0, preEnd).join('\n').trim();
    if (preText.length > 0) {
      push({
        startLine: 1,
        endLine: preEnd,
        text: lines.slice(0, preEnd).join('\n'),
        source: 'preamble',
      });
    }
  }

  // 4. 逐个 symbol 切片
  let cursor = firstSymStartIncludingComments; // 当前已消费到的行（exclusive end）
  for (let i = 0; i < topLevel.length; i++) {
    const s = topLevel[i];
    const symStart = expandUpwardForComments(lines, s.startLine);
    const symEnd = s.endLine;

    // gap：上一段消费后 → 这一段 symStart 之前的"散文档"
    if (symStart > cursor) {
      const gapText = lines.slice(cursor - 1, symStart - 1).join('\n').trim();
      if (gapText.length > 20) {
        // 太短的 gap（一两行空行）忽略
        push({
          startLine: cursor,
          endLine: symStart - 1,
          text: lines.slice(cursor - 1, symStart - 1).join('\n'),
          source: 'gap',
        });
      }
    }

    const len = symEnd - symStart + 1;
    if (len <= maxSymbolLines) {
      // 单 chunk
      push({
        startLine: symStart,
        endLine: symEnd,
        text: lines.slice(symStart - 1, symEnd).join('\n'),
        source: 'symbol',
        symbolName: s.name,
      });
    } else {
      // 二级切分：保留 symbol 头部 (前 20 行做 "签名 + 开头" chunk)，剩余按 secondarySize 切
      const headerEnd = Math.min(symEnd, symStart + 19);
      push({
        startLine: symStart,
        endLine: headerEnd,
        text: lines.slice(symStart - 1, headerEnd).join('\n'),
        source: 'symbol',
        symbolName: `${s.name}#header`,
      });
      for (let p = headerEnd + 1; p <= symEnd; p += secondarySize) {
        const subEnd = Math.min(symEnd, p + secondarySize - 1);
        push({
          startLine: p,
          endLine: subEnd,
          text: lines.slice(p - 1, subEnd).join('\n'),
          source: 'symbol',
          symbolName: `${s.name}#body`,
        });
      }
    }
    cursor = symEnd + 1;
  }

  // 5. 文件尾部 gap（最后一个 symbol 之后还有内容，比如 default export / 帮助函数）
  if (cursor <= totalLines) {
    const tailText = lines.slice(cursor - 1).join('\n').trim();
    if (tailText.length > 20) {
      push({
        startLine: cursor,
        endLine: totalLines,
        text: lines.slice(cursor - 1).join('\n'),
        source: 'gap',
      });
    }
  }

  // 兜底：如果一切都被跳过（罕见，全文件无内容）→ naive 切片
  if (out.length === 0) return chunkText(file, text);

  return out;
}

/**
 * 向上扫描紧邻的注释行（//, /* ... */ /*, JSDoc *）和空行，把它们也算进 symbol 块。
 * 最多回溯 8 行，避免把无关注释吞进来。
 */
function expandUpwardForComments(lines: string[], symStartLine: number): number {
  const MAX_LOOKBACK = 8;
  let i = symStartLine - 2; // symStartLine 是 1-based，前一行索引 = symStartLine-2
  let earliest = symStartLine;
  let consumed = 0;
  while (i >= 0 && consumed < MAX_LOOKBACK) {
    const ln = lines[i].trim();
    if (
      ln === '' ||
      ln.startsWith('//') ||
      ln.startsWith('/*') ||
      ln.startsWith('*') ||
      ln.startsWith('*/')
    ) {
      earliest = i + 1; // 转回 1-based
      i--;
      consumed++;
      continue;
    }
    break;
  }
  return earliest;
}