
/**
 * StubProvider — 本地 HTTP 模拟微信
 *
 * 入站：监听 127.0.0.1:5180/wechat/inbound
 *   POST { wxUserId, text, roomId?, msgId? }
 *
 * 出站：若 WECHAT_OUTBOUND_URL 已设，POST 出去；否则只打 stdout
 */
import http from 'node:http';
import type { InboundHandler, OutboundMessage, Provider } from './provider.js';

export class StubProvider implements Provider {
  private server?: http.Server;
  private outboundUrl = process.env.WECHAT_OUTBOUND_URL;
  private port = Number(process.env.WECHAT_INBOUND_PORT ?? 5180);

  async start(onInbound: InboundHandler): Promise<void> {
    this.server = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url?.startsWith('/wechat/inbound')) {
        const chunks: Buffer[] = [];
        req.on('data', (c) => chunks.push(Buffer.from(c)));
        req.on('end', async () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
            if (!body.wxUserId || !body.text) {
              res.writeHead(400).end('wxUserId & text required');
              return;
            }
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
            await onInbound({
              wxUserId: String(body.wxUserId),
              text: String(body.text),
              roomId: body.roomId,
              msgId: body.msgId,
            });
          } catch (e) {
            res.writeHead(500).end(String(e));
          }
        });
        return;
      }
      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, provider: 'stub' }));
        return;
      }
      res.writeHead(404).end();
    });

    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject);
      this.server!.listen(this.port, '127.0.0.1', () => resolve());
    });

    console.log(`[stub-provider] listening on http://127.0.0.1:${this.port}/wechat/inbound`);
    console.log('  → curl -X POST http://127.0.0.1:' + this.port + '/wechat/inbound \\');
    console.log('         -H "content-type: application/json" \\');
    console.log('         -d \'{"wxUserId":"u_demo","text":"hello"}\'');
  }

  async stop(): Promise<void> {
    await new Promise<void>((r) => this.server?.close(() => r()));
  }

  async send(msg: OutboundMessage): Promise<void> {
    const line = `[→ ${msg.wxUserId}${msg.roomId ? `@${msg.roomId}` : ''}] ${msg.text}`;
    if (this.outboundUrl) {
      try {
        await fetch(this.outboundUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(msg),
        });
      } catch (e) {
        console.error('[stub-provider] outbound failed:', e);
        console.log(line);
      }
    } else {
      console.log(line);
    }
  }
}