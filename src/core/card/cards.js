// 색 카드 공통: 카드 색 목록과 태그 ID → 색 변환.
// 프로그램은 ID를 모른다. ctx.card.onCard 로 { color } 만 받는다.
//
// 카드 방식 A(AprilTag tag36h11) 임시 결정 (docs/hardware-check.md 4번, docs/cards.md 3-A).
//   로봇이 'TAG,<번호>' 전송 → tagIdToColor 로 색 변환 (0 빨강, 1 파랑, 2 노랑, 3 초록)
//   종이 카드 테스트에서 방식 B(색상 인식)로 바뀌어도 ctx.card.onCard 의 { color } 형태는 그대로다. [검증 필요]

import tags from './tags.json';

export const CARD_COLORS = ['red', 'blue', 'yellow', 'green'];

export function isCardColor(color) {
  return CARD_COLORS.includes(color);
}

/** 태그 번호('0' 등)를 카드 색('red')으로. 표에 없으면 null. */
export function tagIdToColor(id, table = tags.ids) {
  const color = table[id];
  return isCardColor(color) ? color : null;
}
