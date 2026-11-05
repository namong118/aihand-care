// WonderCam 색 태그 입력 (아직 구현 전).
//
// [검증 필요] WonderCam 이 인식한 태그 ID 를 micro:bit 로 넘길 수 있는지 확인 전.
//             docs/hardware-check.md 의 WonderCam 항목을 먼저 확인한다.
// TODO: 확인되면 로봇 시리얼 연결에서 'TAG,<ID>' 줄을 받아 onTag 로 넘기기
// TODO: mock.js 와 같은 모양: { kind: 'serial', onTag(cb) }

export function createSerialTag() {
  throw new Error('WonderCam 태그 입력은 아직 구현되지 않았습니다. Mock 모드를 사용하세요.');
}
