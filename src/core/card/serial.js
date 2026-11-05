// 실제 색 카드 입력 (아직 구현 전). 사용자가 색깔 카드를 AIHand의 WonderCam에 보여준다.
//
// [검증 필요] 카드 인식 방식이 아직 정해지지 않았다. docs/hardware-check.md 4번을 먼저 확인한다.
//
// TODO 방식 A) AprilTag 등 태그 인식
//   - 로봇 시리얼에서 'TAG,<ID>' 줄을 받는다 (protocol.parseLine → { type: 'TAG', id })
//   - cards.js 의 tagIdToColor(id) 로 색으로 바꾼다. tags.json 의 ID 를 실제 태그 번호로 고친다
//   - 표에 없는 ID 는 무시하고 console.warn
//
// TODO 방식 B) WonderCam 색상 인식
//   - 로봇이 색을 바로 보내게 되면 tags.json 변환표는 쓰지 않는다
//   - 색을 보내는 줄의 형식은 프로토콜 변경이 필요하다
//     (protocol.js, firmware/, docs/protocol.md 를 함께 고친다)
//
// 어느 방식이든 mock.js 와 같은 모양을 지킨다: { kind: 'serial', onCard(cb) }, cb({ color })

export function createSerialCard() {
  throw new Error('색 카드 입력(WonderCam)은 아직 구현되지 않았습니다. Mock 모드를 사용하세요.');
}
