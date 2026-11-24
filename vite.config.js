import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// GitHub Pages 주소는 https://namong118.github.io/aihand-care/ 처럼 레포 이름 폴더 아래에 있다.
// 그래서 배포용 빌드(npm run build)와 미리 보기(npm run preview)는 base 를 '/aihand-care/' 로 맞춘다.
// 개발 서버(npm run dev)만 그대로 http://localhost:5173/ 에서 열린다.
// public/ 아래 파일은 '/파일' 대신 import.meta.env.BASE_URL + '파일' 로 불러야 배포 주소에서도 맞다.
// 오프라인 한국어 읽기(실시간, docs/voice.md): 앱의 /tts 요청을 같은 기기의 Supertonic 서버(scripts/supertonic.py serve)로 넘긴다.
// 인터넷을 쓰지 않는다. 서버가 없으면 요청이 실패하고 앱은 브라우저 음성으로 넘어간다
const TTS_PROXY = { target: 'http://127.0.0.1:8090', changeOrigin: true };

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'serve' && !isPreview ? '/' : '/aihand-care/',
  server: {
    port: 5173,
    proxy: { '/tts': TTS_PROXY },
  },
  // 라즈베리파이 키오스크는 npm run preview 로 돈다. 그때도 같은 기기의 읽기 서버로 넘긴다
  preview: {
    proxy: { '/tts': TTS_PROXY },
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
