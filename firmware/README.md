# AIHand 펌웨어 (micro:bit, MakeCode)

웹 앱이 Web Serial로 보내는 명령(로봇 통신 프로토콜 v1, `docs/protocol.md`)을 받아 AIHand를 움직이고,
WonderCam에 보인 색깔 카드의 태그 번호를 웹으로 보낸다.

- 코드: `main.ts` (MakeCode JavaScript 탭에 전체 붙여 넣기)
- 버전: **F2** (켜질 때 LED에 `F2`가 지나간 뒤 ✓ 또는 ✖ 아이콘)
  - F1: 로봇 명령 (2026-11-09 실물 확인)
  - F2: F1 + WonderCam 태그 인식 (`CAM,TAG`, `TAG,<번호>`, `TAG,NONE`). 아직 실물 미확인
- 동작 설계: `docs/hardware-check.md` 부록 5 확정안, 타이밍·시리얼 처리: 테스트 코드 v8
- **이 폴더, `src/core/robot/protocol.js`, `docs/protocol.md`는 항상 같이 고친다.**

## 올리는 방법

1. 확장보드 전원을 끈 채 micro:bit를 꽂고, USB를 노트북에 연결한 뒤 어댑터(7.5V)를 확인하고 전원을 켠다
2. https://makecode.microbit.org → 새 프로젝트 → **확장은 추가하지 않는다** (Hiwonder StartbitV2·WonderCam 모두.
   WonderCam에 필요한 I2C 코드는 `main.ts` 안에 들어 있다)
3. JavaScript 탭에 `main.ts` 전체를 붙여 넣기 → 다운로드 → micro:bit에 올리기
4. LED에 `F2`가 지나가고 아이콘이 나오면 준비 완료 (약 3초, F1과 같음)
   - ✓ : 로봇·WonderCam 모두 준비
   - ✖ : 켜질 때 WonderCam이 안 보임. 로봇 명령은 그대로 동작하고, `CAM,TAG`를 받을 때 다시 찾는다. 계속 안 되면 카메라 케이블(I2C)과 확장보드 전원을 확인한다
   - 켜질 때 카메라를 오래 기다리거나 모드를 바꾸지 않는다. 그동안 웹의 `PING`에 답하지 못하기 때문
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
| `CAM,TAG` | `DONE,CAM` | WonderCam 태그(AprilTag) 모드로 전환. 카메라 없음 `ERR,NO_CAM`(약 1초), 전환 안 됨 `ERR,CAM_MODE` | 보통 0.1~0.2초, 최악 약 5.1초 | 같음 |

손모양 이름: `ROCK` `PAPER` `V` `INDEX` `THREE` `FOUR` `THUMB`

오류 응답: `ERR,UNKNOWN_CMD` (모르는 명령), `ERR,UNKNOWN_POSE` (모르는 손모양), `ERR,BAD_ARG` (값이 틀림)

명령과 상관없이 로봇이 보내는 줄 (F2):

| 줄 | 언제 |
|---|---|
| `TAG,<번호>` | WonderCam에 보이는 태그가 바뀌었을 때 한 번 (빨강 0, 파랑 1, 노랑 2, 초록 3) |
| `TAG,NONE` | 보이던 태그가 0.5초 넘게 안 보일 때 한 번 |

- `TAG` 줄은 `CAM,TAG`가 성공한 뒤부터 나온다. 웹은 연결할 때 자동으로 보내고, Serial Terminal에서는 직접 입력한다
- 명령을 처리하지 않을 때 약 0.1초마다 카메라를 읽는다. 서보가 움직이는 동안에는 읽지도 보내지도 않는다
  (그 사이 시리얼 통로가 확장보드 쪽이라 보내면 글자가 확장보드로 간다). 동작이 끝난 뒤 카드가 보이고 있으면 그때 보낸다

안전 범위는 코드 안의 상수다: 손가락 50~130°, 손목 80~100°. 범위를 바꾸거나 각도를 직접 지정하는 명령은 없다.

## Serial Terminal 확인 절차 (F1 첫 실물 확인, 2026-11-09 완료)

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

## Serial Terminal 확인 절차 (F2 WonderCam 태그 수신)

준비: F2를 올리고 **MakeCode 탭을 닫는다**. Serial Terminal 115200 연결 (위 F1 절차와 같은 설정).
카드: `docs/cards/cards.html` 인쇄본, 없으면 모니터에 AprilTag tag36h11 0~3 이미지를 띄운다 (`docs/cards.md` 3-A).
카드는 카메라에서 약 20~30cm. 보여주는 카드 외의 카드는 카메라에 보이지 않게 둔다.

