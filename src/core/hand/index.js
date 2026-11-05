// 손 인식 장치 선택.
// 프로그램은 이 파일을 직접 import 하지 않고 ctx.hand 만 쓴다.

import { createMockHand } from './mock.js';

export { codeToName, nameToCode } from './codes.js';

/**
 * 손 인식 장치를 만든다.
 * 지금은 Mock 만 있다. 실제 웹캠 인식은 mediapipe.js 에서 구현 예정.
 */
export function createHand({ poses }) {
  // TODO: settings.mock 이 false 이면 mediapipe.js 의 createMediaPipeHand 사용
  return createMockHand({ poses });
}
