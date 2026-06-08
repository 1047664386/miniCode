
/**
 * MarkdownMessage：把 assistant 流式输出的 markdown 文本渲染为带样式 + 代码高亮的 React 节点。
 *
 *  - remark-gfm: 支持表格、删除线、任务列表
 *  - rehype-highlight: 自动选择语言高亮
 *  - 代码块标题区附带 Copy + Apply 按钮
 *  - Apply 流程：从 className `language-<lang>:<path>` 或 meta 提取目标路径 → POST /api/edits 创建 PendingEdit
 *  - 流式时一直 re-render；对长输出（>4KB）自动分块渲染，避免 react-markdown 单次解析过重
 */
import React, { useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import { useStore } from '../store';

/**
 * 按 \n\n 拆分段落，保留分隔符。
 */
function splitOnParagraphs(text: string): string[] {
  const parts: string[] = [];
  let start = 0;
  while (start < text.length) {
    const nextBreak = text.indexOf('\n\n', start);
    if (nextBreak === -1) {
      if (start < text.length) parts.push(text.slice(start));
      break;
    }
    parts.push(text.slice(start, nextBreak + 2));
    start = nextBreak + 2;
  }
  return parts.length > 0 ? parts : [text];
}

const CHUNK_THRESHOLD = 4096;

export function MarkdownMessage({ text }: { text: string }) {
  // 文本基本不变时缓存 components 渲染
  const components = useMemo(
    () => ({
      code({ inline, className, children, ...props }: any) {
        const cls = className || '';
        // 支持 ```ts:src/foo.ts 形式（lang 后面跟 :path 表示目标文件）
        const langMatch = /language-([\w+\-]+)(?::([^\s`]+))?/.exec(cls);
        const lang = langMatch?.[1];
        const path = langMatch?.[2];
        const codeText = String(children).replace(/\n$/, '');
        if (inline) {
          // 在 inline code 里识别 path:line 并提升为可点击
          const enriched = enrichString(codeText);
          const enrichedHasRef = enriched.some((n: any) => typeof n !== 'string');
          if (enrichedHasRef) {
            return <code className="md-inline-code md-inline-code--ref" {...props}>{enriched}</code>;
          }
          return (
            <code className="md-inline-code" {...props}>
              {children}
            </code>
          );
        }
        return (
          <div className="md-codeblock">
            <div className="md-codeblock-bar">
              <span className="md-codeblock-lang">
                {lang ?? 'text'}
                {path && <span className="md-codeblock-path"> · {path}</span>}
              </span>
              <div className="md-codeblock-actions">
                {path && <ApplyBtn path={path} content={codeText} />}
                <CopyBtn text={codeText} />
              </div>
            </div>
            <pre>
              <code className={className} {...props}>
                {children}
              </code>
            </pre>
          </div>
        );
      },
      a({ href, children, ...props }: any) {
        // 本地相对路径 (包含扩展名 & 不是 http(s) URL) → 内部跳转
        const isLocal = typeof href === 'string'
          && !/^https?:|^mailto:/.test(href)
          && /[\w\-]+\.[a-zA-Z0-9]{1,6}(?:[:#]L?\d+(?:-L?\d+)?)?$/.test(href);
        if (isLocal) {
          const m = /^([^#:]+)(?:[:#]L?(\d+))?/.exec(href);
          const path = m?.[1];
          const line = m?.[2] ? Number(m[2]) : undefined;
          if (path) {
            return (
              <FileRef path={path} line={line} raw={String(children) || href} />
            );
          }
        }
        return (
          <a href={href} target="_blank" rel="noreferrer" {...props}>
            {children}
          </a>
        );
      },
      // 把所有纯文本里的 `path:line` 或 `path#L42` 形式扫描出来，转成可点击跳转
      p({ children, ...props }: any) {
        return <p {...props}>{enrichTextChildren(children)}</p>;
      },
      li({ children, ...props }: any) {
        return <li {...props}>{enrichTextChildren(children)}</li>;
      },
    }),
    [],
  );

  // 对长文本做 chunk 渲染，避免 react-markdown 一次性 reparse 整个长字符串
  const isLong = text.length >= CHUNK_THRESHOLD;

  return (
    <div className="md-body">
      {isLong ? (
        <ChunkedMarkdown text={text} components={components} />
      ) : (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[[rehypeHighlight, { ignoreMissing: true }]]}
          components={components}
        >
          {text || ''}
        </ReactMarkdown>
      )}
    </div>
  );
}

/**
 * ChunkedMarkdown — 对超长文本按段落边界拆成 chunk，逐 chunk 渲染。
 * 流式增量输出时避免 react-markdown 一次性 reparse 整个 20K+ 字符串。
 */
function ChunkedMarkdown({ text, components }: { text: string; components: any }) {
  const chunksRef = useRef<{ text: string }[]>([]);
  const prevLenRef = useRef(0);

  // 增量更新 chunks
  const parts = splitOnParagraphs(text);
  chunksRef.current = parts.map((p) => ({ text: p }));
  prevLenRef.current = text.length;

  return (
    <>
      {chunksRef.current.map((chunk, i) => (
        <ReactMarkdown
          key={`${i}-${chunk.text.length}`}
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[[rehypeHighlight, { ignoreMissing: true }]]}
          components={components}
        >
          {chunk.text || ''}
        </ReactMarkdown>
      ))}
    </>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="md-copy-btn"
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        } catch {
          /* */
        }
      }}
    >
      {done ? '✓ copied' : '⧉ copy'}
    </button>
  );
}

