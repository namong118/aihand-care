// AIHand 펌웨어 F3 (로봇 통신 프로토콜 v1 + WonderCam 태그·숫자 인식)
// MakeCode(micro:bit) JavaScript 탭에 이 파일 전체를 붙여 넣는다.
// Hiwonder 확장(StartbitV2, WonderCam 모두)은 추가하지 않는다. "Initialize StartbitV2" 블록도 쓰지 않는다.
// WonderCam 은 공식 확장(github.com/Hiwonder/WonderCam)과 같은 I2C 읽기·쓰기를 이 파일 안에 직접 넣었다.
//
// 프로토콜: docs/protocol.md. 이 파일, src/core/robot/protocol.js, docs/protocol.md 는 항상 같이 고친다.
// 동작 설계: docs/hardware-check.md 부록 5 확정안. 타이밍·시리얼 처리: 테스트 코드 v8 그대로.
//
// 웹 → 로봇 (USB 시리얼 115200, 한 줄 = 명령 하나)
//   PING               → PONG
//   HELLO              → DONE,HELLO
//   POSE,<이름>        → DONE,POSE      (이름: ROCK PAPER V INDEX THREE FOUR THUMB)
//   REACT,OK|RETRY     → DONE,REACT
//   REST               → DONE,REST
//   SPEED,SLOW|NORMAL  → DONE,SPEED
//   CAM,TAG            → DONE,CAM       (WonderCam 태그 모드. 카메라 없음 ERR,NO_CAM / 전환 안 됨 ERR,CAM_MODE)
//   CAM,NUM            → DONE,CAM       (WonderCam 숫자 인식 모드. 오류는 CAM,TAG 와 같음)
//                                        켜질 때는 모드를 바꾸지 않는다. TAG·NUM 줄은 CAM 명령이 성공한 뒤부터 나온다
//                                        카메라는 한 번에 한 모드: 태그 모드면 TAG 줄만, 숫자 모드면 NUM 줄만
//   그 밖              → ERR,UNKNOWN_CMD / ERR,UNKNOWN_POSE / ERR,BAD_ARG
//
// 로봇 → 웹 (명령과 상관없이 보냄)
//   TAG,<번호>         WonderCam 에 보이는 태그가 바뀌었을 때 한 번 (예: TAG,0)
//   TAG,NONE           보이던 태그가 0.5초 넘게 안 보일 때 한 번
//   NUM,<1~5>          보이는 숫자 카드가 바뀌었을 때 한 번 (예: NUM,3)
//   NUM,NONE           보이던 숫자가 0.5초 넘게 안 보일 때 한 번
//   RAW,NUM,<숫자>,<확신도×100>   DEBUG_NUM = true 일 때만. 기준값 MIN_CONF 정하기용 (웹은 무시)
//
// DONE 은 정해진 시간이 지나면 보낸다. 서보가 실제로 도착했다는 뜻이 아니다 (부록 4).

const FIRMWARE_VERSION = "F3" // 켜질 때 LED에 잠깐 보여준다 (프로토콜과 무관)

// 숫자 인식 확신도 기준값 정하기용. true 로 바꾸면 숫자 모드에서 카메라 결과가 바뀔 때마다
// RAW,NUM,<숫자>,<확신도×100> 줄을 보낸다 (웹은 이 줄을 무시한다). 평소에는 false
const DEBUG_NUM = false

// ---------- 안전 범위 (상수: 실행 중 바꾸는 명령을 두지 않는다) ----------
const FINGER_MIN = 50
const FINGER_MAX = 130
const WRIST_MIN = 80 // 손목(6번) 실물 확인 범위 80~100 (hardware-check.md 2번)
const WRIST_MAX = 100
const WRIST = 6

// 통로를 확장보드로 돌린 뒤 서보 명령을 다 보낼 때까지 기다리는 시간 (v8: 30ms)
const SETTLE_MS = 30

// 속도 배수: NORMAL 1, SLOW 2 (모든 이동·대기 시간에 곱한다)
let speedK = 1

