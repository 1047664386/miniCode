
/**
 * mci-remote 入口
 *
 * 启动一个独立 Node 进程，把 WeChat 消息桥接到本地 server-node。
 * Provider 抽象使得未来切换到真·iLink/企业微信回调时，只改 provider.ts。
 */
import { StubProvider } from './stub-provider.js';
import { makeBridge } from './bridge.js';

async function main() {
  const provider = new StubProvider();
  const handle = makeBridge(provider);
  await provider.start(handle);

  console.log('[mci-remote] ready. MCI_BASE =', process.env.MCI_BASE ?? 'http://127.0.0.1:5174');

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