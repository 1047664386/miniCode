
/**
 * Monaco TS 语言服务增强：
 * 1) 启用更严格的 jsx / module / target
 * 2) 把项目所有 ts/tsx 文件作为 extraLibs 注入到内置 TS Worker
 * 3) 后续可叠加 monaco-languageclient 连真正的 typescript-language-server（A2/A3）
 *
 * IMPORTANT: 我们要让 `@monaco-editor/react` 使用本地 bundle 的 monaco-editor，
 * 默认它会从 CDN (jsdelivr) 拉，离线或网络抖动时会一直 Loading...
 */
import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';
import { connectLspIfAvailable } from './lsp-client';
import { registerInlineCompletion } from './inline-completion';

// 关键：注册本地 monaco，绕开 CDN
loader.config({ monaco });

let booted = false;
const loadedFiles = new Set<string>();

export async function setupMonaco() {
  if (booted) return;
  booted = true;

  const ts = monaco.languages.typescript;

  ts.typescriptDefaults.setCompilerOptions({
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    strict: true,
    skipLibCheck: true,
    resolveJsonModule: true,
    allowJs: true,
    baseUrl: 'inmemory://workspace/',
  });
  ts.javascriptDefaults.setCompilerOptions({
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    allowJs: true,
    checkJs: false,
    jsx: ts.JsxEmit.ReactJSX,
  });

  ts.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
  });

  await preloadWorkspaceTypings();

  // 尝试连本地 LSP（typescript-language-server）。失败则保持 monaco 内置 TS Worker。
  // dev 时走 vite proxy 走不通 ws upgrade，这里直接连 5174。
  const wsBase = location.protocol === 'https:' ? 'wss' : 'ws';
  const lspUrl = `${wsBase}://${location.hostname}:5174/lsp/ts`;
  connectLspIfAvailable({ wsUrl: lspUrl, rootUri: 'file:///' });

  // Inline ghost text 补全
  registerInlineCompletion();
}

async function preloadWorkspaceTypings() {
  try {
    const files = await collectTsFiles('.');
    for (const f of files) {
      if (loadedFiles.has(f)) continue;
      try {
        const r = await fetch(`/api/file?path=${encodeURIComponent(f)}`);
        const data = await r.json();
        const fakeUri = `inmemory://workspace/${f}`;
        const ts = monaco.languages.typescript;
        ts.typescriptDefaults.addExtraLib(data.content ?? '', fakeUri);
        loadedFiles.add(f);
      } catch {
        /* skip */
      }
    }
    console.log(`[monaco-ts] loaded ${loadedFiles.size} files as extra libs`);
  } catch (e) {
    console.warn('[monaco-ts] preload failed', e);
  }
}

async function collectTsFiles(dir: string, depth = 0, out: string[] = []): Promise<string[]> {
  if (depth > 6 || out.length > 800) return out;
  const r = await fetch(`/api/files?path=${encodeURIComponent(dir)}`);
  const entries: { path: string; name: string; isDir: boolean }[] = await r.json();
  for (const e of entries) {
    if (e.isDir) {
      if (['node_modules', 'dist', 'build', '.git'].includes(e.name)) continue;
      await collectTsFiles(e.path, depth + 1, out);
    } else if (/\.(tsx?|jsx?|d\.ts)$/.test(e.name)) {
      out.push(e.path);
    }
  }
  return out;
}

/** 文件保存后刷新对应 extra lib（供编辑/accept 时调用） */
export function refreshExtraLib(filePath: string, content: string) {
  const ts = monaco.languages.typescript;
  const fakeUri = `inmemory://workspace/${filePath}`;
  ts.typescriptDefaults.addExtraLib(content, fakeUri);
  loadedFiles.add(filePath);
}