// ---------- USB 로 한 줄 보내기 ----------
// 시리얼 통로가 확장보드 쪽으로 돌려져 있는 동안 보내면 글자가 확장보드로 가 버린다.
// 그래서 모든 응답은 send() 로만 보내고, 확장보드 쪽이면 보내지 않는다.
// (명령 처리와 카메라 확인은 맨 아래 forever 하나에서 차례로 하므로 원래 겹치지 않는다. 이건 안전장치)
let onBoard = false
function send(line: string) {
    if (onBoard) return
    serial.writeLine(line)
}

// ---------- 확장보드 서보 ----------
// StartbitV2 setPwmServo 와 같은 형식 (180도 범위). 반드시 toBoard() 상태에서 부른다.
function servo(index: number, angle: number, ms: number) {
    let pos = Math.round(angle * 2000 / 180 + 500)
    let b = pins.createBuffer(10)
    b[0] = 0x55; b[1] = 0x55; b[2] = 0x08; b[3] = 0x03; b[4] = 0x01
    b[5] = ms & 0xff; b[6] = (ms >> 8) & 0xff
    b[7] = index; b[8] = pos & 0xff; b[9] = (pos >> 8) & 0xff
    serial.writeBuffer(b)
}

// micro:bit 시리얼 통로는 하나뿐이다. 서보 명령을 보낼 때만 확장보드(P12·P8)로 돌린다.
function toBoard() {
    onBoard = true
    serial.redirect(SerialPin.P12, SerialPin.P8, BaudRate.BaudRate115200)
}
function toUSB() {
    serial.redirectToUSB()
    serial.readString() // 확장보드 상태 메시지(A......$) 남은 것 버리기
    onBoard = false
}

// 여러 서보를 한 번에 보내고 USB로 되돌린 뒤 wait ms 기다린다.
// 각도는 여기서 안전 범위로 한 번 더 제한한다.
function move(ids: number[], angs: number[], ms: number, wait: number) {
    toBoard()
    for (let n = 0; n < ids.length; n++) {
        let a = angs[n]
        if (ids[n] == WRIST) a = Math.max(WRIST_MIN, Math.min(WRIST_MAX, a))
        else a = Math.max(FINGER_MIN, Math.min(FINGER_MAX, a))
        servo(ids[n], a, ms * speedK)
    }
    basic.pause(SETTLE_MS)
    toUSB()
    basic.pause(wait * speedK)
}

const F = [1, 2, 3, 4, 5] // 엄지, 검지, 중지, 약지, 새끼

// ---------- 손모양 7종 (hardware-check.md 3번 표) ----------
// 엄지(1번)만 방향 반대: 엄지 접기 130 / 펴기 50, 검지~새끼 접기 50 / 펴기 130
const POSE_NAMES = ["ROCK", "PAPER", "V", "INDEX", "THREE", "FOUR", "THUMB"]
const POSE_ANGLES = [
    [130, 50, 50, 50, 50],     // ROCK  00000
    [50, 130, 130, 130, 130],  // PAPER 11111
    [130, 130, 130, 50, 50],   // V     01100
    [130, 130, 50, 50, 50],    // INDEX 01000
    [130, 130, 130, 130, 50],  // THREE 01110
    [130, 130, 130, 130, 130], // FOUR  01111
    [50, 50, 50, 50, 50],      // THUMB 10000
]

// ---------- 동작 (부록 5 확정안, 시간은 NORMAL 기준) ----------
function doRest() {
    move([1, 2, 3, 4, 5, WRIST], [90, 90, 90, 90, 90, 90], 500, 600)
}
function doPalm() {
    move(F, [50, 130, 130, 130, 130], 500, 600)
}
function doPose(i: number) {
    move(F, POSE_ANGLES[i], 500, 600) // 손목은 움직이지 않는다
}
// REACT,OK: 공식 Face Recognition 동작 (주먹 <-> 반쯤 쥔 자세 2번)
function doReactOk() {
    for (let r = 0; r < 2; r++) {
        move(F, [130, 50, 50, 50, 50], 300, 500)
        move(F, [90, 90, 90, 90, 90], 300, 500)
    }
}
// REACT,RETRY: R3 물결 (손바닥에서 새끼 -> 검지 차례로 접었다 차례로 펴기 -> REST)
function doReactRetry() {
    doPalm()
    for (let id = 5; id >= 2; id--) move([id], [90], 400, 150)
    basic.pause(400 * speedK)
    for (let id = 5; id >= 2; id--) move([id], [130], 400, 150)
    basic.pause(400 * speedK)
    doRest()
}
// HELLO: H2 손목 흔들기 (손바닥 편 채 손목 90 -> 100 -> 80 -> 100 -> 90 -> REST, 이동 300 / 대기 400)
function doHello() {
    doPalm()
    move([WRIST], [100], 300, 400)
    move([WRIST], [80], 300, 400)
    move([WRIST], [100], 300, 400)
    move([WRIST], [90], 300, 400)
    doRest()
}

