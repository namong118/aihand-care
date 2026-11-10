# STEP 3 색깔 카드

STEP 3 색깔손에서 사용자가 WonderCam에 보여주는 실물 색깔 카드 4장(빨강·파랑·노랑·초록)의 설정과 인식 테스트 기록.

- 담당: C (gksdnd0519-commits)
- 관련 이슈: #16 (이 문서), #17 (인쇄본 `docs/cards/`), #5 (하드웨어 검증, 카드 인식 방식 결정)
- STEP 3 코드는 카드 방식과 상관없이 `ctx.card.onCard({ color })`로 색만 받는다. 카드 ID→색 변환(`src/core/card/tags.json`)은 core 담당(A)이 반영한다. C는 `src/core/`를 고치지 않는다.

> **상태: 방식 A(AprilTag) 임시 결정 (2026-11-06, #5).** 모니터 테스트에서 태그 0~3을 정확히 인식했다. 종이 카드 거리·조명 테스트에서 문제없으면 확정, 잘 안 읽히면 방식 B를 다시 검토한다. [검증 필요]

## 1. 카드 인식 방식

`docs/hardware-check.md` 4번에서 결정한다.

| 방식 | 내용 | 결정 |
|---|---|---|
| A) AprilTag 태그 번호 | 카드에 태그를 인쇄 → WonderCam이 태그 번호 인식 | **임시 결정** (모니터 테스트에서 0~3 정확, 엉뚱한 번호 없음) |
| B) WonderCam 색상 인식 | 카드 색 자체를 WonderCam이 인식 (색을 미리 학습시켜야 함) | 보류 (모니터 테스트에서 초록을 파랑으로도 인식) |

## 2. 카드 디자인 (인쇄본: `docs/cards/cards.html`)

- 크기: A4 한 장에 4장 (한 장 약 90 × 133 mm). 실물 인식 거리 테스트 후 크기 조정
- 색 바탕 + **큰 색 이름 글자**(붓글씨, 검은 글씨). 색만으로 구분하지 않기
- 꾸밈: 종이를 오려 붙인 판화 느낌. 같은 색의 짙은 톤으로 오린 잎 모양, 옅은 종이 질감, 테이프로 붙인 흰 라벨. 꾸밈은 흰 라벨(태그) 위에 겹치지 않는다
- 방식 B(색상 인식)로 바뀌면 짙은 톤 그림과 질감이 색 인식을 방해할 수 있으니 단색 카드로 다시 만든다 ([검증 필요])
  - **방식 B용 단색 인쇄본: `docs/cards/color-cards.html`** (A4 5쪽: 앞면 4장, 뒷면, 큰 카드 2쪽, 사용법)
  - 위쪽 **색 정사각형 90 × 90 mm** (무늬·글자 없음, 로봇이 한 덩어리로 보게) + 아래쪽 **흰 띠에 큰 색 이름** (색만으로 구분하지 않기)
  - **흰 띠를 잡고** 보여 준다. 손가락이 색 부분을 잡으면 피부색이 빨강과 한 덩어리로 잡혀 카드 모양이 깨진다 (실물에서 빨강 덩어리가 손·피부까지 커지는 것 확인, 2026-11-10)
  - 색은 서로 색상 차이가 크게: 빨강 `#e3121b`, 파랑 `#0b4fd8`, 노랑 `#ffd200`, 초록 `#1fa83a` (초록은 파랑과 헷갈리지 않게 노란빛 쪽)
  - 정사각형(가로/세로 1.0)도 카드로 인정해야 한다. 문방구 색종이도 정사각형이다 (CAM2의 `MIN_RATIO`~`MAX_RATIO` 40~250 안에 들어감)
- 바탕색은 화면 색(`src/data/colors.json`)과 같게 했다. 프린터마다 색이 다를 수 있으니 실물로 확인
- 태그: AprilTag tag36h11, 약 46 × 46 mm. 태그 둘레에 흰 판(여백)을 두었다. 흰 여백을 자르거나 가리지 않는다
- 태그 그림은 공식 이미지(AprilRobotics/apriltag-imgs, tag36h11)의 칸을 그대로 옮겼다
- 양면: `cards.html` 2쪽이 뒷면이다. 양면 모두 "색 바탕 + 같은 태그 + 색 이름"이라 어느 면을 보여줘도 인식된다
- 인쇄 방법: Chrome에서 `cards.html` 열기 → Ctrl+P → A4, 배율 100%, 여백 없음, "배경 그래픽" 켜기
  - 한 면만: 페이지 1만 인쇄
  - 양면: 양면 인쇄 "긴 쪽으로 넘기기". 뒷면이 비치지 않게 두꺼운 종이를 쓰거나 한 면씩 인쇄해 두 장을 붙인다
