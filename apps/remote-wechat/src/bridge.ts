
/**
 * Bridge — 把 InboundMessage 透传到 server-node 的 /api/chat
 *
 * 流程：
 *  1. 收到 wx 消息 → POST /api/remote/sessions 拿 sessionId（按 wxUserId 单例）
 *  2. POST /api/chat（mode='agent'，全量工具）→ 解析 SSE 聚合文本
 *     - 遇到 approve_request 事件自动审批（POST /api/approve/:id）
 *  3. provider.send() 回吐
 *
 * 斜杠命令（在桥层先拦下）：
 *   /reset          重开会话
 *   /mode work|code 切换模式（code = agent 全量工具）
 *   /help           帮助
 */
import type { Provider, InboundMessage } from './provider.js';

const MCI_BASE = process.env.MCI_BASE ?? '';

/**
 * 自动探测后端地址：依次尝试 5175 (server-node dev)、5174 (Electron 打包的 server-node)。
 * 如果设置了 MCI_BASE 环境变量则跳过探测，直接使用。
 */
async function detectBase(): Promise<string> {
  if (MCI_BASE) return MCI_BASE;
  const candidates = ['http://127.0.0.1:5175', 'http://127.0.0.1:5174'];
  for (const base of candidates) {
    try {
      const r = await fetch(`${base}/api/metrics`, { signal: AbortSignal.timeout(2000) });
      if (r.ok) {
        console.log(`[bridge] auto-detected MCI_BASE=${base}`);
        return base;
      }
    } catch { /* try next */ }
  }
  console.warn('[bridge] no backend detected, defaulting to http://127.0.0.1:5175 (start server-node first)');
  return 'http://127.0.0.1:5175';
}

let resolvedBase: string | null = null;
async function getBase(): Promise<string> {
  if (!resolvedBase) resolvedBase = await detectBase();
  return resolvedBase;
}

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

const sessionCache = new Map<string, string>();          // wxUserId → sessionId
const historyCache = new Map<string, ChatTurn[]>();      // wxUserId → recent turns

const HELP = `\u{1F916} mci-remote \u547D\u4EE4\uFF1A
/reset           \u91CD\u65B0\u5F00\u59CB\u5BF9\u8BDD
/mode work|code  \u5207\u6362\u6A21\u5F0F\uFF08\u9ED8\u8BA4 work\uFF09
/help            \u663E\u793A\u672C\u8BF4\u660E`;

/**
 * 过滤 AI 回复中误吐出的 tool_call XML 块（安全兜底）。
 */
function sanitizeReply(raw: string): string {
  const lt = String.fromCharCode(60);
  const gt = String.fromCharCode(62);
  const openTag = `${lt}tool_call${gt}`;
  const closeTag = `${lt}/tool_call${gt}`;

  let result = raw;
  while (true) {
    const start = result.indexOf(openTag);
    if (start === -1) break;
    const end = result.indexOf(closeTag, start);
    if (end === -1) { result = result.slice(0, start); break; }
    result = result.slice(0, start) + result.slice(end + closeTag.length);
  }
  result = result.replace(/```(?:xml|html)?\n[\s\S]*?tool_call[\s\S]*?```/g, '');

  const cleaned = result.trim();
  if (cleaned) return cleaned;
  return `\u62B1\u6B49\uFF0C\u6211\u65E0\u6CD5\u751F\u6210\u6709\u6548\u7684\u6587\u672C\u56DE\u590D\u3002\u8BF7\u5C1D\u8BD5\u6362\u4E00\u79CD\u95EE\u6CD5\u3002`;
}

async function ensureSession(wxUserId: string): Promise<string> {
  const cached = sessionCache.get(wxUserId);
  if (cached) {
    console.log(`[bridge] session cached: ${cached}`);
    return cached;
  }

  const base = await getBase();
  console.log(`[bridge] creating session for ${wxUserId.slice(0, 12)}...`);
  const r = await fetch(`${base}/api/remote/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ wxUserId, mode: 'code' }),
  });
  if (!r.ok) throw new Error(`/api/remote/sessions ${r.status}`);
  const j = (await r.json()) as { id?: string; sessionId?: string };
  const sid: string = j.id ?? j.sessionId ?? '';
  console.log(`[bridge] session created: ${sid}`);
  sessionCache.set(wxUserId, sid);
  historyCache.set(wxUserId, []);
  return sid;
}

/**
 * 自动审批：遇到 approve_request 事件时，立即 POST /api/approve/:id 放行。
 * 远程通道没有 IDE 前端审批弹窗，bridge 代替前端完成审批。
 */
async function autoApprove(approvalId: string, tool: string): Promise<void> {
  const base = await getBase();
  console.log(`[bridge] auto-approve: ${approvalId} (tool: ${tool})`);
  try {
    const r = await fetch(`${base}/api/approve/${approvalId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true }),
    });
    console.log(`[bridge] auto-approve result: ${r.status}`);
  } catch (e: any) {
    console.error(`[bridge] auto-approve failed:`, e?.message ?? e);
  }
}

