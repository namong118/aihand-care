# 로봇 통신 프로토콜 v1

웹(노트북)과 AIHand(micro:bit, MakeCode 펌웨어)는 USB 시리얼(Web Serial)로 **텍스트 한 줄씩** 주고받는다.

- 한 줄 = 명령 하나, 끝은 `\n`
- 글자는 영어 대문자·숫자·`_`·쉼표만 사용
- 값이 있으면 `명령,값` 처럼 쉼표로 붙인다 (공백 없음)
- 구현: 웹 `src/core/robot/protocol.js`, 로봇 `firmware/` (추가 예정)
- **이 문서, `protocol.js`, `firmware/`는 항상 같이 고친다.**

## 웹 → 로봇

| 명령 | 뜻 | 로봇 응답 | 검증 |
|---|---|---|---|
| `HELLO` | 인사 동작 | `DONE,HELLO` | 미확인 |
| `POSE,<이름>` | 손모양 만들기. 이름은 `src/data/poses.json`의 `name` (예: `POSE,ROCK`) | `DONE,POSE` | 미확인 (손모양별 가능 여부는 `hardware-check.md`) |
| `REACT,OK` | 칭찬 반응 동작 | `DONE,REACT` | 미확인 |
| `REACT,RETRY` | "다시 해 볼까요" 반응 동작 | `DONE,REACT` | 미확인 |
| `REST` | 손 내리기(쉬는 자세) | `DONE,REST` | 미확인 |
| `SPEED,SLOW` / `SPEED,NORMAL` | 동작 속도 | `DONE,SPEED` | **[검증 필요]** 서보 속도 조절 가능 여부 미확인 |
| `PING` | 연결 확인 | `PONG` | 미확인 |

## 로봇 → 웹

| 줄 | 뜻 |
|---|---|
| `DONE,<명령>` | 명령 동작을 마침. `<명령>`은 받은 명령의 이름 부분 (`POSE,ROCK` → `DONE,POSE`) |
| `TAG,<ID>` | 색 태그 인식 (`RED`·`BLUE`·`YELLOW`·`GREEN`). **[검증 필요]** WonderCam이 태그 ID를 micro:bit로 넘길 수 있는지 미확인 |
| `PONG` | `PING` 응답 |
| `ERR,<내용>` | 오류. 예: `ERR,UNKNOWN_POSE`, `ERR,BUSY` |

## 동작 규칙

- 웹은 명령을 **하나씩** 보낸다. 앞 명령의 `DONE`을 받은 뒤 다음 명령을 보낸다.
  (Mock도 같은 규칙으로 명령을 줄 세워 처리한다.)
- `ctx.robot.*` 함수는 `DONE`을 받으면 resolve 되는 Promise를 돌려준다.
- 정해진 시간 안에 `DONE`이 오지 않을 때의 처리(시간 초과, 재시도)는 실제 연결 구현 때 정한다. `TODO`
- 통신 속도(baud rate)는 펌웨어 확정 후 적는다. `TODO`

## 예시

```
웹 → 로봇   HELLO
로봇 → 웹   DONE,HELLO
웹 → 로봇   POSE,V
로봇 → 웹   DONE,POSE
웹 → 로봇   REACT,OK
로봇 → 웹   DONE,REACT
```

## Mock 모드

`src/core/robot/mock.js`는 실제로 보내지 않고, `protocol.js`로 같은 문자열을 만들어 화면에 "보낸 명령"으로 보여준 뒤 0.8초 뒤 `DONE`을 받은 것처럼 처리한다.
