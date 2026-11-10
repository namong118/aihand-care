// 로봇 통신 프로토콜 v1: 명령 문자열 만들기와 응답 파싱.
// 텍스트 한 줄 = 명령 하나, '\n' 으로 끝난다. 자세한 내용은 docs/protocol.md.
// 프로토콜을 바꾸면 이 파일, firmware/, docs/protocol.md 를 함께 고친다.

export const PROTOCOL_VERSION = 1;

// 웹 → 로봇 명령 이름
export const CMD = Object.freeze({
  HELLO: 'HELLO',
  POSE: 'POSE',
  REACT: 'REACT',
  REST: 'REST',
  SPEED: 'SPEED',
  PING: 'PING',
  CAM: 'CAM',
});

const REACT_KINDS = { ok: 'OK', retry: 'RETRY' };
const SPEEDS = ['SLOW', 'NORMAL'];
// WonderCam 모드: TAG(AprilTag, 색 카드) / NUM(숫자 인식, 숫자 카드 1~5). 펌웨어 F3
export const CAM_MODES = ['TAG', 'NUM'];
const CARD_NUMBER = /^[1-5]$/;
const POSE_NAME = /^[A-Z][A-Z0-9_]*$/;

function line(text) {
  return `${text}\n`;
}

export function hello() {
  return line(CMD.HELLO);
}

/** POSE,<이름>. 이름은 poses.json 의 name (대문자). */
export function pose(name) {
  if (typeof name !== 'string' || !POSE_NAME.test(name)) {
    throw new Error(`손모양 이름이 올바르지 않습니다: ${name}`);
  }
  return line(`${CMD.POSE},${name}`);
}

/** kind: 'ok' | 'retry' → REACT,OK | REACT,RETRY */
export function react(kind) {
  const arg = REACT_KINDS[kind];
  if (!arg) throw new Error(`react 종류는 'ok' 또는 'retry' 입니다: ${kind}`);
  return line(`${CMD.REACT},${arg}`);
}

export function rest() {
  return line(CMD.REST);
}

/**
 * SPEED,SLOW|NORMAL
 * 모든 이동·대기 시간 ×2 / ×1. 펌웨어 F1 실물 확인 (2026-11-09, docs/hardware-check.md 부록 7).
 */
export function speed(value) {
  if (!SPEEDS.includes(value)) throw new Error(`속도는 SLOW 또는 NORMAL 입니다: ${value}`);
  return line(`${CMD.SPEED},${value}`);
}

export function ping() {
  return line(CMD.PING);
}

/**
 * CAM,TAG | CAM,NUM: WonderCam 을 태그 / 숫자 인식 모드로 바꾼다 (TAG 는 펌웨어 F2, NUM 은 F3).
 * 응답: DONE,CAM / 카메라가 없으면 ERR,NO_CAM / 모드가 안 바뀌면 ERR,CAM_MODE
 *       F2 에 CAM,NUM 을 보내면 ERR,BAD_ARG (모드는 그대로)
 */
export function cam(mode) {
  if (!CAM_MODES.includes(mode)) throw new Error(`WonderCam 모드는 ${CAM_MODES.join(', ')} 입니다: ${mode}`);
  return line(`${CMD.CAM},${mode}`);
}

/**
 * 로봇 → 웹 한 줄을 객체로 바꾼다.
 *   'DONE,POSE'  → { type: 'DONE', command: 'POSE' }
 *   'TAG,3'      → { type: 'TAG', id: '3' }     (WonderCam 에 태그 3번 카드가 보임)
 *   'TAG,NONE'   → { type: 'TAG', id: null }    (보이던 카드가 사라짐)
 *   'NUM,3'      → { type: 'NUM', number: 3 }   (숫자 카드 3 이 보임, 1~5 만)
 *   'NUM,NONE'   → { type: 'NUM', number: null }
 *   'RAW,NUM,…'  → UNKNOWN (펌웨어 DEBUG_NUM 측정용 줄, 웹은 무시)
 *   'PONG'       → { type: 'PONG' }
 *   'ERR,UNKNOWN_POSE' → { type: 'ERR', message: 'UNKNOWN_POSE' }
 *   그 밖        → { type: 'UNKNOWN', raw }
 */
export function parseLine(raw) {
  const text = String(raw).trim();
  const comma = text.indexOf(',');
  const head = comma === -1 ? text : text.slice(0, comma);
  const rest = comma === -1 ? '' : text.slice(comma + 1);

  switch (head) {
    case 'DONE':
      if (rest) return { type: 'DONE', command: rest };
      break;
    case 'TAG':
      if (rest) return { type: 'TAG', id: rest === 'NONE' ? null : rest };
      break;
    case 'NUM':
      if (rest === 'NONE') return { type: 'NUM', number: null };
      if (CARD_NUMBER.test(rest)) return { type: 'NUM', number: Number(rest) };
      break;
    case 'PONG':
      if (!rest) return { type: 'PONG' };
      break;
    case 'ERR':
      return { type: 'ERR', message: rest };
  }
  return { type: 'UNKNOWN', raw: text };
}

/** 'POSE,ROCK\n' 같은 보낸 명령에서 명령 이름('POSE')만 꺼낸다. DONE 짝 맞추기에 쓴다. */
export function commandName(sentLine) {
  return sentLine.trim().split(',')[0];
}
