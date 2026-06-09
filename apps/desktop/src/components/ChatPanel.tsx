
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, type ChatMsg } from '../store';
import { MarkdownMessage } from './MarkdownMessage';
import { PlanPanel } from './PlanPanel';
import { SubagentPanel } from './SubagentPanel';
import { SubagentLauncher } from './SubagentLauncher';
import { CostMiniPanel } from './CostMiniPanel';
import { McpSettingsPanel } from './McpSettingsPanel';
import { ModelSettingsPanel } from './ModelSettingsPanel';
import { ContextStatusBar } from './ContextStatusBar';
import { SessionsDrawer } from './SessionsDrawer';
import { MentionTag, parseMentions } from './MentionTag';
import { MentionInput } from './MentionInput';
import { AddContextPopover } from './AddContextPopover';
import { vsBridge } from '../vscode-bridge';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

// ── SVG 图标组件（统一线条风格，currentColor 自适应主题色）──
const I = ({ d, size = 16, ...rest }: { d: string; size?: number } & React.SVGAttributes<SVGSVGElement>) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...rest}>
    {d.split('|').map((p, i) => <path key={i} d={p} />)}
  </svg>
);
const IconKey     = (p: any) => <I {...p} d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />;
const IconUser    = (p: any) => <I {...p} d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2|M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />;
const IconPlus    = (p: any) => <I {...p} d="M12 5v14|M5 12h14" />;
const IconList    = (p: any) => <I {...p} d="M8 6h13|M8 12h13|M8 18h13|M3 6h.01|M3 12h.01|M3 18h.01" />;
const IconPlug    = (p: any) => <I {...p} d="M12 22v-5|M9 8V2|M15 8V2|M18 8v5a6 6 0 0 1-12 0V8z" />;
const IconRefresh = (p: any) => <I {...p} d="M23 4v6h-6|M1 20v-6h6|M3.51 9a9 9 0 0 1 14.85-3.36L23 10|M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />;
const IconImage   = (p: any) => <I {...p} d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z|M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z|M21 15l-5-5L5 21" />;
const IconLogout  = (p: any) => <I {...p} d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4|M16 17l5-5-5-5|M21 12H9" />;

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
    authUser, setAuthModalOpen, logout,
  } = useStore();
  const [input, setInput] = useState('');
  const [slashList, setSlashList] = useState<SlashSpec[]>([]);
  const [slashActive, setSlashActive] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mcpOpen, setMcpOpen] = useState(false);
  const [modelSettingsOpen, setModelSettingsOpen] = useState(false);
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** push-announce 队列：子 Agent 完成的 announce message，跑完本 turn 自动续发 */
  const pendingAnnouncesRef = useRef<string[]>([]);
  /** 追踪上一帧 running 状态，用于检测 true→false 跳变 */
  const prevRunningRef = useRef<boolean>(false);

  // Push-Announce 续接：running 从 true 变为 false 时，若有积压的 subagent announce，
  // 合并成一条 user 消息自动续发（避免 finally 中 setTimeout 的竞态问题）
  useEffect(() => {
    if (prevRunningRef.current && !running && pendingAnnouncesRef.current.length > 0) {
      const merged = pendingAnnouncesRef.current.join('\n\n');
      pendingAnnouncesRef.current = [];
      setInput(merged);
      // 延迟一帧让 setInput 落地后再发
      setTimeout(() => {
        void send();
      }, 0);
    }
    prevRunningRef.current = running;
  }, [running]);
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

  // 图片文件选择器上传
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const f of Array.from(files)) {
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
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 语音输入（Electron→Vosk / Web→WebSpeech 自动选择）
  const speech = useSpeechRecognition({ lang: 'zh-CN' });
  const inputBeforeVoiceRef = useRef('');
  useEffect(() => {
    // 只在有实际语音结果时更新 input（避免 resetTranscript 的空字符串覆盖 input）
    if (speech.transcript) {
      setInput(inputBeforeVoiceRef.current + speech.transcript);
    }
  }, [speech.transcript]);
  const toggleVoice = () => {
    if (!speech.supported) {
      alert('语音识别不可用（桌面端需 Electron，Web 端需 Chrome / Edge）');
      return;
    }
    if (speech.modelLoading) return;
    if (speech.isListening) {
      speech.stopListening();
    } else {
      inputBeforeVoiceRef.current = input;
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
  // 加载 provider profiles（一次性 + settings 关闭后刷新）
  const loadProfiles = () => {
    fetch('/api/providers').then((r) => r.json()).then((data: any) => {
      const profiles = (data?.profiles ?? []).filter((p: any) => !p.hash);
      setProviderProfiles(profiles.map((p: any) => ({ id: p.id, name: p.name, model: p.model })));
      // 同步下拉框选中状态 = 服务端 active chat
      setSelectedProfileId(data?.active?.chat ?? null);
    }).catch(() => {});
  };
  useEffect(() => { loadProfiles(); }, []);
  // 模型设置 / 全局设置关闭后刷新列表
  useEffect(() => {
    if (!modelSettingsOpen) loadProfiles();
  }, [modelSettingsOpen]);
  // 监听其他组件（SettingsPanel / ModelSettingsPanel）的 provider 变更
  useEffect(() => {
    const handler = () => loadProfiles();
    window.addEventListener('providers-changed', handler);
    return () => window.removeEventListener('providers-changed', handler);
  }, []);

  /** 从下拉框选择模型：同步到服务端 active chat，刷新所有面板 */
  const handleModelSelect = (profileId: string | null) => {
    setModelDropdownOpen(false);
    // 点击当前已选中的 → 取消选中（回到 Auto）
    const targetId = (profileId === selectedProfileId) ? null : profileId;
    fetch('/api/providers/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'chat', id: targetId }),
    }).then(() => {
      loadProfiles();
      window.dispatchEvent(new Event('providers-changed'));
    }).catch(() => {});
  };

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
    const atts = [...composerAttachments];
    const imgs = [...imageAttachments];
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
      const dataUrlMatch = img.dataUrl.match(/^data:([^;]+);base64,/);
      const base64Data = img.dataUrl.split(',')[1] ?? '';
      const mediaType = dataUrlMatch?.[1] || img.type || 'image/png';
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

    pushMessage({ role: 'user', content: finalText, _images: imgs.length > 0 ? imgs.map(img => ({ name: img.name, dataUrl: img.dataUrl })) : undefined, _displayText: text });
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
      // 构建 history：保留 tool_result 消息（让 LLM 知道上轮工具调用结果），
      // 跳过纯 UI 标记消息（slash / rules / pending_edit / subagent 等）和 tool_call（前端渲染用）
      const history = useStore.getState().messages
        .slice(0, -1) // 不含本轮 user
        .filter((m) => {
          if (m.role !== 'tool') return true;
          // 只保留有实质内容的 tool_result（排除 UI 标记类）
          const toolRole = (m as any)._toolRole;
          const toolName = (m as any)._toolName;
          if (toolRole !== 'result') return false;
          // 跳过纯 UI 反馈类消息（slash/rules/pending_edit/subagent）
          const skipNames = new Set(['pending_edit', 'extended_thinking']);
          if (skipNames.has(toolName)) return false;
          return true;
        })
        .map((m) => {
          if (m.role === 'tool') {
            // 将 tool_result 转为 assistant 角色的摘要，让 LLM 理解这是工具输出
            const toolName = (m as any)._toolName ?? 'tool';
            return { role: 'assistant' as const, content: `[${toolName} result]: ${m.content.slice(0, 800)}` };
          }
          return { role: m.role, content: m.content };
        });

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
      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        throw new Error(`HTTP ${resp.status}: ${errText || resp.statusText}`);
      }
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
      // subagent announce 续发已移至 useEffect（避免竞态）
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
        // 多模态图片：tool_result 里的 __image 字段（来自 read_image / screenshot）
        const imgData = (ev.toolResult as any)?.__image;
        pushMessage({
          role: 'tool',
          content: summary,
          _toolRole: 'result',
          _toolName: ev.toolCall?.name ?? 'unknown',
          ...(imgData?.type === 'image' ? { _imageData: { media_type: imgData.media_type, data: imgData.data } } : {}),
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
        const items: Array<{ kind: string; label: string; path?: string }> = [];
        if (ev.resolved?.length) {
          ev.resolved.forEach((r: any) => items.push({ kind: r.type, label: r.label, path: r.label }));
        }
        const unresolvedParts = ev.unresolved?.length
          ? `⚠ unresolved: ${ev.unresolved.map((u: any) => `${u.kind}:${u.arg} (${u.reason})`).join(', ')}`
          : '';
        const content = unresolvedParts || (items.length ? `📎 mentioned: ${items.map((i) => `${i.kind}:${i.label}`).join(', ')}` : '');
        if (content || items.length) {
          pushMessage({ role: 'tool', content, _mentionItems: items.length ? items : undefined } as any);
        }
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
          {authUser ? (
            <button
              className="icon-btn auth-user-btn"
              data-tip={authUser.isAnonymous ? '点击登录以同步会话' : `${authUser.username || authUser.name}（点击登出）`}
              title={authUser.isAnonymous ? '点击登录以同步会话' : `${authUser.username || authUser.name}（点击登出）`}
              onClick={() => authUser.isAnonymous ? setAuthModalOpen(true) : logout()}
            >
              {authUser.isAnonymous ? <IconUser size={16} /> : (
                <span>{(authUser.username || authUser.name || 'U')?.slice(0, 1).toUpperCase()}</span>
              )}
            </button>
          ) : (
            <button className="icon-btn" data-tip="登录 / 注册" title="登录 / 注册" onClick={() => setAuthModalOpen(true)}>
              <IconKey size={16} />
            </button>
          )}
          <button
            className="icon-btn"
            data-tip="新建会话"
            title="新建会话"
            onClick={async () => {
              resetChat();
              clearAttachments();
              try { await createSession(); } catch { /* server 未启动也不阻塞 */ }
            }}
          >
            <IconPlus size={16} />
          </button>
          <button className="icon-btn" data-tip="历史会话" title="历史会话" onClick={() => setDrawerOpen(true)}>
            <IconList size={16} />
          </button>
          <button className="icon-btn" data-tip="MCP 服务" title="MCP 服务" onClick={() => setMcpOpen(true)}>
            <IconPlug size={16} />
          </button>
          <button className="icon-btn" onClick={resetChat} data-tip="清空对话" title="清空对话">
            <IconRefresh size={16} />
          </button>
        </div>
      </div>
      <SessionsDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <ContextStatusBar />
      <PlanPanel />
      <SubagentLauncher />
      <SubagentPanel />
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
      {modelSettingsOpen && (
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
          onClick={() => setModelSettingsOpen(false)}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', overflow: 'auto' }}>
            <ModelSettingsPanel onClose={() => setModelSettingsOpen(false)} />
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
        <div className="messages-spacer" />
        {!messages.length && (
          <div style={{ color: '#666', textAlign: 'center', marginTop: 40 }}>
            Ask me anything about the codebase.
            <br />
            Try: "list the project structure"
          </div>
        )}
        {renderMessages(messages, running, scrollRef, openFile, revealLine)}
      </div>
      <CostMiniPanel />
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
                    title="移除图片"
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
                <MentionTag
                  key={a.id}
                  kind={a.kind}
                  label={a.label}
                  path={a.path}
                  line1={a.line1}
                  line2={a.line2}
                  removable
                  onRemove={() => removeAttachment(a.id)}
                  onOpen={(p, l) => {
                    if (a.kind === 'symbol') return;
                    openFile(p);
                    if (l) revealLine(p, l);
                  }}
                />
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
                type="button"
                className="composer-chip composer-chip--img"
                data-tip="上传图片"
                title="上传图片"
                onClick={() => fileInputRef.current?.click()}
              >
                <IconImage size={16} />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/jpeg,image/png,image/gif,image/webp"
                multiple
                onChange={handleImageUpload}
                style={{ display: 'none' }}
              />
              <button
                ref={addCtxBtnRef}
                type="button"
                className="composer-chip"
                data-tip="添加上下文（文件 / 符号 / 文档 / 选区）"
                title="添加上下文（文件 / 符号 / 文档 / 选区）"
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
                data-tip={`切换模式：当前 ${mode === 'agent' ? '智能体' : mode === 'plan' ? '规划' : '问答'}`}
                title={`切换模式：当前 ${mode === 'agent' ? '智能体' : mode === 'plan' ? '规划' : '问答'}`}
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
                data-tip={selectedProfileId ? `当前模型：${providerProfiles.find(p => p.id === selectedProfileId)?.name ?? selectedProfileId}` : '自动路由（点击选择模型）'}
                title={selectedProfileId ? `当前模型：${providerProfiles.find(p => p.id === selectedProfileId)?.name ?? selectedProfileId}` : '自动路由（点击选择模型）'}
                onClick={() => setModelDropdownOpen((b) => !b)}
              >
                {selectedProfileId ? (providerProfiles.find(p => p.id === selectedProfileId)?.model ?? providerProfiles.find(p => p.id === selectedProfileId)?.name ?? selectedProfileId) : 'Auto'}
                <span className="composer-chip__caret">▾</span>
              </button>
              {modelDropdownOpen && (
                <div className="model-dropdown" onClick={() => setModelDropdownOpen(false)}>
                  <div
                    className={`model-dropdown-item${!selectedProfileId ? ' active' : ''}`}
                    onClick={() => handleModelSelect(null)}
                  >
                    ⚡ Auto (router)
                  </div>
                  {providerProfiles.map((p) => (
                    <div
                      key={p.id}
                      className={`model-dropdown-item${selectedProfileId === p.id ? ' active' : ''}`}
                      onClick={() => handleModelSelect(p.id)}
                    >
                      {p.model ?? p.name}
                    </div>
                  ))}
                  <div className="model-dropdown-divider" />
                  <div
                    className="model-dropdown-item model-dropdown-item--settings"
                    onClick={() => {
                      setModelDropdownOpen(false);
                      setModelSettingsOpen(true);
                    }}
                  >
                    ⚙ 配置模型 Provider
                  </div>
                </div>
              )}
            </div>
            <div className="composer-toolbar__right">
              <button
                type="button"
                onClick={toggleVoice}
                disabled={!speech.supported || speech.modelLoading}
                className={`composer-chip composer-chip--voice${speech.isListening ? ' composer-chip--voice-active' : ''}`}
                data-tip={
                  !speech.supported
                    ? '语音识别不可用'
                    : speech.modelLoading
                      ? '语音模型加载中…'
                      : speech.isListening
                        ? '停止语音输入'
                        : '语音输入（中文·离线识别）'
                }
                title={
                  !speech.supported
                    ? '语音识别不可用'
                    : speech.modelLoading
                      ? '语音模型加载中…'
                      : speech.isListening
                        ? '停止语音输入'
                        : '语音输入（中文·离线识别）'
                }
              >
                {speech.modelLoading ? (
                  <span className="composer-send__spinner" />
                ) : speech.isListening ? (
                  <span className="voice-waves">
                    <span className="voice-wave" />
                    <span className="voice-wave" />
                    <span className="voice-wave" />
                    <span className="voice-wave" />
                  </span>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="9" y="3" width="6" height="11" rx="3" />
                    <path d="M5 10v1c0 3.866 3.134 7 7 7s7-3.134 7-7v-1" strokeLinecap="round" />
                    <path d="M12 18v4" strokeLinecap="round" />
                    <path d="M8 21h8" strokeLinecap="round" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={send}
                disabled={running || (!input.trim() && composerAttachments.length === 0)}
                className="composer-send"
                data-tip={running ? '正在生成…' : '发送（⌘/Ctrl + Enter）'}
                title={running ? '正在生成…' : '发送（⌘/Ctrl + Enter）'}
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
    imageData?: { media_type: string; data: string };
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
    const imgData = (r as any)._imageData;
    // 找到匹配的 call
    const callIdx = items.findIndex((it) => it.name === name && it.status === 'running');
    if (callIdx >= 0) {
      items[callIdx].result = r.content;
      items[callIdx].status = 'done';
      if (imgData) items[callIdx].imageData = imgData;
    } else {
      items.push({
        name,
        label: translateToolName(name),
        args: '',
        result: r.content,
        status: 'done',
        imageData: imgData,
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
              {it.imageData && (
                <img
                  className="toolchain-result-img"
                  src={`data:${it.imageData.media_type};base64,${it.imageData.data}`}
                  alt={it.label + ' image'}
                />
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
    // 含图片的 tool_result（read_image / screenshot）
    if (rAny._imageData) {
      return (
        <div className="tool-image-result">
          <span className="msg-plain">{r.content}</span>
          <img
            className="tool-image-result__img"
            src={`data:${rAny._imageData.media_type};base64,${rAny._imageData.data}`}
            alt={(rAny._toolName ?? 'tool') + ' image'}
          />
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

/** 工具图标映射 */
const TOOL_ICONS: Record<string, string> = {
  read_file: '📄', write_to_file: '✏️', replace_in_file: '✂️',
  search_file: '🔍', list_files: '📁', grep_search: '🔎',
  execute_command: '⚡', view_code_item: '🧩', view_file_outline: '🗂',
  search_web: '🌐', fetch_web: '📡', think: '💭',
  task: '📝', pending_edit: '📝', extended_thinking: '🧠',
  update_plan: '🗓', read_lints: '✅', write_todo: '☑️',
  use_subagent: '🤖', use_skill: '🎯', search_memory: '🧠',
  update_memory: '💾', project_preview: '👁', browser_agent: '🌐',
};

/** 思考过程面板 - 借鉴 Ai-bot 的 ThinkingProcess 组件 */
function ThinkingProcess({ steps, isRunning }: {
  steps: ChatMsg[];
  isRunning: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  // 分类步骤
  const thinkSteps = steps.filter(s => {
    const name = (s as any)._toolName;
    return name === 'think' || name === 'extended_thinking';
  });
  const toolCalls = steps.filter(s => (s as any)._toolRole === 'call');
  const toolResults = steps.filter(s => (s as any)._toolRole === 'result' && (s as any)._toolName !== 'think' && (s as any)._toolName !== 'extended_thinking');
  const otherSteps = steps.filter(s => {
    const name = (s as any)._toolName;
    const role = (s as any)._toolRole;
    return !thinkSteps.includes(s) && !toolCalls.includes(s) && !toolResults.includes(s);
  });

  const toolCallCount = toolCalls.length;
  const doneCount = toolResults.length;
  const successCount = toolResults.filter(r => !(r.content?.startsWith('✗') || r.content?.startsWith('❌'))).length;
  const isInProgress = isRunning && toolCallCount > doneCount;

  const summaryParts: string[] = [];
  if (thinkSteps.length > 0) summaryParts.push(`${thinkSteps.length} 步思考`);
  if (toolCallCount > 0) summaryParts.push(`${toolCallCount} 次工具调用`);
  const summary = summaryParts.length > 0 ? summaryParts.join(' · ') : '思考过程';

  return (
    <div className={`thinking-process ${expanded ? 'thinking-process--expanded' : 'thinking-process--collapsed'}`}>
      <div className="thinking-process__header" onClick={() => setExpanded(!expanded)}>
        <span className="thinking-process__icon">
          {isInProgress ? <span className="tp-spinner" /> : '🧠'}
        </span>
        <span className="thinking-process__title">{summary}</span>
        {isInProgress && <span className="thinking-process__badge">进行中</span>}
        {doneCount > 0 && (
          <span className="thinking-process__stats">
            {successCount}/{doneCount} 完成
          </span>
        )}
        <svg
          className={`thinking-process__chevron ${expanded ? 'thinking-process__chevron--up' : ''}`}
          width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <path d="M5 7l5 5 5-5" />
        </svg>
      </div>

      {expanded && (
        <div className="thinking-process__body">
          {/* 思考步骤 */}
          {thinkSteps.length > 0 && (
            <div className="thinking-process__section">
              <div className="thinking-process__section-header">
                <span className="thinking-process__section-icon">💭</span>
                推理过程
              </div>
              {thinkSteps.map((step, i) => (
                <div key={i} className="thinking-process__step">
                  <span className="thinking-process__step-dot" />
                  <span className="thinking-process__step-msg">
                    {(step as any).thinkFull
                      ? String((step as any).thinkFull).slice(0, 300)
                      : step.content}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* 工具调用 */}
          {(toolCalls.length > 0 || toolResults.length > 0) && (
            <div className="thinking-process__section">
              <div className="thinking-process__section-header">
                <span className="thinking-process__section-icon">🔧</span>
                工具调用
              </div>
              <ToolCallGroup calls={toolCalls} results={toolResults} />
            </div>
          )}

          {/* 其他步骤（mentions 等） */}
          {otherSteps.length > 0 && (
            <div className="thinking-process__section">
              {otherSteps.map((step, i) => (
                <div key={i} className="thinking-process__step">
                  <span className="thinking-process__step-dot" />
                  <span className="thinking-process__step-msg">
                    {step._mentionItems?.length ? (
                      <span className="msg-mention-tags">
                        {step._mentionItems.map((item, idx) => (
                          <MentionTag
                            key={idx}
                            kind={item.kind as any}
                            label={item.label}
                            path={item.path || item.label}
                          />
                        ))}
                      </span>
                    ) : step.content}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** 工具调用组 - 配对 call/result 并渲染为独立卡片 */
function ToolCallGroup({ calls, results }: { calls: ChatMsg[]; results: ChatMsg[] }) {
  const items: Array<{
    name: string; label: string; icon: string; args: string;
    result: string; status: 'running' | 'done' | 'error';
    imageData?: { media_type: string; data: string };
  }> = [];

  for (const c of calls) {
    const name = (c as any)._toolName ?? 'unknown';
    items.push({
      name, label: translateToolName(name),
      icon: TOOL_ICONS[name] ?? '🔧',
      args: (c as any)._toolArgs ?? '',
      result: '', status: 'running',
    });
  }
  for (const r of results) {
    const name = (r as any)._toolName ?? 'unknown';
    const imgData = (r as any)._imageData;
    const callIdx = items.findIndex(it => it.name === name && it.status === 'running');
    const isError = r.content?.startsWith('✗') || r.content?.startsWith('❌');
    if (callIdx >= 0) {
      items[callIdx].result = r.content;
      items[callIdx].status = isError ? 'error' : 'done';
      if (imgData) items[callIdx].imageData = imgData;
    } else {
      items.push({
        name, label: translateToolName(name),
        icon: TOOL_ICONS[name] ?? '🔧',
        args: '', result: r.content,
        status: isError ? 'error' : 'done',
        imageData: imgData,
      });
    }
  }

  return (
    <>
      {items.map((it, j) => (
        <ToolCallCard key={j} item={it} />
      ))}
    </>
  );
}

/** 单个工具调用卡片 - 带图标、状态、可展开详情 */
function ToolCallCard({ item }: {
  item: {
    name: string; label: string; icon: string; args: string;
    result: string; status: 'running' | 'done' | 'error';
    imageData?: { media_type: string; data: string };
  };
}) {
  const [expanded, setExpanded] = useState(false);
  const statusText = item.status === 'running' ? '调用中' : item.status === 'done' ? '✓ 完成' : '✗ 失败';

  return (
    <div className={`tool-call-card tool-call-card--${item.status}`}>
      <div className="tool-call-card__header" onClick={() => setExpanded(!expanded)}>
        <span className="tool-call-card__icon">{item.icon}</span>
        <span className="tool-call-card__label">{item.label}</span>
        <span className={`tool-call-card__status tool-call-card__status--${item.status}`}>
          {item.status === 'running' && <span className="tp-spinner" />}
          {statusText}
        </span>
        <svg
          className={`tool-call-card__chevron ${expanded ? 'tool-call-card__chevron--up' : ''}`}
          width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <path d="M5 7l5 5 5-5" />
        </svg>
      </div>
      {expanded && (
        <div className="tool-call-card__detail">
          {item.args && (
            <div className="tool-call-card__args">
              <span className="tool-call-card__args-label">参数</span>
              <code>{item.args.slice(0, 500)}</code>
            </div>
          )}
          {item.status !== 'running' && item.result && (
            <div className="tool-call-card__result">
              <span className="tool-call-card__args-label">返回结果</span>
              <code>{item.result.slice(0, 500)}</code>
            </div>
          )}
          {item.imageData && (
            <img
              className="tool-call-card__img"
              src={`data:${item.imageData.media_type};base64,${item.imageData.data}`}
              alt={item.label + ' image'}
            />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Tool 消息内容渲染器 — 检测 _mentionItems 并渲染 MentionTag，否则显示纯文本
 */
function ToolContent({ m }: { m: ChatMsg }) {
  if (m._mentionItems?.length) {
    return (
      <div className="msg-mention-tags">
        {m._mentionItems.map((item, idx) => (
          <MentionTag
            key={idx}
            kind={item.kind as any}
            label={item.label}
            path={item.path || item.label}
          />
        ))}
      </div>
    );
  }
  return <span className="msg-plain">{m.content}</span>;
}

/**
 * 消息渲染器 - 智能分组用户消息、助手消息、工具消息
 */
function renderMessages(
  messages: ChatMsg[],
  running: boolean,
  scrollRef: React.RefObject<HTMLDivElement | null>,
  openFile: (p: string) => void | Promise<void>,
  revealLine: (p: string, l: number) => void | Promise<void>,
) {
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < messages.length) {
    const m = messages[i];

    if (m.role === 'user') {
      // 用户消息：明显的聊天气泡，支持展示图片缩略图
      const userImages = m._images;
      // 解析 @file / @selection 提及标签
      const { mentions, cleanText } = parseMentions(m.content || '');
      const displayText = m._displayText || cleanText || '(empty)';
      elements.push(
        <div key={i} className="msg msg-user">
          <div className="user-bubble">
            {userImages && userImages.length > 0 && (
              <div className="user-bubble__images">
                {userImages.map((img, idx) => (
                  <img
                    key={idx}
                    src={img.dataUrl}
                    alt={img.name}
                    className="user-bubble__img"
                    title={img.name}
                  />
                ))}
              </div>
            )}
            {mentions.length > 0 && (
              <div className="user-bubble__mentions">
                {mentions.map((mt, idx) => (
                  <MentionTag
                    key={idx}
                    kind={mt.kind}
                    label={mt.label}
                    path={mt.path}
                    line1={mt.line1}
                    line2={mt.line2}
                    onOpen={(p, l) => {
                      openFile(p);
                      if (l) revealLine(p, l);
                    }}
                  />
                ))}
              </div>
            )}
            <div className="user-bubble__text">{displayText}</div>
          </div>
        </div>
      );
      i++;
    } else if (m.role === 'assistant') {
      // 助手消息
      const hasThinkingMs = (m as any)._thinkingMs != null && (m as any)._thinkingMs > 0;
      const isEmpty = !m.content;
      const isLast = i === messages.length - 1;
      elements.push(
        <div key={i} className="msg msg-assistant" style={{ flexShrink: 0 }}>
          <div className="msg-avatar">AI</div>
          <div className="msg-assistant-body">
            {hasThinkingMs && (
              <div className="thinking-indicator">
                <span className="thinking-indicator__dot" />
                <span>{formatThinkingTime((m as any)._thinkingMs)}</span>
              </div>
            )}
            {m.content ? (
              <MarkdownMessage text={m.content} />
            ) : running && isLast ? (
              <div className="dots-loading">
                <span className="dots-loading__dot" />
                <span className="dots-loading__dot" />
                <span className="dots-loading__dot" />
              </div>
            ) : null}
          </div>
        </div>
      );
      i++;
    } else if (m.role === 'tool') {
      // 工具消息：收集连续的 tool 消息并分组为 ThinkingProcess
      const groupStart = i;
      const group: ChatMsg[] = [];
      while (i < messages.length && messages[i].role === 'tool' && (messages[i] as any)._toolRole != null) {
        group.push(messages[i]);
        i++;
      }
      // 检查是否有后续的非 _toolRole tool 消息
      while (i < messages.length && messages[i].role === 'tool' && (messages[i] as any)._toolRole == null) {
        group.push(messages[i]);
        i++;
      }

      if (group.length === 0) {
        i++;
        continue;
      }

      // 单条非分组消息（如 slash, rules, pending_edit）
      if (group.length === 1 && !(group[0] as any)._toolRole) {
        const gm = group[0];
        const hasPending = (gm as any).pendingEditId != null;
        elements.push(
          <div key={groupStart} className={`msg msg-tool${hasPending ? ' has-pending' : ''}`}>
            <span className="msg-plain">{gm.content}</span>
          </div>
        );
        continue;
      }

      // 单个 think/extended_thinking 结果（没有 call）
      const hasCall = group.some(g => (g as any)._toolRole === 'call');
      const resultsOnly = group.filter(g => (g as any)._toolRole === 'result');
      if (!hasCall && resultsOnly.length === 1) {
        const r = resultsOnly[0];
        const rAny = r as any;
        if (rAny.thinkFull != null) {
          elements.push(
            <div key={groupStart} className="msg msg-tool">
              <ThinkBubble preview={r.content} full={rAny.thinkFull} />
            </div>
          );
          continue;
        }
        if (rAny.pendingEditId != null) {
          elements.push(
            <div key={groupStart} className="msg msg-tool has-pending">
              <ToolContent m={r} />
            </div>
          );
          continue;
        }
        if (rAny._imageData) {
          elements.push(
            <div key={groupStart} className="msg msg-tool">
              <div className="tool-image-result">
                <span className="msg-plain">{r.content}</span>
                <img
                  className="tool-image-result__img"
                  src={`data:${rAny._imageData.media_type};base64,${rAny._imageData.data}`}
                  alt={(rAny._toolName ?? 'tool') + ' image'}
                />
              </div>
            </div>
          );
          continue;
        }
        elements.push(
          <div key={groupStart} className="msg msg-tool">
            <ToolContent m={r} />
          </div>
        );
        continue;
      }

      // 多条工具 → ThinkingProcess 分组
      elements.push(
        <div key={groupStart} className="msg msg-tool">
          <ThinkingProcess steps={group} isRunning={running} />
        </div>
      );
    } else {
      // 其他角色（system / 未匹配的 tool）
      elements.push(
        <div key={i} className={`msg msg-${m.role}`}>
          <ToolContent m={m} />
        </div>
      );
      i++;
    }
  }

  return <>{elements}</>;
}