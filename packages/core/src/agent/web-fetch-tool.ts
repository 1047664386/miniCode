/**
 * web_fetch tool —— 让 LLM 主动取一段公网内容（文档/SO/README/RFC），转 Markdown。
 *
 * 设计要点：
 *  1. 零依赖：用 fetch + 自写极简 HTML→Markdown（不引 turndown/readability，避免 monorepo 体积膨胀）
 *  2. 内容裁剪：30KB 上限（约 8K tokens），超过截断；优先正文区域
 *  3. 进程级 LRU 缓存：15 min TTL，128 entries —— 同一 URL 短时间反复 fetch 直接命中
 *  4. 安全：白名单协议（http/https）；阻止 RFC1918 / localhost / metadata 服务（防 SSRF）
 *  5. UA 伪装：常见 site 对默认 UA 经常返回 403，使用一个真实浏览器 UA
 *  6. parallelSafe=true：纯读，无副作用；可与其它 read tool 并发
 */
import { z } from 'zod';
import type { Tool } from './tool-registry.js';

const CACHE = new Map<string, { at: number; text: string; title: string; finalUrl: string }>();
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_MAX = 128;
const MAX_CONTENT_BYTES = 30 * 1024;
const MAX_REDIRECTS = 5;

function cacheGet(url: string) {
  const e = CACHE.get(url);
  if (!e) return null;
  if (Date.now() - e.at > CACHE_TTL_MS) {
    CACHE.delete(url);
    return null;
  }
  return e;
}

function cachePut(url: string, val: { text: string; title: string; finalUrl: string }) {
  if (CACHE.size >= CACHE_MAX) {
    const oldestKey = CACHE.keys().next().value;
    if (oldestKey) CACHE.delete(oldestKey);
  }
  CACHE.set(url, { at: Date.now(), ...val });
}

/** SSRF 防护：拒绝对内网 / 元数据服务 / file:// 等的访问 */
function ensureSafeUrl(raw: string): { ok: true; url: URL } | { ok: false; reason: string } {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, reason: 'Malformed URL' };
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { ok: false, reason: `Disallowed protocol: ${u.protocol}` };
  }
  const host = u.hostname.toLowerCase();

  // 纯 IP 地址检查（防止通过 IP 绕过域名黑名单）
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const octets = host.split('.').map(Number);
    if (octets.some((o) => o > 255)) {
      return { ok: false, reason: 'Invalid IP address' };
    }
    // 127.x.x.x
    if (octets[0] === 127) {
      return { ok: false, reason: 'Disallowed host: loopback' };
    }
    // 10.x.x.x
    if (octets[0] === 10) {
      return { ok: false, reason: 'Disallowed host: private network (10.0.0.0/8)' };
    }
    // 172.16-31.x.x
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) {
      return { ok: false, reason: 'Disallowed host: private network (172.16.0.0/12)' };
    }
    // 192.168.x.x
    if (octets[0] === 192 && octets[1] === 168) {
      return { ok: false, reason: 'Disallowed host: private network (192.168.0.0/16)' };
    }
    // 169.254.x.x (link-local / cloud metadata)
    if (octets[0] === 169 && octets[1] === 254) {
      return { ok: false, reason: 'Disallowed host: link-local / cloud metadata' };
    }
    // 0.0.0.0
    if (octets[0] === 0 && octets[1] === 0 && octets[2] === 0 && octets[3] === 0) {
      return { ok: false, reason: 'Disallowed host: 0.0.0.0' };
    }
  }

  // IPv6 loopback
  if (host === '[::1]' || host === '::1') {
    return { ok: false, reason: 'Disallowed host: IPv6 loopback' };
  }

  // 域名黑名单
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    host.endsWith('.localhost') ||
    host.endsWith('.internal') ||
    host.endsWith('.arpa')
  ) {
    return { ok: false, reason: 'Disallowed host: loopback / local / internal' };
  }
  return { ok: true, url: u };
}

/** DNS 重绑定防护：解析域名后再次检查 IP 是否为私有地址 */
async function ensureSafeDns(url: URL): Promise<{ ok: true } | { ok: false; reason: string }> {
  const host = url.hostname.toLowerCase();
  // 已经是 IP 地址的，ensureSafeUrl 已检查过
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || /^\[?[0-9a-f:]+\]?$/i.test(host)) {
    return { ok: true };
  }
  try {
    const { lookup } = await import('dns');
    return new Promise((resolve) => {
      lookup(host, (err, address) => {
        if (err) {
          // DNS 解析失败，不阻止请求（让 fetch 自行处理）
          resolve({ ok: true });
          return;
        }
        const safe = ensureSafeUrl(`http://${address}`);
        if (!safe.ok) {
          resolve({ ok: false, reason: `DNS resolved to blocked address: ${safe.reason}` });
          return;
        }
        resolve({ ok: true });
      });
    });
  } catch {
    // dns 模块不可用（如浏览器环境），跳过 DNS 检查
    return { ok: true };
  }
}

