import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * miniCodeIde 网页版 Vite 配置
 *
 * 关键：通过 alias 引 apps/desktop/src/agents-window 的 React 组件，
 * 桌面/网页版共享 UI 但跑在两个 server 上（apps/server vs apps/server-cloud）。
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@desktop': path.resolve(__dirname, '../desktop/src'),
    },
  },
  server: {
    // ⚠️ 不要用 5174 —— 那是 server-node 的端口，会和桌面端冲突（macOS 上
    //   IPv4/IPv6 双栈允许两个进程在同一端口 LISTEN，desktop vite proxy 走 localhost
    //   就有可能被 web vite 抢走，导致 /api/workspace/switch → 500）。
    port: 5273,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.API_PROXY ?? 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});