// AIHand 펌웨어 F1 (로봇 통신 프로토콜 v1)
// MakeCode(micro:bit) JavaScript 탭에 이 파일 전체를 붙여 넣는다.
// Hiwonder 확장(StartbitV2 등)은 추가하지 않는다. "Initialize StartbitV2" 블록도 쓰지 않는다.
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
//   그 밖              → ERR,UNKNOWN_CMD / ERR,UNKNOWN_POSE / ERR,BAD_ARG
//
// DONE 은 정해진 시간이 지나면 보낸다. 서보가 실제로 도착했다는 뜻이 아니다 (부록 4).

const FIRMWARE_VERSION = "F1" // 켜질 때 LED에 잠깐 보여준다 (프로토콜과 무관)

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
    serial.redirect(SerialPin.P12, SerialPin.P8, BaudRate.BaudRate115200)
}
function toUSB() {
    serial.redirectToUSB()
    serial.readString() // 확장보드 상태 메시지(A......$) 남은 것 버리기
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

// ---------- 명령 처리 ----------
// 명령 하나 = 함수 하나. 새 명령은 cmdXxx 함수를 만들고 handle() 에 한 줄 추가한다.
// (명령을 추가하면 docs/protocol.md 와 src/core/robot/protocol.js 도 함께 고친다)

function cmdPing(arg: string) {
    if (arg != "") { serial.writeLine("ERR,BAD_ARG"); return }
    serial.writeLine("PONG")
}
function cmdHello(arg: string) {
    if (arg != "") { serial.writeLine("ERR,BAD_ARG"); return }
    doHello()
    serial.writeLine("DONE,HELLO")
}
function cmdPose(arg: string) {
    let i = POSE_NAMES.indexOf(arg)
    if (i < 0) { serial.writeLine("ERR,UNKNOWN_POSE"); return }
    doPose(i)
    serial.writeLine("DONE,POSE")
}
function cmdReact(arg: string) {
    if (arg == "OK") doReactOk()
    else if (arg == "RETRY") doReactRetry()
    else { serial.writeLine("ERR,BAD_ARG"); return }
    serial.writeLine("DONE,REACT")
}
function cmdRest(arg: string) {
    if (arg != "") { serial.writeLine("ERR,BAD_ARG"); return }
    doRest()
    serial.writeLine("DONE,REST")
}
function cmdSpeed(arg: string) {
    if (arg == "SLOW") speedK = 2
    else if (arg == "NORMAL") speedK = 1
    else { serial.writeLine("ERR,BAD_ARG"); return }
    serial.writeLine("DONE,SPEED")
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
    else serial.writeLine("ERR,UNKNOWN_CMD")
}

// ---------- 시작 ----------
toUSB()
basic.showString(FIRMWARE_VERSION) // 펌웨어 버전 확인용. 켜질 때 서보는 움직이지 않는다
basic.showIcon(IconNames.Yes)

const MAX_LINE = 40 // 이보다 긴 줄은 잡음으로 보고 버린다
let buf = ""
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
    basic.pause(20)
})
