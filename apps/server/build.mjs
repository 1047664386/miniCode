
#!/usr/bin/env node
/**
 * build.mjs —— esbuild bundle for Express server (SINGLE-FILE 模式)
 * ---------------------------------------------------------------
 * 2026-06：从 "全部 dep external + pnpm deploy 800MB" 切换为单文件 bundle
 *
 * 只 external：
 *   1. native binding (*.node) —— 无法 bundle
 *   2. macOS 专属可选包 —— fsevents
 *
 * 其余包（express / cors / chokidar / ws / zod / rxjs ...）全部 bundle 进
 * main.mjs，最终 ~3MB，运行时 node_modules 只剩 native（~50MB）。
 */
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const outDir = path.join(__dirname, 'dist');
mkdirSync(outDir, { recursive: true });

const external = [
  // native bindings — 包含 *.node 文件，无法 bundle
  'tree-sitter',
  'tree-sitter-javascript',
  'tree-sitter-typescript',
  'tree-sitter-python',
  'tree-sitter-go',
  'tree-sitter-rust',
  'tree-sitter-java',
  'tree-sitter-c-sharp',
  'tree-sitter-cpp',
  'tree-sitter-ruby',
  'web-tree-sitter',
  // ws 性能加速（可选，缺失时纯 JS fallback）
  'bufferutil',
  'utf-8-validate',
  // chokidar macOS native
  'fsevents',
];

await build({
  entryPoints: [path.join(__dirname, 'src', 'main.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: path.join(outDir, 'main.mjs'),
  external,
  sourcemap: true,
  logLevel: 'info',
  banner: {
    js: [
      // Node ESM shim：createRequire + __filename/__dirname
      "import { createRequire as __cr } from 'module';",
      "import { fileURLToPath as __ftu } from 'url';",
      "import { dirname as __dn } from 'path';",
      "const require = __cr(import.meta.url);",
      "const __filename = __ftu(import.meta.url);",
      "const __dirname = __dn(__filename);",
    ].join('\n'),
  },
});

console.log('[server-build] done →', path.relative(process.cwd(), path.join(outDir, 'main.mjs')));