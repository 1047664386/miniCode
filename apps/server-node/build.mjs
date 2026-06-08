
/**
 * build.mjs —— esbuild single-file bundle for @mini/server-node
 * ---------------------------------------------------------------
 * 与 apps/server/build.mjs 同样的 external 策略（只 external native）。
 * 目标 dist/main.mjs 应该 < 3MB（比 express 版还小一点，因为没装 express）。
 */
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, 'dist');
mkdirSync(outDir, { recursive: true });

const external = [
  // native bindings
  'tree-sitter', 'tree-sitter-javascript', 'tree-sitter-typescript',
  'tree-sitter-python', 'tree-sitter-go', 'tree-sitter-rust',
  'tree-sitter-java', 'tree-sitter-c-sharp', 'tree-sitter-cpp',
  'tree-sitter-ruby', 'web-tree-sitter',
  // ws optional native accelerators
  'bufferutil', 'utf-8-validate',
  // chokidar macOS
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
      "import { createRequire as __cr } from 'module';",
      "import { fileURLToPath as __ftu } from 'url';",
      "import { dirname as __dn } from 'path';",
      "const require = __cr(import.meta.url);",
      "const __filename = __ftu(import.meta.url);",
      "const __dirname = __dn(__filename);",
    ].join('\n'),
  },
});

console.log('[server-node:build] done →', path.relative(process.cwd(), path.join(outDir, 'main.mjs')));