import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 다른 프로젝트와 섞이지 않게 포트를 고정한다. 밀려서 뜨면 어느 앱을 보는지 헷갈린다.
  server: {
    port: 5180,
    strictPort: true,
  },
});
