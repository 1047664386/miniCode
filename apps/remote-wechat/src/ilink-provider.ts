/**
 * ILinkProvider — 基于微信 iLink Bot 协议的真实微信通道
 *
 * 流程：
 *  1. 扫码登录（终端显示二维码）→ 获取 bot_token
 *  2. 长轮询 getUpdates 拉取消息
 *  3. 调用 sendMessage 发送回复
 *
 * 凭证持久化到 ~/.mci/remote-wechat/credentials.json，重启免扫码
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { InboundHandler, OutboundMessage, Provider } from './provider.js';

// ─── iLink 协议常量 ────────────────────────────────────────
const ILINK_BASE = 'https://ilinkai.weixin.qq.com';
const CREDENTIALS_DIR = path.join(os.homedir(), '.mci', 'remote-wechat');
const CREDENTIALS_FILE = path.join(CREDENTIALS_DIR, 'credentials.json');
const MAX_DEDUP_SIZE = 200;

// ─── 类型定义 ──────────────────────────────────────────────
interface LoginCredentials {
  botToken: string;
  accountId: string;
  baseUrl: string;
  userId?: string;
}

interface ILinkMessage {
  from_user_id?: string;
  context_token?: string;
  message_type?: number;
  msg_id?: string;
  item_list?: Array<{
    type: number;
    text_item?: { text: string };
  }>;
}

interface PollResult {
  ret?: number;
  msgs?: ILinkMessage[];
  get_updates_buf?: string;
}

// ─── 工具函数 ──────────────────────────────────────────────
function randomWechatUin(): string {
  const uin = Math.floor(Math.random() * 0xffffffff) >>> 0;
  return Buffer.from(uin.toString()).toString('base64');
}

function buildHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    AuthorizationType: 'ilink_bot_token',
    'X-WECHAT-UIN': randomWechatUin(),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function generateClientId(): string {
  return `mci_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function saveCredentials(creds: LoginCredentials): void {
  fs.mkdirSync(CREDENTIALS_DIR, { recursive: true });
  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(creds, null, 2), { mode: 0o600 });
}

function clearCredentials(): void {
  try {
    if (fs.existsSync(CREDENTIALS_FILE)) {
      fs.unlinkSync(CREDENTIALS_FILE);
    }
  } catch { /* ignore */ }
}

function loadCredentials(): LoginCredentials | null {
  try {
    if (!fs.existsSync(CREDENTIALS_FILE)) return null;
    const raw = fs.readFileSync(CREDENTIALS_FILE, 'utf8');
    const creds = JSON.parse(raw) as LoginCredentials;
    if (!creds.botToken || !creds.accountId) return null;
    return creds;
  } catch {
    return null;
  }
}

// ─── 终端二维码渲染 ────────────────────────────────────────
async function renderQRInTerminal(url: string): Promise<void> {
  try {
    const mod = await import('qrcode-terminal');
    // CJS 模块动态 import 后 generate 在 .default 上
    const qrcode = mod.default ?? mod;
    qrcode.generate(url, { small: true }, (output: string) => {
      console.log('\n' + output);
    });
  } catch {
    console.log(`\n请用微信扫描此链接生成的二维码：\n${url}\n`);
  }
}

// ─── ILinkProvider ─────────────────────────────────────────
export class ILinkProvider implements Provider {
  private creds: LoginCredentials | null = null;
  private syncBuf = '';
  private running = false;
  private onInbound: InboundHandler | null = null;
  private pollLoopPromise: Promise<void> | null = null;

  // 消息去重：缓存最近 msgId
  private recentMsgIds = new Set<string>();
  private msgIdQueue: string[] = [];

  // context_token 缓存：wxUserId → context_token
  private contextTokenCache = new Map<string, string>();

  async start(onInbound: InboundHandler): Promise<void> {
    this.onInbound = onInbound;

    // 1. 尝试复用已保存的凭证
    this.creds = loadCredentials();
    if (this.creds) {
      console.log('[ilink] 已加载保存的凭证，跳过扫码');
    } else {
      // 2. 扫码登录
      this.creds = await this.loginWithQR();
    }

    console.log(`[ilink] 登录成功! accountId=${this.creds.accountId}`);

    // 3. 启动长轮询
    this.running = true;
    this.pollLoopPromise = this.pollLoop().catch((e) => {
      console.error('[ilink] pollLoop 异常退出:', e);
      this.running = false;
    });
  }

