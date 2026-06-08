
/**
 * router.ts —— 极简手写路由
 * ---------------------------------------------------------------
 * 设计原则（参考 CodeFlicker gateway/server.impl.ts）：
 *   - 路由表是简单数组：[{ method, pattern, handler }]
 *   - 匹配支持 exact 路径 + `:param` + `*` 末尾通配
 *   - 不做 Express 的中间件链；中间件就是普通函数，handler 自己组合
 *   - request body 解析、CORS、JSON response 都是 utility 函数，不挂在 framework 上
 *
 * 为什么不用 Express：
 *   - Express 4 体积 1.5MB + 100+ 间接依赖
 *   - 我们的需求 = 路由匹配 + JSON 读写 + SSE → 200 行手写够了
 *   - 完全可控：中间件顺序 / 错误处理 / response stream 都自己定
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';

export interface RouteCtx {
  req: IncomingMessage;
  res: ServerResponse;
  /** 解析后的 URL（含 query） */
  url: URL;
  /** path param: { id: 'xxx' } */
  params: Record<string, string>;
  /** query string: { q: 'xxx' } */
  query: Record<string, string>;
  /** body（只在 readBody 后填充） */
  body?: any;
}

export type Handler = (ctx: RouteCtx) => void | Promise<void>;

interface Route {
  method: Method;
  /** path pattern，如 /api/sessions/:id 或 /api/edits/* */
  pattern: string;
  /** 编译后的 regex */
  regex: RegExp;
  /** param 名顺序 */
  paramNames: string[];
  handler: Handler;
}

function compile(pattern: string): { regex: RegExp; paramNames: string[] } {
  const paramNames: string[] = [];
  // 转 regex：:name → ([^/]+)，* → (.*)
  const body = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\/:([\w]+)/g, (_m, name) => {
      paramNames.push(name);
      return '/([^/]+)';
    })
    .replace(/\\\*/g, '(.*)');
  return { regex: new RegExp(`^${body}$`), paramNames };
}

export class Router {
  private routes: Route[] = [];

  add(method: Method, pattern: string, handler: Handler) {
    const { regex, paramNames } = compile(pattern);
    this.routes.push({ method, pattern, regex, paramNames, handler });
  }

  get(p: string, h: Handler)    { this.add('GET', p, h); }
  post(p: string, h: Handler)   { this.add('POST', p, h); }
  put(p: string, h: Handler)    { this.add('PUT', p, h); }
  patch(p: string, h: Handler)  { this.add('PATCH', p, h); }
  delete(p: string, h: Handler) { this.add('DELETE', p, h); }

  /** 查找匹配；不匹配返回 null */
  match(method: string, pathname: string): { route: Route; params: Record<string, string> } | null {
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const m = route.regex.exec(pathname);
      if (!m) continue;
      const params: Record<string, string> = {};
      route.paramNames.forEach((name, i) => { params[name] = decodeURIComponent(m[i + 1]!); });
      return { route, params };
    }
    return null;
  }

  /** 路由表快照（debug 用） */
  snapshot() {
    return this.routes.map((r) => `${r.method} ${r.pattern}`);
  }
}