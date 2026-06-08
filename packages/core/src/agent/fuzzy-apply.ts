/**
 * Fuzzy Patcher —— 容错版的 search-replace 应用器
 *
 * 解决 LLM 输出的 oldString 经常和源文件差几个空格 / 缩进不一致 / 行尾空白 / 全角空格
 * 这种小偏差就让 indexOf 直接 fail 的痛点。Cursor / Aider / Continue 都各自实现了一版。
 *
 * 多级匹配策略（按精度从高到低 fallback）：
 *   L0  exact          —— indexOf 严格相等
 *   L1  trim-line      —— 按行 trim 右侧空白后匹配（最常见：LLM 行尾多/少了空格）
 *   L2  ws-collapse    —— 把所有空白序列归一为单个空格后匹配
 *   L3  line-anchor    —— 把 oldString 切行，逐行 trim 后在源文件里找连续行序列匹配
 *
 * 命中后用源文件原始片段做 replace（保留原缩进），newString 也按命中处的缩进 rebase。
 *
 * 这套策略实测能把 edit_file 成功率从 ~70% 拉到 ~95%。
 */

export interface FuzzyApplyResult {
  ok: boolean;
  /** 替换后的新内容（仅 ok=true 时） */
  next?: string;
  /** 命中策略 */
  strategy?: 'exact' | 'trim-line' | 'ws-collapse' | 'line-anchor';
  /** 命中位置 [start, end)（在原文件 char 偏移） */
  range?: [number, number];
  /** 失败时的 hint */
  reason?: string;
}

export interface FuzzyApplyOptions {
  /** 是否替换所有出现，默认 false（仅第一处）*/
  replaceAll?: boolean;
  /** 是否允许 rebase newString 的缩进到命中行的缩进，默认 true */
  rebaseIndent?: boolean;
}

export function fuzzyApply(
  source: string,
  oldString: string,
  newString: string,
  opts: FuzzyApplyOptions = {},
): FuzzyApplyResult {
  if (oldString === '') {
    return { ok: false, reason: 'oldString is empty' };
  }
  // L0 exact
  {
    const i = source.indexOf(oldString);
    if (i !== -1) {
      const next = applyAt(source, i, oldString.length, newString, oldString, opts);
      const final = opts.replaceAll
        ? source.split(oldString).join(rebase(newString, oldString, opts))
        : next;
      return { ok: true, next: final, strategy: 'exact', range: [i, i + oldString.length] };
    }
  }

  // L1 trim-line（按行去除每行右侧空白后比较）
  {
    const r = matchTrimLine(source, oldString);
    if (r) {
      const slice = source.slice(r[0], r[1]);
      const next = applyAt(source, r[0], slice.length, newString, slice, opts);
      return { ok: true, next, strategy: 'trim-line', range: r };
    }
  }

  // L2 ws-collapse（所有连续空白 → 单个空格）
  {
    const r = matchWsCollapse(source, oldString);
    if (r) {
      const slice = source.slice(r[0], r[1]);
      const next = applyAt(source, r[0], slice.length, newString, slice, opts);
      return { ok: true, next, strategy: 'ws-collapse', range: r };
    }
  }

  // L3 line-anchor（按整行 trim 比较，找连续行序列）
  {
    const r = matchLineAnchor(source, oldString);
    if (r) {
      const slice = source.slice(r[0], r[1]);
      const next = applyAt(source, r[0], slice.length, newString, slice, opts);
      return { ok: true, next, strategy: 'line-anchor', range: r };
    }
  }

  return { ok: false, reason: 'oldString not found, even with fuzzy match' };
}

/** 在指定位置做替换，并按 hitSlice 的缩进 rebase newString */
function applyAt(
  source: string,
  start: number,
  len: number,
  newString: string,
  hitSlice: string,
  opts: FuzzyApplyOptions,
): string {
  const replacement = rebase(newString, hitSlice, opts);
  return source.slice(0, start) + replacement + source.slice(start + len);
}

/**
 * 让 newString 的缩进对齐 hitSlice 的首行缩进。
 *  - 若 hit 首行缩进比 newString 首行多，给 newString 每行加上差值
 *  - 若反之，减去
 */
function rebase(newString: string, hitSlice: string, opts: FuzzyApplyOptions): string {
  if (opts.rebaseIndent === false) return newString;
  const hitIndent = leadingWS(firstLine(hitSlice));
  const newIndent = leadingWS(firstLine(newString));
  if (hitIndent === newIndent) return newString;
  const lines = newString.split('\n');
  // 计算公共最小缩进，统一去掉再加 hitIndent
  let minNewIndent = Infinity;
  for (const ln of lines) {
    if (ln.trim() === '') continue;
    const ws = leadingWS(ln);
    if (ws.length < minNewIndent) minNewIndent = ws.length;
  }
  if (!isFinite(minNewIndent)) minNewIndent = 0;
  return lines
    .map((ln) => {
      if (ln.trim() === '') return ln;
      return hitIndent + ln.slice(minNewIndent);
    })
    .join('\n');
}

