import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
  },
  test: {
    // 화면(DOM) 코드는 테스트하지 않으므로 node 환경으로 충분하다.
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
});