/** 极简 HTML → Markdown：保留标题/列表/代码块/链接，丢掉脚本/样式/装饰 */
function htmlToMarkdown(html: string): { title: string; markdown: string } {
  // 1. 抓 title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = (titleMatch?.[1] ?? '').replace(/\s+/g, ' ').trim();

  // 2. 删 script / style / noscript / svg / iframe / nav / footer / aside / header / form
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<form[\s\S]*?<\/form>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // 3. 优先抓 <main> / <article> / role=main，否则 fallback 到 <body>
  const main =
    s.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] ??
    s.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1] ??
    s.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ??
    s;
  s = main;

  // 4. 标签 → markdown
  s = s
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n\n# $1\n\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n### $1\n\n')
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n\n#### $1\n\n')
    .replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n\n##### $1\n\n')
    .replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n\n###### $1\n\n')
    .replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n```\n$1\n```\n')
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n')
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1')
    .replace(/<\/(ul|ol)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<a [^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
    .replace(/<[^>]+>/g, '') // 去掉剩余标签
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { title, markdown: s };
}

export const webFetchTool: Tool = {
  name: 'web_fetch',
  description:
    'Fetch a public web page (docs / RFC / Stack Overflow / GitHub README / npm page) and return its main content as Markdown. Use this to look up library APIs, error explanations, RFC text, or third-party docs that the user references.\n\n' +
    'WHEN TO USE:\n' +
    '  - User pastes a URL in their message and asks "what does this say?" / "summarize" / "use the API described here".\n' +
    '  - You need to look up a library version\'s actual API (npm / docs site / GitHub README), not guess.\n' +
    '  - You need to read an error\'s canonical explanation (e.g. an RFC, an MDN page, a TC39 proposal).\n' +
    'WHEN NOT TO USE:\n' +
    '  - Reading LOCAL project files — use read_file. web_fetch is for the public internet.\n' +
    '  - Searching the web — web_fetch fetches a SPECIFIC URL; you must already know it. There is no search tool yet.\n' +
    '  - Fetching internal / private hosts — blocked by SSRF guard (loopback, RFC1918, metadata).\n\n' +
    'BEHAVIOR:\n' +
    '  - HTML is converted to Markdown (headings/lists/code blocks/links preserved). JSON / plain text returned verbatim.\n' +
    '  - Content > 30KB is TRUNCATED with a marker. If you need more, fetch a more specific URL (anchor / sub-page).\n' +
    '  - Identical URLs are CACHED for 15 min — repeating the same fetch is free.\n' +
    '  - Returns { ok, status, finalUrl, title, content, truncated, cached }.\n\n' +
    'parallelSafe: true (pure read).',
  parallelSafe: true,
  schema: z.object({
    url: z.string().url().describe('Absolute http(s) URL to fetch.'),
    /** 可选：跳过缓存（debug 用，默认 false） */
    no_cache: z.boolean().optional(),
  }),
  async execute(input) {
    const url = (input as any).url as string;
    const noCache = !!(input as any).no_cache;

    const safe = ensureSafeUrl(url);
    if (!safe.ok) {
      return { ok: false, error: safe.reason };
    }

    // DNS 重绑定防护：解析域名后检查 IP
    const dnsSafe = await ensureSafeDns(safe.url);
    if (!dnsSafe.ok) {
      return { ok: false, error: dnsSafe.reason };
    }

    if (!noCache) {
      const hit = cacheGet(url);
      if (hit) {
        return {
          ok: true,
          status: 200,
          finalUrl: hit.finalUrl,
          title: hit.title,
          content: hit.text,
          truncated: hit.text.endsWith('[truncated]'),
          cached: true,
        };
      }
    }

    // 手动处理重定向，限制次数并在每次重定向时做安全检查
    let currentUrl = safe.url.toString();
    let redirects = 0;

    while (redirects <= MAX_REDIRECTS) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20_000);
      try {
        const resp = await fetch(currentUrl, {
          method: 'GET',
          redirect: 'manual',
          signal: ctrl.signal,
          headers: {
            'user-agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });

        // 处理重定向
        if ([301, 302, 303, 307, 308].includes(resp.status)) {
          const location = resp.headers.get('location');
          if (!location) {
            return { ok: false, error: `Redirect ${resp.status} without Location header` };
          }
          redirects++;
          if (redirects > MAX_REDIRECTS) {
            return { ok: false, error: `Too many redirects (max ${MAX_REDIRECTS})` };
          }
          // 解析重定向 URL（可能是相对路径）
          const redirectUrl = new URL(location, currentUrl);
          // 对重定向 URL 做安全检查
          const redirectSafe = ensureSafeUrl(redirectUrl.toString());
          if (!redirectSafe.ok) {
            return { ok: false, error: `Redirect to disallowed URL: ${redirectSafe.reason}` };
          }
          // DNS 重绑定防护：检查重定向域名的 DNS 解析
          const redirectDnsSafe = await ensureSafeDns(redirectSafe.url);
          if (!redirectDnsSafe.ok) {
            return { ok: false, error: `Redirect DNS check failed: ${redirectDnsSafe.reason}` };
          }
          currentUrl = redirectSafe.url.toString();
          continue;
        }

        // 非重定向响应，处理内容
        const ct = resp.headers.get('content-type') ?? '';
        const buf = await resp.arrayBuffer();
        let raw = new TextDecoder('utf-8', { fatal: false }).decode(buf);

        let title = '';
        let content = raw;
        if (/text\/html|application\/xhtml/i.test(ct)) {
          const md = htmlToMarkdown(raw);
          title = md.title;
          content = md.markdown;
        } else if (/application\/json/i.test(ct)) {
          try {
            content = JSON.stringify(JSON.parse(raw), null, 2);
          } catch {
            // 留 raw
          }
        }

        let truncated = false;
        if (content.length > MAX_CONTENT_BYTES) {
          content = content.slice(0, MAX_CONTENT_BYTES) + '\n\n...[truncated]';
          truncated = true;
        }

        const finalUrl = currentUrl;
        cachePut(url, { text: content, title, finalUrl });

        return {
          ok: resp.ok,
          status: resp.status,
          finalUrl,
          title,
          content,
          truncated,
          cached: false,
        };
      } catch (e: any) {
        return {
          ok: false,
          error: e?.name === 'AbortError' ? 'Fetch timeout (20s)' : e?.message ?? String(e),
        };
      } finally {
        clearTimeout(timer);
      }
    }

    return { ok: false, error: `Too many redirects (max ${MAX_REDIRECTS})` };
  },
};