// ---------- WonderCam (I2C 주소 0x32, hardware-check.md 4번·부록 6) ----------
// I2C 는 USB 시리얼·확장보드 시리얼과 다른 핀이라 통로 전환과 상관없다.
const CAM_ADDR = 0x32
const FUNC_TAG = 7         // WonderCam 기능 번호: 7 = AprilTag (5 = 색상)
const FUNC_NUM = 10        // 10 = 숫자 인식 (공식 확장 Functions.NumberRecognition, 실물에서 10 확인)
const REG_FUNC = 0x0035    // 지금 기능 번호 (읽기) / 기능 바꾸기 (쓰기)
const REG_TAG = 0x1E00     // AprilTag 결과: [1] = 태그 개수, [2..] = 태그 번호들
const TAG_LEN = 512        // 공식 확장과 같은 길이로 읽는다 (CAM1 실물 확인한 방식 그대로)
const REG_NUM = 0x0D00     // 숫자 인식 결과: [1] = 가장 확신하는 숫자, [2..3] = 그 확신도 (UInt16LE, ÷10000 하면 0~1)
const NUM_LEN = 128        // 공식 확장과 같은 길이
// 확신도 기준 (% 단위, 확신도 × 100). 숫자 인식은 "안 보임"을 따로 알려 주지 않아서
// 이보다 낮거나 숫자가 1~5 가 아니면 안 보인 것으로 친다. 카드가 없으면 카메라는 숫자 0 을 준다.
// 2026-11-11 실물 측정: 카드 1~5 를 10~15cm 에서 맞게 읽을 때 89~99, 카드 없음은 0 (63~99).
// 맞게 읽은 가장 낮은 값(89)보다 여유를 두고 80 (hardware-check.md 부록 8)
const MIN_CONF = 80
const POLL_MS = 100        // 명령이 없을 때 이 간격으로 카메라 결과를 읽는다
const LOST_MS = 500        // 이 시간 넘게 안 보여야 카드가 사라진 것으로 친다 (인식이 0.17~0.34초씩 끊김)

let camOk = false
let camMode = 0            // 지금 모드: 0 = 없음, FUNC_TAG, FUNC_NUM. CAM 명령이 성공했을 때만 바뀐다
let shown = -1             // 웹에 마지막으로 알린 값 (태그 번호 또는 숫자). -1 = 없음
let lastSeenAt = 0         // shown 을 마지막으로 본 시각
let lastPoll = 0
let lastRaw = ""           // DEBUG_NUM: 마지막으로 보낸 RAW 줄

function camRead(reg: number, len: number): Buffer {
    let req = pins.createBuffer(2)
    req[0] = reg & 0xff
    req[1] = (reg >> 8) & 0xff
    pins.i2cWriteBuffer(CAM_ADDR, req)
    return pins.i2cReadBuffer(CAM_ADDR, len)
}
function camWrite(reg: number, value: number) {
    let b = pins.createBuffer(3)
    b[0] = reg & 0xff
    b[1] = (reg >> 8) & 0xff
    b[2] = value & 0xff
    pins.i2cWriteBuffer(CAM_ADDR, b)
}
// 0번 레지스터가 'v'(118)이면 WonderCam. 공식 wondercam_init 은 못 찾으면 무한 대기라서 쓰지 않는다
function camAlive(): boolean {
    return camRead(0, 1)[0] == 118
}
// tries 번 찾아 본다. 사이에 0.5초씩 쉰다 (마지막 뒤에는 쉬지 않음). 3번이면 못 찾을 때 약 1초
function camFind(tries: number): boolean {
    for (let k = 0; k < tries; k++) {
        if (camAlive()) return true
        if (k < tries - 1) basic.pause(500)
    }
    return false
}
// 기능 바꾸기. 공식 ChangeFunc 와 같다: 0x0035 에 쓰고 0.1초 대기 → 확인, 아니면 0.05초 쉬고 다시 (쉬기 최대 80번)
// 최악 약 4.1초 (0.1 + 80 × 0.05). 공식은 끝내 안 바뀌어도 그냥 끝나지만, 여기서는 false 를 돌려 ERR,CAM_MODE 를 보낸다
function camSwitch(func: number): boolean {
    let count = 0
    camWrite(REG_FUNC, func)
    basic.pause(100)
    while (camRead(REG_FUNC, 1)[0] != func) {
        if (count >= 80) return false
        basic.pause(50)
        count++
    }
    return true
}

