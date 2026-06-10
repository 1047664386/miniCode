
/**
 * mci-remote 入口
 *
 * 启动一个独立 Node 进程，把 WeChat 消息桥接到本地 server-node。
 * Provider 抽象使得未来切换到真·iLink/企业微信回调时，只改 provider.ts。
 *
 * 环境变量 WECHAT_PROVIDER 选择通道：
 *   - stub  (默认) 本地 HTTP 模拟
 *   - ilink        微信 iLink Bot 协议（扫码登录，真实微信消息）
 */
import { StubProvider } from './stub-provider.js';
import { ILinkProvider } from './ilink-provider.js';
import { makeBridge } from './bridge.js';
import type { Provider } from './provider.js';

function createProvider(): Provider {
  const name = process.env.WECHAT_PROVIDER ?? 'stub';
  switch (name) {
    case 'ilink':
      return new ILinkProvider();
    case 'stub':
      return new StubProvider();
    default:
      console.error(`[mci-remote] 未知 WECHAT_PROVIDER="${name}"，可选: stub | ilink`);
      process.exit(1);
  }
}

async function main() {
  const provider = createProvider();
  const handle = makeBridge(provider);
  await provider.start(handle);

  const providerName = process.env.WECHAT_PROVIDER ?? 'stub';
  console.log(`[mci-remote] ready. provider=${providerName}, MCI_BASE=${process.env.MCI_BASE ?? 'http://127.0.0.1:5174'}`);

  const shutdown = async () => {
    console.log('\n[mci-remote] shutting down…');
    await provider.stop().catch(() => undefined);
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  console.error('[mci-remote] fatal:', e);
  process.exit(1);
});