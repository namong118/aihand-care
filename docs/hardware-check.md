# 하드웨어 검증 체크리스트

AIHand·WonderCam 기능 중 공식 문서와 실물로 **확인된 것만** 코드에서 "동작한다"고 가정한다.
확인 전 기능은 Mock으로 두고 코드 TODO에 `[검증 필요]`를 적는다.

- 상태: `미확인` → `확인됨` / `안 됨` / `부분 가능`
- 확인하면 **날짜, 확인한 사람(A/B/C/D), 방법(공식 문서 링크 또는 실물 테스트), 메모**를 적는다.
- 시연 구성: 노트북 1대 + AIHand 1대 (USB). 여러 대 연결은 확인하지 않는다.

## 1. 연결

| 항목 | 상태 | 날짜 | 확인 | 방법·메모 |
|---|---|---|---|---|
| micro:bit가 노트북 USB로 연결되고 Chrome Web Serial 포트 목록에 보임 | 확인됨 | 2026-11-06 | A | 실물 테스트. Chrome + [Serial Terminal](https://googlechromelabs.github.io/serial-terminal/)에서 포트 선택·연결. 시연은 Chrome만 사용 |
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
| 손가락 하나 움직임에 걸리는 시간 (DONE을 보낼 시점 판단용) | 확인됨 | 2026-11-06 | A | 이동 시간을 명령에서 정한다(서보 명령의 duration, ms). 500ms·2000ms 모두 지정한 시간대로 움직임(실물 테스트). 테스트 코드는 이동 시간 + 100ms 뒤에 `DONE`을 보냄 |
| **서보 속도 조절** (`SPEED,SLOW`) | 확인됨 | 2026-11-06 | A | 서보 명령의 이동 시간 값으로 조절. `S,2,50,2000`에서 검지가 2초에 걸쳐 천천히 접힘(실물 테스트). `SPEED,SLOW`·`NORMAL`은 이동 시간을 바꾸는 방식으로 구현 가능. 실제 값(예: 500ms / 1500ms)은 #6에서 정함 |
| 인사 동작 (`HELLO`) 표현 방법 | 미확인 | | | |
| 칭찬 반응 (`REACT,OK`) 표현 방법 | 미확인 | | | |
| 다시 반응 (`REACT,RETRY`) 표현 방법 | 미확인 | | | |
| 쉬는 자세 (`REST`) | 미확인 | | | |
| 손목·팔 등 손가락 외 관절 유무 | 확인됨 | 2026-11-06 | A | 공식 문서 기준 6번 서보 = 180° 팬틸트(손목 쪽 회전) 1개([AiHand 1장](https://docs.hiwonder.com/projects/AiHand/en/latest/docs/1.Getting_Ready.html), [5장](https://docs.hiwonder.com/projects/AiHand/en/latest/docs/5.Aihand_basic_games_lesson.html)). 실물로 6번은 아직 움직여 보지 않음 |
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
| A) AprilTag 등 태그 인식 | 카드에 태그 인쇄 → WonderCam이 태그 ID 인식 → micro:bit가 `TAG,<ID>` 전송 → 웹 `core/card`가 `tags.json`으로 ID→색 변환 | `src/core/card/tags.json`의 ID를 실제 태그 번호로 | 미확인 |
| B) WonderCam 색상 인식 | 카드 색 자체를 WonderCam이 인식 → micro:bit가 색을 전송 → 웹은 변환 없이 색 사용 | 프로토콜에 색 전송 줄 추가 (`protocol.js`·`firmware/`·`docs/protocol.md`), `tags.json` 불필요 | 미확인 |

| 항목 | 상태 | 날짜 | 확인 | 방법·메모 |
|---|---|---|---|---|
| WonderCam이 micro:bit에 연결되어 MakeCode에서 쓸 수 있음 | 미확인 | | | |
| 색상 인식으로 4색 카드를 구분 (방식 B) | 미확인 | | | 조명·카드 재질에 따라 노랑/초록 혼동 여부 |
| 태그(AprilTag 등) 인식 가능 여부와 ID 값 얻기 (방식 A) | 미확인 | | | |
| **인식 결과(태그 ID 또는 색)를 micro:bit가 받아 시리얼로 전달** | 미확인 | | | [검증 필요] 안 되면 STEP 3은 화면 버튼·키보드(카드 대신 입력)로 시연 |
| 카드 방식 결정 (A 또는 B) | 미정 | | | 정해지면 `core/card/serial.js` TODO 정리 |
| 실내 조명에서 인식 거리·각도 | 미확인 | | | |
| 로봇 동작 중에도 카드 인식이 동시에 되는지 | 미확인 | | | |

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