// 웹에 알리는 규칙 (태그·숫자 공통): 값이 바뀔 때만 보낸다. 사라짐은 LOST_MS 동안 계속 안 보일 때만
// kind: "TAG" 또는 "NUM", id: 지금 보이는 값 (-1 = 안 보임)
function report(kind: string, id: number) {
    let now = input.runningTime()
    if (id >= 0) {
        lastSeenAt = now
        if (id != shown) {
            shown = id
            send(kind + "," + id)
        }
    } else if (shown >= 0 && now - lastSeenAt > LOST_MS) {
        shown = -1
        send(kind + ",NONE")
    }
}

// 보이는 태그 하나 고르기: 알린 태그가 아직 보이면 그대로, 아니면 가장 작은 번호. 없으면 -1
function seeTag(): number {
    if (camRead(REG_FUNC, 1)[0] != FUNC_TAG) return -1 // 카메라 메뉴에서 기능을 바꾼 경우
    let r = camRead(REG_TAG, TAG_LEN)
    let n = r.getNumber(NumberFormat.Int8LE, 1)
    let pick = -1
    for (let i = 2; i < 2 + n && i < r.length; i++) {
        let id = r[i]
        if (id == shown) return id
        if (pick < 0 || id < pick) pick = id
    }
    return pick
}

function pollTag() {
    report("TAG", seeTag())
}

// 보이는 숫자: 가장 확신하는 숫자가 1~5 이고 확신도가 MIN_CONF 이상이면 그 숫자, 아니면 -1
function seeNum(): number {
    if (camRead(REG_FUNC, 1)[0] != FUNC_NUM) return -1 // 카메라 메뉴에서 기능을 바꾼 경우
    let r = camRead(REG_NUM, NUM_LEN)
    let n = r[1]
    let pct = Math.idiv(r.getNumber(NumberFormat.UInt16LE, 2), 100) // 확신도 × 100 (0~100)
    if (DEBUG_NUM) {
        let raw = "RAW,NUM," + n + "," + pct
        if (raw != lastRaw) {
            lastRaw = raw
            send(raw)
        }
    }
    if (n < 1 || n > 5 || pct < MIN_CONF) return -1
    return n
}

function pollNum() {
    report("NUM", seeNum())
}

// ---------- 명령 처리 ----------
// 명령 하나 = 함수 하나. 새 명령은 cmdXxx 함수를 만들고 handle() 에 한 줄 추가한다.
// (명령을 추가하면 docs/protocol.md 와 src/core/robot/protocol.js 도 함께 고친다)

