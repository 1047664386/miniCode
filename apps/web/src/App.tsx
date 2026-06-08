
/**
 * 网页版根组件 —— 路线 B 完成版
 *
 * 关键点：直接挂载 desktop 的 <AgentsApp />，UI 100% 复用。
 *
 * 适配层（zero-cost）：
 *  - vite alias `@desktop` → ../desktop/src
 *  - server-cloud 实现了 desktop UI 依赖的所有路由（/api/sessions, /api/chat,
 *    /api/skills, /api/workspace, /api/agents/*）
 *  - WorkspacePicker 在 web 走 prompt fallback（无 electronAPI）
 *
 * 启动序列：
 *  1. fetch /api/auth/me → 401 → POST /api/auth/anonymous → 拿到 cookie
 *  2. 拿到身份后再渲染 AgentsApp（避免 AgentsApp 内部首批 fetch 都 401）
 */
import { useEffect, useState } from 'react';
import { AgentsApp } from '@desktop/agents-window/AgentsApp';

export function App() {
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await fetch('/api/auth/me', { credentials: 'include' });
        if (!me.ok) {
          await fetch('/api/auth/anonymous', { method: 'POST', credentials: 'include' });
        }
        setReady(true);
      } catch (e: any) {
        setErr(e?.message ?? 'auth failed');
      }
    })();
  }, []);

  if (err) {
    return (
      <div style={{ padding: 24, color: '#f88', fontFamily: 'system-ui' }}>
        无法连接 server-cloud（{err}）。请确认 <code>pnpm --filter @mini/server-cloud dev</code> 已启动。
      </div>
    );
  }
  if (!ready) {
    return (
      <div style={{ padding: 24, color: '#888', fontFamily: 'system-ui' }}>
        正在登录…
      </div>
    );
  }
  return <AgentsApp />;
}