/**
 * ApplyBtn — 把代码块直接转成一个 PendingEdit，让用户在编辑器里审 diff。
 * Server 路由：POST /api/edits { path, newContent }，返回 PendingEdit。
 * 拿到 id 后调用 store.openDiffTab，UI 立即切到 diff 视图。
 */
function ApplyBtn({ path, content }: { path: string; content: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<'ok' | 'err' | null>(null);
  const openDiffTab = useStore((s) => s.openDiffTab);
  return (
    <button
      className="md-apply-btn"
      disabled={busy}
      onClick={async (e) => {
        e.stopPropagation();
        setBusy(true);
        setDone(null);
        try {
          const r = await fetch('/api/edits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, newContent: content, tool: 'apply' }),
          });
          if (!r.ok) throw new Error(await r.text());
          const edit = await r.json();
          openDiffTab({
            path: edit.path,
            oldContent: edit.oldContent,
            newContent: edit.newContent,
            pendingEditId: edit.id,
          });
          setDone('ok');
          setTimeout(() => setDone(null), 1500);
        } catch {
          setDone('err');
          setTimeout(() => setDone(null), 2000);
        } finally {
          setBusy(false);
        }
      }}
      title={`Create a pending edit for ${path}`}
    >
      {busy ? '…' : done === 'ok' ? '✓ applied' : done === 'err' ? '✗ failed' : '↦ apply'}
    </button>
  );
}

// --------- 行号点击跳转：文本节点扫描 ---------

/**
 * 把 react-markdown 给 p / li 等容器节点的 children 里所有「字符串子节点」
 * 扫描出 `path:line` / `path#L42` / `path#L10-L20` 形式的引用，替换为可点击 <FileRef/>。
 *
 * 匹配规则：
 *  - 必须像文件路径（有扩展名，或 src/... 这种）
 *  - 行号可选；带行号 → 跳转；不带 → 仅打开
 *  - 反引号内的 `src/foo.ts:12` 也支持（react-markdown 会把它包成 inline <code>，
 *    我们已经在 inline code 路径上单独 enrich，参见 components.code）
 */
function enrichTextChildren(children: any): any {
  if (children == null) return children;
  if (typeof children === 'string') return enrichString(children);
  if (Array.isArray(children)) return children.map((c, i) => (
    typeof c === 'string' ? <span key={i}>{enrichString(c)}</span> : c
  ));
  return children;
}

const FILE_REF_RE = /(?<![\w/])((?:[\w.-]+\/)*[\w.-]+\.[a-zA-Z0-9]{1,6})(?:[:#]L?(\d+)(?:-L?(\d+))?)?/g;

function enrichString(s: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  // 重置 regex 状态
  FILE_REF_RE.lastIndex = 0;
  while ((m = FILE_REF_RE.exec(s)) !== null) {
    const [full, p, ln] = m;
    // 启发式：路径里必须有 / 或扩展名属于常见列表，避免把 "v0.1.0"、"ui.tsx"（罕见单 token）误伤过度
    if (!p.includes('/') && !/\.(ts|tsx|js|jsx|json|md|css|html|py|go|rs|java|sh|yml|yaml|toml)$/i.test(p)) {
      continue;
    }
    if (m.index > last) out.push(s.slice(last, m.index));
    out.push(
      <FileRef
        key={`${m.index}-${full}`}
        path={p}
        line={ln ? Number(ln) : undefined}
        raw={full}
      />,
    );
    last = m.index + full.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out.length ? out : [s];
}

function FileRef({ path, line, raw }: { path: string; line?: number; raw: string }) {
  const openFile = useStore((s) => s.openFile);
  const revealLine = useStore((s) => s.revealLine);
  return (
    <a
      className="md-fileref"
      href="#"
      title={line ? `Open ${path} at line ${line}` : `Open ${path}`}
      onClick={async (e) => {
        e.preventDefault();
        try {
          await openFile(path);
          if (line) {
            // 给 EditorArea 一帧时间挂载 model
            setTimeout(() => revealLine(path, line), 30);
          }
        } catch {
          /* 文件不存在 → 静默 */
        }
      }}
    >
      {raw}
    </a>
  );
}