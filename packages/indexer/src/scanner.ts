import { promises as fs } from 'node:fs';
import path from 'node:path';

const IGNORES = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.cache', '.minicodeide']);
const IGNORE_FILES = new Set([
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  'bun.lockb',
  'Cargo.lock',
  'poetry.lock',
]);
const TEXT_EXT = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.java', '.kt', '.swift', '.c', '.h', '.cpp', '.hpp',
  '.md', '.json', '.yml', '.yaml', '.toml', '.html', '.css', '.scss', '.vue', '.svelte',
]);

export interface ScannedFile {
  path: string; // relative
  abs: string;
  size: number;
  ext: string;
}

export async function scanWorkspace(root: string): Promise<ScannedFile[]> {
  const out: ScannedFile[] = [];
  const walk = async (dir: string) => {
    let entries: import('node:fs').Dirent[] = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith('.') && e.name !== '.env' && e.name !== '.gitignore') continue;
      if (IGNORES.has(e.name)) continue;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        await walk(abs);
      } else if (e.isFile()) {
        if (IGNORE_FILES.has(e.name)) continue;
        const ext = path.extname(e.name).toLowerCase();
        if (!TEXT_EXT.has(ext)) continue;
        try {
          const st = await fs.stat(abs);
          if (st.size > 1_000_000) continue; // > 1MB skip
          out.push({ path: path.relative(root, abs), abs, size: st.size, ext });
        } catch {
          /* */
        }
      }
    }
  };
  await walk(root);
  return out;
}