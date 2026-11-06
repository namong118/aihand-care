# 하드웨어 검증 체크리스트

AIHand·WonderCam 기능 중 공식 문서와 실물로 **확인된 것만** 코드에서 "동작한다"고 가정한다.
확인 전 기능은 Mock으로 두고 코드 TODO에 `[검증 필요]`를 적는다.

- 상태: `미확인` → `확인됨` / `안 됨` / `부분 가능`
- 확인하면 **날짜, 확인한 사람(A/B/C/D), 방법(공식 문서 링크 또는 실물 테스트), 메모**를 적는다.
- 시연 구성: 노트북 1대 + AIHand 1대 (USB). 여러 대 연결은 확인하지 않는다.

## 1. 연결

| 항목 | 상태 | 날짜 | 확인 | 방법·메모 |
|---|---|---|---|---|
| micro:bit가 노트북 USB로 연결되고 Chrome Web Serial 포트 목록에 보임 | 확인됨 | 2026-11-06 | A | 실물 테스트. Chrome + [Serial Terminal](https://googlechromelabs.github.io/serial-terminal/)에서 포트 선택·연결. 시연은 Chrome만 사용. 포트 이름: Chrome 선택 창 **"Port 1"**, Windows 장치 관리자 **"USB 직렬 장치(COM7)"** (COM 번호는 노트북·USB 단자마다 달라질 수 있음) |
| 시리얼 통신 속도(baud rate) 값 | 확인됨 | 2026-11-06 | A | **115200**. 실물 테스트. MakeCode `serial.setBaudRate(BaudRate.BaudRate115200)` + 터미널 115200에서 정상 송수신 |
| 웹 → micro:bit 한 줄 명령 수신 (`PING` → `PONG`) | 확인됨 | 2026-11-06 | A | 실물 테스트. 아래 "부록 1: 연결 테스트 방법"의 테스트 코드 사용 (`firmware/` 아님). 터미널에서 손으로 칠 때는 영문 대문자로, 지우지 말고 입력 (백스페이스·한글도 그대로 전송되어 줄이 깨짐). 웹 코드는 한 줄을 한 번에 보내므로 앱에는 해당 없음 |
| micro:bit → 웹 한 줄 응답 수신 | 확인됨 | 2026-11-06 | A | 실물 테스트. 2초마다 보낸 `TICK,<번호>` 65회 이상 빠짐없이 수신 |
| USB 전원만으로 서보 5개 동시 동작 가능 (외부 전원 필요 여부) | 확인됨 | 2026-11-06 | A | **외부 어댑터 필요, 시연도 어댑터 사용.** 공식 구성품이 7.4V 3A 어댑터([AiHand 1장](https://docs.hiwonder.com/projects/AiHand/en/latest/docs/1.Getting_Ready.html)), 실물 어댑터 라벨은 DC 7.5V 3A. 어댑터 연결 상태에서 `OPEN`·`FIST`로 서보 5개 동시 동작 확인(실물 테스트). USB 전원만으로는 시험하지 않음 (전원 부족 시 micro:bit 재시작 위험) |
| 웹 USB 시리얼과 확장보드 서보 시리얼 함께 쓰기 | 확인됨 | 2026-11-06 | A | 확장보드는 micro:bit **P12·P8 시리얼**로 서보 명령을 받는다([StartbitV2 확장](https://github.com/Hiwonder/StartbitV2) `startbit_Init()`). micro:bit 시리얼 통로는 하나뿐이라, 명령을 받았을 때만 `serial.redirect(P12, P8)`로 돌려 서보 명령을 보내고 `serial.redirectToUSB()`로 되돌리는 방식으로 실물 테스트. 서보 명령 뒤에도 다음 명령을 계속 정상 수신하고, `DONE,OPEN`·`DONE,FIST`·`DONE,S` 응답도 웹에서 수신. **공식 확장의 `Initialize StartbitV2` 블록은 쓰지 않는다** (통로를 확장보드로 고정하고 시리얼 입력을 계속 읽어 감). `firmware/`(#6)에 이 방식 반영 필요 |

## 2. AIHand 동작

| 항목 | 상태 | 날짜 | 확인 | 방법·메모 |
|---|---|---|---|---|
| 서보 번호와 접기·펴기 각도 | 확인됨 | 2026-11-06 | A | 서보 1~5 = 엄지~새끼, 6 = 손목 쪽 팬틸트. 엄지(1번)만 방향이 반대: **엄지 접기 130° / 펴기 50°, 검지~새끼 접기 50° / 펴기 130°**, 90°는 반쯤 쥔 자세. 공식 문서([AiHand 5장](https://docs.hiwonder.com/projects/AiHand/en/latest/docs/5.Aihand_basic_games_lesson.html)) + 실물 테스트(`OPEN`·`FIST`) |
| 손가락 5개를 각각 따로 접고 펼 수 있음 | 확인됨 | 2026-11-06 | A | 실물 테스트. 서보 1~5번 모두 `S` 명령으로 하나씩 움직임. `FIST`에서 손가락을 하나씩 펴는 방식으로 1~5번 개별 펴기 확인, 검지는 개별 접기도 확인(`S,2,50,500`). 이미 목표 각도에 있는 손가락은 명령을 받아도 안 움직이므로 `OPEN`·`FIST`로 자세를 맞춘 뒤 시험할 것 |
| 손가락 하나 움직임에 걸리는 시간 (DONE을 보낼 시점 판단용) | 확인됨 | 2026-11-06 | A | 이동 시간을 명령에서 정한다(서보 명령의 duration, ms). 500ms·2000ms 모두 지정한 시간대로 움직임(실물 테스트). 테스트 코드는 이동 시간 + 100ms 뒤에 `DONE`을 보냄 **주의: `DONE`은 시간 기준이며 서보가 실제로 도착했는지 확인하지 않는다** (PWM 서보는 위치를 알려 주지 않음). 막힘·무반응이어도 `DONE`이 온다 |
| **서보 속도 조절** (`SPEED,SLOW`) | 확인됨 | 2026-11-06 | A | 서보 명령의 이동 시간 값으로 조절. `S,2,50,2000`에서 검지가 2초에 걸쳐 천천히 접힘(실물 테스트). `SPEED,SLOW`·`NORMAL`은 이동 시간을 바꾸는 방식으로 구현 가능. 실제 값(예: 500ms / 1500ms)은 #6에서 정함 |
| 인사 동작 (`HELLO`) 표현 방법 | 미확인 | | | |
| 칭찬 반응 (`REACT,OK`) 표현 방법 | 미확인 | | | |
| 다시 반응 (`REACT,RETRY`) 표현 방법 | 미확인 | | | |
| 쉬는 자세 (`REST`) | 미확인 | | | |
| 손목·팔 등 손가락 외 관절 유무 | 확인됨 | 2026-11-06 | A | 공식 문서 기준 6번 서보 = 180° 팬틸트(손목 쪽 회전) 1개([AiHand 1장](https://docs.hiwonder.com/projects/AiHand/en/latest/docs/1.Getting_Ready.html), [5장](https://docs.hiwonder.com/projects/AiHand/en/latest/docs/5.Aihand_basic_games_lesson.html)). 공식 예제 소스에서 6번을 0°~180°, 이동 시간 300~500ms로 사용 (아래 부록 3). **실물로 6번은 아직 움직여 보지 않음 → 안전 범위 미확정** |
| 손목(6번) 실물 동작과 안전 범위 | 미확인 | 2026-11-06 | A | 실물 테스트: 6번이 90°↔95° 명령에 반응함. 테스트 코드 v6으로 `S,6,85` → `S,6,80` → `S,6,90` (각 2000ms) 이상 없음. 테스트 코드 v8 `THELLO`로 90→100→80→100→90 왕복을 이동 시간 500·400·300ms로 반복해 덜컥거림·떨림·지속음·케이블 당김 없음. **80°~100°, 이동 300ms까지는 실물 확인.** 이보다 넓은 범위는 미확인. **정면 기준 재확인 중**: 공식 문서는 90° = 처음 자세(정면), 180° = 왼쪽, 0° = 오른쪽([6.3](https://docs.hiwonder.com/projects/AiHand/en/latest/docs/6.AI_Vision_Games_Lesson.html)). 공식 제품 사진과 비교해 90°가 정상 정면일 가능성이 있어 결합 불량·고장으로 판단하지 않음. **90°를 임시 중립값으로 사용**, 각도 범위 확대·분해는 보류. 안전 범위는 확정 전 |
| 손목 테스트 중 설명되지 않은 현상 | 미확인 | 2026-11-06 | A | `S,6,90`·`S,6,100`에 반응이 없던 때가 있었음 (그때 손목 제한 없는 코드 또는 넓힌 LIMIT 상태였고, 보낸 명령 기록 없음). 이후 90°↔95°는 정상 반응. (`S,5,90`에서 손 전체가 돌았다는 관찰은 확인자 착각으로 정정, 5번 = 새끼 문제 없음) |
| 연속 동작 시 서보 발열·떨림 | 미확인 | | | |

## 3. 손모양별 로봇 재현 가능 여부

`src/data/poses.json`의 7개 손모양을 AIHand가 실제로 만들 수 있는지.
**안 되는 손모양은 프로그램 문제·루틴에서 빼야 한다** (STEP 1, STEP 4 담당 확인).

| name | code [엄지,검지,중지,약지,새끼] | 화면 이름 | 상태 | 날짜 | 확인 | 메모 (사진 링크, 비슷하게만 되는지 등) |
|---|---|---|---|---|---|---|
| `ROCK` | `00000` | 주먹(바위) | 확인됨 | 2026-11-06 | A | 실물 테스트 `FIST` (엄지 130°, 검지~새끼 50°) |
| `PAPER` | `11111` | 손바닥(보) | 확인됨 | 2026-11-06 | A | 실물 테스트 `OPEN` (엄지 50°, 검지~새끼 130°) |
| `V` | `01100` | 브이(가위) | 확인됨 | 2026-11-06 | A | 실물 테스트 `FIST` → `S,2,130,500` → `S,3,130,500` |
| `INDEX` | `01000` | 검지 하나 | 확인됨 | 2026-11-06 | A | 실물 테스트 `FIST` → `S,2,130,500` |
| `THREE` | `01110` | 손가락 셋 | 확인됨 | 2026-11-06 | A | 실물 테스트 `FIST` → `S,2,130,500` → `S,3,130,500` → `S,4,130,500`. 새끼가 약지에 딸려 펴지는 문제 없음 |
| `FOUR` | `01111` | 손가락 넷 | 확인됨 | 2026-11-06 | A | 실물 테스트 `FIST` → `S,2,130,500` → `S,3,130,500` → `S,4,130,500` → `S,5,130,500` |
| `THUMB` | `10000` | 엄지 척 | 확인됨 | 2026-11-06 | A | 실물 테스트 `FIST` → `S,1,50,500` |

### 정리: 손모양 7종 서보 각도 (STEP 1·STEP 4 담당 참고)

**7종 모두 AIHand로 재현됨 (2026-11-06, A 실물 테스트). 문제·루틴에서 뺄 손모양은 없다.**

- 서보 1~5 = 엄지·검지·중지·약지·새끼 (6번은 손목 팬틸트, 손모양에는 안 씀)
- 엄지(1번)만 방향이 반대: **엄지 접기 130° / 펴기 50°**, **검지~새끼 접기 50° / 펴기 130°**
- 웹 프로그램은 각도를 몰라도 된다. 지금처럼 `ctx.robot.showPose('V')`만 부르면, 펌웨어(#6)가 `POSE,V`를 받아 아래 각도로 움직인다

| name | code | 서보 1 엄지 | 서보 2 검지 | 서보 3 중지 | 서보 4 약지 | 서보 5 새끼 |
|---|---|---|---|---|---|---|
| `ROCK` | `00000` | 130 접기 | 50 접기 | 50 접기 | 50 접기 | 50 접기 |
| `PAPER` | `11111` | 50 펴기 | 130 펴기 | 130 펴기 | 130 펴기 | 130 펴기 |
| `V` | `01100` | 130 접기 | 130 펴기 | 130 펴기 | 50 접기 | 50 접기 |
| `INDEX` | `01000` | 130 접기 | 130 펴기 | 50 접기 | 50 접기 | 50 접기 |
| `THREE` | `01110` | 130 접기 | 130 펴기 | 130 펴기 | 130 펴기 | 50 접기 |
| `FOUR` | `01111` | 130 접기 | 130 펴기 | 130 펴기 | 130 펴기 | 130 펴기 |
| `THUMB` | `10000` | 50 펴기 | 50 접기 | 50 접기 | 50 접기 | 50 접기 |

테스트 때 쓴 명령(`OPEN`, `FIST`, `S,<서보>,<각도>,<ms>`)은 **테스트 코드 전용**이다. 프로토콜 v1(`docs/protocol.md`)의 정식 명령이 아니므로 웹 코드에서 쓰지 않는다. 정식 명령은 `POSE,<이름>`이다.

## 4. WonderCam (STEP 3 색깔 카드)

STEP 3에서는 사용자가 **색깔 카드**(빨강·파랑·노랑·초록)를 AIHand의 WonderCam에 보여준다.
카드를 어떻게 인식할지는 아직 정하지 않았다. 아래 두 방식 중 확인되는 쪽으로 정한다.
웹 프로그램은 어느 방식이든 `ctx.card.onCard({ color })`로 색만 받으므로 STEP 3 코드는 바뀌지 않는다.

| 방식 | 흐름 | 웹에서 바꿀 곳 | 상태 |
|---|---|---|---|
| A) AprilTag 태그 인식 | 카드에 태그 인쇄 → WonderCam이 태그 ID 인식 → micro:bit가 `TAG,<ID>` 전송 → 웹 `core/card`가 `tags.json`으로 ID→색 변환 | `src/core/card/tags.json`의 ID를 실제 태그 번호로 | 화면에 띄운 태그로 확인됨, 종이 카드 미확인 |
| B) WonderCam 색상 인식 | 카드 색 자체를 WonderCam이 인식 → micro:bit가 색을 전송 → 웹은 변환 없이 색 사용 | 프로토콜에 색 전송 줄 추가 (`protocol.js`·`firmware/`·`docs/protocol.md`), `tags.json` 불필요 | 모니터에서 초록↔파랑 혼동, 종이 카드 미확인 |

| 항목 | 상태 | 날짜 | 확인 | 방법·메모 |
|---|---|---|---|---|
| WonderCam이 micro:bit에 연결되어 MakeCode에서 쓸 수 있음 | 확인됨 | 2026-11-06 | A | 실물 테스트. **I2C 연결, 주소 0x32**(공식 확장 [Hiwonder/WonderCam](https://github.com/Hiwonder/WonderCam) 기본값). 테스트 코드 CAM1(부록 6)이 0번 레지스터 `'v'` 응답으로 카메라를 찾고 현재 기능 번호를 읽음. 연결 포트: AIHand에 **처음부터 장착·연결된 상태**로 받았고 따로 꽂지 않음(제품 조립 상태 그대로 사용). I2C라서 USB 시리얼 통로(1번 표 마지막 줄)와 겹치지 않음 |
| micro:bit에서 WonderCam 기능(모드) 전환 | 확인됨 | 2026-11-06 | A | 실물 테스트. `MODE,TAG` → 기능 번호 10(숫자 인식) → 7(AprilTag), `MODE,COLOR` → 5(색상 인식). 시연 때 카메라 메뉴를 손으로 맞출 필요 없이 펌웨어가 켜질 때 모드를 정하면 됨 |
| 태그(AprilTag) 인식 가능 여부와 ID 값 얻기 (방식 A) | 확인됨 | 2026-11-06 | A | 실물 테스트. 태그 종류 **tag36h11**([공식 문서](https://docs.hiwonder.com/projects/AiNova/en/latest/docs/6.AI_Vision_lesson.html)). [AprilRobotics 이미지](https://github.com/AprilRobotics/apriltag-imgs/tree/master/tag36h11) ID 0~3을 **모니터에 띄워** 약 20~30cm에서 보여줌 → 4개 모두 맞는 ID, 다른 번호 오인식 없음. 두 태그가 함께 보이면 두 ID 모두 보고됨(`0 1`). **같은 태그를 계속 보여줘도 0.17~0.34초씩 `NONE`으로 끊김**(결과 읽기 주기 약 0.17초) → 부록 6 펌웨어 반영 사항 |
| 색상 인식으로 4색 카드를 구분 (방식 B) | 부분 가능 | 2026-11-06 | A | 실물 테스트, **모니터 기준 참고 결과**. 카메라에서 ID 1 빨강·2 파랑·3 노랑·4 초록을 모니터 색(`src/data/colors.json`과 같은 색)으로 학습 후 한 색씩 비춤 → 빨강 `1`, 파랑 `2`, 노랑 `3`은 정확하고 끊김 없음. **초록은 `2 4`(파랑으로도 인식)**. 노랑↔초록 혼동은 없었음. 한때 파랑도 `2 4`로 나왔다가 보조등 조치 후 `2`만 나옴. 색 학습은 카메라 레버로 직접 함(공식 문서는 사용 전 학습하라고 안내). 색상 인식은 **화면에 보이는 같은 색 물건을 모두 보고**함(테스트 화면의 색 버튼까지 함께 인식된 적 있음). **종이 카드로는 미확인** [검증 필요] |
| WonderCam 보조등 끄기 | 안 됨 | 2026-11-06 | A | 실물 테스트. 공식 확장 `TurnOnOrOffLed(OFF)`(레지스터 0x30) 명령은 보냈지만 보조등이 꺼지지 않음. 카메라 메뉴 System Settings → **Fill light brightness를 0으로 하면 밝기는 줄지만 완전히 꺼지지는 않음**(실물 테스트). 이 조치 뒤 파랑은 `2`만 인식됨, 초록 혼동은 그대로 |
| **인식 결과(태그 ID 또는 색)를 micro:bit가 받아 시리얼로 전달** | 확인됨 | 2026-11-06 | A | 실물 테스트. CAM1이 인식 결과가 바뀔 때마다 `SEE,TAG,<개수>,<ID들>` / `SEE,COLOR,<개수>,<ID들>`을 USB 시리얼로 보냄. 정식 프로토콜(`TAG,<ID>`)은 #6에서 구현 |
| 카드 방식 결정 (A 또는 B) | 임시 결정: A | 2026-11-06 | A | **방식 A(AprilTag tag36h11) 임시 결정**, 팀 확인 필요(`docs/meetings/2026-11-06.md`). 근거: 위 태그·색상 줄. 종이 카드 테스트에서 문제없으면 확정, 잘 안 읽히면 방식 B 재검토. 확정 후 `core/card/serial.js` TODO·`tags.json` 정리 |
| 실내 조명에서 인식 거리·각도 | 미확인 | | | 종이 카드로 확인 |
| 로봇 동작 중에도 카드 인식이 동시에 되는지 | 미확인 | | | CAM1(서보 없음)과 서보 테스트 코드 v8을 합친 코드 필요 |

## 5. 웹캠 손 인식 (MediaPipe)

| 항목 | 상태 | 날짜 | 확인 | 방법·메모 |
|---|---|---|---|---|
| 시연 노트북 웹캠으로 Hand Landmarker가 실시간 동작 (fps) | 미확인 | | | |
| 7개 손모양을 5비트 code로 구분하는 정확도 | 미확인 | | | 특히 `THUMB`, `THREE`, `FOUR` |
| 고령자 손(굽은 손가락 등)에서 인식 | 미확인 | | | |
| 인터넷 없이 모델 파일을 로컬에서 불러오기 | 미확인 | | | 시연장 네트워크 대비 |

## 부록 1: 연결 테스트 방법

"1. 연결"을 다시 확인할 때 쓴다. 실제 펌웨어(`firmware/`)가 아니라 테스트용 코드다.

1. https://makecode.microbit.org 새 프로젝트 → JavaScript 탭에 아래 코드 붙여 넣기 → 다운로드
2. **MakeCode 탭을 닫는다** (MakeCode가 시리얼 포트를 잡고 있으면 다른 페이지에서 못 연다)
3. Chrome에서 https://googlechromelabs.github.io/serial-terminal/ → Baud rate 115200, Local echo·Convert EOL 체크, Flush on enter·Automatically connect 해제 → Connect
4. `TICK,1`, `TICK,2`…가 2초마다 보이면 micro:bit → 웹 정상
5. Enter 한 번(남은 글자 비우기) → `PING` 입력 → Enter → `PONG`이 오면 웹 → micro:bit 정상
6. `ERR,...`가 오면 `CODES=` 뒤 숫자로 어떤 글자가 들어왔는지 확인 (`PING` = `80 73 78 71`)

```js
serial.redirectToUSB()
serial.setBaudRate(BaudRate.BaudRate115200)
basic.showIcon(IconNames.Yes)
basic.pause(500)
basic.clearScreen()
let buf = ""
let n = 0
basic.forever(function () {
    let s = serial.readString()
    for (let i = 0; i < s.length; i++) {
        led.toggle(0, 0)   // 글자를 받을 때마다 왼쪽 위 LED 깜빡임
        let c = s.charAt(i)
        if (c == "\n" || c == "\r") {
            if (buf == "PING") {
                serial.writeLine("PONG")
            } else if (buf.length > 0) {
                let codes = ""
                for (let j = 0; j < buf.length; j++) {
                    codes = codes + buf.charCodeAt(j) + " "
                }
                serial.writeLine("ERR," + buf + ",LEN=" + buf.length + ",CODES=" + codes)
            }
            buf = ""
        } else {
            buf = buf + c
        }
    }
    basic.pause(20)
})
loops.everyInterval(2000, function () {
    n += 1
    serial.writeLine("TICK," + n)
})
```

## 부록 2: 서보 테스트 방법 (확장보드 장착)

"1. 연결"의 전원·시리얼 전환, "2. AIHand 동작", "3. 손모양"을 확인할 때 쓴다. 실제 펌웨어(`firmware/`)가 아니라 테스트용 코드다.

**환경 (2026-11-06 테스트):** Chrome + Serial Terminal, micro:bit V2, Hiwonder AIHand(흰색 확장보드), DC 7.5V 3A 어댑터

1. 확장보드 전원 스위치를 끈다 → micro:bit를 확장보드에 꽂는다 (USB는 노트북에 연결한 채) → 어댑터 확인 후 전원을 켠다
2. MakeCode 새 프로젝트 → **Hiwonder 확장은 추가하지 않고** 아래 코드만 붙여 넣기 → 다운로드 → MakeCode 탭 닫기
3. 터미널 설정은 부록 1과 같다 (115200, Flush on enter 해제)
4. 아래 명령을 순서대로 입력

| 입력 | 결과 (2026-11-06) |
|---|---|
| `PING` | `PONG` |
| `OPEN` | 손가락 5개 모두 펴짐 |
| `FIST` | 손가락 5개 모두 접힘 |
| `S,2,50,500` | 검지만 접힘 |
| `S,2,130,500` | 검지만 펴짐 |
| `S,2,50,2000` | 검지가 2초에 걸쳐 천천히 접힘 |
| 손모양 5종 (`FIST` 뒤 손가락 펴기) | `THUMB`, `INDEX`, `V`, `THREE`, `FOUR` 모두 재현 (명령 순서는 "3. 손모양" 표 메모) |

`OPEN`·`FIST`·`S` 명령 모두 `DONE,OPEN`·`DONE,FIST`·`DONE,S` 응답을 받았다.

- `S,<서보번호>,<각도>,<이동시간ms>`: 서보 하나만 움직인다. 서보 1~5 = 엄지~새끼
- 손가락이 이미 목표 각도에 있으면 움직이지 않으니, 개별 테스트는 `OPEN` 뒤에 한다
- 서보 명령 형식은 [StartbitV2 확장](https://github.com/Hiwonder/StartbitV2)의 `setPwmServo`(180° 범위)를 그대로 옮긴 것

```js
// 확장보드 서보 명령 (StartbitV2 setPwmServo와 같은 형식, 180도 범위)
function servo(index: number, angle: number, ms: number) {
    let pos = Math.round(angle * 2000 / 180 + 500)
    let b = pins.createBuffer(10)
    b[0] = 0x55; b[1] = 0x55; b[2] = 0x08; b[3] = 0x03; b[4] = 0x01
    b[5] = ms & 0xff; b[6] = (ms >> 8) & 0xff
    b[7] = index; b[8] = pos & 0xff; b[9] = (pos >> 8) & 0xff
    serial.writeBuffer(b)
}
function toBoard() { serial.redirect(SerialPin.P12, SerialPin.P8, BaudRate.BaudRate115200) }
function toUSB() { serial.redirectToUSB() }
function hand(thumb: number, other: number, ms: number) {
    toBoard()
    servo(1, thumb, ms)
    for (let i = 2; i <= 5; i++) servo(i, other, ms)
    basic.pause(5)
    toUSB()
    basic.pause(ms + 100)
}

toUSB()
basic.showIcon(IconNames.Yes)
let buf = ""
basic.forever(function () {
    let s = serial.readString()
    for (let i = 0; i < s.length; i++) {
        let c = s.charAt(i)
        if (c == "\n" || c == "\r") {
            let p = buf.split(",")
            if (buf == "PING") serial.writeLine("PONG")
            else if (buf == "OPEN") { hand(50, 130, 500); serial.writeLine("DONE,OPEN") }
            else if (buf == "FIST") { hand(130, 50, 500); serial.writeLine("DONE,FIST") }
            else if (p[0] == "S" && p.length == 4) {
                // S,<서보번호>,<각도>,<ms>  예: S,2,50,500
                let ms = parseInt(p[3])
                toBoard(); servo(parseInt(p[1]), parseInt(p[2]), ms); basic.pause(5); toUSB()
                basic.pause(ms + 100)
                serial.writeLine("DONE,S")
            }
            else if (buf.length > 0) serial.writeLine("ERR," + buf)
            buf = ""
        } else buf = buf + c
    }
    basic.pause(20)
})
```

## 부록 3: 공식 예제 분석 (동작 설계 근거)

Hiwonder 공식 예제 `.hex`([6장 예제 zip](https://docs.hiwonder.com/projects/AiHand/en/latest/_static/source_code/ai_vision_games_lesson.zip), [5장 예제 zip](https://docs.hiwonder.com/projects/AiHand/en/latest/_downloads/1d70d145819cdfbad6ebed73ae9ba5a0/aihand_basic_games_lesson.zip))에 들어 있는 MakeCode 소스를 꺼내 확인했다 (2026-11-06, A). **공식 소스 기준이며 실물 테스트가 아니다.**

### 6.7 Face Recognition (`02 Face Recognition Program.hex`)

[문서 6.7](https://docs.hiwonder.com/projects/AiHand/en/latest/docs/6.AI_Vision_Games_Lesson.html)

| 상황 | 동작 (소스 그대로) |
|---|---|
| 시작 | 서보 1~6 모두 90°, 500ms → 0.6초 대기 (반쯤 쥔 자세) |
| 등록된 얼굴 | 아래를 **2번 반복**: 1번 130°·2~5번 50° (300ms) → 0.5초 대기 → 1~5번 모두 **90°** (300ms) → 0.5초 대기. **손목(6번)은 움직이지 않음** |
| 등록 안 된 얼굴 | 6번 135° (300ms) → 0.5초 → 6번 45° (300ms) → 0.5초, **2번 반복** → 6번 90° (500ms) → 0.8초 |
| 얼굴 없음 | 서보 1~6 모두 90° (500ms) → 0.8초 |

- 등록된 얼굴 동작은 "주먹 → 손바닥" 반복이 아니라 **"주먹 → 반쯤 쥔 자세(90°)" 반복**이다. 손가락을 끝까지 펴지 않는다.
- 이동 300ms 뒤 0.5초 대기이므로 각 자세에서 약 0.2초 멈춘다. 한 번 반복에 약 1초, 2번에 약 2초.
- 실제 예제는 `forever` 안에 있어서 얼굴이 보이는 동안 이 2번 반복이 계속 이어진다.

### 6번(손목) 서보를 쓰는 공식 예제

| 예제 | 6번 각도 | 이동 시간 |
|---|---|---|
| Face Recognition | 45 ↔ 135, 복귀 90 | 300ms, 복귀 500ms |
| Landmark Recognition | 0, 180, 45 ↔ 135 | 500ms, 300ms |
| Waste Sorting | 0, 45, 135, 180 (각각 90으로 복귀) | 500ms |
| Color Recognition | 0, 180 | 500ms |
| Color Tracking / Face Detection | 추적용으로 조금씩 변경 | 5ms / 20ms 단위 |

공식 예제는 0°~180° 전체를 쓰지만, **우리 기구에서의 안전 범위는 실물 테스트 전까지 확정하지 않는다** (케이블 꼬임·간섭 확인 필요).

## 부록 4: 테스트 코드에서 배운 점 (정식 펌웨어 #6 요구 사항)

2026-11-06 손목 테스트 중 확인한 것. 실제 펌웨어(`firmware/`)를 만들 때 반영한다.

| 확인한 것 | 펌웨어·웹에 반영할 것 |
|---|---|
| `DONE`은 시간 기준이라 서보가 막히거나 안 움직여도 온다 | 웹은 `DONE`을 "명령 처리 끝"으로만 해석한다. 화면 문구도 "로봇이 동작을 마쳤어요" 수준으로 쓰고, 위치 도달을 판정하지 않는다 |
| 터미널은 백스페이스·한글도 그대로 보내고, `parseInt`는 숫자가 아닌 글자 앞까지만 읽는다 (`S,6,100⌫⌫10` → 100) | 숫자 칸은 0~9만 허용하고 아니면 `ERR` (테스트 코드의 `isNum`) |
| 확장보드 전원만 껐다 켜면 micro:bit는 USB 전원으로 계속 켜져 있어 변수(LIMIT 등)가 초기화되지 않는다 | 안전 범위는 실행 중 바꿀 수 없는 상수로 둔다 |
| 범위를 실행 중 넓히는 명령(`LIMIT`)을 여러 번 보내면 어떤 상태인지 알 수 없게 된다 | 정식 프로토콜에 각도 직접 지정·범위 변경 명령을 넣지 않는다 (`POSE,<이름>` 등 정해진 동작만) |
| 손목(6번)은 손가락보다 위험 (손 전체 회전, 케이블) | 손목 각도는 펌웨어에서 고정 범위로 제한, 천천히(이동 시간 길게) |
| 통로 전환 전 대기 5ms는 50바이트(서보 5개) 전송에 빠듯 | 전송 후 충분히 기다린 뒤(테스트 코드는 30ms) USB로 되돌린다 |
| 확장보드는 micro:bit 쪽으로 상태 메시지 `A<6자리 16진수>$`를 계속 보낸다 (예: `A05595C$`). 통로를 확장보드로 돌린 동안 받은 이 글자가 USB로 되돌린 뒤 다음 입력 앞에 붙어 `ERR,A05595E$REST`처럼 명령이 깨졌다 (v6 실물 테스트) | 통로를 USB로 되돌린 직후 받은 글자를 버리고, `$`가 나오면 그때까지의 글자를 버린다 (테스트 코드 v7). 공식 확장 소스 기준 마지막 2자리 × 78.63 = 전원 전압(mV) 추정 (`5C` → 약 7.2V, 실물 미검증) |
| `VER` 명령으로 어떤 코드가 올라가 있는지 확인할 수 있어 진단이 쉬웠다 | 정식 펌웨어도 버전 확인 수단을 둔다 (프로토콜 변경이므로 `protocol.js`·`docs/protocol.md`와 함께 논의) |

## 부록 5: 로봇 반응 동작 설계 (2026-11-06 확정)

`HELLO`, `REACT,OK`, `REACT,RETRY`, `REST`의 동작 설계다. 후보를 실물로 테스트한 뒤 **2026-11-06 A가 아래와 같이 확정**했다. 정식 펌웨어(#6) 구현 때 `docs/protocol.md`·`src/core/robot/protocol.js`·`firmware/`에 함께 반영한다.

### 확정안

| 명령 | 동작 | 각도·시간 (보통 속도) | 전체 시간 |
|---|---|---|---|
| `REST` | 손가락·손목 모두 90° | `[90, 90, 90, 90, 90]`, 손목 90, 이동 500 | 약 0.6초 |
| `REACT,OK` | 공식 Face Recognition 동작: 주먹 ↔ 반쯤 쥔 자세 2번 | `[130, 50, 50, 50, 50]` ↔ `[90 ×5]`, 이동 300 / 대기 500 | 약 2.0초 |
| `REACT,RETRY` | R3 물결: 손바닥 → 새끼부터 검지까지 차례로 90°로 접었다 차례로 펴기 → REST | 손바닥 이동 500, 손가락마다 이동 400·간격 약 0.15초 | 약 3.0초 |
| `HELLO` | H2 손목 흔들기: 손바닥 편 채 손목 90 → 100 → 80 → 100 → 90 → REST | 손목 이동 300 / 대기 400 | 약 2.8초 |
| `SPEED,SLOW` | 모든 이동·대기 시간 ×2 (`SPEED,NORMAL`은 ×1) | POSE 이동 500 → 1000 | |

- 손목 각도는 실물 확인된 80°~100°만 쓴다. 90°는 임시 중립값
- 마지막 대기까지 끝난 뒤 `DONE`을 보낸다 (시간 기준)
- 아래 후보 비교와 테스트 기록은 설계 근거로 남긴다

### 설계 과정

**1차 실물 테스트 대상 (2026-11-06 A 선택):** `REACT,OK` = 공식 동작, `REACT,RETRY` = **R3 물결**, `HELLO` = **H2 손목 흔들기**, `REST` = 전부 90°. 테스트 전 진단 코드 v5 실행 중임을 `VER`로 확인함. 테스트 코드는 v6(`VER,DIAG6,...`)을 쓴다.

### 설계 원칙

- 각도는 오늘 실물로 확인한 값만 쓴다: 손가락 50°~130° (엄지 접기 130 / 펴기 50, 검지~새끼 접기 50 / 펴기 130, 90 = 반쯤 쥔 자세), 손목은 90°(임시 중립) 근처
- **POSE 7종과 구분**: POSE는 한 손모양에서 "멈춰 있는" 동작이다. 반응 동작은 모두 **반복해서 움직이고**, 마지막에 `REST`(전부 90°)로 끝나서 POSE 손모양으로 멈추지 않는다. 엄지 척(`THUMB`)·브이(`V`)·검지(`INDEX`) 모양으로 멈추는 동작은 쓰지 않는다
- **세 반응끼리 구분**: OK = 빠르게 **쥐기** 2번 / HELLO = 편 채로 **까딱** 2번 / RETRY = 천천히 **한 번 펴기**
- 검지를 좌우로 흔드는 동작(꾸짖는 느낌)은 쓰지 않는다
- 펌웨어는 마지막 대기까지 끝난 뒤 `DONE`을 보낸다 (`DONE`은 시간 기준, 도착 확인 아님)

표기: `[엄지, 검지, 중지, 약지, 새끼]` 각도, `이동 ms` 동안 움직인 뒤 `대기 ms`까지 기다림 (대기는 이동 시간 포함, 공식 예제 방식)

### REACT,OK: 공식 Face Recognition 동작 그대로 (후보 1개)

| 순서 | 자세 | 각도 | 이동 | 대기 |
|---|---|---|---|---|
| 1 | 주먹 | `[130, 50, 50, 50, 50]` | 300 | 500 |
| 2 | 반쯤 쥔 자세 | `[90, 90, 90, 90, 90]` | 300 | 500 |
| 3~4 | 1~2 한 번 더 | | | |

보통 속도 약 2.0초. 손목은 움직이지 않음(공식과 같음). 끝 자세가 `REST`와 같다.

### REACT,RETRY: "괜찮아요, 다시 해 볼까요?"

| 후보 | 동작 | 보통 속도 | 느낌 | OK와 구분 | 걱정되는 점 |
|---|---|---|---|---|---|
| **R1 천천히 펴기 (추천)** | REST → 손바닥 `[50,130,130,130,130]` 이동 1000 → 0.4초 멈춤 → REST 이동 1000 | 약 2.4초 | 손을 펴 보이며 "괜찮아요" | 펴는 동작·느림·1번 → 가장 잘 구분됨 | 중간에 잠깐 `PAPER` 모양이 보임 (0.4초, 곧 REST로 돌아가 POSE로 오해될 가능성 낮음) |
| R2 손짓 "이리 와요" | 엄지 90 유지, 검지~새끼 130 → 70 → 130 을 2번 (각 이동 600) → REST | 약 3.4초 | "자, 한 번 더 해 봐요" 부르는 손짓 | 엄지는 안 움직이고 느림 | 손가락을 오므리는 동작이라 OK와 비슷하게 보일 수 있음 |
| R3 물결 | 손바닥에서 새끼 → 검지 순서로 90까지 차례로 접었다(0.15초 간격, 이동 400) 다시 차례로 펴기 → REST | 약 3.0초 | 부드럽게 기다리는 느낌 | 손가락이 차례로 움직여 모양이 전혀 다름 | 앉은 거리에서 잘 안 보일 수 있음. 서보 명령 순서·간격 실물 확인 필요 |
| W1 손목 "갸웃" (손목 대체안) | REST 그대로, 손목 90 → 100 (이동 800) → 0.6초 멈춤 → 90 (이동 800) | 약 2.2초 | 고개를 갸웃하는 느낌 | 손가락이 안 움직임 | 10°라 작게 보일 수 있음. 손목 800ms 이동은 실물 미검증 (진단 코드 v5는 1500ms 이상만 허용) |

### HELLO: 인사

| 후보 | 동작 | 보통 속도 | 느낌 | 걱정되는 점 |
|---|---|---|---|---|
| **H1 손가락 까딱 (기본안, 추천)** | REST → 손바닥 (이동 500) → 검지~새끼 130 → 90 → 130 을 2번 (각 이동 300, 대기 400), 엄지는 편 채 → REST (이동 500) | 약 2.6초 | 손바닥을 펴고 "안녕" 까딱 | 확인된 각도만 사용 |
| H2 손목 흔들기 (확장안) | REST → 손바닥 → 손목 90 → 100 → 80 → 100 → 90 (각 이동 300, 처음 안은 600) → REST | 약 2.8초 | 손을 흔드는 인사 (공식 예제는 45°↔135°) | ±10°는 작아 보일 수 있음. 손목 600ms 이동·80°는 v5 제한 밖이라 **실물 미검증**. 더 크게 흔들려면 정면 기준 확인과 안전 범위 확인이 먼저 |

### REST: 쉬는 자세

| 동작 | 각도 | 이동 | 확인할 것 |
|---|---|---|---|
| 손가락·손목 모두 90° (공식 예제의 시작 자세) | `[90, 90, 90, 90, 90]`, 손목 90 | 500 | 2026-11-06 실물 테스트 (v6 `TREST`): 1분 유지 이상 없음. 더 긴 시간·연속 사용은 미확인 |

### 1차 실물 테스트 결과 (2026-11-06, A, 테스트 코드 v7·v8)

| 동작 | 테스트 명령 | 결과 |
|---|---|---|
| `REST` | `TREST` | 정상. 1분 유지 이상 없음 |
| `REACT,OK` (공식 동작) | `TOK` | SLOW·NORMAL 정상 |
| `REACT,RETRY` (R3 물결) | `TRETRY` | SLOW·NORMAL 정상 |
| `HELLO` (H2 손목 흔들기) | `THELLO` | SLOW·NORMAL 정상. 손목 이동 600ms는 느리게 느껴짐 → 500·400·300ms 시험, 모두 이상 없음. **300ms가 가장 자연스러움** (공식 예제와 같은 이동 시간) |

H2를 300ms로 하면 보통 속도 약 2.8초 (손바닥 0.6 + 흔들기 4 × 0.4 + REST 0.6), SLOW 약 5.6초.

사용자 관점 확인 (2026-11-06, A, 실물): 앉은 거리에서 `HELLO`·`REACT,OK`·`REACT,RETRY` 세 동작이 서로 잘 구분되고, POSE 7종과 헷갈리지 않음.

아직 확인하지 않은 것: 연속 반복 시 발열 (`OPEN`/`FIST` 50회 테스트와 함께).

### 세 반응 구분표 (추천안 기준)

| | HELLO (H1) | REACT,OK | REACT,RETRY (R1) | POSE 7종 |
|---|---|---|---|---|
| 손가락 움직임 | 편 채 검지~새끼 까딱 | 다섯 손가락 모두 쥐기 | 한 번 천천히 펴기 | 한 손모양으로 이동 |
| 엄지 | 편 채 고정 | 함께 쥠 | 함께 펴짐 | 손모양에 따라 |
| 반복 | 2번 | 2번 | 1번 | 없음 |
| 빠르기 | 보통 (300ms) | 빠름 (300ms) | 느림 (1000ms) | 500ms |
| 끝 자세 | REST | REST | REST | 그 손모양에서 멈춤 |
| 손목 | 안 씀 | 안 씀 | 안 씀 | 안 씀 |

### 속도 (`SPEED,SLOW` / `SPEED,NORMAL`) 제안

- NORMAL: 위 표의 시간 그대로. POSE는 이동 500ms
- SLOW: **모든 이동·대기 시간 ×2** (POSE 1000ms, OK 약 4.0초, HELLO 약 5.2초, RETRY 약 4.8초)
- 서보 이동 시간 값으로 속도를 바꾸는 방식은 실물로 확인됨 (500ms·2000ms). 각 동작을 SLOW로 했을 때 보기 좋은지는 미확인

### 다음 실물 테스트 절차 (설계 후보 확인)

1. **먼저 `VER`를 보내 올라가 있는 코드와 안전 제한을 확인한다.**
   - 지금 진단 코드 v5라면 `VER,DIAG5,W,90,100`이 와야 한다 (`ERR,MS,1500-3000` 응답은 v5에만 있으므로 최근에 v5가 올라갔을 가능성이 높다)
   - 후보 동작용 테스트 코드는 새 버전으로 만들고, 그 버전의 `VER` 응답 값을 절차에 적는다
   - 응답이 기대값과 다르거나 없으면 **테스트하지 않고** 코드를 다시 올린다
2. 안전 제한이 걸려 있는지 확인: 범위 밖 명령(예: `S,6,110,2000`)을 보내 `ERR,RANGE`가 오는지 본다
3. 오타가 나면 지우지 말고 Enter로 그 줄을 버린 뒤 다시 입력한다
4. 후보 동작을 하나씩 실행하고, 각 동작 뒤 `DONE`을 받은 다음 지속음·발열·간섭을 확인한다
5. 결과를 이 부록 표에 기록하고, 확정된 동작만 `docs/protocol.md`와 #6 펌웨어에 반영한다

## 부록 6: WonderCam 테스트 방법과 결과 (2026-11-06, A, 테스트 코드 CAM1)

실제 펌웨어(`firmware/`)가 아니라 테스트용 코드다. 서보는 움직이지 않는다.

### 준비

1. WonderCam을 확장보드 I2C 포트에 꽂고 외부 어댑터 전원을 켠다
2. MakeCode 새 프로젝트 → 톱니바퀴 → 확장 → `https://github.com/Hiwonder/WonderCam` 추가
3. JavaScript 탭에 아래 코드 전체를 붙여 넣고 다운로드 → **MakeCode 탭을 닫는다**
4. Serial Terminal 115200 연결 (부록 1과 같은 설정). micro:bit 화면 ✔ = 카메라 찾음, ✖ = 못 찾음
5. 카메라 메뉴가 중국어면: 왼쪽 레버로 系统设置(System Settings) → 오른쪽 레버 누르기 → 语言(Language) → English 선택 → 확인 → 자동 재시작

### 명령

| 보내기 | 응답 |
|---|---|
| `VER` | `VER,CAM1,USB115200,I2C0x32,NOSERVO` |
| `INFO` | `INFO,FUNC=<번호>,<COLOR/TAG/OTHER>` (5 = 색상, 7 = AprilTag, 10 = 숫자 인식) |
| `MODE,TAG` / `MODE,COLOR` | `DONE,MODE,FUNC=<번호>` |
| `LED,ON` / `LED,OFF` | `DONE,LED,...` (실제로 꺼지지 않음, 4번 표) |
| (자동) | 인식 결과가 바뀔 때마다 `SEE,TAG,<개수>,<ID들>,t=<ms>` 또는 `SEE,COLOR,...`, 없으면 `NONE` |

### 색 학습 방법 (방식 B)

카메라를 Color Recognition 화면에 두고 → 오른쪽 레버를 왼쪽으로 밀어 학습 화면(`+`, `Color ID:1`) → `+`를 색에 맞추고 흰 테두리가 잡히면 오른쪽 레버를 왼쪽으로 밀어 학습 → 성공하면 오른쪽 레버 누르기. ID 1 빨강, 2 파랑, 3 노랑, 4 초록. 학습 화면에서 나갈 때 확인 창에서 **Yes**(No는 변경 내용을 버림).

### 테스트에서 배운 점 (정식 펌웨어 #6·`core/card` 반영 사항)

| 확인한 것 | 반영할 것 |
|---|---|
| 공식 `wondercam_init`은 카메라를 못 찾으면 `E`를 띄우며 무한 대기한다 | 펌웨어는 먼저 0번 레지스터로 연결을 확인하고, 못 찾으면 `ERR,CAM` 같은 응답을 보낸 뒤 로봇 기능은 계속 동작하게 한다 (프로토콜 변경이므로 함께 논의) |
| 태그가 계속 보여도 0.17~0.34초씩 끊긴다 (모니터 기준) | 같은 ID가 몇 번 연속 보이면 `TAG,<ID>`를 **한 번만** 보내고, 일정 시간(예: 0.5초) 넘게 안 보여야 사라진 것으로 친다. 값은 종이 카드 테스트 후 정함 (C의 "스치듯 보여준 카드" 결정과 연결) |
| 여러 태그·여러 색이 한 번에 보고된다 | 시연 안내: 보여주는 카드 외의 카드는 카메라에 보이지 않게 둔다. 방식 B면 가장 큰 색 덩어리 하나만 답으로 치는 규칙 필요 (공식 확장에 크기 읽기 기능 있음) |
| 모드 전환 중에도 결과 읽기가 돌아 `DONE` 전에 결과가 출력됐다 | 모드 전환 중에는 결과를 보내지 않는다 |
| 터미널은 방향키도 ESC 글자(`27 91 66` = ↓)로 보내 명령이 깨진다 | 손으로 칠 때만 해당. 입력 칸은 마우스로 클릭 |

### CAM1 코드

```js
// WonderCam 검증용 테스트 코드 CAM1 (정식 펌웨어 아님)
// 준비: MakeCode 확장에서 https://github.com/Hiwonder/WonderCam 추가 → JavaScript 탭에 전체 붙여 넣기
// 서보는 움직이지 않는다. 시리얼 통로는 USB만 쓴다 (WonderCam은 I2C).
//
// 명령 (Serial Terminal, 115200):
//   VER          버전
//   PING         → PONG
//   INFO         WonderCam 현재 기능 번호 (5=색상, 7=AprilTag)
//   MODE,TAG     AprilTag 모드로 전환
//   MODE,COLOR   색상 인식 모드로 전환
//   LED,ON / LED,OFF   보조등
// 자동 출력: 보이는 대상이 바뀔 때마다
//   SEE,TAG,<개수>,<ID들>,t=<ms>      예) SEE,TAG,1,3,t=12345
//   SEE,COLOR,<개수>,<ID들>,t=<ms>    예) SEE,COLOR,1,2,t=12345
//   없으면 개수 0, ID 칸은 NONE

const CAM_ADDR = 0x32
let camOk = false
let lastSeen = ""
let buf = ""

serial.redirectToUSB()
serial.setBaudRate(BaudRate.BaudRate115200)

// 연결 확인: 0번 레지스터가 'v'(118)이면 WonderCam
// (공식 wondercam_init 은 못 찾으면 E를 띄우며 무한 대기하므로 직접 확인)
function camAlive(): boolean {
    let req = pins.createBuffer(2)
    req.setNumber(NumberFormat.UInt8LE, 0, 0)
    req.setNumber(NumberFormat.UInt8LE, 1, 0)
    pins.i2cWriteBuffer(CAM_ADDR, req)
    let r = pins.i2cReadBuffer(CAM_ADDR, 1)
    return r.getNumber(NumberFormat.UInt8LE, 0) == 118
}

function funcName(f: number): string {
    if (f == 5) return "COLOR"
    if (f == 7) return "TAG"
    return "OTHER"
}

basic.pause(1500) // WonderCam 부팅 대기
for (let k = 0; k < 10; k++) {
    if (camAlive()) {
        camOk = true
        break
    }
    basic.pause(500)
}
if (camOk) {
    wondercam.wondercam_init(wondercam.DEV_ADDR.x32)
    basic.showIcon(IconNames.Yes)
    serial.writeLine("CAM,OK,FUNC=" + wondercam.CurrentFunc())
} else {
    basic.showIcon(IconNames.No)
    serial.writeLine("CAM,NOT_FOUND")
}

function handle(cmd: string) {
    if (cmd == "VER") {
        serial.writeLine("VER,CAM1,USB115200,I2C0x32,NOSERVO")
    } else if (cmd == "PING") {
        serial.writeLine("PONG")
    } else if (!camOk) {
        serial.writeLine("ERR,CAM_NOT_FOUND")
    } else if (cmd == "INFO") {
        let f = wondercam.CurrentFunc()
        serial.writeLine("INFO,FUNC=" + f + "," + funcName(f))
    } else if (cmd == "MODE,TAG") {
        wondercam.ChangeFunc(wondercam.Functions.AprilTag)
        lastSeen = ""
        serial.writeLine("DONE,MODE,FUNC=" + wondercam.CurrentFunc())
    } else if (cmd == "MODE,COLOR") {
        wondercam.ChangeFunc(wondercam.Functions.ColorDetect)
        lastSeen = ""
        serial.writeLine("DONE,MODE,FUNC=" + wondercam.CurrentFunc())
    } else if (cmd == "LED,ON") {
        wondercam.TurnOnOrOffLed(wondercam.LED_STATE.ON)
        serial.writeLine("DONE,LED,ON")
    } else if (cmd == "LED,OFF") {
        wondercam.TurnOnOrOffLed(wondercam.LED_STATE.OFF)
        serial.writeLine("DONE,LED,OFF")
    } else {
        let codes = ""
        for (let j = 0; j < cmd.length; j++) {
            codes = codes + cmd.charCodeAt(j) + " "
        }
        serial.writeLine("ERR," + cmd + ",LEN=" + cmd.length + ",CODES=" + codes)
    }
}

// 명령 받기 (오타는 지우지 말고 Enter로 버리기)
basic.forever(function () {
    let s = serial.readString()
    for (let i = 0; i < s.length; i++) {
        let c = s.charAt(i)
        if (c == "\n" || c == "\r") {
            if (buf.length > 0) handle(buf)
            buf = ""
        } else {
            buf = buf + c
        }
    }
    basic.pause(20)
})

// 인식 결과 읽기: 100ms마다, 바뀔 때만 출력
basic.forever(function () {
    if (!camOk) {
        basic.pause(500)
        return
    }
    wondercam.UpdateResult()
    let f = wondercam.CurrentFunc()
    let line = ""
    if (f == 7) {
        let ids = ""
        let n = 0
        for (let id = 0; id < 30; id++) { // 카드용 태그는 0~29 안에서 고른다
            if (wondercam.isDetecteAprilTagId(id)) {
                ids = ids + (n > 0 ? " " : "") + id
                n += 1
            }
        }
        line = "SEE,TAG," + n + "," + (n > 0 ? ids : "NONE")
    } else if (f == 5) {
        let ids = ""
        let n = 0
        for (let id = 1; id <= 7; id++) {
            if (wondercam.isDetectedColorId(id)) {
                ids = ids + (n > 0 ? " " : "") + id
                n += 1
            }
        }
        line = "SEE,COLOR," + n + "," + (n > 0 ? ids : "NONE")
    } else {
        line = "SEE,FUNC=" + f + ",NOT_TAG_OR_COLOR"
    }
    if (line != lastSeen) {
        serial.writeLine(line + ",t=" + input.runningTime())
        lastSeen = line
    }
    basic.pause(100)
})
```
