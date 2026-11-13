// MediaPipe 실행 파일(WASM)을 node_modules 에서 public/mediapipe/wasm/ 으로 복사한다.
// npm run dev, npm run build 앞에 자동으로 실행된다 (package.json 의 predev, prebuild).
// 인터넷(CDN) 없이도 손 인식이 되게 하려고, 배포 결과(dist/)에 같이 넣는다.
// 복사한 파일은 git 에 올리지 않는다 (.gitignore). 패키지 버전은 package.json 에 정확히 고정되어 있다.

import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const to = join(root, 'public', 'mediapipe', 'wasm');

// FilesetResolver.forVisionTasks(경로) 가 불러오는 두 파일 (ES 모듈판 *_module_* 은 쓰지 않는다)
const FILES = ['vision_wasm_internal.js', 'vision_wasm_internal.wasm'];

if (!existsSync(from)) {
  console.error('@mediapipe/tasks-vision 이 없습니다. 먼저 npm install 을 실행하세요.');
  process.exit(1);
}
mkdirSync(to, { recursive: true });
for (const f of FILES) copyFileSync(join(from, f), join(to, f));
console.log(`MediaPipe WASM 복사: ${FILES.join(', ')} → public/mediapipe/wasm/`);
