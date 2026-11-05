// Web Serial 로 micro:bit(AIHand) 와 통신하는 모듈 (아직 구현 전).
// Chrome·Edge 에서만 동작한다.
//
// TODO: navigator.serial.requestPort() 로 포트 고르기 (사용자 버튼 클릭에서만 호출 가능)
// TODO: 통신 속도(baudRate) 확인 후 port.open  [검증 필요: 펌웨어 설정값]
// TODO: protocol.js 로 만든 문자열을 TextEncoder 로 써서 보내기
// TODO: 받은 바이트를 줄 단위로 나눠 protocol.parseLine 으로 해석
// TODO: 보낸 명령마다 'DONE,<명령>' 을 기다렸다가 Promise resolve, 시간 초과 처리
// TODO: 'TAG,<ID>' 줄은 tag 모듈로 넘기기  [검증 필요: WonderCam 태그 ID 전달]
// TODO: 연결 끊김 감지, 상태 표시줄 갱신
// TODO: mock.js 와 같은 모양: { kind: 'serial', hello, showPose, react, rest }

export function createSerialRobot() {
  throw new Error('Web Serial 로봇 연결은 아직 구현되지 않았습니다. Mock 모드를 사용하세요.');
}
