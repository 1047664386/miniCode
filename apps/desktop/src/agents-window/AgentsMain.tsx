
import { useState, useEffect, useRef } from 'react';
import { useAgentsStore } from './store';
import { ModeToggle } from './ModeToggle';
import { WorkspacePicker } from './WorkspacePicker';
import { useWebSpeech } from '../hooks/useWebSpeech';

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
  attachments?: Attachment[];
  /** Code 模式下 AI 调用工具的过程，按时序追加 */
  toolEvents?: ToolEvent[];
}

interface ToolEvent {
  /** 单次 tool 调用的本地 id（拼名字+ts） */
  id: string;
  name: string;
  args?: any;
  ok?: boolean;
  summary?: string;
  /** 'pending' | 'done' | 'error' */
  status: 'pending' | 'done' | 'error';
}

interface Attachment {
  name: string;
  size: number;
  type: string;
  dataUrl?: string;  // 图片预览
  text?: string;     // 文本文件内容
  wsPath?: string;   // 有值=来自工作区的文件引用
  line1?: number;    // 选区起始行（1-indexed）
  line2?: number;    // 选区结束行
}

interface SkillItem {
  name: string;
  description?: string;
}

const MAX_TEXT_BYTES = 256 * 1024;       // 单文件 ≤ 256KB 直接读文本
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 图片 ≤ 5MB

