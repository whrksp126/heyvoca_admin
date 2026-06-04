import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// 빌드 산출물은 Flask 가 서빙하는 app/static/spa 로.
// base 는 /static/spa/ — EB staticfiles(/static → app/static) / Flask static 라우트가 자산을 직접 서빙.
export default defineConfig({
  plugins: [react()],
  base: '/static/spa/',
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    outDir: path.resolve(__dirname, '../app/static/spa'),
    emptyOutDir: true,
  },
  server: {
    port: 5180,
    proxy: {
      // 로컬 개발: Flask(run.py, 기본 5000)로 인증/프록시 위임
      '/api': { target: 'http://127.0.0.1:5000', changeOrigin: true },
      '/auth': { target: 'http://127.0.0.1:5000', changeOrigin: true },
    },
  },
});