  async stop(): Promise<void> {
    this.running = false;
    await this.pollLoopPromise?.catch(() => undefined);
  }

  async send(msg: OutboundMessage): Promise<void> {
    if (!this.creds) throw new Error('未登录');

    const text = msg.text;
    const toUserId = msg.wxUserId;
    const contextToken = msg.contextToken || this.contextTokenCache.get(toUserId) || '';
    console.log(`[ilink] send: to=${toUserId.slice(0, 12)}, ctxToken=${contextToken ? '有' : '无'}, len=${text.length}`);

    // iLink 单条消息限制约 4000 字，自动切片
    const MAX_LEN = 4000;
    for (let i = 0; i < text.length; i += MAX_LEN) {
      await this.sendText(toUserId, text.slice(i, i + MAX_LEN), contextToken || undefined);
    }
  }

  // ─── 扫码登录 ───────────────────────────────────────────
  private async loginWithQR(): Promise<LoginCredentials> {
    const MAX_REFRESH = 3;
    let refreshCount = 0;

    while (refreshCount < MAX_REFRESH) {
      console.log('[ilink] 正在获取二维码...');
      const qrResp = await fetch(`${ILINK_BASE}/ilink/bot/get_bot_qrcode?bot_type=3`);
      if (!qrResp.ok) throw new Error(`获取二维码失败: ${qrResp.status}`);
      const qrData = (await qrResp.json()) as { qrcode?: string; qrcode_img_content?: string };
      const qrcodeKey = qrData.qrcode;
      const qrcodeUrl = qrData.qrcode_img_content;

      if (!qrcodeUrl) throw new Error('二维码返回为空');

      console.log('[ilink] 请用微信扫描以下二维码（iOS 或 Android 微信 ≥ 8.0.70）：');
      await renderQRInTerminal(qrcodeUrl);

      const LOGIN_TIMEOUT = 8 * 60 * 1000;
      const startTime = Date.now();

      while (Date.now() - startTime < LOGIN_TIMEOUT) {
        const statusResp = await fetch(
          `${ILINK_BASE}/ilink/bot/get_qrcode_status?qrcode=${qrcodeKey}`,
          { headers: { 'iLink-App-ClientVersion': '1' } },
        );
        if (!statusResp.ok) {
          await sleep(2000);
          continue;
        }
        const status = (await statusResp.json()) as {
          status?: string;
          bot_token?: string;
          ilink_bot_id?: string;
          ilink_user_id?: string;
          baseurl?: string;
        };

        switch (status.status) {
          case 'confirmed': {
            if (!status.bot_token || !status.ilink_bot_id) {
              throw new Error('登录确认但未返回 token 或 bot_id');
            }
            const creds: LoginCredentials = {
              botToken: status.bot_token,
              accountId: status.ilink_bot_id,
              baseUrl: status.baseurl || ILINK_BASE,
              userId: status.ilink_user_id,
            };
            saveCredentials(creds);
            return creds;
          }
          case 'scaned':
            console.log('[ilink] 已扫码，请在手机上确认...');
            break;
          case 'expired':
            console.log('[ilink] 二维码已过期，正在刷新...');
            refreshCount++;
            break;
          default:
            break;
        }

        if (status.status === 'expired') break;
        await sleep(2000);
      }

      if (Date.now() - startTime >= LOGIN_TIMEOUT) {
        throw new Error('登录超时（8 分钟），请重试');
      }
    }

    throw new Error(`二维码刷新 ${MAX_REFRESH} 次后仍过期，请重试`);
  }

  // ─── 长轮询循环 ─────────────────────────────────────────
  private async pollLoop(): Promise<void> {
    let consecutiveErrors = 0;

    while (this.running) {
      try {
        const result = await this.poll();

        // 检查 ret 字段，非零表示协议级错误
        if (result.ret && result.ret !== 0) {
          console.error(`[ilink] poll 返回错误 ret=${result.ret}`);
          // ret 非零可能是 token 过期
          if (result.ret === -1 || result.ret === 1001) {
            await this.handleTokenExpired();
            continue;
          }
        }

        if (result.get_updates_buf) {
          this.syncBuf = result.get_updates_buf;
        }

        for (const msg of result.msgs ?? []) {
          await this.handleMessage(msg);
        }

        consecutiveErrors = 0;
      } catch (e: any) {
        consecutiveErrors++;
        console.error(`[ilink] 轮询错误 (${consecutiveErrors}):`, e?.message ?? e);

        // 检测 401/403 → token 过期，触发重新登录
        if (e?.message?.includes('401') || e?.message?.includes('403')) {
          await this.handleTokenExpired();
          continue;
        }

        // 指数退避，最多 30 秒
        const delay = Math.min(3000 * Math.pow(1.5, consecutiveErrors - 1), 30_000);
        await sleep(delay);
      }
    }
  }