export function AgentsMain() {
  const activeId = useAgentsStore((s) => s.activeSessionId);
  const mode = useAgentsStore((s) => s.mode);
  const workspace = useAgentsStore((s) => s.workspaceRoot);
  const createSession = useAgentsStore((s) => s.createSession);
  const pendingAttachments = useAgentsStore((s) => s.pendingAttachments);
  const removePendingAttachment = useAgentsStore((s) => s.removePendingAttachment);
  const clearPendingAttachments = useAgentsStore((s) => s.clearPendingAttachments);
  const sandboxDirty = useAgentsStore((s) => s.sandboxDirty);

  // 沙箱里有未导出的改动 → beforeunload 提示（仅 web）
  useEffect(() => {
    const isWeb = typeof window !== 'undefined' && !(window as any).electronAPI;
    if (!isWeb || !sandboxDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      // 现代浏览器忽略自定义文案，仅靠 returnValue 触发原生确认框
      e.preventDefault();
      e.returnValue = '沙箱里有未导出的改动，关闭页面会丢失。是否继续？';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [sandboxDirty]);

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [dragHover, setDragHover] = useState(false);

  // ----- Skills slash popover -----
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [skillOpen, setSkillOpen] = useState(false);
  const [skillFilter, setSkillFilter] = useState('');
  const [skillIndex, setSkillIndex] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // ----- 语音 -----
  const speech = useWebSpeech({ lang: 'zh-CN' });
  const lastSpeechRef = useRef('');

  // 把语音 transcript 拼回输入框（增量同步，不覆盖用户手打的内容）
  useEffect(() => {
    if (!speech.isListening) return;
    const incoming = speech.transcript;
    const delta = incoming.slice(lastSpeechRef.current.length);
    if (delta) {
      setInput((s) => s + delta);
      lastSpeechRef.current = incoming;
    }
  }, [speech.transcript, speech.isListening]);

  useEffect(() => {
    if (!speech.isListening) lastSpeechRef.current = speech.transcript;
  }, [speech.isListening, speech.transcript]);

  useEffect(() => {
    void fetch('/api/skills')
      .then((r) => (r.ok ? r.json() : []))
      .then((j) => Array.isArray(j) && setSkills(j as SkillItem[]))
      .catch(() => undefined);
  }, []);

  // ----- 切换 session → 加载历史 -----
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    void fetch(`/api/sessions/${activeId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j) return;
        const ms: ChatMsg[] = (j.messages ?? []).map((m: any) => ({
          role: m.role,
          content: m.content,
          ts: m.ts,
        }));
        setMessages(ms);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  // ----- 文件处理 -----
  async function processFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    const out: Attachment[] = [];
    for (const f of arr) {
      const isImage = f.type.startsWith('image/');
      if (isImage) {
        if (f.size > MAX_IMAGE_BYTES) {
          alert(`图片 ${f.name} 超过 5MB`);
          continue;
        }
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result));
          r.onerror = reject;
          r.readAsDataURL(f);
        });
        out.push({ name: f.name, size: f.size, type: f.type, dataUrl });
      } else if (f.size <= MAX_TEXT_BYTES) {
        // 小文本文件直接读字符串
        const text = await f.text();
        out.push({ name: f.name, size: f.size, type: f.type || 'text/plain', text });
      } else {
        alert(`文件 ${f.name} 太大（>${Math.round(MAX_TEXT_BYTES / 1024)}KB），仅支持 ≤ 256KB 文本和 ≤ 5MB 图片`);
      }
    }
    if (out.length) setAttachments((a) => [...a, ...out]);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragHover(false);
    if (e.dataTransfer.files?.length) void processFiles(e.dataTransfer.files);
  }

  // ----- Skill popover 控制 -----
  function handleInputChange(value: string) {
    setInput(value);
    // 检测是否在输入 / 命令（行首或空格后跟 /）
    const ta = textareaRef.current;
    const cursor = ta?.selectionStart ?? value.length;
    const before = value.slice(0, cursor);
    const m = /(^|\s)\/([\w\-]*)$/.exec(before);
    if (m) {
      setSkillOpen(true);
      setSkillFilter(m[2].toLowerCase());
      setSkillIndex(0);
    } else {
      setSkillOpen(false);
    }
  }

  function applySkill(skill: SkillItem) {
    // 把当前 / 后的内容替换为 skill 名（保留前缀）
    const ta = textareaRef.current;
    const cursor = ta?.selectionStart ?? input.length;
    const before = input.slice(0, cursor);
    const after = input.slice(cursor);
    const replaced = before.replace(/\/[\w\-]*$/, `@skill:${skill.name} `);
    const next = replaced + after;
    setInput(next);
    setSkillOpen(false);
    requestAnimationFrame(() => {
      ta?.focus();
      const pos = replaced.length;
      ta?.setSelectionRange(pos, pos);
    });
  }

  const filteredSkills = skills.filter((s) =>
    !skillFilter ||
    s.name.toLowerCase().includes(skillFilter) ||
    s.description?.toLowerCase().includes(skillFilter),
  ).slice(0, 8);

  // ----- 发送 -----
  async function send() {
    const text = input.trim();
    // 合并：本地 drag/upload attachments + store 里的工作区文件附件
    const allAtts: Attachment[] = [
      ...attachments,
      ...pendingAttachments.map((a) => ({ ...a })),
    ];
    if ((!text && allAtts.length === 0) || streaming) return;

    if (speech.isListening) speech.stopListening();

    let sid = activeId;
    if (!sid) {
      const meta = await createSession();
      sid = meta.id;
    }

    // 把附件拼接到用户消息（V1：作为 markdown 引用块附在末尾）
    let composed = text;
    for (const a of allAtts) {
      if (a.text) {
        let head: string;
        if (a.wsPath && a.line1 && a.line2) {
          head = `✎ **${a.wsPath}** (L${a.line1}–L${a.line2})`;
        } else if (a.wsPath) {
          head = `📎 **${a.wsPath}**`;
        } else {
          head = `📎 **${a.name}**`;
        }
        composed += `\n\n---\n${head}\n\`\`\`\n${a.text.slice(0, 8000)}\n\`\`\``;
      } else if (a.dataUrl) {
        composed += `\n\n---\n🖼️ **${a.name}** (${(a.size / 1024).toFixed(1)} KB)`;
      }
    }

    setMessages((m) => [
      ...m,
      { role: 'user', content: composed, ts: Date.now(), attachments: allAtts },
      { role: 'assistant', content: '', ts: Date.now() },
    ]);
    setInput('');
    setAttachments([]);
    clearPendingAttachments();
    speech.resetTranscript();
    lastSpeechRef.current = '';
    setStreaming(true);

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sessionId: sid,
          userMessage: composed,
          mode: mode === 'work' ? 'ask' : 'agent',
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
        signal: ac.signal,
      });
      if (!r.ok || !r.body) {
        setMessages((m) => {
          const c = [...m];
          c[c.length - 1] = { ...c[c.length - 1], content: `[error] HTTP ${r.status}` };
          return c;
        });
        return;
      }
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const events = buf.split('\n\n');
        buf = events.pop() ?? '';
        for (const ev of events) {
          const lines = ev.split('\n').filter(Boolean);
          let evType = 'message';
          const dataLines: string[] = [];
          for (const ln of lines) {
            if (ln.startsWith('event:')) evType = ln.slice(6).trim();
            else if (ln.startsWith('data:')) dataLines.push(ln.slice(5).trim());
          }
          const dataStr = dataLines.join('\n');
          if (!dataStr) continue;
          try {
            const data = JSON.parse(dataStr);
            if (data.type === 'text' || evType === 'text') {
              const delta: string = data.text ?? data.delta ?? '';
              if (delta) {
                setMessages((m) => {
                  const c = [...m];
                  const last = c[c.length - 1];
                  c[c.length - 1] = { ...last, content: last.content + delta };
                  return c;
                });
              }
            } else if (evType === 'tool_call') {
              // AI 调用某个工具，追加 pending 卡片
              setMessages((m) => {
                const c = [...m];
                const last = c[c.length - 1];
                const events = last.toolEvents ?? [];
                const id = `${data.name}-${Date.now()}-${events.length}`;
                c[c.length - 1] = {
                  ...last,
                  toolEvents: [...events, { id, name: data.name, args: data.args, status: 'pending' }],
                };
                return c;
              });
            } else if (evType === 'tool_result') {
              // 把最后一个 pending 工具卡标记为 done/error
              setMessages((m) => {
                const c = [...m];
                const last = c[c.length - 1];
                const events = (last.toolEvents ?? []).slice();
                for (let k = events.length - 1; k >= 0; k--) {
                  if (events[k].status === 'pending') {
                    events[k] = {
                      ...events[k],
                      status: data.ok === false ? 'error' : 'done',
                      ok: data.ok !== false,
                      summary: data.summary,
                    };
                    // AI 写过文件 / 跑过命令 → 沙箱视为脏，触发 beforeunload 提示
                    if (data.ok !== false && /^(write_file|run_command|edit_file|create_file|delete_file)$/.test(events[k].name)) {
                      useAgentsStore.getState().setSandboxDirty(true);
                    }
                    break;
                  }
                }
                c[c.length - 1] = { ...last, toolEvents: events };
                return c;
              });
            }
          } catch {
            /* skip */
          }
        }
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') console.error('chat error', e);
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function stop() { abortRef.current?.abort(); }

  // ----- 语音按钮 toggle -----
  function toggleVoice() {
    if (!speech.supported) {
      alert('当前浏览器不支持 Web Speech API（建议 Chrome / Edge / Safari）');
      return;
    }
    if (speech.isListening) {
      speech.stopListening();
    } else {
      lastSpeechRef.current = '';
      speech.resetTranscript();
      speech.startListening();
    }
  }

  return (
    <main
      className={`agents-main${dragHover ? ' agents-main--drag' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragHover(true); }}
      onDragLeave={() => setDragHover(false)}
      onDrop={handleDrop}
    >
      <div className="agents-breadcrumb">
        {mode === 'code' && workspace ? <span>📁 {workspace.split('/').pop()} / </span> : null}
        <span>{messages.find((m) => m.role === 'user')?.content?.slice(0, 50) ?? '新对话'}</span>
      </div>

      <div className="agents-messages">
        {messages.length === 0 ? (
          <div className="agents-hero">
            <div className="agents-hero-title">
              {mode === 'work' ? 'Chat' : 'Coding'} With <span className="hero-badge">[ ✦ ]</span> Flicker
            </div>
            <div className="agents-hero-sub">
              {mode === 'work'
                ? '通用对话 · 不绑定仓库'
                : `编码模式 · 当前仓库 ${workspace?.split('/').pop() ?? '未设置'}`}
              <span className="agents-hero-tip"> · 拖拽文件上传 · 输入 / 唤起技能 · 🎤 语音输入</span>
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`agents-msg agents-msg-${m.role}`}>
              <div className="agents-msg-role">{m.role === 'user' ? '你' : 'Assistant'}</div>
              <div className="agents-msg-content">
                {m.attachments?.filter((a) => a.dataUrl).map((a, j) => (
                  <img key={j} src={a.dataUrl} alt={a.name} className="agents-msg-img" />
                ))}
                {m.toolEvents && m.toolEvents.length > 0 && (
                  <div className="agents-tool-events">
                    {m.toolEvents.map((te) => (
                      <ToolEventBubble key={te.id} ev={te} />
                    ))}
                  </div>
                )}
                <RichText text={m.content || (streaming && i === messages.length - 1 ? '…' : '')} />
              </div>
            </div>
          ))
        )}
      </div>

      <div className="agents-composer">
        <div className="agents-composer-top">
          <ModeToggle />
          {mode === 'code' && <WorkspacePicker />}
        </div>

        {/* 附件预览：本地拖拽/上传 + 工作区文件 */}
        {(attachments.length > 0 || pendingAttachments.length > 0) && (
          <div className="agents-attachments">
            {attachments.map((a, i) => (
              <div key={`local-${i}`} className="agents-attachment">
                {a.dataUrl ? (
                  <img src={a.dataUrl} alt={a.name} />
                ) : (
                  <span className="agents-attachment-icon">📄</span>
                )}
                <span className="agents-attachment-name" title={a.name}>{a.name}</span>
                <button
                  type="button"
                  className="agents-attachment-del"
                  onClick={() => setAttachments((arr) => arr.filter((_, j) => j !== i))}
                >×</button>
              </div>
            ))}
            {pendingAttachments.map((a, i) => {
              const labelText = a.wsPath
                ? a.line1 && a.line2
                  ? `${a.wsPath}:L${a.line1}-L${a.line2}`
                  : a.wsPath
                : a.name;
              const icon = a.line1 ? '✂' : '📌';
              return (
                <div
                  key={`ws-${i}`}
                  className={`agents-attachment agents-attachment--ws${a.line1 ? ' agents-attachment--sel' : ''}`}
                  title={labelText}
                >
                  <span className="agents-attachment-icon">{icon}</span>
                  <span className="agents-attachment-name">{labelText}</span>
                  <button
                    type="button"
                    className="agents-attachment-del"
                    onClick={() => removePendingAttachment(i)}
                  >×</button>
                </div>
              );
            })}
          </div>
        )}

        {/* 语音状态条 */}
        {speech.isListening && (
          <div className="agents-voice-bar">
            <span className="agents-voice-dot" />
            语音识别中…
            {speech.interim && <em className="agents-voice-interim"> {speech.interim}</em>}
          </div>
        )}

        <div className="agents-input-wrap">
          <textarea
            ref={textareaRef}
            className="agents-input"
            placeholder={
              speech.isListening ? '语音识别中…' : '输入问题，⏎ 发送 · ⇧⏎ 换行 · / 唤起技能 · 拖入文件'
            }
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (skillOpen) {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setSkillIndex((i) => Math.min(i + 1, filteredSkills.length - 1));
                  return;
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setSkillIndex((i) => Math.max(i - 1, 0));
                  return;
                }
                if (e.key === 'Tab' || e.key === 'Enter') {
                  if (filteredSkills[skillIndex]) {
                    e.preventDefault();
                    applySkill(filteredSkills[skillIndex]);
                    return;
                  }
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setSkillOpen(false);
                  return;
                }
              }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={3}
          />

          {/* Skill popover */}
          {skillOpen && filteredSkills.length > 0 && (
            <div className="agents-skill-popover">
              <div className="agents-skill-popover-title">技能（↑↓ 选择，Tab/⏎ 确认，Esc 取消）</div>
              {filteredSkills.map((s, i) => (
                <div
                  key={s.name}
                  className={`agents-skill-item${i === skillIndex ? ' active' : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); applySkill(s); }}
                  onMouseEnter={() => setSkillIndex(i)}
                >
                  <span className="agents-skill-name">/{s.name}</span>
                  {s.description && (
                    <span className="agents-skill-desc">{s.description.slice(0, 60)}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="agents-composer-actions">
          <div className="agents-composer-tools">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,text/*,.md,.txt,.json,.js,.ts,.tsx,.py,.css,.html"
              hidden
              onChange={(e) => {
                if (e.target.files) void processFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <button
              className="agents-tool-btn"
              title="上传文件 / 图片"
              onClick={() => fileInputRef.current?.click()}
            >📎</button>
            <button
              className={`agents-tool-btn${speech.isListening ? ' agents-tool-btn--active' : ''}`}
              title={speech.supported ? (speech.isListening ? '停止语音' : '开始语音输入') : '当前浏览器不支持语音'}
              onClick={toggleVoice}
              disabled={!speech.supported}
            >🎤</button>
            <button
              className="agents-tool-btn"
              title="唤起技能"
              onClick={() => {
                const ta = textareaRef.current;
                if (!ta) return;
                const pos = ta.selectionStart ?? input.length;
                const before = input.slice(0, pos);
                const after = input.slice(pos);
                const insert = before.length === 0 || /\s$/.test(before) ? '/' : ' /';
                const next = before + insert + after;
                setInput(next);
                requestAnimationFrame(() => {
                  ta.focus();
                  const cur = before.length + insert.length;
                  ta.setSelectionRange(cur, cur);
                  handleInputChange(next);
                });
              }}
            >/</button>
            <span className="agents-mode-hint">
              {mode === 'work' ? '💬 Work' : '⚡ Code'}
            </span>
          </div>
          {streaming ? (
            <button className="agents-send-btn agents-stop-btn" onClick={stop}>停止</button>
          ) : (
            <button
              className="agents-send-btn"
              onClick={() => void send()}
              disabled={!input.trim() && attachments.length === 0 && pendingAttachments.length === 0}
            >发送</button>
          )}
        </div>
      </div>
    </main>
  );
}

/**
 * RichText — 把对话文本里的文件路径自动转成可点击 chip
 * 识别规则（保守，避免误伤）：
 *   - 反引号包裹的路径： `apps/desktop/src/foo.ts`
 *   - 行内带 / 且有扩展名的相对路径
 */
function RichText({ text }: { text: string }) {
  const openFile = useAgentsStore((s) => s.openFile);
  const ws = useAgentsStore((s) => s.workspaceRoot);

  if (!text) return null;

  // 优先匹配反引号路径，再匹配裸路径
  const re = /`([^`\n]{1,200}?\.[a-zA-Z0-9]{1,8})`|(\b[\w./-]+\.[a-zA-Z0-9]{1,8})\b/g;
  const parts: Array<{ kind: 'text' | 'path'; value: string; raw?: string }> = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ kind: 'text', value: text.slice(last, m.index) });
    const raw = m[0];
    const inner = (m[1] ?? m[2]).trim();
    // 排除 url / 邮箱 / 看起来像版本号
    if (inner.includes('://') || inner.includes('@') || /^\d/.test(inner) || inner.length < 3) {
      parts.push({ kind: 'text', value: raw });
    } else {
      parts.push({ kind: 'path', value: inner, raw });
    }
    last = re.lastIndex;
  }
  if (last < text.length) parts.push({ kind: 'text', value: text.slice(last) });

  return (
    <>
      {parts.map((p, i) =>
        p.kind === 'text' ? (
          <span key={i}>{p.value}</span>
        ) : (
          <button
            key={i}
            className="agents-msg-pathchip"
            disabled={!ws}
            onClick={() => ws && openFile(p.value)}
            title={ws ? `打开 ${p.value}` : '请先选择工作区'}
          >
            📄 {p.value}
          </button>
        ),
      )}
    </>
  );
}

/**
 * ToolEventBubble — 把 AI 的工具调用过程展示成卡片
 *  - pending: ⏳ 加载圈
 *  - done   : ✓ 绿色对勾 + summary
 *  - error  : ✗ 红色
 *  - 折叠：默认展示一行；点开展开 args
 */
function ToolEventBubble({ ev }: { ev: ToolEvent }) {
  const [open, setOpen] = useState(false);
  const icon = ev.status === 'pending' ? '⏳' : ev.status === 'error' ? '✗' : '✓';
  const cls = `agents-tool-bubble agents-tool-${ev.status}`;
  const argsPreview = ev.args ? truncatePreview(formatArgs(ev.name, ev.args)) : '';

  // 是否是"修改了文件"的工具调用 → 提供 "查看 diff" 跳转
  const writeTools = /^(write_file|edit_file|create_file|delete_file)$/;
  const path: string | undefined = ev.args?.path;
  const showDiffJump = ev.status === 'done' && writeTools.test(ev.name) && !!path;

  const jumpToDiff = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!path) return;
    // 1) 派发自定义事件 → GitChangesPanel 监听并加载 diff
    window.dispatchEvent(new CustomEvent('mci.jumpToDiff', { detail: { path } }));
    // 2) 切右栏 tab 到 changes（通过 store 或 storage 事件实现都可以；这里用 storage）
    try {
      // 简单粗暴：让 AgentsRight 自己根据 storage 切 tab
      localStorage.setItem('mci.agents.rightTab', 'changes');
      window.dispatchEvent(new StorageEvent('storage', { key: 'mci.agents.rightTab' }));
    } catch { /* ignore */ }
  };

  return (
    <div className={cls}>
      <div className="agents-tool-bubble-row" onClick={() => setOpen((v) => !v)}>
        <span className="agents-tool-icon">{icon}</span>
        <span className="agents-tool-name">{ev.name}</span>
        {argsPreview && <span className="agents-tool-args">{argsPreview}</span>}
        {ev.summary && <span className="agents-tool-summary">→ {ev.summary}</span>}
        {showDiffJump && (
          <button
            type="button"
            className="agents-tool-jump"
            onClick={jumpToDiff}
            title={`查看 ${path} 的 diff`}
          >→ diff</button>
        )}
      </div>
      {open && ev.args && (
        <pre className="agents-tool-args-full">
          {JSON.stringify(ev.args, null, 2)}
        </pre>
      )}
    </div>
  );
}

function formatArgs(name: string, args: any): string {
  if (!args) return '';
  // 常用工具特别照顾
  if (name === 'read_file' || name === 'write_file') return String(args.path ?? '');
  if (name === 'list_files') return args.path ?? '/';
  if (name === 'run_command') return String(args.command ?? '');
  if (name === 'grep_search') return String(args.pattern ?? '');
  return JSON.stringify(args);
}

function truncatePreview(s: string): string {
  return s.length > 60 ? s.slice(0, 60) + '…' : s;
}