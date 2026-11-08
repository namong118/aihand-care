# 로봇 통신 프로토콜 v1

웹(노트북)과 AIHand(micro:bit, MakeCode 펌웨어)는 USB 시리얼(Web Serial)로 **텍스트 한 줄씩** 주고받는다.

- 한 줄 = 명령 하나, 끝은 `\n`
- 글자는 영어 대문자·숫자·`_`·쉼표만 사용
- 값이 있으면 `명령,값` 처럼 쉼표로 붙인다 (공백 없음)
- 구현: 웹 `src/core/robot/protocol.js`·`serial.js`, 로봇 `firmware/main.ts` (펌웨어 F1)
- **이 문서, `protocol.js`, `firmware/`는 항상 같이 고친다.**

## 웹 → 로봇

| 명령 | 뜻 | 로봇 응답 | 검증 |
|---|---|---|---|
| `HELLO` | 인사 동작: 손바닥 편 채 손목 흔들기 → REST | `DONE,HELLO` | 확인됨 (F1, 2026-11-09) |
| `POSE,<이름>` | 손모양 만들기. 이름은 `src/data/poses.json`의 `name` (예: `POSE,ROCK`) | `DONE,POSE` | 확인됨 (F1, 7종, 2026-11-09) |
| `REACT,OK` | 칭찬 반응: 주먹 ↔ 반쯤 쥔 자세 2번 | `DONE,REACT` | 확인됨 (F1, 2026-11-09) |
| `REACT,RETRY` | "다시 해 볼까요" 반응: 새끼→검지 물결 → REST | `DONE,REACT` | 확인됨 (F1, 2026-11-09) |
| `REST` | 쉬는 자세: 손가락·손목 모두 90° | `DONE,REST` | 확인됨 (F1, 2026-11-09) |
| `SPEED,SLOW` / `SPEED,NORMAL` | 모든 이동·대기 시간 ×2 / ×1 | `DONE,SPEED` | 확인됨 (F1, POSE·반응 동작 모두, 2026-11-09) |
| `PING` | 연결 확인 | `PONG` | 확인됨 (F1, 2026-11-09) |

동작 각도·시간은 `docs/hardware-check.md` 3번·부록 5, 명령별 동작 시간은 `firmware/README.md`.

## 로봇 → 웹

| 줄 | 뜻 |
|---|---|
| `DONE,<명령>` | 명령 동작을 마침. `<명령>`은 받은 명령의 이름 부분 (`POSE,ROCK` → `DONE,POSE`) |
| `TAG,<ID>` | 색깔 카드의 태그 인식. 웹의 `core/card`가 `tags.json`으로 ID를 색(`red` 등)으로 바꿔 `ctx.card.onCard({ color })`로 넘긴다. **[검증 필요]** 카드 인식 방식 미정: AprilTag 방식이면 이 줄을 쓰고, WonderCam 색상 인식 방식이면 색을 바로 보내는 줄로 바꿀 수 있다 (그때 이 문서·`protocol.js`·`firmware/`를 함께 고친다) |
| `PONG` | `PING` 응답 |
| `ERR,<내용>` | 오류. `ERR,UNKNOWN_CMD` (모르는 명령), `ERR,UNKNOWN_POSE` (모르는 손모양), `ERR,BAD_ARG` (값이 틀림). 오류가 나면 로봇은 움직이지 않는다 |

## 동작 규칙

- 웹은 명령을 **하나씩** 보낸다. 앞 명령의 `DONE`을 받은 뒤 다음 명령을 보낸다.
  (Mock도 같은 규칙으로 명령을 줄 세워 처리한다.)
- `ctx.robot.*` 함수는 `DONE`을 받으면 resolve 되는 Promise를 돌려준다.
- 통신 속도(baud rate): **115200**
- `DONE`은 정해진 시간이 지나면 보낸다. 서보가 실제로 도착했다는 뜻이 아니다.
- 로봇은 동작하는 동안 웹이 보낸 글자를 받지 못한다 (서보 명령 때 시리얼 통로를 확장보드로 돌리기 때문). 동작 중에 보낸 `PING`은 사라진다 (F1 실물 확인, 2026-11-09).

### 시간 초과와 재동기화 (`serial.js`)

명령별 시간 초과 = SLOW 기준 동작 시간 + 여유.

| 명령 | 시간 초과 | 동작 시간 (NORMAL / SLOW) |
|---|---|---|
| `PING`, `SPEED` | 1.5초 | 바로 |
| `POSE`, `REST` | 3초 | 약 0.65초 / 1.25초 |
| `REACT` | 10초 | OK 약 2.1초 / 4.1초, RETRY 약 3.5초 / 6.7초 |
| `HELLO` | 10초 | 약 3.0초 / 5.8초 |

- 시간 초과나 `ERR`가 나도 `ctx.robot.*`는 reject 하지 않고 `{ type: 'ERR', message }`로 resolve 한다. 상태 표시줄에 알리고 활동은 계속한다. 잘못된 손모양 이름만 바로 에러를 낸다 (프로그램 코드 실수).
- 시간 초과 뒤에는 다음 명령 전에 `PING`을 보내 `PONG`을 받을 때까지 기다린다 (최대 3번). 그 사이 늦게 온 `DONE`은 버린다. 3번 모두 `PONG`이 없으면 연결이 끊긴 것으로 본다.
- 연결이 끊기면(USB 빠짐, 응답 없음) 로봇만 Mock(화면 속 로봇손)으로 돌아간다. 다시 연결하려면 상태 표시줄의 "AIHand 연결" 버튼을 누른다.
- 웹 쪽에서 만드는 오류 `message`: `TIMEOUT`, `NO_RESPONSE`, `DISCONNECTED`, `NOT_CONNECTED` (로봇이 보내는 줄이 아님)
- `TAG`·알 수 없는 줄(확장보드 잡음 등)은 기다리는 명령에 영향을 주지 않는다. `TAG`를 `core/card`로 넘기는 것은 아직 구현 전 (`TODO`)

### 연결 순서

1. 상태 표시줄 "AIHand 연결" 클릭 → Chrome 포트 고르기 창에서 micro:bit 선택
2. 115200으로 열고 `PING` → `PONG` 확인 (최대 3번)
3. 홈의 진행 속도로 `SPEED,SLOW|NORMAL` 전송. 홈에서 속도를 바꿀 때도 다시 보낸다

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
