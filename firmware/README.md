# AIHand 펌웨어 (micro:bit, MakeCode)

웹 앱이 Web Serial로 보내는 명령(로봇 통신 프로토콜 v1, `docs/protocol.md`)을 받아 AIHand를 움직인다.

- 코드: `main.ts` (MakeCode JavaScript 탭에 전체 붙여 넣기)
- 버전: **F1** (켜질 때 LED에 `F1`이 지나간 뒤 ✓ 아이콘)
- 동작 설계: `docs/hardware-check.md` 부록 5 확정안, 타이밍·시리얼 처리: 테스트 코드 v8
- **이 폴더, `src/core/robot/protocol.js`, `docs/protocol.md`는 항상 같이 고친다.**

## 올리는 방법

1. 확장보드 전원을 끈 채 micro:bit를 꽂고, USB를 노트북에 연결한 뒤 어댑터(7.5V)를 확인하고 전원을 켠다
2. https://makecode.microbit.org → 새 프로젝트 → **확장은 추가하지 않는다** (Hiwonder StartbitV2·WonderCam 모두)
3. JavaScript 탭에 `main.ts` 전체를 붙여 넣기 → 다운로드 → micro:bit에 올리기
4. LED에 `F1`이 지나가고 ✓가 나오면 준비 완료
5. **MakeCode 탭을 닫는다** (MakeCode가 시리얼을 잡고 있으면 웹·터미널이 연결되지 않는다)

## 명령과 시간

| 명령 | 응답 | 동작 | NORMAL | SLOW |
|---|---|---|---|---|
| `PING` | `PONG` | 없음 | 바로 | 바로 |
| `POSE,<이름>` | `DONE,POSE` | 손모양 7종 (손목은 안 움직임) | 약 0.65초 | 약 1.25초 |
| `REST` | `DONE,REST` | 손가락·손목 모두 90° | 약 0.65초 | 약 1.25초 |
| `REACT,OK` | `DONE,REACT` | 주먹 ↔ 반쯤 쥔 자세 2번 | 약 2.1초 | 약 4.1초 |
| `REACT,RETRY` | `DONE,REACT` | 새끼→검지 물결 → REST | 약 3.5초 | 약 6.7초 |
| `HELLO` | `DONE,HELLO` | 손바닥 편 채 손목 90→100→80→100→90 → REST | 약 3.0초 | 약 5.8초 |
| `SPEED,SLOW` / `SPEED,NORMAL` | `DONE,SPEED` | 모든 이동·대기 시간 ×2 / ×1 | 바로 | 바로 |

손모양 이름: `ROCK` `PAPER` `V` `INDEX` `THREE` `FOUR` `THUMB`

오류 응답: `ERR,UNKNOWN_CMD` (모르는 명령), `ERR,UNKNOWN_POSE` (모르는 손모양), `ERR,BAD_ARG` (값이 틀림)

안전 범위는 코드 안의 상수다: 손가락 50~130°, 손목 80~100°. 범위를 바꾸거나 각도를 직접 지정하는 명령은 없다.

## Serial Terminal 확인 절차 (F1 첫 실물 확인)

준비: Chrome에서 Serial Terminal을 열고 115200으로 연결한다. "Flush on enter"는 끈다 (부록 1과 같은 설정).
**오타가 나면 지우지 말고 Enter로 그 줄을 버린다.** 백스페이스·방향키도 글자로 전송되어 명령이 깨진다.

각 명령 뒤 응답이 올 때까지 기다린 다음 다음 명령을 보낸다. 동작마다 지속음·떨림·발열·케이블 당김을 확인한다.

| 순서 | 입력 | 기대 결과 | 확인 |
|---|---|---|---|
| 0 | (전원 켜기) | LED `F1` → ✓, 서보는 움직이지 않음 | |
| 1 | `PING` | `PONG` | |
| 2 | `REST` | 손가락·손목 90°, `DONE,REST` | |
| 3 | `POSE,ROCK` | 주먹, `DONE,POSE` | |
| 4 | `POSE,PAPER` | 손바닥 | |
| 5 | `POSE,V` | 검지·중지만 펴짐 | |
| 6 | `POSE,INDEX` | 검지만 펴짐 | |
| 7 | `POSE,THREE` | 검지·중지·약지 펴짐 | |
| 8 | `POSE,FOUR` | 엄지만 접힘 | |
| 9 | `POSE,THUMB` | 엄지만 펴짐 | |
| 10 | `REACT,OK` | 쥐기 2번 후 반쯤 쥔 자세, `DONE,REACT` | |
| 11 | `REACT,RETRY` | 손바닥 → 물결 → REST, `DONE,REACT` | |
| 12 | `HELLO` | 손바닥 → 손목 흔들기 → REST, `DONE,HELLO` | |
| 13 | `REST` | `DONE,REST` | |
| 14 | `SPEED,SLOW` | `DONE,SPEED` | |
| 15 | `POSE,ROCK` → `POSE,PAPER` | 약 1초에 걸쳐 천천히 움직임 (SLOW POSE는 처음 확인) | |
| 16 | `REACT,OK` → `REACT,RETRY` → `HELLO` | 위보다 느리게 같은 동작 | |
| 17 | `SPEED,NORMAL` | `DONE,SPEED` | |
| 18 | `POSE,ABC` | `ERR,UNKNOWN_POSE`, 움직이지 않음 | |
| 19 | `REACT,YES` | `ERR,BAD_ARG`, 움직이지 않음 | |
| 20 | `WAVE` | `ERR,UNKNOWN_CMD` | |
| 21 | `HELLO` 직후 바로 `PING` 입력 | 동작이 끝난 뒤 `DONE,HELLO`가 옴. `PONG`은 오거나 사라질 수 있음 (사라지는지 기록: 웹 재동기화 PING 재시도 근거) | |
| 22 | 응답 줄 앞에 `A…$` 같은 글자가 붙거나 `ERR,A…`가 나오지 않는지 전체 확인 | 없어야 함 | |

결과는 `docs/hardware-check.md`에 기록한다 (F1 실물 확인).

## 나중에 명령을 추가할 때

`main.ts`의 "명령 처리" 부분은 명령 하나 = 함수 하나(`cmdPing`, `cmdPose` …)다.
새 명령은 `cmdXxx(arg)` 함수를 만들고 `handle()`에 `else if (name == "XXX") cmdXxx(arg)` 한 줄을 추가한다.
(예: STEP 1 숫자 카드 검토 중인 WonderCam 숫자 모드. 아직 구현하지 않음)
명령을 추가하면 `docs/protocol.md`와 `src/core/robot/protocol.js`도 함께 고친다.