function cmdPing(arg: string) {
    if (arg != "") { send("ERR,BAD_ARG"); return }
    send("PONG")
}
function cmdHello(arg: string) {
    if (arg != "") { send("ERR,BAD_ARG"); return }
    doHello()
    send("DONE,HELLO")
}
function cmdPose(arg: string) {
    let i = POSE_NAMES.indexOf(arg)
    if (i < 0) { send("ERR,UNKNOWN_POSE"); return }
    doPose(i)
    send("DONE,POSE")
}
function cmdReact(arg: string) {
    if (arg == "OK") doReactOk()
    else if (arg == "RETRY") doReactRetry()
    else { send("ERR,BAD_ARG"); return }
    send("DONE,REACT")
}
function cmdRest(arg: string) {
    if (arg != "") { send("ERR,BAD_ARG"); return }
    doRest()
    send("DONE,REST")
}
// CAM,TAG / CAM,NUM: WonderCam 모드 바꾸기. 켜질 때 못 찾았으면 여기서 다시 찾는다 (카메라가 늦게 켜진 경우)
// 걸리는 시간: 카메라 없음 약 1초 / 있음 보통 0.1~0.2초, 최악 약 5.1초 (찾기 1초 + 전환 4.1초). 웹 시간 초과 6초
// 모드를 바꾸면 보이던 카드는 없는 것으로 치고 처음부터 다시 알린다 (웹도 DONE,CAM 을 받으면 같은 규칙)
// 실패하면 모드 없음(0)이 되어 TAG·NUM 줄을 보내지 않는다. 값이 틀린 경우(ERR,BAD_ARG)만 지금 모드를 그대로 둔다
function cmdCam(arg: string) {
    let func = 0
    if (arg == "TAG") func = FUNC_TAG
    else if (arg == "NUM") func = FUNC_NUM
    else { send("ERR,BAD_ARG"); return }
    camMode = 0
    shown = -1
    if (!camOk) camOk = camFind(3)
    if (!camOk) { send("ERR,NO_CAM"); return }
    if (!camSwitch(func)) { send("ERR,CAM_MODE"); return }
    camMode = func
    lastRaw = ""
    send("DONE,CAM")
}
function cmdSpeed(arg: string) {
    if (arg == "SLOW") speedK = 2
    else if (arg == "NORMAL") speedK = 1
    else { send("ERR,BAD_ARG"); return }
    send("DONE,SPEED")
}

// "POSE,ROCK" → 이름 "POSE", 값 "ROCK"
function handle(line: string) {
    let comma = line.indexOf(",")
    let name = comma < 0 ? line : line.substr(0, comma)
    let arg = comma < 0 ? "" : line.substr(comma + 1)

    if (name == "PING") cmdPing(arg)
    else if (name == "HELLO") cmdHello(arg)
    else if (name == "POSE") cmdPose(arg)
    else if (name == "REACT") cmdReact(arg)
    else if (name == "REST") cmdRest(arg)
    else if (name == "SPEED") cmdSpeed(arg)
    else if (name == "CAM") cmdCam(arg)
    else send("ERR,UNKNOWN_CMD")
}

// ---------- 시작 ----------
toUSB()
basic.showString(FIRMWARE_VERSION) // 펌웨어 버전 확인용. 켜질 때 서보는 움직이지 않는다 (글자가 지나가는 약 2.5초 동안 카메라도 켜진다)
// 켜질 때는 카메라를 한 번만 확인하고 기다리지 않는다. 모드 전환(최악 4.1초)도 하지 않는다.
// 여기서 오래 막히면 반복문에 늦게 들어가 웹의 PING(1.5초 × 3번)에 답하지 못하기 때문. 반복문까지 F1 과 같은 약 3초
// 모드 전환은 웹이 보내는 CAM,TAG / CAM,NUM 에서 한다 (Serial Terminal 에서는 직접 입력)
camOk = camAlive()
if (camOk) basic.showIcon(IconNames.Yes) // ✓ 로봇·WonderCam 준비
else basic.showIcon(IconNames.No)        // ✖ 지금은 WonderCam 이 안 보임. CAM 명령 때 다시 찾는다 (로봇 명령은 그대로)

const MAX_LINE = 40 // 이보다 긴 줄은 잡음으로 보고 버린다
let buf = ""
// 명령 처리와 카메라 확인을 이 반복 하나에서 차례로 한다.
// 명령을 처리하는 동안(서보 동작 중)에는 카메라를 읽지 않는다. 그래서 동작 중에는 카메라 줄이 끼어들 수 없고,
// 동작 중에 보여준 카드는 동작이 끝난 뒤에도 보이고 있으면 그때 알린다 (보여줬다 바로 치우면 알리지 못한다).
basic.forever(function () {
    let s = serial.readString()
    for (let i = 0; i < s.length; i++) {
        let c = s.charAt(i)
        if (c == "$") { buf = ""; continue } // 확장보드 상태 메시지 끝: 그때까지 글자 버림
        if (c == "\n" || c == "\r") {
            if (buf.length > 0) handle(buf)
            buf = ""
        } else if (buf.length < MAX_LINE) {
            buf = buf + c
        }
    }
    if (camMode != 0 && input.runningTime() - lastPoll >= POLL_MS) {
        lastPoll = input.runningTime()
        if (camMode == FUNC_TAG) pollTag()
        else pollNum()
    }
    basic.pause(20)
})
