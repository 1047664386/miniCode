
import { useEffect, useRef, useState } from 'react';
import Editor, { DiffEditor } from '@monaco-editor/react';
import { useStore } from '../store';
import { InlineEditWidget } from './InlineEditWidget';
import { WelcomePage } from './WelcomePage';

function extToLang(p: string): string {
  const ext = p.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', go: 'go', rs: 'rust', java: 'java', json: 'json',
    md: 'markdown', html: 'html', css: 'css', scss: 'scss', yml: 'yaml', yaml: 'yaml',
  };
  return map[ext ?? ''] ?? 'plaintext';
}

export function EditorArea() {
  const { tabs, activeTab, updateTab, closeTab, saveActive, acceptPending, rejectPending, revealTarget } =
    useStore((s) => s);
  const tab = tabs.find((t) => t.path === activeTab);
  const isDiff = tab && tab.pendingEditId;
  const editorRef = useRef<any>(null);
  const [inlineEdit, setInlineEdit] = useState<{
    path: string;
    selection: string;
    language: string;
    contextBefore: string;
    contextAfter: string;
    fullText: string;
    startLine: number;
  } | null>(null);

  // 触发 Cmd+K：用当前 selection 和上下文打开 InlineEditWidget
  const openCmdK = () => {
    const ed = editorRef.current;
    if (!ed || !tab) return;
    const sel = ed.getSelection();
    const model = ed.getModel();
    if (!sel || !model || sel.isEmpty()) return;
    const fullText: string = model.getValue();
    const selectionText: string = model.getValueInRange(sel);
    const beforeRange = {
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: sel.startLineNumber,
      endColumn: sel.startColumn,
    };
    const totalLines = model.getLineCount();
    const lastCol = model.getLineMaxColumn(totalLines);
    const afterRange = {
      startLineNumber: sel.endLineNumber,
      startColumn: sel.endColumn,
      endLineNumber: totalLines,
      endColumn: lastCol,
    };
    setInlineEdit({
      path: tab.path,
      selection: selectionText,
      language: extToLang(tab.path),
      contextBefore: model.getValueInRange(beforeRange),
      contextAfter: model.getValueInRange(afterRange),
      fullText,
      startLine: sel.startLineNumber,
    });
  };

  /** Cmd+L / 右键 "Add to Chat" — 把当前选区或文件推到 chat input
   *  ⚠️ 必须读 store 的实时 activeTab（不能用闭包 tab：onMount 时 capture 的是首个 tab）
   */
  const addCurrentToChat = () => {
    const ed = editorRef.current;
    if (!ed) return;
    const st = useStore.getState();
    const curPath = st.activeTab;
    if (!curPath) return;
    const sel = ed.getSelection();
    const model = ed.getModel();
    if (!model) return;
    let mention: string;
    if (sel && !sel.isEmpty()) {
      mention = `@selection:${curPath}:${sel.startLineNumber}-${sel.endLineNumber}`;
    } else {
      mention = `@file:${curPath}`;
    }
    st.appendChatInput(mention + ' ');
  };

  /** Cmd+Shift+L / 右键 "Send Selection to Agents Window"
   *  把当前选区作为附件 push 到 Agents Window（独立窗口的对话框）
   */
  const sendCurrentToAgentsWindow = () => {
    const ed = editorRef.current;
    if (!ed) return;
    const st = useStore.getState();
    const curPath = st.activeTab;
    if (!curPath) return;
    const model = ed.getModel();
    if (!model) return;
    const sel = ed.getSelection();
    const api = (window as any).mciAgents;
    if (!api?.sendAttachSelection) return;
    if (sel && !sel.isEmpty()) {
      const text = model.getValueInRange(sel);
      api.sendAttachSelection({
        wsPath: curPath,
        line1: sel.startLineNumber,
        line2: sel.endLineNumber,
        text,
        fileName: curPath.split('/').pop(),
      });
    } else {
      api.sendAttachSelection({
        wsPath: curPath,
        text: model.getValue(),
        fileName: curPath.split('/').pop(),
      });
    }
  };

  // 响应 revealLine
  useEffect(() => {
    if (!revealTarget || !editorRef.current) return;
    if (revealTarget.path !== activeTab) return;
    const ed = editorRef.current;
    ed.revealLineInCenter(revealTarget.line);
    ed.setPosition({ lineNumber: revealTarget.line, column: 1 });
    ed.focus();
  }, [revealTarget, activeTab]);

  return (
    <div className="editor-area">
      <div className="tabs">
        {tabs.map((t) => (
          <div
            key={t.path}
            className={`tab ${t.path === activeTab ? 'active' : ''} ${t.pendingEditId ? 'pending' : ''}`}
            onClick={() => useStore.setState({ activeTab: t.path })}
          >
            {t.pendingEditId ? '◆ ' : ''}
            {t.path.split('/').pop()}
            {t.dirty ? ' •' : ''}
            <span
              className="close"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(t.path);
              }}
            >
              ×
            </span>
          </div>
        ))}
      </div>

      {isDiff && tab && (
        <div className="diff-bar diff-bar--mini">
          <span className="diff-label">
            ◆ Pending edit · <code>{tab.path}</code>
          </span>
          <span className="diff-bar__hint">⌘↵ accept · esc reject</span>
        </div>
      )}

      {tab ? (
        isDiff ? (
          <div className="diff-wrap">
            <div className="diff-overlay">
              <span className="diff-overlay__label">◆ Pending</span>
              <div className="diff-overlay__actions">
                <button
                  className="diff-overlay__btn diff-overlay__btn--accept"
                  title="Accept (⌘↵)"
                  onClick={() => acceptPending(tab.pendingEditId!)}
                >
                  ✓ Accept
                </button>
                <button
                  className="diff-overlay__btn diff-overlay__btn--reject"
                  title="Reject (Esc)"
                  onClick={() => rejectPending(tab.pendingEditId!)}
                >
                  ✕ Reject
                </button>
              </div>
            </div>
            <DiffEditor
              height="100%"
              theme="vs-dark"
              language={extToLang(tab.path)}
              original={tab.diffOld ?? ''}
              modified={tab.content}
              onMount={(editor, monaco) => {
                const modifiedEd = editor.getModifiedEditor();
                modifiedEd.addCommand(
                  monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
                  () => acceptPending(tab.pendingEditId!),
                );
                modifiedEd.addCommand(monaco.KeyCode.Escape, () => rejectPending(tab.pendingEditId!));
              }}
              options={{
                fontSize: 13,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                renderSideBySide: false, // inline diff，更紧凑
                readOnly: true,
              }}
            />
          </div>
        ) : (
          <Editor
            height="100%"
            theme="vs-dark"
            path={tab.path}
            language={extToLang(tab.path)}
            value={tab.content}
            onChange={(v) => updateTab(tab.path, v ?? '')}
            onMount={(editor, monaco) => {
              editorRef.current = editor;
              editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                saveActive();
              });
              editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP, () => {
                useStore.getState().togglePalette(true);
              });
              // Cmd+K：选中代码后唤起 inline edit
              editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
                openCmdK();
              });
              // Cmd+L：把当前选区（或整文件）作为 @selection / @file 推到 chat input
              editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyL, () => {
                addCurrentToChat();
              });
              // 右键菜单：Add Selection to Chat
              editor.addAction({
                id: 'add-to-chat',
                label: 'Add to Chat',
                contextMenuGroupId: 'navigation',
                contextMenuOrder: 1.5,
                keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyL],
                run: () => addCurrentToChat(),
              });
              // 右键菜单：把选区推到 Agents Window（独立窗口）
              editor.addAction({
                id: 'send-to-agents-window',
                label: 'Send Selection to Agents Window',
                contextMenuGroupId: 'navigation',
                contextMenuOrder: 1.6,
                keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyL],
                run: () => sendCurrentToAgentsWindow(),
              });
            }}
            options={{
              fontSize: 13,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              inlineSuggest: { enabled: true, mode: 'subwordSmart' },
              suggest: { preview: true },
            }}
          />
        )
      ) : (
        <div className="welcome-wrap">
          <WelcomePage />
        </div>
      )}
      {inlineEdit && (
        <InlineEditWidget
          {...inlineEdit}
          onClose={() => setInlineEdit(null)}
        />
      )}
    </div>
  );
}