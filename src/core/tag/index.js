// 색 태그 입력 장치 선택.
// 프로그램은 이 파일을 직접 import 하지 않고 ctx.tag 만 쓴다.

import { createMockTag } from './mock.js';

export function createTag({ tags }) {
  // TODO: settings.mock 이 false 이고 WonderCam 이 검증되면 serial.js 사용
  return createMockTag({ tags });
}
