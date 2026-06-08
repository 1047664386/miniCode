
/**
 * AgentsCodePreview — 中间可关闭代码预览面板（行级渲染 + Portal 右键菜单）
 *
 * 关键交互：
 *  - 文件按行渲染，每一行一个 .ln-row
 *  - 单击 = 选中该行；Shift+单击 = 扩选；按住拖动 = 多行选区
 *  - 任意位置右键 → Portal 弹出菜单（不会被中间面板 overflow 剪裁）
 *      ➕ 添加选区到对话 / 添加这一行到对话
 *      📎 添加整文件到对话
 *      📋 复制选中 / 复制文件路径
 *  - 跨窗口接收：mciAgents.onAttachSelection
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAgentsStore } from './store';
import { CtxMenu, type CtxMenuItem } from './CtxMenu';

interface FileContent {
  path: string;
  content: string;
  size: number;
}

export function AgentsCodePreview() {
  const ws = useAgentsStore((s) => s.workspaceRoot);
  const openFiles = useAgentsStore((s) => s.openFiles);
  const previewFile = useAgentsStore((s) => s.previewFile);
  const setPreviewFile = useAgentsStore((s) => s.setPreviewFile);
  const closeFile = useAgentsStore((s) => s.closeFile);
  const closePreview = useAgentsStore((s) => s.closePreview);
  const attachWorkspaceFile = useAgentsStore((s) => s.attachWorkspaceFile);
  const attachWorkspaceSelection = useAgentsStore((s) => s.attachWorkspaceSelection);
  const pendingAttachments = useAgentsStore((s) => s.pendingAttachments);

  const [data, setData] = useState<FileContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // anchor & focus：行号 1-indexed；null=无选区
  const [anchor, setAnchor] = useState<number | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const draggingRef = useRef(false);

  const [ctx, setCtx] = useState<{ x: number; y: number; rightClickedLine?: number } | null>(null);

  useEffect(() => {
    if (!ws || !previewFile) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErr(null);
    void fetch(`/api/agents/file?ws=${encodeURIComponent(ws)}&path=${encodeURIComponent(previewFile)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j) => {
        if (cancelled) return;
        setData(j as FileContent);
        setLoading(false);
      })
      .catch((e: any) => {
        if (cancelled) return;
        setErr(String(e?.message ?? e));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [ws, previewFile]);

  useEffect(() => { setAnchor(null); setFocus(null); setCtx(null); }, [previewFile]);

  // 跨窗口接收（主 IDE → Agents Window 推送选区）
  useEffect(() => {
    const api = (window as any).mciAgents;
    const off = api?.onAttachSelection?.((payload: any) => {
      if (!payload?.wsPath || typeof payload.text !== 'string') return;
      if (payload.line1 && payload.line2) {
        attachWorkspaceSelection(payload.wsPath, payload.line1, payload.line2, payload.text);
      }
    });
    return () => { try { off?.(); } catch {} };
  }, [attachWorkspaceSelection]);

  if (!previewFile) return null;

  const text = data?.content ?? '';
  const lines = text ? text.split('\n') : [];
  const fileName = previewFile.split('/').pop() ?? previewFile;
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';

  const selL1 = anchor !== null && focus !== null ? Math.min(anchor, focus) : null;
  const selL2 = anchor !== null && focus !== null ? Math.max(anchor, focus) : null;
  const hasSel = selL1 !== null && selL2 !== null;

  const onLineMouseDown = (ln: number, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (e.shiftKey && anchor !== null) {
      setFocus(ln);
    } else {
      setAnchor(ln);
      setFocus(ln);
      draggingRef.current = true;
    }
  };
  const onLineMouseEnter = (ln: number) => {
    if (draggingRef.current) setFocus(ln);
  };
  const onMouseUp = () => { draggingRef.current = false; };

  // 操作 ----
  const addSelection = useCallback((l1: number, l2: number) => {
    if (!previewFile || !data) return;
    const sliced = data.content.split('\n').slice(l1 - 1, l2).join('\n');
    attachWorkspaceSelection(previewFile, l1, l2, sliced);
    setAnchor(null); setFocus(null);
  }, [previewFile, data, attachWorkspaceSelection]);

  const addWholeFile = useCallback(() => {
    if (previewFile) void attachWorkspaceFile(previewFile);
  }, [previewFile, attachWorkspaceFile]);

  const copyRange = useCallback((l1: number, l2: number) => {
    if (!data) return;
    const sliced = data.content.split('\n').slice(l1 - 1, l2).join('\n');
    void navigator.clipboard?.writeText(sliced).catch(() => undefined);
  }, [data]);

  const copyPath = useCallback(() => {
    if (previewFile) void navigator.clipboard?.writeText(previewFile).catch(() => undefined);
  }, [previewFile]);

  // 右键 ----
  const openCtxMenu = (e: React.MouseEvent, ln?: number) => {
    e.preventDefault();
    e.stopPropagation();
    setCtx({ x: e.clientX, y: e.clientY, rightClickedLine: ln });
  };

  // 计算菜单项 ----
  const buildMenuItems = (): (CtxMenuItem | 'divider')[] => {
    const items: (CtxMenuItem | 'divider')[] = [];
    if (hasSel && selL1 !== null && selL2 !== null) {
      items.push({
        icon: '➕',
        label: '添加选区到对话',
        hint: `L${selL1}–L${selL2}`,
        variant: 'primary',
        onClick: () => addSelection(selL1, selL2),
      });
    } else if (ctx?.rightClickedLine) {
      // 没拖选 → 把右键所在行作为单行选区加入
      const ln = ctx.rightClickedLine;
      items.push({
        icon: '➕',
        label: '添加这一行到对话',
        hint: `L${ln}`,
        variant: 'primary',
        onClick: () => addSelection(ln, ln),
      });
    }
    const wholeAttached = pendingAttachments.some((a) => a.wsPath === previewFile && !a.line1);
    items.push({
      icon: '📎',
      label: wholeAttached ? '整文件已加入' : '添加整文件到对话',
      disabled: wholeAttached,
      onClick: addWholeFile,
    });
    items.push('divider');
    if (hasSel && selL1 !== null && selL2 !== null) {
      items.push({
        icon: '📋',
        label: '复制选中内容',
        onClick: () => copyRange(selL1, selL2),
      });
    } else if (ctx?.rightClickedLine) {
      const ln = ctx.rightClickedLine;
      items.push({
        icon: '📋',
        label: '复制这一行',
        onClick: () => copyRange(ln, ln),
      });
    }
    items.push({
      icon: '📋',
      label: '复制文件路径',
      onClick: copyPath,
    });
    if (hasSel) {
      items.push('divider');
      items.push({
        icon: '✕',
        label: '取消选择',
        variant: 'muted',
        onClick: () => { setAnchor(null); setFocus(null); },
      });
    }
    return items;
  };

  return (
    <section className="agents-preview" onMouseUp={onMouseUp}>
      <div className="agents-preview-tabs">
        <span className="agents-preview-tabs-icon" title="文件预览">📄 文件</span>
        <div className="agents-preview-tabs-spacer" />
        <button
          type="button"
          className="agents-preview-close"
          onClick={closePreview}
          title="关闭预览面板"
        >×</button>
      </div>

      <div className="agents-preview-tabbar">
        {openFiles.map((p) => {
          const name = p.split('/').pop() ?? p;
          const active = p === previewFile;
          return (
            <div
              key={p}
              className={`agents-preview-tab${active ? ' active' : ''}`}
              onClick={() => setPreviewFile(p)}
              title={p}
            >
              <span className="agents-preview-tab-name">{name}</span>
              <span
                className="agents-preview-tab-close"
                onClick={(e) => { e.stopPropagation(); closeFile(p); }}
              >×</span>
            </div>
          );
        })}
      </div>

      <div className="agents-preview-pathbar">
        <span className="agents-preview-pathbar-icon">📍</span>
        <span className="agents-preview-pathbar-text" title={previewFile}>
          {previewFile}
          {hasSel && <span className="agents-preview-sel-badge"> · L{selL1}–L{selL2}</span>}
        </span>
        {hasSel && selL1 !== null && selL2 !== null ? (
          <button
            type="button"
            className="agents-preview-action active"
            onClick={() => addSelection(selL1, selL2)}
            title={`把 L${selL1}-L${selL2} 加入对话`}
          >➕ 加入选区</button>
        ) : (
          <button
            type="button"
            className={`agents-preview-action${pendingAttachments.some((a) => a.wsPath === previewFile && !a.line1) ? ' active' : ''}`}
            onClick={addWholeFile}
            disabled={pendingAttachments.some((a) => a.wsPath === previewFile && !a.line1)}
            title="加入整文件到对话"
          >
            {pendingAttachments.some((a) => a.wsPath === previewFile && !a.line1) ? '✓ 已加入' : '➕ 加入整文件'}
          </button>
        )}
        <button
          type="button"
          className="agents-preview-action"
          onClick={copyPath}
          title="复制路径"
        >📋</button>
      </div>

      <div
        className="agents-preview-body"
        onContextMenu={(e) => openCtxMenu(e)}
      >
        {loading && <div className="agents-preview-loading">加载中…</div>}
        {err && <div className="agents-preview-error">⚠ {err}</div>}
        {!loading && !err && data && (
          <div className={`agents-preview-code lang-${ext}`}>
            {lines.map((line, i) => {
              const ln = i + 1;
              const inSel = hasSel && selL1 !== null && selL2 !== null && ln >= selL1 && ln <= selL2;
              return (
                <div
                  key={i}
                  className={`ln-row${inSel ? ' in-sel' : ''}`}
                  onMouseDown={(e) => onLineMouseDown(ln, e)}
                  onMouseEnter={() => onLineMouseEnter(ln)}
                  onContextMenu={(e) => openCtxMenu(e, ln)}
                >
                  <span className="ln-no">{ln}</span>
                  <span className="ln-content">{line || '\u00A0'}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {ctx && (
        <CtxMenu
          x={ctx.x}
          y={ctx.y}
          items={buildMenuItems()}
          onClose={() => setCtx(null)}
        />
      )}
    </section>
  );
}