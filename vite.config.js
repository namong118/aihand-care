import { defineConfig } from 'vite';

// GitHub Pages 주소는 https://namong118.github.io/aihand-care/ 처럼 레포 이름 폴더 아래에 있다.
// 그래서 배포용 빌드(npm run build)와 미리 보기(npm run preview)는 base 를 '/aihand-care/' 로 맞춘다.
// 개발 서버(npm run dev)만 그대로 http://localhost:5173/ 에서 열린다.
// public/ 아래 파일은 '/파일' 대신 import.meta.env.BASE_URL + '파일' 로 불러야 배포 주소에서도 맞다.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'serve' && !isPreview ? '/' : '/aihand-care/',
  server: {
    port: 5173,
  },
  test: {
    // 화면(DOM) 코드는 테스트하지 않으므로 node 환경으로 충분하다.
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
}));
