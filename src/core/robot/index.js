// 로봇 출력 장치 선택.
// 프로그램은 이 파일을 직접 import 하지 않고 ctx.robot 만 쓴다.

import { createMockRobot } from './mock.js';

export function createRobot({ poses }) {
  // TODO: settings.mock 이 false 이면 serial.js 의 createSerialRobot 사용
  return createMockRobot({ poses });
}
