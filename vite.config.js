import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// GitHub Pages 주소는 https://namong118.github.io/aihand-care/ 처럼 레포 이름 폴더 아래에 있다.
// 그래서 배포용 빌드(npm run build)와 미리 보기(npm run preview)는 base 를 '/aihand-care/' 로 맞춘다.
// 개발 서버(npm run dev)만 그대로 http://localhost:5173/ 에서 열린다.
// public/ 아래 파일은 '/파일' 대신 import.meta.env.BASE_URL + '파일' 로 불러야 배포 주소에서도 맞다.
// 오프라인 AI(코스 끝 오늘의 한마디, docs/ai-greeting.md): 앱의 /ai/... 요청을 같은 기기의 llama-server(127.0.0.1:8080)로 넘긴다.
// 인터넷을 쓰지 않는다. 서버가 없으면 요청이 실패하고 앱은 미리 써 둔 인사를 쓴다 (콘솔에 proxy 오류가 한 줄 나올 수 있다)
const AI_PROXY = {
  target: 'http://127.0.0.1:8080',
  changeOrigin: true,
  rewrite: (path) => path.replace(/^\/ai/, ''),
};

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'serve' && !isPreview ? '/' : '/aihand-care/',
  server: {
    port: 5173,
    proxy: { '/ai': AI_PROXY },
  },
  // 라즈베리파이 키오스크는 npm run preview 로 돈다. 그때도 같은 기기의 AI 서버로 넘긴다
  preview: {
    proxy: { '/ai': AI_PROXY },
  },
  // 페이지 두 개를 함께 빌드한다: 스테이션 앱(index.html)과 보호자 폰 앱(guardian/index.html, #62)
  // 폰 앱 주소: 배포 https://namong118.github.io/aihand-care/guardian/ · 개발 http://localhost:5173/guardian/
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        guardian: fileURLToPath(new URL('./guardian/index.html', import.meta.url)),
      },
    },
  },
  test: {
    // 화면(DOM) 코드는 테스트하지 않으므로 node 환경으로 충분하다.
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
}));
