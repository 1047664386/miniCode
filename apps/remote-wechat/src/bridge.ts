
/**
 * Bridge — 把 InboundMessage 透传到 server-node 的 /api/chat
 *
 * 流程：
 *  1. 收到 wx 消息 → POST /api/remote/sessions 拿 sessionId（按 wxUserId 单例）
 *  2. POST /api/chat（mode='ask'，工具受限）→ 解析 SSE 聚合文本
 *  3. provider.send() 回吐
 *
 * 斜杠命令（在桥层先拦下）：
 *   /reset          重开会话
 *   /mode work|code 切换模式（V1 仅 ask 可用，code 留 stub）
 *   /help           帮助
 */
import type { Provider, InboundMessage } from './provider.js';

const MCI_BASE = process.env.MCI_BASE ?? 'http://127.0.0.1:5174';

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

const sessionCache = new Map<string, string>();          // wxUserId → sessionId
const historyCache = new Map<string, ChatTurn[]>();      // wxUserId → recent turns

const HELP = `🤖 mci-remote 命令：
/reset           重新开始对话
/mode work|code  切换模式（默认 work）
/help            显示本说明`;

async function ensureSession(wxUserId: string): Promise<string> {
  const cached = sessionCache.get(wxUserId);
  if (cached) return cached;

  const r = await fetch(`${MCI_BASE}/api/remote/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ wxUserId, mode: 'work' }),
  });
  if (!r.ok) throw new Error(`/api/remote/sessions ${r.status}`);
  const j = (await r.json()) as { id?: string; sessionId?: string };
  const sid: string = j.id ?? j.sessionId ?? '';
  sessionCache.set(wxUserId, sid);
  historyCache.set(wxUserId, []);
  return sid;
}

async function streamChat(sessionId: string, history: ChatTurn[], userMessage: string): Promise<string> {
  const r = await fetch(`${MCI_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      userMessage,
      mode: 'ask',
      messages: history,
    }),
  });
  if (!r.ok || !r.body) throw new Error(`/api/chat ${r.status}`);

  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let agg = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
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
        if (j.type === 'text' || evType === 'text') {
          agg += j.text ?? j.delta ?? '';
        }
      } catch { /* skip */ }
    }
  }
  return agg.trim() || '（无回复）';
}

export function makeBridge(provider: Provider) {
  return async function handle(msg: InboundMessage) {
    const text = msg.text.trim();
    const send = (out: string) => provider.send({ wxUserId: msg.wxUserId, roomId: msg.roomId, text: out });

    // 1) 斜杠命令
    if (text === '/help') return send(HELP);
    if (text === '/reset') {
      sessionCache.delete(msg.wxUserId);
      historyCache.delete(msg.wxUserId);
      return send('✅ 已重置对话');
    }
    if (text.startsWith('/mode')) {
      // 当前仅支持 work；code 模式涉及 workspace 和危险工具，留待审批流上线
      return send('当前仅支持 work 模式（安全考虑）');
    }

    // 2) 透传给 IDE
    try {
      const sid = await ensureSession(msg.wxUserId);
      const hist = historyCache.get(msg.wxUserId) ?? [];
      const reply = await streamChat(sid, hist, text);
      hist.push({ role: 'user', content: text });
      hist.push({ role: 'assistant', content: reply });
      // 只保留最近 10 轮，避免内存膨胀
      if (hist.length > 20) hist.splice(0, hist.length - 20);
      historyCache.set(msg.wxUserId, hist);

      // 微信单条 ≤ 2000 字，长文切片
      const SLICE = 1800;
      if (reply.length <= SLICE) {
        await send(reply);
      } else {
        for (let i = 0; i < reply.length; i += SLICE) {
          await send(reply.slice(i, i + SLICE));
        }
      }
    } catch (e: any) {
      await send(`❌ 出错了：${e?.message ?? e}`);
    }
  };
}