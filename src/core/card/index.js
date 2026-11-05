// 색 카드 입력 장치 선택.
// 프로그램은 이 파일을 직접 import 하지 않고 ctx.card 만 쓴다.

import { createMockCard } from './mock.js';

export { CARD_COLORS, isCardColor, tagIdToColor } from './cards.js';

export function createCard({ colors }) {
  // TODO: settings.mock 이 false 이고 카드 인식 방식이 검증되면 serial.js 사용 [검증 필요]
  return createMockCard({ colors });
}
