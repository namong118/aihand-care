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

### 초록↔파랑 혼동 줄이기 (#5에서 모니터 기준으로 생긴 문제)

시도할 순서다. 하나씩 해 보고 4번 표에 결과를 적는다.

1. **모니터 말고 인쇄한 종이 카드로 다시 학습한다.** 모니터 색과 종이 색은 다르다. 시연할 장소의 조명에서 학습한다
2. **카드를 단색으로 만든다.** 지금 카드의 짙은 톤 잎 그림과 질감이 색 덩어리를 쪼갤 수 있다 (2번 디자인 메모)
3. **보조등 밝기를 고정한다.** 보조등은 완전히 꺼지지 않으니(#5), 학습할 때와 시연할 때 같은 밝기로 둔다
4. **가장 큰 색 덩어리 하나만 답으로 친다.** 초록 카드가 `2 4`로 보고되어도 초록 덩어리가 훨씬 크면 초록으로 친다 (아래 CAM2 코드)
5. 그래도 안 되면 초록을 노란빛 초록처럼 파랑과 더 먼 색으로 바꾸는 것을 A와 논의한다 (`src/data/colors.json`은 A 담당)

### 색 카드 테스트 코드 CAM2 (정식 펌웨어 아님)

#5의 CAM1 코드를 바탕으로, 색상 인식 결과를 **카드 하나의 색**으로 정리해서 보내는 테스트 코드다.
C가 종이 카드 테스트를 할 때 쓴다. 정식 펌웨어(`firmware/`, #6)와 프로토콜은 A 담당이므로, 결과가 좋으면 이 규칙을 A에게 넘긴다.

규칙:

- 학습한 4색 중 **가장 큰 색 덩어리** 하나만 고른다. 너무 작은 덩어리(`MIN_AREA` 미만)는 무시한다 (배경의 작은 물건, 화면 속 색 버튼 등)
- 같은 색이 `HOLD_READS`번 연속 보여야 카드로 친다 (스치듯 보인 색은 무시)
- 카드 색은 **한 번만** 보낸다. `GONE_MS` 넘게 안 보여야 카드를 내린 것으로 치고 `CARD,NONE`을 보낸다
- `MIN_AREA`·`HOLD_READS`·`GONE_MS` 값은 임시값이다. 종이 카드 테스트 후 정한다 [검증 필요]

준비: MakeCode에서 확장 `https://github.com/Hiwonder/WonderCam` 추가 → JavaScript 탭에 전체 붙여 넣기 → 다운로드 → Serial Terminal(115200)에서 확인.
카메라는 미리 Color Recognition에서 ID 1 빨강, 2 파랑, 3 노랑, 4 초록으로 학습해 둔다.

```js
// 색 카드 테스트 코드 CAM2 (정식 펌웨어 아님). 서보는 움직이지 않는다.
// 출력 (USB 시리얼 115200):
//   CARD,<색>,AREA=<크기>,t=<ms>   카드가 확정됐을 때 한 번   예) CARD,GREEN,AREA=5400,t=12345
//   CARD,NONE,t=<ms>               카드를 내렸을 때 한 번
//   RAW,<번호:크기 ...>            보이는 색이 바뀔 때마다 (테스트 기록용)
//   CAM,OK / CAM,NOT_FOUND         시작할 때

const CAM_ADDR = 0x32
const NAMES = ["NONE", "RED", "BLUE", "YELLOW", "GREEN"] // Color ID 1~4
const MIN_AREA = 1500   // 이보다 작은 색 덩어리는 무시 [검증 필요]
const HOLD_READS = 3    // 같은 색이 몇 번 연속 보여야 카드로 칠지 (100ms 간격) [검증 필요]
const GONE_MS = 500     // 이만큼 안 보이면 카드를 내린 것으로 침 [검증 필요]

let camOk = false
let candidate = 0  // 지금 연속으로 보이는 색 번호
let count = 0      // candidate 가 연속으로 보인 횟수
let sent = 0       // 마지막으로 보낸 카드 색 번호 (0 = 없음)
let sentSeenAt = 0 // sent 색이 마지막으로 보인 시각
let lastRaw = ""

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
    wondercam.UpdateResult()

    // 1. 학습한 4색 중 가장 큰 색 덩어리 고르기
    let best = 0
    let bestArea = 0
    let raw = ""
    for (let id = 1; id <= 4; id++) {
        if (wondercam.isDetectedColorId(id)) {
            let w = wondercam.XOfColorId(wondercam.Options.Width, id)
            let h = wondercam.XOfColorId(wondercam.Options.Height, id)
            let area = w * h
            raw = raw + id + ":" + area + " "
            if (area > bestArea) {
                best = id
                bestArea = area
            }
        }
    }
    if (bestArea < MIN_AREA) best = 0
    if (raw != lastRaw) {
        serial.writeLine("RAW," + (raw == "" ? "NONE" : raw))
        lastRaw = raw
    }

    // 2. 같은 색이 연속으로 보인 횟수 세기
    if (best == candidate) {
        count += 1
    } else {
        candidate = best
        count = 1
    }
    let now = input.runningTime()
    if (sent != 0 && best == sent) sentSeenAt = now

    // 3. 새 카드가 확정되면 한 번만 보내기
    if (candidate != 0 && count >= HOLD_READS && candidate != sent) {
        sent = candidate
        sentSeenAt = now
        serial.writeLine("CARD," + NAMES[sent] + ",AREA=" + bestArea + ",t=" + now)
    }

    // 4. 보낸 카드가 한동안 안 보이면 내린 것으로 치기
    if (sent != 0 && now - sentSeenAt > GONE_MS) {
        sent = 0
        serial.writeLine("CARD,NONE,t=" + now)
    }

    basic.pause(100)
})
```

테스트할 때 볼 것 (4번 표에 기록):

- 카드마다 `CARD,<색>`이 맞게 한 번만 나오는지, 초록 카드에서 `RAW`에 `2`(파랑)가 같이 나와도 `CARD,GREEN`이 되는지
- `RAW`의 크기 값: 카드를 15·20·30cm에 둘 때 몇인지 → `MIN_AREA`를 정한다
- 카드를 스치듯 보여줬을 때 `CARD`가 나오는지 → `HOLD_READS`를 정한다
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
