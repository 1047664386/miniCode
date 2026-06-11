
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 用相对路径输出资源引用 ("./assets/..." 而不是 "/assets/...")
  // Electron file:// 协议加载 index.html 时，绝对路径会被解析到文件系统根 → 白屏
  base: './',
  server: {
    port: 5173,
    proxy: {
      '/cloud-api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/cloud-api/, ''),
        // 超时设置需大于 SSE keepalive（server-node 每 15s 发心跳），
        // 同时给 LLM 长时间推理留足余量
        proxyTimeout: 120_000,
        timeout: 120_000,
      },
      '/api': {
        target: 'http://localhost:5175',
        changeOrigin: true,
        proxyTimeout: 120_000,
        timeout: 120_000,
      },
    },
  },
});