async function streamChat(sessionId: string, history: ChatTurn[], userMessage: string): Promise<string> {
  const base = await getBase();
  console.log(`[bridge] POST /api/chat sessionId=${sessionId} mode=agent msg="${userMessage.slice(0, 40)}"`);

  const r = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      userMessage,
      mode: 'agent',
      messages: history,
    }),
  });
  console.log(`[bridge] /api/chat status=${r.status}`);
  if (!r.ok || !r.body) throw new Error(`/api/chat ${r.status}`);

  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let agg = '';
  let chunkCount = 0;
  let toolCount = 0;

  // 超时保护：3 分钟无新数据则中止（agent 模式可能更慢）
  const IDLE_TIMEOUT = 180_000;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const resetTimer = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      console.warn('[bridge] SSE idle timeout (180s), aborting');
      reader.cancel().catch(() => undefined);
    }, IDLE_TIMEOUT);
  };
  resetTimer();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    resetTimer();
    chunkCount++;
    buf += dec.decode(value, { stream: true });
    const events = buf.split('\n\n');
    buf = events.pop() ?? '';
    for (const ev of events) {
      let evType = 'message';
      const data: string[] = [];
      for (const ln of ev.split('\n')) {
        if (ln.startsWith('event:')) evType = ln.slice(6).trim();
        else if (ln.startsWith('data:')) data.push(ln.slice(5).trim());
      }
      const dataStr = data.join('\n');
      if (!dataStr) continue;
      try {
        const j = JSON.parse(dataStr);

        // 聚合文本回复
        if (j.type === 'text' || evType === 'text') {
          agg += j.text ?? j.delta ?? '';
        }

        // 工具调用日志
        if (j.type === 'tool_use') {
          toolCount++;
          console.log(`[bridge] tool_use #${toolCount}: ${j.name ?? j.tool ?? 'unknown'}`);
        }

        // 工具结果日志
        if (j.type === 'tool_result') {
          const preview = String(j.output ?? j.result ?? '').slice(0, 80);
          console.log(`[bridge] tool_result: ${preview}...`);
        }

        // 自动审批：bridge 代替 IDE 前端批准工具调用
        if (j.type === 'approve_request') {
          await autoApprove(j.id, j.tool ?? 'unknown');
        }

      } catch { /* skip */ }
    }
  }
  if (timer) clearTimeout(timer);
  console.log(`[bridge] SSE done: ${chunkCount} chunks, ${toolCount} tools, reply="${agg.slice(0, 80)}..."`);
  return agg.trim() || `\uFF08\u65E0\u6587\u672C\u56DE\u590D\uFF0C\u5DF2\u6267\u884C ${toolCount} \u4E2A\u5DE5\u5177\u8C03\u7528\uFF09`;
}

export function makeBridge(provider: Provider) {
  return async function handle(msg: InboundMessage) {
    const text = msg.text.trim();
    const send = (out: string) => provider.send({ wxUserId: msg.wxUserId, roomId: msg.roomId, contextToken: msg.contextToken, text: out });

    // 1) 斜杠命令
    if (text === '/help') return send(HELP);
    if (text === '/reset') {
      sessionCache.delete(msg.wxUserId);
      historyCache.delete(msg.wxUserId);
      return send('\u2705 \u5DF2\u91CD\u7F6E\u5BF9\u8BDD');
    }
    if (text.startsWith('/mode')) {
      return send('\u5F53\u524D\u8FD0\u884C\u5728 agent \u6A21\u5F0F\uFF08\u5168\u91CF\u5DE5\u5177\uFF09\uFF0C\u53EF\u4EE5\u8BFB\u6587\u4EF6\u3001\u5199\u4EE3\u7801\u3001\u8DD1\u547D\u4EE4\u3002');
    }

    // 2) 透传给 IDE
    try {
      console.log(`[bridge] handling: "${text.slice(0, 60)}" from ${msg.wxUserId.slice(0, 12)}`);
      const sid = await ensureSession(msg.wxUserId);
      const hist = historyCache.get(msg.wxUserId) ?? [];
      const rawReply = await streamChat(sid, hist, text);
      const reply = sanitizeReply(rawReply);
      if (reply !== rawReply) {
        console.log(`[bridge] sanitized reply (tool_call stripped)`);
      }
      console.log(`[bridge] reply: "${reply.slice(0, 80)}..."`);
      hist.push({ role: 'user', content: text });
      hist.push({ role: 'assistant', content: reply });
      if (hist.length > 20) hist.splice(0, hist.length - 20);
      historyCache.set(msg.wxUserId, hist);

      // 微信单条 <= 2000 字，长文切片
      const SLICE = 1800;
      if (reply.length <= SLICE) {
        await send(reply);
      } else {
        for (let i = 0; i < reply.length; i += SLICE) {
          await send(reply.slice(i, i + SLICE));
        }
      }
      console.log(`[bridge] reply sent \u2713`);
    } catch (e: any) {
      console.error(`[bridge] error:`, e?.message ?? e);
      await send(`\u274C \u51FA\u9519\u4E86\uFF1A${e?.message ?? e}`).catch(() => undefined);
    }
  };
}