- 코팅은 무광으로 한다 (반짝이면 태그가 안 읽힐 수 있음, [검증 필요])
- 시연할 때 보여주는 카드 외의 카드는 카메라에 보이지 않게 둔다. 태그가 여러 개 보이면 모두 인식된다

## 3-A. 방식 A일 때: 카드 색 ↔ 태그 표

| 카드 색 | `color` 값 | 태그 종류(패밀리) | 태그 번호 |
|---|---|---|---|
| 빨강 | `red` | tag36h11 | 0 |
| 파랑 | `blue` | tag36h11 | 1 |
| 노랑 | `yellow` | tag36h11 | 2 |
| 초록 | `green` | tag36h11 | 3 |

- 번호는 #5 모니터 테스트에서 쓴 번호다 (`docs/hardware-check.md` 4번·부록 6)
- 태그 이미지: https://github.com/AprilRobotics/apriltag-imgs/tree/master/tag36h11

## 3-B. 방식 B일 때: 색별 WonderCam 설정 (보류, 종이 카드 테스트에서 방식 A가 안 되면 채운다)

| 카드 색 | `color` 값 | WonderCam 색 번호/설정 | 인식 확인 |
|---|---|---|---|
| 빨강 | `red` | Color ID 1 | |
| 파랑 | `blue` | Color ID 2 | |
| 노랑 | `yellow` | Color ID 3 | |
| 초록 | `green` | Color ID 4 | |

번호는 #5 테스트에서 학습한 번호와 같다 (`docs/hardware-check.md` 부록 6 "색 학습 방법").

### 색 인식은 WonderCam 안에서 한다

색 인식 처리는 WonderCam 카메라 안에 이미 들어 있다. micro:bit는 결과(보인 색 번호와 색 덩어리의 위치·크기)만 I2C로 읽는다. 따로 학습 모델을 만들거나 웹에서 색을 계산할 필요는 없다.

- 공식 확장: https://github.com/Hiwonder/WonderCam (`custom.ts`의 "Color detection" 블록)
  - `UpdateResult()`: 결과 새로 읽기 (색상 인식은 레지스터 `0x1000`에서 400바이트)
  - `isDetectedColorId(id)`: 색 번호 1~7이 보이는지
  - `XOfColorId(Options.Width / Height, id)`: 그 색 덩어리의 가로·세로 크기
