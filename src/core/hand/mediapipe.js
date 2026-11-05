// 웹캠 + MediaPipe Hand Landmarker 로 손모양을 인식하는 모듈 (아직 구현 전).
//
// TODO: @mediapipe/tasks-vision 패키지 추가 (추가 전 팀 확인 필요)
// TODO: 웹캠 열기 (getUserMedia), 실패 시 상태를 '연결 안 됨'으로 표시
// TODO: 랜드마크 21개 → 손가락별 펴짐 여부 → 5비트 code [엄지,검지,중지,약지,새끼]
// TODO: 같은 code 가 이어진 시간을 stableMs 로 계산
// TODO: mock.js 와 같은 모양의 객체 반환: { kind: 'mediapipe', onPose(cb), destroy() }
//
// 반환 형태와 이벤트 값은 docs/hand-api.md 를 따른다.

export function createMediaPipeHand() {
  throw new Error('MediaPipe 손 인식은 아직 구현되지 않았습니다. Mock 모드를 사용하세요.');
}
