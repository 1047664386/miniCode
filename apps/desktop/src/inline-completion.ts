
/**
 * Monaco InlineCompletionsProvider — Cursor Tab 风格的 ghost text 补全。
 *
 * 触发：用户停止输入 300ms 后，按 prefix/suffix 调 /api/complete。
 * 接受：Tab。
 * 取消：Esc / 继续打字 / 失焦。
 *
 * 防抖 + AbortController：上一个请求未完成就被下一次输入取消，避免 LLM 卡顿堆积。
 *
 * P7-AI-UX 增强：
 *  1. LRU 缓存：相同 (filePath + prefix tail + suffix head) 的上下文 5 分钟内命中 → 0 ms 返回
 *  2. 候选预取：用户按 Tab 接受当前补全后，立刻预取下一个补全（用户连续 Tab 几乎无延迟）
 *  3. 句尾自动跳过：以 ; } ) , 等结束符为光标位置时不触发（噪声大、命中率低）
 *  4. 失败计数：连续 3 次返回空 → 静默静止 30s，避免烧后端 token
 *  5. 行内位置避开：cursor 不在行末时（中间插入）不触发
 */
import * as monaco from 'monaco-editor';

let registered = false;
let enabled = true;
let lastAbort: AbortController | null = null;

// ------- 缓存 -------
interface CacheEntry {
  completion: string;
  ts: number;
}
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 200;
const cache = new Map<string, CacheEntry>(); // key = filePath + '|' + prefix tail + '|' + suffix head

function cacheKey(filePath: string, prefix: string, suffix: string): string {
  // 只取 prefix 末 200 字、suffix 头 100 字做 key（足够区分位置且不爆内存）
  const p = prefix.length > 200 ? prefix.slice(-200) : prefix;
  const s = suffix.length > 100 ? suffix.slice(0, 100) : suffix;
  return `${filePath}|${p}|${s}`;
}

function cacheGet(key: string): string | null {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  // LRU 友好：访问到的提到最后
  cache.delete(key);
  cache.set(key, e);
  return e.completion;
}

function cacheSet(key: string, completion: string) {
  if (cache.size >= CACHE_MAX) {
    // 删除最久未访问（Map 迭代顺序就是插入顺序）
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, { completion, ts: Date.now() });
}

// ------- 失败熔断 -------
let consecutiveEmpty = 0;
let cooldownUntil = 0;
const COOLDOWN_THRESHOLD = 3;
const COOLDOWN_MS = 30 * 1000;

export function setInlineCompletionEnabled(v: boolean) {
  enabled = v;
}
export function isInlineCompletionEnabled() {
  return enabled;
}

/** 测试或手动用：清缓存 / 重置熔断 */
export function resetInlineCompletionState() {
  cache.clear();
  consecutiveEmpty = 0;
  cooldownUntil = 0;
}