| 순서 | 할 일 | 기대 결과 | 확인 |
|---|---|---|---|
| 0 | (전원 켜기) | LED `F2` → ✓, 서보는 움직이지 않음 | |
| 1 | `PING` | `PONG` | |
| 1-1 | 카드를 보여주기 (`CAM,TAG` 전) | 아무 줄도 나오지 않음 | |
| 1-2 | `CAM,TAG` | `DONE,CAM` (보통 바로, 길어도 약 5초) | |
| 2 | 빨강 카드(태그 0)를 보여주고 들고 있기 | `TAG,0` **한 줄만** (들고 있는 동안 더 나오지 않음) | |
| 3 | 카드 치우기 | 약 0.5초 뒤 `TAG,NONE` 한 줄 | |
| 4 | 파랑(1) → 치움 → 노랑(2) → 치움 → 초록(3) → 치움 | `TAG,1` `TAG,NONE` `TAG,2` `TAG,NONE` `TAG,3` `TAG,NONE` | |
| 5 | 빨강을 들고 있다가 치우지 않고 바로 파랑으로 바꾸기 | `TAG,0` 뒤 `TAG,1` (사이에 `NONE`이 있어도 됨) | |
| 6 | 카드를 계속 들고 10초 기다리기 | 그 사이 `TAG,NONE`이 나오지 않아야 함 (나오면 횟수 기록: 0.5초 기준 조정 근거) | |
| 7 | `CAM,TAG` | `DONE,CAM`. 카드를 들고 있었으면 바로 뒤 `TAG,<번호>`가 다시 옴 | |
| 8 | `CAM,NUM` | `ERR,BAD_ARG` (숫자 모드는 아직 없음) | |
| 9 | 카드를 들고 있는 채로 `HELLO` | 동작 중에는 `TAG` 줄이 없고, `DONE,HELLO`가 온 뒤 필요하면 `TAG` 줄 | |
| 10 | `HELLO`를 보내고 동작 중에 카드를 보여줬다가 동작이 끝나기 전에 치우기 | `TAG` 줄이 안 와도 정상 (동작 중에는 카메라를 읽지 않음) | |
| 11 | `HELLO`를 보내고 동작 중에 카드를 보여준 채로 기다리기 | `DONE,HELLO` 뒤 `TAG,<번호>` | |
| 12 | `POSE,ROCK` → `REACT,OK` → `REST`를 하나씩 | 응답이 F1과 같고, 응답 앞에 `A…$`·`TAG` 글자가 붙지 않음 | |
| 13 | 카메라 케이블을 뽑고 micro:bit 리셋(뒷면 버튼) | LED `F2` → ✖. `PING` → `PONG`, `REST` → `DONE,REST` (로봇은 그대로) | |
| 14 | (케이블 뽑은 채) `CAM,TAG` | 약 1초 뒤 `ERR,NO_CAM` | |
| 15 | 케이블을 다시 꽂고 몇 초 뒤 `CAM,TAG` | `DONE,CAM`, 카드를 보여주면 `TAG` 줄 | |

13~15는 케이블을 뽑기 어려우면 건너뛰고 "건너뜀"으로 기록한다.
결과는 `docs/hardware-check.md` 4번 표와 부록(F2 실물 확인)에 기록한다.

## 웹 확인 절차 (F2, 11/12 점검: 태그 번호 웹 수신)

준비: Serial Terminal 연결을 끊는다 (포트는 한 프로그램만 쓸 수 있다). `npm run dev` → Chrome `http://localhost:5173`.

| 순서 | 할 일 | 기대 결과 | 확인 |
|---|---|---|---|
| 1 | 맨 아래 "개발자 입력 (Mock)" 펼치기 | `WonderCam: 가상 (카드 대신 키보드·버튼) · Mock` | |
| 2 | 상단 바 "AIHand 연결" → micro:bit 포트 선택 | 상단 바 `AIHand 연결됨`, 개발자 입력에 `WonderCam: 연결됨 (태그 모드 · 보이는 카드 없음) · 실제` | |
| 3 | 빨강 카드 보여주기 | `보이는 카드: 빨강 (태그 0)` | |
| 4 | 카드 치우기 | 약 0.5초 뒤 `보이는 카드 없음` | |
| 5 | 파랑·노랑·초록 차례로 | `파랑 (태그 1)`, `노랑 (태그 2)`, `초록 (태그 3)` | |
| 6 | 홈 → STEP 3 색깔손 시작, 문제마다 답 색 카드를 보여주기 | 카드로 답이 들어감 (한 문제에 카드는 한 번: 같은 카드로 다음 문제에 답하려면 내렸다가 다시 보여주기) | |
| 7 | STEP 3 진행 중 키보드 R/B/Y/G | 카드 대신 입력도 계속 됨 | |
| 8 | STEP 1이나 STEP 4로 로봇 동작 확인 | F1 때와 같이 동작, 상단 바에 시간 초과·오류 문구 없음 | |
| 9 | USB 뽑기 | `AIHand 연결 안 됨`, `WonderCam: 연결 안 됨 (AIHand 연결이 끊겨 카드 대신 키보드·버튼) · Mock` | |
| 10 | USB 다시 꽂고 "AIHand 연결" | 2번과 같이 `WonderCam: 연결됨` | |
| 11 | (선택) 펌웨어 F1이 올라간 micro:bit로 연결 | 로봇은 연결됨, `WonderCam: 찾지 못함 (펌웨어 F2가 필요해요)` | |

브라우저 개발자 도구(F12) 콘솔에 `카드 표(tags.json)에 없는 태그 번호예요`가 나오면 0~3이 아닌 태그가 보인 것이다.

## 나중에 명령을 추가할 때

`main.ts`의 "명령 처리" 부분은 명령 하나 = 함수 하나(`cmdPing`, `cmdPose` …)다.
새 명령은 `cmdXxx(arg)` 함수를 만들고 `handle()`에 `else if (name == "XXX") cmdXxx(arg)` 한 줄을 추가한다.
(예: STEP 1 숫자 카드 검토 중인 WonderCam 숫자 모드 `CAM,NUM`. 아직 구현하지 않음.
`cmdCam()`에 `NUM` 분기를 더하고, `pollTag()`처럼 바뀔 때만 `NUM,<숫자>` / `NUM,NONE`을 보내게 한다)
명령을 추가하면 `docs/protocol.md`와 `src/core/robot/protocol.js`도 함께 고친다.