  private async handleTokenExpired(): Promise<void> {
    console.log('[ilink] Token 已过期，清除凭证并重新扫码登录...');
    clearCredentials();
    this.creds = null;
    this.contextTokenCache.clear();
    try {
      this.creds = await this.loginWithQR();
      console.log(`[ilink] 重新登录成功! accountId=${this.creds.accountId}`);
    } catch (e: any) {
      console.error('[ilink] 重新登录失败:', e?.message ?? e);
      this.running = false;
    }
  }

  private async poll(): Promise<PollResult> {
    const body = JSON.stringify({
      get_updates_buf: this.syncBuf,
      base_info: { channel_version: 'mci-remote/0.1.0' },
    });

    const resp = await fetch(`${this.creds!.baseUrl}/ilink/bot/getupdates`, {
      method: 'POST',
      headers: buildHeaders(this.creds!.botToken),
      body,
      signal: AbortSignal.timeout(40_000),
    });

    if (resp.ok) {
      return (await resp.json()) as PollResult;
    }

    // 401/403 明确抛出带状态码的错误，供上层检测 token 过期
    throw new Error(`getupdates ${resp.status}`);
  }

  // ─── 消息处理 ───────────────────────────────────────────
  private async handleMessage(msg: ILinkMessage): Promise<void> {
    // 只处理用户消息 (message_type === 1)
    if (msg.message_type !== 1) return;

    const text = msg.item_list?.find((i) => i.type === 1)?.text_item?.text;
    if (!text || !msg.from_user_id) return;

    // 消息去重
    const msgId = msg.msg_id || `${msg.from_user_id}:${text.slice(0, 50)}:${Date.now()}`;
    if (this.recentMsgIds.has(msgId)) return;
    this.recentMsgIds.add(msgId);
    this.msgIdQueue.push(msgId);
    if (this.msgIdQueue.length > MAX_DEDUP_SIZE) {
      const old = this.msgIdQueue.shift()!;
      this.recentMsgIds.delete(old);
    }

    // 缓存 context_token 供回复使用
    if (msg.context_token) {
      this.contextTokenCache.set(msg.from_user_id, msg.context_token);
    }

    console.log(`[ilink] 收到消息: ${text} (from: ${msg.from_user_id})`);

    await this.onInbound?.({
      wxUserId: msg.from_user_id,
      text,
      contextToken: msg.context_token,
      msgId,
    });
  }

  // ─── 发送消息 ───────────────────────────────────────────
  private async sendText(toUserId: string, text: string, contextToken?: string): Promise<void> {
    const ctx = contextToken || this.contextTokenCache.get(toUserId) || '';
    const baseUrl = this.creds!.baseUrl;

    const body = JSON.stringify({
      msg: {
        from_user_id: '',
        to_user_id: toUserId,
        client_id: generateClientId(),
        message_type: 2,
        message_state: 2,
        context_token: ctx,
        item_list: [
          {
            type: 1,
            text_item: { text },
          },
        ],
      },
      base_info: { channel_version: '1.0.3' },
    });

    console.log(`[ilink] sendText → ${baseUrl}/ilink/bot/sendmessage (${text.length} chars)`);
    const resp = await fetch(`${baseUrl}/ilink/bot/sendmessage`, {
      method: 'POST',
      headers: buildHeaders(this.creds!.botToken),
      body,
      signal: AbortSignal.timeout(15_000),
    });

    const respBody = await resp.text().catch(() => '');
    console.log(`[ilink] sendText resp: status=${resp.status} body=${respBody.slice(0, 300)}`);

    if (!resp.ok) {
      throw new Error(`sendMessage 失败: ${resp.status} ${respBody.slice(0, 200)}`);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
