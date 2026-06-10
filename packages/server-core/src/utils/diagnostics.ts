import { exec } from 'node:child_process';
import path from 'node:path';
import { promises as fs } from 'node:fs';

/** TypeScript 诊断条目 */
export interface Diagnostic {
  file: string;
  line: number;
  col: number;
  severity: 'error' | 'warning';
  message: string;
  code: string;
}

/** 诊断缓存 */
export interface DiagCache {
  ts: number;
  running: boolean;
  result: Diagnostic[];
  lastError?: string;
  durationMs?: number;
}

/** 30 秒 TTL */
export const DIAG_TTL_MS = 30_000;

/** 创建一个空的诊断缓存 */
export function createDiagCache(): DiagCache {
  return { ts: 0, running: false, result: [] };
}

/**
 * 执行 tsc --noEmit (或项目自定义 typecheck 命令)，
 * 解析输出为结构化诊断列表。
 *
 * @param workspace - 项目根目录
 * @param cache - 诊断缓存对象（会被原地更新）
 * @returns 当前诊断列表
 */
export async function runDiagnostics(
  workspace: string,
  cache: DiagCache,
): Promise<Diagnostic[]> {
  if (cache.running) return cache.result;
  cache.running = true;
  const t0 = Date.now();
  try {
    const hasPnpm = await fs.access(path.join(workspace, 'pnpm-workspace.yaml'))
      .then(() => true).catch(() => false);
    const pkgJson = await fs.readFile(path.join(workspace, 'package.json'), 'utf-8')
      .catch(() => '{}');
    const scripts = (JSON.parse(pkgJson).scripts ?? {}) as Record<string, string>;
    let cmd: string;
    if (hasPnpm && scripts.typecheck) cmd = 'pnpm -r typecheck';
    else if (scripts.typecheck) cmd = 'npm run typecheck';
    else cmd = 'npx tsc --noEmit';

    const result = await new Promise<{ out: string }>((resolve) => {
      const p = exec(
        cmd,
        { cwd: workspace, maxBuffer: 8 * 1024 * 1024, timeout: 120_000 },
        (_e: unknown, so: string, se: string) =>
          resolve({ out: (so ?? '') + '\n' + (se ?? '') }),
      );
      (p as unknown as { on?: (ev: string, fn: () => void) => void })
        .on?.('error', () => undefined);
    });

    const diagnostics: Diagnostic[] = [];
    const tscRe = /(.+?)\((\d+),(\d+)\):\s*(error|warning)\s+(TS\d+):\s*(.+)/g;
    for (const m of result.out.matchAll(tscRe)) {
      let file = m[1];
      if (path.isAbsolute(file)) file = path.relative(workspace, file);
      diagnostics.push({
        file,
        line: Number(m[2]),
        col: Number(m[3]),
        severity: m[4] as 'error' | 'warning',
        message: m[6].slice(0, 300),
        code: m[5],
      });
      if (diagnostics.length >= 200) break;
    }
    cache.ts = Date.now();
    cache.running = false;
    cache.result = diagnostics;
    cache.durationMs = Date.now() - t0;
    cache.lastError = undefined;
  } catch (e: unknown) {
    cache.ts = Date.now();
    cache.running = false;
    cache.result = [];
    cache.lastError = e instanceof Error ? e.message : String(e);
    cache.durationMs = Date.now() - t0;
  }
  return cache.result;
}