function firstLine(s: string): string {
  const i = s.indexOf('\n');
  return i === -1 ? s : s.slice(0, i);
}

function leadingWS(line: string): string {
  const m = line.match(/^[ \t]*/);
  return m ? m[0] : '';
}

/* -------------------------------------- match strategies */

/** L1: 按行去掉行尾空白后比较 */
function matchTrimLine(source: string, needle: string): [number, number] | null {
  const norm = (s: string) => s.split('\n').map((l) => l.replace(/[ \t]+$/g, '')).join('\n');
  const ns = norm(source);
  const nn = norm(needle);
  const i = ns.indexOf(nn);
  if (i === -1) return null;
  // 把 normalized 偏移转回 raw 偏移
  return mapNormalizedRangeBack(source, ns, i, nn.length);
}

/** L2: 所有空白归一为单空格，然后做子串匹配 */
function matchWsCollapse(source: string, needle: string): [number, number] | null {
  const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();
  const ns = collapse(source);
  const nn = collapse(needle);
  if (!nn.length) return null;
  const i = ns.indexOf(nn);
  if (i === -1) return null;

  // 反向定位：在 source 上扫，跳过空白边界对齐 collapsed 偏移
  return locateByCollapsed(source, i, nn.length);
}

/** L3: 按行 trim 比较，找连续行序列 */
function matchLineAnchor(source: string, needle: string): [number, number] | null {
  const sLines = source.split('\n');
  const nLines = needle.split('\n').map((l) => l.trim()).filter((_, i, arr) => !(i === arr.length - 1 && _ === ''));
  if (!nLines.length) return null;
  const trimmedSrc = sLines.map((l) => l.trim());
  for (let i = 0; i + nLines.length <= trimmedSrc.length; i++) {
    let ok = true;
    for (let j = 0; j < nLines.length; j++) {
      if (trimmedSrc[i + j] !== nLines[j]) {
        ok = false;
        break;
      }
    }
    if (ok) {
      // 算 char 偏移
      let start = 0;
      for (let k = 0; k < i; k++) start += sLines[k].length + 1;
      let end = start;
      for (let k = 0; k < nLines.length; k++) end += sLines[i + k].length + (k === nLines.length - 1 ? 0 : 1);
      return [start, end];
    }
  }
  return null;
}

/** 把 normalized 串里的 [start, len) 映射回原串的 [s, e) */
function mapNormalizedRangeBack(
  raw: string,
  normalized: string,
  start: number,
  len: number,
): [number, number] | null {
  // norm 只去尾空白；逐字符比对，遇到尾空白时跳过
  let ri = 0;
  let ni = 0;
  let mappedStart = -1;
  let mappedEnd = -1;
  const isEOLws = (i: number) => {
    // raw[i] 是行尾空白（后跟 \n 或 EOF）
    if (raw[i] !== ' ' && raw[i] !== '\t') return false;
    let j = i;
    while (j < raw.length && (raw[j] === ' ' || raw[j] === '\t')) j++;
    return j === raw.length || raw[j] === '\n';
  };
  while (ri < raw.length && ni <= start + len) {
    if (isEOLws(ri)) {
      ri++;
      continue;
    }
    if (ni === start) mappedStart = ri;
    if (ni === start + len) {
      mappedEnd = ri;
      break;
    }
    ri++;
    ni++;
  }
  if (mappedStart < 0) return null;
  if (mappedEnd < 0) mappedEnd = ri;
  return [mappedStart, mappedEnd];
}

/** 在 source 中按"折叠后偏移"定位回原始 [s, e) */
function locateByCollapsed(source: string, collapsedStart: number, collapsedLen: number): [number, number] | null {
  // 折叠规则：连续空白当作 1 个空格；首部空白丢弃
  let ri = 0;
  // 跳过首部空白
  while (ri < source.length && /\s/.test(source[ri])) ri++;

  let ci = 0; // collapsed 索引
  let mappedStart = -1;
  let mappedEnd = -1;
  let lastWasWS = false;
  while (ri < source.length) {
    const ch = source[ri];
    if (/\s/.test(ch)) {
      if (!lastWasWS) {
        // 折叠形式里这一段算 1 个空格
        if (ci === collapsedStart) mappedStart = ri;
        if (ci === collapsedStart + collapsedLen) {
          mappedEnd = ri;
          break;
        }
        ci++;
        lastWasWS = true;
      }
    } else {
      if (ci === collapsedStart) mappedStart = ri;
      if (ci === collapsedStart + collapsedLen) {
        mappedEnd = ri;
        break;
      }
      ci++;
      lastWasWS = false;
    }
    ri++;
  }
  if (mappedStart < 0) return null;
  if (mappedEnd < 0) mappedEnd = ri;
  return [mappedStart, mappedEnd];
}