- 공식 예제: AiHand 문서 6장 Color Recognition, 예제 프로그램 `ai_vision_games_lesson.zip`의 `02 Color Recognition Program.hex` (https://docs.hiwonder.com/projects/AiHand/en/latest/docs/Appendix.html)

### 공식 문서의 색 학습 요령 (6장 Color Recognition)

- 밝고 채도가 높은 색을 쓴다. 흰색이나 여러 색이 섞인 것은 학습하지 않는다
- 카드 색과 배경색이 확실히 달라야 한다
- 주변이 충분히 밝아야 한다. 어두우면 보조등을 켠다
- 학습할 때 `+`를 카드에 맞추고 흰 테두리가 카드를 잡은 뒤 학습한다
- 카드 거리는 공식 숫자 인식·랜드마크 인식 예제 기준 15~20cm (색상 인식 거리는 문서에 없음, [검증 필요])
- **Color Range(색 범위)는 공식 권장값 20.** 너무 크면 화면 전체가 잡히고, 너무 작으면 색의 일부만 잡힌다. 바꾼 뒤에는 다시 학습해야 한다 (WonderCam 문서 2.1.4)
- **시연에 쓸 종이 카드로, 시연할 자리 조명에서 학습한다.** 모니터 색이나 다른 종이로 학습하면 카드 색과 달라진다. 빨강이 사람 피부·옷까지 잡으면 빨강만 다시 학습한다 (실물에서 화면 전체가 빨강으로 잡히는 경우 확인, 2026-11-10)
- 화면 좌표는 가로 0~319, 세로 0~239 (WonderCam 문서 1.3.3)
- 근거 문서: [WonderCam 2. Function Instruction](https://wiki.hiwonder.com/projects/WonderCam/en/latest/docs/2_Function%20Instruction.html), [AiHand 6장](https://wiki.hiwonder.com/projects/AiHand/en/latest/docs/6.AI_Vision_Games_Lesson.html) (docs.hiwonder.com 주소는 wiki.hiwonder.com 으로 옮겨짐)

### 초록↔파랑 혼동 줄이기 (#5에서 모니터 기준으로 생긴 문제)

시도할 순서다. 하나씩 해 보고 4번 표에 결과를 적는다.

1. **모니터 말고 인쇄한 종이 카드로 다시 학습한다.** 모니터 색과 종이 색은 다르다. 시연할 장소의 조명에서 학습한다
2. **카드를 단색으로 만든다.** 지금 카드의 짙은 톤 잎 그림과 질감이 색 덩어리를 쪼갤 수 있다 (2번 디자인 메모)
3. **보조등 밝기를 고정한다.** 보조등은 완전히 꺼지지 않으니(#5), 학습할 때와 시연할 때 같은 밝기로 둔다
4. **가장 큰 색 덩어리 하나만 답으로 친다.** 초록 카드가 `2 4`로 보고되어도 초록 덩어리가 훨씬 크면 초록으로 친다 (아래 CAM2 코드)
5. 그래도 안 되면 초록을 노란빛 초록처럼 파랑과 더 먼 색으로 바꾸는 것을 A와 논의한다 (`src/data/colors.json`은 A 담당)

### 사람이 입은 옷 색은 인식하지 않기 (A 요청, 2026-11-09)

색상 인식은 화면에 보이는 같은 색을 **모두** 보고한다(#5). 그래서 사용자나 옆 사람이 빨강·파랑·노랑·초록 옷을 입고 있으면 카드를 보여주지 않아도 카드로 인식될 수 있다.
카드와 옷은 **위치·크기·모양**이 다르다는 점을 이용해, 아래 세 조건을 모두 통과한 색 덩어리만 카드로 친다 (CAM2 코드 `checkBlob`).

| 조건 | 카드 | 옷 | 코드 값 (임시) |
|---|---|---|---|
| 위치: 덩어리 중심이 화면 가운데 영역 안 | 카메라 정면에 들고 보여준다 | 화면 아래쪽·가장자리에 걸치는 경우가 많다 | `ROI_X1`~`ROI_X2`, `ROI_Y1`~`ROI_Y2` |
| 크기: 너무 작지도 크지도 않음 | 15~20cm에서 일정한 크기 | 가까우면 화면 대부분을 덮는다 | `MIN_AREA`~`MAX_AREA` |
| 모양: 가로세로 비율이 카드에 가까움 | 약 90 × 133mm 직사각형 (세로로 들면 비율 약 0.68) | 모양이 일정하지 않다 | `MIN_RATIO`~`MAX_RATIO` (가로 ÷ 세로 × 100) |

- 화면 좌표는 가로 0~320 기준이다. 공식 Color Tracking 예제가 가로 중심을 150~170으로 본다 (세로 범위 240은 [검증 필요])
- 위 값은 모두 임시값이다. 종이 카드와 실제 옷으로 테스트하면서 `RAW` 출력(위치·크기)을 보고 정한다 [검증 필요]
- **한계:** 공식 확장은 같은 색 번호의 덩어리를 **하나만** 알려준다(`XOfColorId`는 처음 찾은 덩어리). 카드와 옷이 같은 색이면 옷 덩어리만 보고되어 카드가 걸러질 수 있다 [검증 필요]
- 그래서 시연 안내도 함께 한다: 시연자는 4색(빨강·파랑·노랑·초록)이 크게 들어간 옷을 피하고, 카메라 뒤 배경에도 4색 물건을 두지 않는다
- 방식 A(태그)는 옷에 태그가 없으므로 이 문제가 생기지 않는다. 방식을 정할 때 참고한다

### 색 카드 테스트 코드 CAM2 (정식 펌웨어 아님)

#5의 CAM1 코드를 바탕으로, 색상 인식 결과를 **카드 하나의 색**으로 정리해서 보내는 테스트 코드다.
C가 종이 카드 테스트를 할 때 쓴다. 정식 펌웨어(`firmware/`, #6)와 프로토콜은 A 담당이므로, 결과가 좋으면 이 규칙을 A에게 넘긴다.

규칙:

- 학습한 4색 각각에 대해 위치·크기·모양 조건(`checkBlob`)을 통과한 덩어리만 남긴다 (옷·배경 무시)
- 남은 것 중 **가장 큰 색 덩어리** 하나를 고른다
- 같은 색이 `HOLD_MS` 동안 계속 보여야 카드로 친다 (스치듯 보인 색은 무시)
- 카드 색은 **한 번만** 보낸다. `GONE_MS` 넘게 안 보여야 카드를 내린 것으로 치고 `CARD,NONE`을 보낸다
- 기준값은 모두 임시값이다. 종이 카드 테스트 후 정한다 [검증 필요]

반응 속도 (카드를 보여준 뒤 `CARD`가 나올 때까지):

- 결과를 `LOOP_MS`(5ms) 쉬고 바로 다시 읽는다. 처음 버전은 100ms마다 읽고 3번 연속 확인해서 최소 약 0.3초가 걸렸다. 결과 한 번 읽기(400바이트)에 약 0.04초가 걸려서 이보다 빨라지지는 않는다
- 같은 색 확인은 횟수가 아니라 시간(`HOLD_MS`)으로 한다. **0ms = 처음 보이는 순간 바로 카드로 친다(즉시 인식)**. 스치는 색까지 잡히면 50ms 정도로 올린다 [검증 필요]
- `RAW` 출력은 카드가 조금만 움직여도 바뀌어서 매번 찍으면 느려진다. `RAW_EVERY_MS`(300ms)에 한 번만 찍고, 속도를 잴 때는 `RAW_ON = false`로 끈다
- `CARD` 줄에 `HOLD`(처음 보인 뒤 보낼 때까지 ms)와 `LOOP`(한 번 읽는 데 걸린 ms)를 찍어서 실제 속도를 잰다
- WonderCam 자체가 결과를 새로 만드는 간격보다 빨라지지는 않는다. #5에서 AprilTag 결과 간격이 약 0.17초였고, 색상 인식 간격은 [검증 필요]
- `HOLD_MS`를 줄일수록 빨라지지만 스치듯 지나간 색도 카드로 칠 수 있다. 테스트로 정한다

준비: MakeCode에서 확장 `https://github.com/Hiwonder/WonderCam` 추가 → JavaScript 탭에 전체 붙여 넣기 → 다운로드 → Serial Terminal(115200)에서 확인.
카메라는 미리 Color Recognition에서 ID 1 빨강, 2 파랑, 3 노랑, 4 초록으로 학습해 둔다.

```js
// 색 카드 테스트 코드 CAM2 (정식 펌웨어 아님). 서보는 움직이지 않는다.
// 출력 (USB 시리얼 115200):
//   CARD,<색>,AREA=<크기>,HOLD=<ms>,LOOP=<ms>,t=<ms>   카드가 확정됐을 때 한 번
//        예) CARD,GREEN,AREA=5400,HOLD=160,LOOP=12,t=12345
//        HOLD: 처음 보인 뒤 보낼 때까지 걸린 시간, LOOP: 결과 한 번 읽는 데 걸린 시간
//   CARD,NONE,t=<ms>               카드를 내렸을 때 한 번
//   RAW,<번호>:<x>,<y>,<w>,<h>,<판정> ...   RAW_EVERY_MS 마다, 바뀌었을 때만 (테스트 기록용)
//        판정: OK 카드로 인정 / POS 위치 밖 / SMALL 너무 작음 / BIG 너무 큼 / SHAPE 모양 다름
//   CAM,OK / CAM,NOT_FOUND         시작할 때

const CAM_ADDR = 0x32
const NAMES = ["NONE", "RED", "BLUE", "YELLOW", "GREEN"] // Color ID 1~4

// 옷·배경을 거르는 조건 (모두 임시값) [검증 필요]
const ROI_X1 = 60       // 덩어리 중심이 이 가로 범위 안이어야 함 (화면 가로 0~320)
const ROI_X2 = 260
const ROI_Y1 = 30       // 덩어리 중심이 이 세로 범위 안이어야 함 (화면 세로 0~240 [검증 필요])
const ROI_Y2 = 190
const MIN_AREA = 1500   // 이보다 작으면 무시 (멀리 있는 작은 물건)
const MAX_AREA = 30000  // 이보다 크면 무시 (가까운 옷이 화면을 덮을 때)
const MIN_RATIO = 40    // 가로 ÷ 세로 × 100. 카드를 세로로 들면 약 68, 가로로 들면 약 148
const MAX_RATIO = 250

// 반응 속도 (모두 임시값) [검증 필요]
const LOOP_MS = 5       // 결과를 읽은 뒤 쉬는 시간 (거의 바로 다시 읽음)
const HOLD_MS = 0       // 같은 색이 이만큼 계속 보여야 카드로 침. 0 = 즉시 (스치는 색도 잡히면 50 정도로)
const GONE_MS = 500     // 이만큼 안 보이면 카드를 내린 것으로 침
const RAW_ON = true     // 속도를 잴 때는 false (RAW 출력이 읽기를 늦춘다)
const RAW_EVERY_MS = 300

let camOk = false
let candidate = 0      // 지금 계속 보이는 색 번호
let candidateSince = 0 // candidate 가 처음 보인 시각
let sent = 0       // 마지막으로 보낸 카드 색 번호 (0 = 없음)
let sentSeenAt = 0 // sent 색이 마지막으로 보인 시각
let lastRaw = ""
let lastRawAt = 0
let loopMs = 0
let blobInfo = ""  // checkBlob 이 남기는 RAW 기록

serial.redirectToUSB()
serial.setBaudRate(BaudRate.BaudRate115200)

// 0번 레지스터가 'v'(118)이면 WonderCam (CAM1과 같은 방법)
function camAlive(): boolean {
    let req = pins.createBuffer(2)
    req.setNumber(NumberFormat.UInt8LE, 0, 0)
    req.setNumber(NumberFormat.UInt8LE, 1, 0)
    pins.i2cWriteBuffer(CAM_ADDR, req)
    let r = pins.i2cReadBuffer(CAM_ADDR, 1)
    return r.getNumber(NumberFormat.UInt8LE, 0) == 118
}

// 색 번호 id 의 덩어리가 카드처럼 보이면 크기를, 아니면 0 을 돌려준다
function checkBlob(id: number): number {
    let x = wondercam.XOfColorId(wondercam.Options.Pos_X, id)
    let y = wondercam.XOfColorId(wondercam.Options.Pos_Y, id)
    let w = wondercam.XOfColorId(wondercam.Options.Width, id)
    let h = wondercam.XOfColorId(wondercam.Options.Height, id)
    let area = w * h
    let verdict = "OK"
    if (x < ROI_X1 || x > ROI_X2 || y < ROI_Y1 || y > ROI_Y2) {
        verdict = "POS"
    } else if (area < MIN_AREA) {
        verdict = "SMALL"
    } else if (area > MAX_AREA) {
        verdict = "BIG"
    } else if (h <= 0 || w * 100 < MIN_RATIO * h || w * 100 > MAX_RATIO * h) {
        verdict = "SHAPE"
    }
    blobInfo = id + ":" + x + "," + y + "," + w + "," + h + "," + verdict
    return verdict == "OK" ? area : 0
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
    wondercam.ChangeFunc(wondercam.Functions.ColorDetect)
    basic.showIcon(IconNames.Yes)
    serial.writeLine("CAM,OK")
} else {
    basic.showIcon(IconNames.No)
    serial.writeLine("CAM,NOT_FOUND")
}

basic.forever(function () {
    if (!camOk) {
        basic.pause(500)
        return
    }
    let start = input.runningTime()
    wondercam.UpdateResult()

    // 1. 조건을 통과한 덩어리 중 가장 큰 것 고르기
    let best = 0
    let bestArea = 0
    let raw = ""
    for (let id = 1; id <= 4; id++) {
        if (wondercam.isDetectedColorId(id)) {
            let area = checkBlob(id)
            raw = raw + blobInfo + " "
            if (area > bestArea) {
                best = id
                bestArea = area
            }
        }
    }
    let now = input.runningTime()
    loopMs = now - start
    if (RAW_ON && raw != lastRaw && now - lastRawAt >= RAW_EVERY_MS) {
        serial.writeLine("RAW," + (raw == "" ? "NONE" : raw))
        lastRaw = raw
        lastRawAt = now
    }

    // 2. 같은 색이 처음 보인 시각 기억하기
    if (best != candidate) {
        candidate = best
        candidateSince = now
    }
    if (sent != 0 && best == sent) sentSeenAt = now

    // 3. 새 카드가 확정되면 한 번만 보내기
    if (candidate != 0 && now - candidateSince >= HOLD_MS && candidate != sent) {
        sent = candidate
        sentSeenAt = now
        serial.writeLine("CARD," + NAMES[sent] + ",AREA=" + bestArea + ",HOLD=" + (now - candidateSince) + ",LOOP=" + loopMs + ",t=" + now)
    }

    // 4. 보낸 카드가 한동안 안 보이면 내린 것으로 치기
    if (sent != 0 && now - sentSeenAt > GONE_MS) {
        sent = 0
        serial.writeLine("CARD,NONE,t=" + now)
    }

    basic.pause(LOOP_MS)
})
```

테스트할 때 볼 것 (4번 표에 기록):

- 카드마다 `CARD,<색>`이 맞게 한 번만 나오는지, 초록 카드에서 `RAW`에 `2`(파랑)가 같이 나와도 `CARD,GREEN`이 되는지
- **옷 테스트:** 4색 옷(또는 큰 색 천)을 입고 시연 자리에 앉았을 때 `CARD`가 나오지 않는지. `RAW`에 옷이 `POS`·`BIG`·`SHAPE` 중 무엇으로 걸러지는지 적는다
- **같은 색 옷 + 카드:** 빨간 옷을 입고 빨강 카드를 보여줬을 때 `CARD,RED`가 나오는지 (위 "한계" 확인)
- `RAW`의 위치·크기 값: 카드를 15·20·30cm에 둘 때 몇인지 → `ROI`·`MIN_AREA`·`MAX_AREA`를 정한다
- 카드를 스치듯 보여줬을 때 `CARD`가 나오는지 → `HOLD_MS`를 정한다
- **반응 속도:** `RAW_ON = false`로 두고 카드를 보여줬을 때 `CARD` 줄의 `HOLD`·`LOOP` 값과, 체감으로 늦다고 느껴지는지 적는다
- 카드를 들고 있는데 `CARD,NONE`이 나오는지 → 나오면 `GONE_MS`를 늘린다

## 4. 실물 인식 테스트 기록

| 날짜 | 확인한 사람 | 카드 크기 | 거리(cm) | 조명 | 결과 | 혼동된 색·메모 |
|---|---|---|---|---|---|---|
| 2026-11-06 | A (namong118) | 모니터 화면 | | | 태그 0~3 정확히 인식, 엉뚱한 번호 없음 | 방식 B는 초록을 파랑으로도 인식 |
| | | 종이 카드 | | | | |

확인할 것: 인식되는 최대·최소 거리, 기울였을 때, 형광등/창가 조명, 코팅 빛 반사, 양면 비침, 로봇이 움직이는 중에도 인식되는지

## 5. 정할 것

- [ ] 카드를 잠깐 스치듯 보여줬을 때도 답으로 칠지 (#14, 실물 테스트 결과 보고 결정)
  - A의 모니터 테스트에서 알게 된 점 (`docs/hardware-check.md` 4번·부록 6): 태그를 계속 보여줘도 인식이 0.17~0.34초씩 끊긴다
  - 그래서 펌웨어(#6)는 같은 ID가 몇 번 연속 보이면 `TAG,<ID>`를 **한 번만** 보내고, 일정 시간(예: 0.5초) 넘게 안 보여야 카드가 사라진 것으로 칠 예정이다. 이 값은 종이 카드 테스트 후 A와 함께 정한다
  - STEP 3는 문제마다 처음 들어온 카드 하나만 답으로 치고, 결과 문구와 쉬는 시간 동안 들어온 카드는 버린다. 따라서 카드를 들고 있는 채로 다음 문제로 넘어가면 `TAG`가 다시 오지 않아 답이 안 들어갈 수 있다
  - 종이 카드 테스트에서 볼 것: 스치듯 보여준 카드가 몇 번 연속 인식되는지, 카드를 내렸다가 다시 보여줘야 하는 상황이 자주 생기는지. 자주 생기면 문제 화면에 "카드를 내렸다가 다시 보여 주세요" 안내를 넣는다 [검증 필요]
- [ ] 카드·태그 크기 확정 (종이 카드 거리 테스트 후)
- [ ] 방식 A 확정 (종이 카드 테스트 후)

## 6. 반영 순서

1. 이 문서 PR 병합
2. 종이 카드 거리·조명 테스트 (A와 함께), 결과를 4번 표에 기록
3. 방식 A 확정 후 namong118이 `src/core/card/tags.json` 반영 (C는 core를 고치지 않는다)
