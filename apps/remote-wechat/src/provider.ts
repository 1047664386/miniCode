
/**
 * Provider 抽象 — 微信消息进出通道
 *
 * V0 用 StubProvider（本地 HTTP），V1 替换为 iLink / 企业微信回调即可。
 */

export interface InboundMessage {
  wxUserId: string;
  text: string;
  /** 群消息时填群 id；私聊为空 */
  roomId?: string;
  /** 微信消息原始 id，去重用 */
  msgId?: string;
}

export interface OutboundMessage {
  wxUserId: string;
  roomId?: string;
  text: string;
}

export type InboundHandler = (msg: InboundMessage) => Promise<void>;

export interface Provider {
  start(onInbound: InboundHandler): Promise<void>;
  stop(): Promise<void>;
  send(msg: OutboundMessage): Promise<void>;
}