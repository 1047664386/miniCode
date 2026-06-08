
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, type ChatMsg } from '../store';
import { MarkdownMessage } from './MarkdownMessage';
import { PlanPanel } from './PlanPanel';
import { SubagentPanel } from './SubagentPanel';
import { SubagentLauncher } from './SubagentLauncher';
import { CostMiniPanel } from './CostMiniPanel';
import { McpSettingsPanel } from './McpSettingsPanel';
import { ContextStatusBar } from './ContextStatusBar';
import { SessionsDrawer } from './SessionsDrawer';
import { MentionInput } from './MentionInput';
import { AddContextPopover } from './AddContextPopover';
import { vsBridge } from '../vscode-bridge';
import { useWebSpeech } from '../hooks/useWebSpeech';

interface SlashSpec {
  name: string;
  description: string;
  source: 'builtin' | 'user';
}

export function ChatPanel() {
  const {
    messages, pushMessage, patchLastAssistant, patchMessageAt, resetChat,
    mode, setMode, running, setRunning, loadTree,
    setPlan, setContextStats, setUsage, upsertSubagent,
    sessionId, createSession,
    resumeDraft, setResumeDraft,
    pendingInput,
    composerAttachments, removeAttachment, clearAttachments,
    openFile, revealLine,
    selectedProfileId, setSelectedProfileId,
  } = useStore();
  const [input, setInput] = useState('');
  const [slashList, setSlashList] = useState<SlashSpec[]>([]);
  const [slashActive, setSlashActive] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mcpOpen, setMcpOpen] = useState(false);
  const [addCtxOpen, setAddCtxOpen] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [providerProfiles, setProviderProfiles] = useState<Array<{ id: string; name: string; model?: string }>>([]);
  const addCtxBtnRef = useRef<HTMLButtonElement>(null);
  /** 待审批的 run_command（exec policy 判定为 ask 时弹出） */
  const [approvals, setApprovals] = useState<
    Array<{ id: string; tool: string; args: any }>
  >([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  /** push-announce 队列：子 Agent 完成的 announce message，跑完本 turn 自动续发 */
  const pendingAnnouncesRef = useRef<string[]>([]);
  /** 思考计时：第一个 tool_call 的时间戳，用于计算"思考中... Ns" */
  const thinkingSinceRef = useRef<number>(0);
  /** 当前 turn 的工具调用计数 */
  const turnToolCountRef = useRef<number>(0);
  /** 粘贴/拖拽上传的图片 attachments（base64 data URL） */
  const [imageAttachments, setImageAttachments] = useState<
    Array<{ id: string; name: string; type: string; dataUrl: string }>
  >([]);

  // ─── 图片粘贴/拖拽处理 ───
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  const handleImagePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = e.clipboardData.files;
    if (!files || files.length === 0) return;
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue;
      if (f.size > MAX_IMAGE_BYTES) {
        alert(`图片 ${f.name} 超过 5MB`);
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result);
        setImageAttachments((prev) => [
          ...prev,
          { id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: f.name, type: f.type, dataUrl },
        ]);
      };
      reader.readAsDataURL(f);
    }
  };
  const handleImageDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue;
      if (f.size > MAX_IMAGE_BYTES) {
        alert(`图片 ${f.name} 超过 5MB`);
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result);
        setImageAttachments((prev) => [
          ...prev,
          { id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: f.name, type: f.type, dataUrl },
        ]);
      };
      reader.readAsDataURL(f);
    }
  };

  // 语音输入（Web Speech API）
  const speech = useWebSpeech({ lang: 'zh-CN' });
  const lastSpeechRef = useRef('');
  useEffect(() => {
    if (!speech.isListening) return;
    const incoming = speech.transcript;
    const delta = incoming.slice(lastSpeechRef.current.length);
    if (delta) {
      setInput((s) => s + delta);
      lastSpeechRef.current = incoming;
    }
  }, [speech.transcript]);
  useEffect(() => {
    if (!speech.isListening) {
      lastSpeechRef.current = '';
    }
  }, [speech.isListening]);
  const toggleVoice = () => {
    if (!speech.supported) {
      alert('当前浏览器不支持 Web Speech API（建议 Chrome / Edge / Safari）');
      return;
    }
    if (speech.isListening) speech.stopListening();
    else {
      lastSpeechRef.current = '';
      speech.resetTranscript();
      speech.startListening();
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  // Resume：当 store 写入 resumeDraft，自动填到 input 并聚焦（让用户最后 review）
  useEffect(() => {
    if (resumeDraft) {
      setInput(resumeDraft);
      setResumeDraft(undefined);
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [resumeDraft, setResumeDraft]);

  // Add-to-Chat：从 editor 右键 / 文件树 / Cmd+L 推过来的待粘贴文本
  useEffect(() => {
    if (!pendingInput) return;
    setInput((cur) => (cur ? cur.replace(/\s*$/, '\n') : '') + pendingInput.text);
    setTimeout(() => {
      textareaRef.current?.focus();
      const ta = textareaRef.current;
      if (ta) {
        ta.selectionStart = ta.selectionEnd = ta.value.length;
        ta.scrollTop = ta.scrollHeight;
      }
    }, 0);
  }, [pendingInput]);

  // 加载 slash 命令列表（一次性）
  useEffect(() => {
    fetch('/api/slash').then((r) => r.json()).then(setSlashList).catch(() => {});
  }, []);
  // 加载 provider profiles（一次性）
  useEffect(() => {
    fetch('/api/providers').then((r) => r.json()).then((data: any) => {
      const profiles = (data?.profiles ?? []).filter((p: any) => !p.hash);
      setProviderProfiles(profiles.map((p: any) => ({ id: p.id, name: p.name, model: p.model })));
    }).catch(() => {});
  }, []);

  // 当且仅当输入以 / 开头、且第一行没有空格时，展示候选
  const slashSuggestions = useMemo(() => {
    if (!input.startsWith('/')) return [];
    const firstLine = input.split('\n')[0];
    if (firstLine.includes(' ')) return []; // 已开始填参数
    const q = firstLine.slice(1).toLowerCase();
    return slashList.filter((c) => c.name.startsWith(q)).slice(0, 8);
  }, [input, slashList]);

  useEffect(() => {
    setSlashActive(0);
  }, [slashSuggestions.length]);

  const applySlash = (name: string) => {
    const rest = input.split('\n').slice(1).join('\n');
    const next = '/' + name + ' ' + (rest ? '\n' + rest : '');
    setInput(next);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const send = async () => {
    const text = input.trim();
    const atts = composerAttachments;
    const imgs = imageAttachments;
    if ((!text && atts.length === 0 && imgs.length === 0) || running) return;
    setInput('');
    setImageAttachments([]);

    // 拼接 attachments 到 message 头部 (不改变后台语义，仍靠 @file:xxx)
    const attPrefix = atts.length
      ? atts
          .map((a) =>
            a.kind === 'selection' && a.line1 && a.line2
              ? `@selection:${a.path}:${a.line1}-${a.line2}`
              : `@${a.kind}:${a.path}`,
          )
          .join(' ') + '\n'
      : '';
    let finalText = (attPrefix + text).trim();
    clearAttachments();

    // 图片：提取 base64 data + media_type → 传给后端作为 multimodal content blocks
    const multimodalImages = imgs.map((img) => {
      // dataUrl 格式: "data:image/png;base64,xxxxx"
      const base64Data = img.dataUrl.split(',')[1] ?? '';
      const mediaType = img.type || 'image/png';
      return { type: 'image', media_type: mediaType, data: base64Data };
    });
    try {
      if (vsBridge.isReady()) {
        const ctx = await vsBridge.requestContext(400);
        if (ctx?.filePath) {
          const snippet = ctx.selectionText && ctx.selectionText.length > 0
            ? `\n\n<editor-context file="${ctx.filePath}" lines="${ctx.selection?.startLine}-${ctx.selection?.endLine}" lang="${ctx.language ?? ''}">\n${ctx.selectionText}\n</editor-context>`
            : `\n\n<editor-context file="${ctx.filePath}" lang="${ctx.language ?? ''}" />`;
          finalText = text + snippet;
        }
      }
    } catch {
      /* bridge 不在就降级，保持原文 */
    }

    pushMessage({ role: 'user', content: finalText });
    setRunning(true);

    // 没有 active session → 自动创建一个；首条消息内容会被 server 用作 title
    let sid = sessionId;
    if (!sid) {
      try {
        sid = await createSession();
      } catch {
        /* server 没起也不阻塞 chat */
      }
    }

    try {
      const history = useStore.getState().messages
        .slice(0, -1) // 不含本轮 user
        .filter((m) => m.role !== 'tool') // 简化：第一版不回传 tool history
        .map((m) => ({ role: m.role, content: m.content }));

      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          userMessage: finalText,
          mode,
          sessionId: sid,
          profileId: selectedProfileId,
          ...(multimodalImages.length > 0 ? { images: multimodalImages } : {}),
        }),
      });
      if (!resp.body) throw new Error('No response body');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      // 占位一条 assistant 消息
      pushMessage({ role: 'assistant', content: '' });

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const json = line.slice(5).trim();
          if (!json) continue;
          try {
            const ev = JSON.parse(json);
            handleEvent(ev);
          } catch {
            /* */
          }
        }
      }
    } catch (e: any) {
      pushMessage({ role: 'assistant', content: `❌ Error: ${e.message}` });
    } finally {
      setRunning(false);
      // 若 Agent 改了文件，重新拉一下文件树
      loadTree('.');
      // Push-Announce 续接：若刚才有子 Agent 完成的 announce，把它们合并成一条
      // user 消息自动续发（zero-token 设计：父 Agent 视角等同收到 follow-up question）
      if (pendingAnnouncesRef.current.length > 0) {
        const merged = pendingAnnouncesRef.current.join('\n\n');
        pendingAnnouncesRef.current = [];
        setInput(merged);
        // 用微任务延迟一次，让 setInput 落地后再发
        setTimeout(() => {
          void send();
        }, 0);
      }
    }
  };

  const handleEvent = (ev: any) => {
    switch (ev.type) {
      case 'text': {
        // 思考计时：第一个 text delta 到达时结算 thinking 时长
        if (thinkingSinceRef.current > 0) {
          const elapsedMs = Date.now() - thinkingSinceRef.current;
          thinkingSinceRef.current = 0;
          // 找到最后一条 assistant 消息（刚刚在 tool 链之后 push 的空消息）注入思考耗时
          const msgs = useStore.getState().messages;
          for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].role === 'assistant') {
              useStore.getState().patchMessageAt(i, { _thinkingMs: elapsedMs } as any);
              break;
            }
          }
        }
        patchLastAssistant(ev.text);
        break;
      }
      case 'tool_call': {
        turnToolCountRef.current += 1;
        if (thinkingSinceRef.current === 0) {
          thinkingSinceRef.current = Date.now();
        }
        // think tool：不推 call msg，等 result 时一次性渲染
        if (ev.toolCall.name === 'think') break;
        pushMessage({
          role: 'tool',
          content: '',
          _toolRole: 'call',
          _toolName: ev.toolCall.name,
          _toolArgs: JSON.stringify(ev.toolCall.arguments).slice(0, 200),
        } as any);
        break;
      }
      case 'tool_result': {
        turnToolCountRef.current -= 1;
        // think tool 专用渲染
        if (ev.toolCall?.name === 'think') {
          const t =
            (ev.toolResult as any)?.thought ??
            (typeof ev.toolResult === 'string' ? ev.toolResult : '');
          pushMessage({
            role: 'tool',
            content: `💭 think: ${String(t).slice(0, 80)}${String(t).length > 80 ? '…' : ''}`,
            _toolRole: 'result',
            _toolName: 'think',
            thinkFull: String(t),
            isThink: true,
          } as any);
          break;
        }
        const summary = typeof ev.toolResult === 'string'
          ? ev.toolResult.slice(0, 300)
          : JSON.stringify(ev.toolResult).slice(0, 300);
        pushMessage({
          role: 'tool',
          content: summary,
          _toolRole: 'result',
          _toolName: ev.toolCall?.name ?? 'unknown',
        } as any);
        break;
      }
      case 'pending_edit': {
        const e = ev.edit;
        useStore.getState().openDiffTab({
          path: e.path,
          oldContent: e.oldContent,
          newContent: e.newContent,
          pendingEditId: e.id,
        });
        pushMessage({
          role: 'tool',
          content: `◆ Proposed edit to ${e.path} — review in editor above.`,
          _toolRole: 'result',
          _toolName: 'pending_edit',
          pendingEditId: e.id,
          pendingEditPath: e.path,
        } as any);
        break;
      }
      case 'error':
        pushMessage({ role: 'tool', content: `✗ error: ${ev.error}` } as any);
        break;
      case 'slash':
        pushMessage({ role: 'tool', content: `⚡ slash: /${ev.command} expanded` } as any);
        break;
      case 'rules':
        if (ev.activated?.length)
          pushMessage({
            role: 'tool',
            content: `📜 rules activated: ${ev.activated.join(', ')}`,
          } as any);
        break;
      case 'plan':
        setPlan(ev.plan);
        break;
      case 'context_stats':
        setContextStats({
          contextWindow: ev.contextWindow,
          triggerTokens: ev.triggerTokens,
          targetTokens: ev.targetTokens,
          beforeTokens: ev.beforeTokens,
          afterTokens: ev.afterTokens,
          triggered: ev.triggered,
          stableTokens: ev.stableTokens,
          dynamicTokens: ev.dynamicTokens,
        });
        break;
      case 'usage':
        setUsage(ev.usage);
        break;
      case 'mentions': {
        const parts: string[] = [];
        if (ev.resolved?.length)
          parts.push(`📎 mentioned: ${ev.resolved.map((r: any) => `${r.type}:${r.label}`).join(', ')}`);
        if (ev.unresolved?.length)
          parts.push(`⚠ unresolved: ${ev.unresolved.map((u: any) => `${u.kind}:${u.arg} (${u.reason})`).join(', ')}`);
        if (parts.length) pushMessage({ role: 'tool', content: parts.join('  |  ') } as any);
        break;
      }
      case 'done':
        // Reset per-turn state
        thinkingSinceRef.current = 0;
        turnToolCountRef.current = 0;
        break;
      case 'subagent_spawned':
        pushMessage({
          role: 'tool',
          content: `🤖 dispatch_subagent → ${(ev as any).label ?? '(no-label)'}${(ev as any).role ? ` [${(ev as any).role}]` : ''}\n  task: ${(ev as any).task?.slice(0, 80) ?? ''}`,
        } as any);
        upsertSubagent({
          runId: (ev as any).runId,
          label: (ev as any).label,
          role: (ev as any).role,
          task: (ev as any).task ?? '',
          status: 'running',
          startedAt: Date.now(),
        });
        break;
      case 'subagent_announce': {
        pendingAnnouncesRef.current.push((ev as any).message as string);
        const msg = (ev as any).message as string;
        const firstLine = msg.split('\n')[0] ?? '';
        const runIdMatch = firstLine.match(/runId=([\w-]+)/);
        const outcomeMatch = firstLine.match(/outcome=(\w+)/);
        if (runIdMatch && outcomeMatch) {
          const status = outcomeMatch[1] as 'completed' | 'error' | 'timeout';
          const body = msg.split('\n').slice(2).join('\n');
          upsertSubagent({
            runId: runIdMatch[1],
            label: undefined,
            task: '',
            status,
            startedAt: 0,
            finishedAt: Date.now(),
            ...(status === 'completed' ? { result: body } : { error: body }),
          });
        }
        pushMessage({ role: 'tool', content: `📨 ${firstLine}` } as any);
        break;
      }
      case 'provider_switch': {
        const e: any = ev;
        pushMessage({
          role: 'tool',
          content: `⤵ provider switched: ${e.fromProfileId} → ${e.toProfileId} (${e.errorKind})${e.error ? `\n  ${String(e.error).slice(0, 200)}` : ''}`,
        } as any);
        break;
      }
      case 'subagent_progress': {
        const e: any = ev;
        upsertSubagent({
          runId: e.runId,
          label: undefined,
          task: '',
          status: 'running',
          startedAt: 0,
          recentTools: [{ tool: e.tool, resultPreview: e.resultPreview ?? '', ts: e.ts ?? Date.now() }],
        });
        break;
      }
      case 'thinking_start': {
        pushMessage({
          role: 'tool',
          content: '💭 Deep thinking...',
          _toolRole: 'result',
          _toolName: 'extended_thinking',
          thinkFull: '',
          _thinkingLive: true,
        } as any);
        break;
      }
      case 'thinking_delta': {
        const delta = (ev as any).thinkingDelta ?? '';
        if (!delta) break;
        const msgs = useStore.getState().messages;
        for (let i = msgs.length - 1; i >= 0; i--) {
          if ((msgs[i] as any)._thinkingLive) {
            const prev = (msgs[i] as any).thinkFull ?? '';
            const next = prev + delta;
            useStore.getState().patchMessageAt(i, {
              content: `💭 Deep thinking: ${String(next).slice(0, 80)}${String(next).length > 80 ? '…' : ''}`,
              thinkFull: next,
            } as any);
            break;
          }
        }
        break;
      }
      case 'approve_request': {
        setApprovals((prev) => [
          ...prev,
          {
            id: (ev as any).id as string,
            tool: (ev as any).tool as string,
            args: (ev as any).args,
          },
        ]);
        break;
      }
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <h3>AI Chat</h3>
        <div className="chat-header-actions">
          <button className="icon-btn" title="Sessions" onClick={() => setDrawerOpen(true)}>
            ☰
          </button>
          <button className="icon-btn" title="MCP Servers" onClick={() => setMcpOpen(true)}>
            🔌
          </button>
          <button className="icon-btn" onClick={resetChat} title="Clear conversation">⟲</button>
        </div>
      </div>
      <SessionsDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <ContextStatusBar />
      <PlanPanel />
      <SubagentLauncher />
      <SubagentPanel />
      <CostMiniPanel />
      {mcpOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: 60,
          }}
          onClick={() => setMcpOpen(false)}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', overflow: 'auto' }}>
            <McpSettingsPanel onClose={() => setMcpOpen(false)} />
          </div>
        </div>
      )}
      {approvals.length > 0 && (
        <div className="approvals-banner">
          {approvals.map((a) => (
            <div key={a.id} className="approval-card">
              <div className="approval-head">
                <span className="approval-tool">⚠️ {a.tool}</span>
                {a.args?.matchedRule && (
                  <span className="approval-rule">[{a.args.matchedRule}]</span>
                )}
              </div>
              {a.args?.reason && <div className="approval-reason">{a.args.reason}</div>}
              {a.args?.command && (
                <pre className="approval-cmd">{String(a.args.command)}</pre>
              )}
              <div className="approval-actions">
                <button
                  className="btn-approve"
                  onClick={async () => {
                    await fetch(`/api/approve/${a.id}`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ ok: true }),
                    });
                    setApprovals((prev) => prev.filter((x) => x.id !== a.id));
                  }}
                >
                  Approve
                </button>
                <button
                  className="btn-deny"
                  onClick={async () => {
                    await fetch(`/api/approve/${a.id}`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ ok: false }),
                    });
                    setApprovals((prev) => prev.filter((x) => x.id !== a.id));
                  }}
                >
                  Deny
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="messages" ref={scrollRef}>
        {!messages.length && (
          <div style={{ color: '#666', textAlign: 'center', marginTop: 40 }}>
            Ask me anything about the codebase.
            <br />
            Try: "list the project structure"
          </div>
        )}
        {messages.map((m, i) => {
          const hasThink = (m as any).thinkFull != null || (m as any).isThink;
          const hasPending =
            (m as any).pendingEditId != null || (m as any).pendingEditPath != null;

          return (
            <div key={i} className={`msg ${m.role}${hasThink ? ' has-think' : ''}${hasPending ? ' has-pending' : ''}`}>
              {m.role !== 'tool' && <div className="role-tag">{m.role}</div>}
              {m.role === 'assistant' ? (
                <>
                  {(m as any)._thinkingMs != null && (m as any)._thinkingMs > 0 && (
                    <div className="thinking-indicator">
                      <span className="thinking-indicator__dot" />
                      <span>{formatThinkingTime((m as any)._thinkingMs)}</span>
                    </div>
                  )}
                  {m.content ? (
                    <MarkdownMessage text={m.content} />
                  ) : running && i === messages.length - 1 ? (
                    <span className="thinking">…</span>
                  ) : null}
                </>
              ) : m.role === 'tool' ? (
                <ToolChainItem m={m} i={i} messages={messages} running={running} />
              ) : (
                <span className="msg-plain">{m.content}</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="input-area">
        {slashSuggestions.length > 0 && (
          <div className="slash-popup">
            {slashSuggestions.map((c, i) => (
              <div
                key={c.name}
                className={`slash-item ${i === slashActive ? 'active' : ''}`}
                onMouseEnter={() => setSlashActive(i)}
                onClick={() => applySlash(c.name)}
              >
                <span className="slash-name">/{c.name}</span>
                <span className="slash-source">{c.source}</span>
                <span className="slash-desc">{c.description}</span>
              </div>
            ))}
          </div>
        )}
        <div className={`composer ${running ? 'is-running' : ''}`}>
          {imageAttachments.length > 0 && (
            <div className="composer-attachments composer-attachments--images">
              {imageAttachments.map((img) => (
                <span key={img.id} className="composer-att composer-att--image">
                  <img className="composer-att__thumb" src={img.dataUrl} alt={img.name} />
                  <span className="composer-att__label">{img.name}</span>
                  <button
                    type="button"
                    className="composer-att__x"
                    title="Remove image"
                    onClick={() => setImageAttachments((prev) => prev.filter((x) => x.id !== img.id))}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          {composerAttachments.length > 0 && (
            <div className="composer-attachments">
              {composerAttachments.map((a) => (
                <span
                  key={a.id}
                  className={`composer-att composer-att--${a.kind}`}
                  title={`${a.kind}: ${a.path}${a.line1 ? `:${a.line1}-${a.line2}` : ''} (click to open)`}
                  onClick={async () => {
                    if (a.kind === 'symbol') return;
                    await openFile(a.path);
                    if (a.line1) revealLine(a.path, a.line1);
                  }}
                >
                  <span className="composer-att__icon">
                    {a.kind === 'file' ? '📄' : a.kind === 'folder' ? '📁' : a.kind === 'selection' ? '✂' : '🔣'}
                  </span>
                  <span className="composer-att__label">{a.label}</span>
                  <button
                    type="button"
                    className="composer-att__x"
                    title="Remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeAttachment(a.id);
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <MentionInput
            ref={textareaRef}
            value={input}
            onChange={setInput}
            onPaste={handleImagePaste}
            onDrop={handleImageDrop}
            onKeyDown={(e) => {
              if (slashSuggestions.length > 0) {
                if (e.key === 'ArrowDown') {
                  setSlashActive((a) => Math.min(slashSuggestions.length - 1, a + 1));
                  e.preventDefault();
                  return;
                }
                if (e.key === 'ArrowUp') {
                  setSlashActive((a) => Math.max(0, a - 1));
                  e.preventDefault();
                  return;
                }
                if (e.key === 'Tab' || (e.key === 'Enter' && !(e.metaKey || e.ctrlKey))) {
                  applySlash(slashSuggestions[slashActive].name);
                  e.preventDefault();
                  return;
                }
              }
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send();
            }}
            placeholder="输入问题，# 添加上下文，/ 唤起指令"
            rows={2}
          />
          <div className="composer-toolbar">
            <div className="composer-toolbar__left">
              <button
                ref={addCtxBtnRef}
                type="button"
                className="composer-chip"
                title="Add context (file / symbol / docs / selection)"
                onClick={() => setAddCtxOpen((b) => !b)}
              >
                +
              </button>
              {addCtxOpen && (
                <AddContextPopover
                  anchorRef={addCtxBtnRef}
                  onClose={() => setAddCtxOpen(false)}
                />
              )}
              <button
                type="button"
                className={`composer-chip composer-chip--mode ${mode === 'agent' ? 'is-agent' : mode === 'plan' ? 'is-plan' : 'is-ask'}`}
                title="Cycle mode: Ask → Agent → Plan"
                onClick={() => {
                  const next = mode === 'ask' ? 'agent' : mode === 'agent' ? 'plan' : 'ask';
                  setMode(next as any);
                }}
              >
                {mode === 'agent' ? '∞ 智能体' : mode === 'plan' ? '◇ Plan' : '✦ Ask'}
                <span className="composer-chip__caret">▾</span>
              </button>
              <button
                type="button"
                className="composer-chip composer-chip--model"
                title={selectedProfileId ? `Using: ${providerProfiles.find(p => p.id === selectedProfileId)?.name ?? selectedProfileId}` : 'Auto routing (click to pick model)'}
                onClick={() => setModelDropdownOpen((b) => !b)}
              >
                {selectedProfileId ? (providerProfiles.find(p => p.id === selectedProfileId)?.model ?? providerProfiles.find(p => p.id === selectedProfileId)?.name ?? selectedProfileId) : 'Auto'}
                <span className="composer-chip__caret">▾</span>
              </button>
              {modelDropdownOpen && (
                <div className="model-dropdown" onClick={() => setModelDropdownOpen(false)}>
                  <div
                    className={`model-dropdown-item${!selectedProfileId ? ' active' : ''}`}
                    onClick={() => setSelectedProfileId(null)}
                  >
                    ⚡ Auto (router)
                  </div>
                  {providerProfiles.map((p) => (
                    <div
                      key={p.id}
                      className={`model-dropdown-item${selectedProfileId === p.id ? ' active' : ''}`}
                      onClick={() => setSelectedProfileId(p.id)}
                    >
                      {p.model ?? p.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="composer-toolbar__right">
              <button
                type="button"
                onClick={toggleVoice}
                disabled={!speech.supported}
                className={`composer-chip${speech.isListening ? ' composer-chip--voice-active' : ''}`}
                title={
                  !speech.supported
                    ? '当前浏览器不支持语音识别'
                    : speech.isListening
                      ? '停止语音输入'
                      : '语音输入（中文）'
                }
                style={{ marginRight: 6 }}
              >
                {speech.isListening ? '⏺' : '🎤'}
              </button>
              <button
                type="button"
                onClick={send}
                disabled={running || (!input.trim() && composerAttachments.length === 0)}
                className="composer-send"
                title={running ? 'Running…' : 'Send (⌘/Ctrl + Enter)'}
              >
                {running ? (
                  <span className="composer-send__spinner" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M2 8L14 2L8 14L7 9L2 8Z" fill="currentColor" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 工具中文名翻译
 */
function translateToolName(name: string): string {
  const map: Record<string, string> = {
    read_file: '读取文件',
    write_to_file: '写入文件',
    replace_in_file: '编辑文件',
    search_file: '搜索文件',
    list_files: '列出目录',
    grep_search: '代码搜索',
    execute_command: '执行命令',
    view_code_item: '查看符号',
    view_file_outline: '文件结构',
    search_web: '网页搜索',
    fetch_web: '获取网页',
    think: '思考',
    task: '子任务',
    pending_edit: '建议修改',
    extended_thinking: '深度思考',
    update_plan: '更新计划',
    read_lints: 'Lint 检查',
    write_todo: '任务列表',
    use_subagent: '启动子代理',
    use_skill: '加载技能',
    search_memory: '记忆搜索',
    update_memory: '更新记忆',
    project_preview: '启动预览',
    browser_agent: '浏览器操作',
  };
  return map[name] ?? name;
}

/**
 * 格式化思考时间，如 "思考 · 3s"
 */
function formatThinkingTime(ms: number): string {
  if (ms < 1000) return `思考 · <1s`;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `思考 · ${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return `思考 · ${min}m${rem}s`;
}

/**
 * 工具链卡片 — 自动检测相邻的 tool call/result 对并折叠展示
 */
function ToolChainCard({
  calls,
  results,
  startIdx,
}: {
  calls: ChatMsg[];
  results: ChatMsg[];
  startIdx: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const { running } = useStore();

  // 配对：按 _toolName 做 call-result 配对
  const items: Array<{
    name: string;
    label: string;
    args: string;
    result: string;
    status: 'running' | 'done';
    isThink?: boolean;
  }> = [];

  for (const c of calls) {
    const name = (c as any)._toolName ?? 'unknown';
    items.push({
      name,
      label: translateToolName(name),
      args: (c as any)._toolArgs ?? '',
      result: '',
      status: 'running',
    });
  }
  for (const r of results) {
    const name = (r as any)._toolName ?? 'unknown';
    // 找到匹配的 call
    const callIdx = items.findIndex((it) => it.name === name && it.status === 'running');
    if (callIdx >= 0) {
      items[callIdx].result = r.content;
      items[callIdx].status = 'done';
    } else {
      items.push({
        name,
        label: translateToolName(name),
        args: '',
        result: r.content,
        status: 'done',
      });
    }
  }

  // 统计
  const doneCount = items.filter((it) => it.status === 'done').length;
  const runningCount = items.filter((it) => it.status === 'running').length;
  const allDone = runningCount === 0 && !running;

  const firstThreeLabels = items.slice(0, 3).map((it) => it.label);

  return (
    <div className={`toolchain-card${allDone ? ' toolchain-card--done' : ''}`} onClick={() => setExpanded((v) => !v)}>
      <div className="toolchain-header">
        <span className="toolchain-toggle">{expanded ? '▼' : '▶'}</span>
        <span className="toolchain-summary">
          <span className="toolchain-count">{doneCount}/{items.length}</span>
          <span className="toolchain-labels">{firstThreeLabels.join(' · ')}</span>
          {items.length > 3 && <span className="toolchain-more"> 等 {items.length} 个工具</span>}
        </span>
        {runningCount > 0 && <span className="toolchain-spinner" />}
      </div>
      {expanded && (
        <div className="toolchain-body">
          {items.map((it, j) => (
            <div key={j} className={`toolchain-item toolchain-item--${it.status}`}>
              <span className={`toolchain-dot toolchain-dot--${it.status}`} />
              <span className="toolchain-name">{it.label}</span>
              {it.args && (
                <span className="toolchain-args">{it.args.slice(0, 100)}</span>
              )}
              {it.status === 'done' && it.result && (
                <span className="toolchain-result">{it.result.slice(0, 200)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 单条 tool 消息渲染：自动检测相邻的 tool_calls 归为一组
 */
function ToolChainItem({ m, i, messages, running }: { m: ChatMsg; i: number; messages: ChatMsg[]; running: boolean }) {
  const role = (m as any)._toolRole as string | undefined;

  // 如果不属于 call/result 分组，按老逻辑渲染
  if (!role) {
    return (
      <span className="msg-plain">{m.content}</span>
    );
  }

  // 检测是否位于 tool call 链段起始
  // 如果前一条也是同组 tool 消息，则跳过（由段首统一渲染）
  const prev = i > 0 ? messages[i - 1] : null;
  if (prev && (prev as any)._toolRole != null && prev.role === 'tool') return null;

  // 收集连续的 tool 消息段
  const groupMessages: ChatMsg[] = [];
  let j = i;
  while (j < messages.length && (messages[j] as any)._toolRole != null && messages[j].role === 'tool') {
    groupMessages.push(messages[j]);
    j++;
  }

  // 分离 calls 和 results
  const calls = groupMessages.filter((gm) => (gm as any)._toolRole === 'call');
  const results = groupMessages.filter((gm) => (gm as any)._toolRole === 'result');

  // 如果只有结果（think / extended_thinking 等），走原有折叠逻辑
  if (calls.length === 0 && results.length === 1) {
    const r = results[0];
    const rAny = r as any;
    if (rAny.thinkFull != null) {
      return <ThinkBubble preview={r.content} full={rAny.thinkFull} />;
    }
    if (rAny.pendingEditId != null) {
      return (
        <div className="pending-edit-card">
          <span className="msg-plain">{r.content}</span>
        </div>
      );
    }
    return <span className="msg-plain">{r.content}</span>;
  }

  // 多条工具 → 折叠面板
  return <ToolChainCard calls={calls} results={results} startIdx={i} />;
}

/**
 * 思考折叠卡片 — 渲染 `think` tool / extended_thinking 的结果。
 * 默认折叠（80 字预览），点击展开整段。
 */
function ThinkBubble({ preview, full }: { preview: string; full: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="think-bubble" onClick={() => setExpanded((v) => !v)}>
      <span className="think-toggle">{expanded ? '▼' : '▶'}</span>
      {expanded ? (
        <pre className="think-full">{full}</pre>
      ) : (
        <span className="think-preview">{preview}</span>
      )}
    </div>
  );
}