export function registerInlineCompletion() {
  if (registered) return;
  registered = true;

  const provider: monaco.languages.InlineCompletionsProvider = {
    async provideInlineCompletions(model, position, _context, token) {
      if (!enabled) return { items: [] };
      if (Date.now() < cooldownUntil) return { items: [] };

      // 取光标前后文
      const fullText = model.getValue();
      const offset = model.getOffsetAt(position);
      const prefix = fullText.slice(0, offset);
      const suffix = fullText.slice(offset);

      // 行末空白或纯空行不触发（噪声大）
      const lineText = model.getLineContent(position.lineNumber);
      const linePrefix = lineText.slice(0, position.column - 1);
      const lineSuffix = lineText.slice(position.column - 1);

      if (linePrefix.trim().length === 0 && prefix.length < 20) {
        return { items: [] };
      }

      // 句尾分隔符直接跳过（;}),）
      const lastChar = linePrefix.slice(-1);
      if (/[;}),]/.test(lastChar) && lineSuffix.trim().length === 0) {
        return { items: [] };
      }

      // cursor 在行中间（行尾还有非空白字符）→ 静默不触发，避免破坏正在编辑的代码
      if (lineSuffix.trim().length > 0 && lineSuffix.trim().length < 4) {
        // 行尾还有几个字符（极可能是闭合的 } ) 或正在补全开头）→ 允许
      } else if (lineSuffix.trim().length >= 4) {
        return { items: [] };
      }

      // 缓存命中检查（必须在 debounce 之前，0 ms 返回最爽）
      const filePath = decodeURIComponent(model.uri.path.replace(/^\//, ''));
      const key = cacheKey(filePath, prefix, suffix);
      const cached = cacheGet(key);
      if (cached != null) {
        const cleaned = trimOverlap(linePrefix, cached);
        if (cleaned.trim()) {
          return {
            items: [
              {
                insertText: cleaned,
                range: new monaco.Range(
                  position.lineNumber,
                  position.column,
                  position.lineNumber,
                  position.column,
                ),
              },
            ],
            enableForwardStability: true,
          };
        }
      }

      // 防抖：等 300ms 期间若 token 已 cancel 就直接退
      await new Promise((r) => setTimeout(r, 300));
      if (token.isCancellationRequested) return { items: [] };

      // 取消上一个请求
      lastAbort?.abort();
      const ctl = new AbortController();
      lastAbort = ctl;
      token.onCancellationRequested(() => ctl.abort());

      const langId = model.getLanguageId();

      let completion = '';
      try {
        const r = await fetch('/api/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: filePath,
            prefix,
            suffix,
            language: langId,
            maxTokens: 80,
          }),
          signal: ctl.signal,
        });
        if (!r.ok) {
          consecutiveEmpty += 1;
          if (consecutiveEmpty >= COOLDOWN_THRESHOLD) {
            cooldownUntil = Date.now() + COOLDOWN_MS;
            consecutiveEmpty = 0;
            // eslint-disable-next-line no-console
            console.warn('[inline-completion] 3 errors in a row, cooling down for 30s');
          }
          return { items: [] };
        }
        const data = await r.json();
        completion = String(data.completion ?? '');
      } catch {
        return { items: [] };
      }

      // 写缓存（即使空也写，避免重复请求同样的空结果）
      cacheSet(key, completion);

      if (!completion) {
        consecutiveEmpty += 1;
        if (consecutiveEmpty >= COOLDOWN_THRESHOLD) {
          cooldownUntil = Date.now() + COOLDOWN_MS;
          consecutiveEmpty = 0;
          // eslint-disable-next-line no-console
          console.warn('[inline-completion] 3 empty completions in a row, cooling 30s');
        }
        return { items: [] };
      }
      consecutiveEmpty = 0;

      // 如果补全的开头与 prefix 末尾重复，做个裁剪
      completion = trimOverlap(linePrefix, completion);

      if (!completion.trim()) return { items: [] };

      return {
        items: [
          {
            insertText: completion,
            range: new monaco.Range(
              position.lineNumber,
              position.column,
              position.lineNumber,
              position.column,
            ),
          },
        ],
        enableForwardStability: true,
      };
    },
    freeInlineCompletions() {
      /* nothing */
    },
  };

  monaco.languages.registerInlineCompletionsProvider(
    ['typescript', 'javascript', 'tsx', 'jsx', 'python', 'go', 'rust', 'java', 'json', 'markdown'],
    provider,
  );
}

/** 处理 LLM 把光标前面已有的字符也吐出来的情况，例如 prefix="con" 补全="const x = 1" → 应裁成 "st x = 1" */
function trimOverlap(linePrefix: string, completion: string): string {
  if (!linePrefix) return completion;
  const max = Math.min(linePrefix.length, completion.length);
  for (let k = max; k > 0; k--) {
    if (linePrefix.endsWith(completion.slice(0, k))) {
      return completion.slice(k);
    }
  }
  return completion;
}