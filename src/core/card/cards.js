// 색 카드 공통: 카드 색 목록과 태그 ID → 색 변환.
// 프로그램은 ID를 모른다. ctx.card.onCard 로 { color } 만 받는다.
//
// [검증 필요] 카드를 어떻게 인식할지 아직 정해지지 않았다 (docs/hardware-check.md 4번).
//   방식 A) AprilTag 등 태그 인식 → 로봇이 'TAG,<ID>' 전송 → tagIdToColor 로 색 변환
//   방식 B) WonderCam 색상 인식 → 로봇이 색을 바로 전송 → 이 변환표는 필요 없음
//   어느 쪽이든 ctx.card.onCard 의 { color } 형태는 바뀌지 않는다.

import tags from './tags.json';

export const CARD_COLORS = ['red', 'blue', 'yellow', 'green'];

export function isCardColor(color) {
  return CARD_COLORS.includes(color);
}

/** 태그 ID('RED' 등)를 카드 색('red')으로. 표에 없으면 null. */
export function tagIdToColor(id, table = tags.ids) {
  const color = table[id];
  return isCardColor(color) ? color : null;
}
