// Web Serial 로 micro:bit(AIHand, 펌웨어 F2) 와 통신하는 모듈.
// Chrome 에서만 사용한다 (회의 결정). 프로토콜: docs/protocol.md
//
// 규칙
// - 명령은 한 번에 하나씩 보낸다 (큐). 앞 명령의 응답을 받은 뒤 다음 명령을 보낸다.
// - 응답 짝 맞추기: 보낸 명령 이름과 같은 'DONE,<이름>' (PING 은 'PONG'), 또는 'ERR,…'.
// - 함수들은 reject 하지 않는다. 시간 초과·끊김도 { type: 'ERR', message } 로 resolve 해서
//   프로그램이 멈추지 않고 다음으로 진행하게 한다. (잘못된 손모양 이름만 바로 throw)
// - 시간 초과가 나면 늦게 오는 DONE 이 다음 명령의 짝으로 잘못 맞춰질 수 있다.
//   그래서 다음 명령 전에 PING 을 보내 PONG 을 받을 때까지(최대 RESYNC_TRIES 번) 순서를 다시 맞춘다.
//   동작 중에 보낸 PING 은 펌웨어가 확장보드로 통로를 돌린 사이 사라진다 (F1 실물 확인).
//   재시도해도 PONG 이 없으면 연결이 끊긴 것으로 본다.
// - 'TAG,…' 줄과 알 수 없는 줄(확장보드 잡음 등)은 기다리는 명령에 영향을 주지 않는다.
//   'TAG,…' 줄은 onTag, 'NUM,…' 줄은 onNumber 로 넘긴다 (core/card 가 받는다). 명령을 기다리는 중에 와도 된다.

import * as protocol from './protocol.js';

export const BAUD_RATE = 115200;

/** 명령별 시간 초과 (ms). 동작 시간(SLOW 기준) + 여유. docs/protocol.md 와 같게 유지 */
export const TIMEOUT_MS = Object.freeze({
  PING: 1500,
  SPEED: 1500,
  POSE: 3000, // SLOW 약 1.25초
  REST: 3000, // SLOW 약 1.25초
  REACT: 10000, // RETRY SLOW 약 6.7초
  HELLO: 10000, // SLOW 약 5.8초
  CAM: 6000, // WonderCam 모드 전환: 최악 약 5.1초 (카메라 다시 찾기 1초 + 공식 ChangeFunc 최대 4.1초)
});

/** 시간 초과 뒤 순서를 다시 맞출 때 PING 을 보내 보는 횟수 */
export const RESYNC_TRIES = 3;

export function isSerialSupported(nav = globalThis.navigator) {
  return Boolean(nav && 'serial' in nav);
}

/**
 * 포트 고르기 창을 띄우고 연다. 반드시 버튼 클릭 처리 안에서 불러야 한다 (브라우저 규칙).
 * 사용자가 창을 닫으면 NotFoundError 로 reject 된다.
 */
export async function openSerialPort(serialApi = globalThis.navigator?.serial) {
  const port = await serialApi.requestPort();
  await port.open({ baudRate: BAUD_RATE });
  return port;
}

function err(message) {
  return { type: 'ERR', message };
}

/**
 * @param {object} options
 * @param {SerialPort} options.port  열린 포트 (테스트에서는 readable·writable 이 있는 가짜 포트)
 * @param {(reason: string) => void} [options.onLost]  연결이 끊겼다고 판단했을 때 한 번 불린다
 * @param {(event: {ok: boolean, text?: string}) => void} [options.onResult]  명령 결과 알림 (상태 표시줄용)
 * @param {(id: string | null) => void} [options.onTag]  'TAG,<번호>' 줄을 받으면 번호, 'TAG,NONE' 이면 null
 * @param {(n: number | null) => void} [options.onNumber]  'NUM,<1~5>' 줄을 받으면 숫자, 'NUM,NONE' 이면 null
 * @param {object} [options.timeouts]  TIMEOUT_MS 대신 쓸 값 (테스트용)
 */
export function createSerialRobot({
  port,
  onLost = () => {},
  onResult = () => {},
  onTag = () => {},
  onNumber = () => {},
  timeouts = TIMEOUT_MS,
}) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const writer = port.writable.getWriter();
  const reader = port.readable.getReader();

  let lost = false;
  let closing = false;
  let needResync = false;
  let waiter = null; // { matches(msg), resolve(msg) } 지금 응답을 기다리는 명령
  let queue = Promise.resolve();

  // ---- 받기: 바이트 → 줄 → parseLine ----
  let pending = '';
  function handleLine(raw) {
    const msg = protocol.parseLine(raw);
    if (msg.type === 'TAG') {
      onTag(msg.id); // 카드 인식 결과는 기다리는 명령과 상관없이 바로 넘긴다
      return;
    }
    if (msg.type === 'NUM') {
      onNumber(msg.number);
      return;
    }
    if (msg.type === 'UNKNOWN') return; // 확장보드 잡음 등은 무시
    if (waiter && waiter.matches(msg)) {
      const w = waiter;
      waiter = null;
      w.resolve(msg);
    }
    // 짝이 없는 DONE·PONG·ERR (시간 초과 뒤 늦게 온 응답) 은 버린다
  }

  const reading = (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        const lines = pending.split(/\r?\n|\r/);
        pending = lines.pop();
        for (const line of lines) if (line.trim()) handleLine(line);
      }
    } catch {
      // USB 를 뽑으면 여기로 온다
    }
    markLost('연결이 끊겼어요');
  })();

  function markLost(reason) {
    if (lost) return;
    lost = true;
    if (waiter) {
      const w = waiter;
      waiter = null;
      w.resolve(err('DISCONNECTED'));
    }
    if (!closing) onLost(reason);
  }

  // ---- 보내기: 한 줄 보내고 짝이 맞는 응답 또는 시간 초과를 기다린다 ----
  function exchange(line, timeoutMs) {
    const name = protocol.commandName(line);
    const matches =
      name === protocol.CMD.PING
        ? (m) => m.type === 'PONG'
        : (m) => (m.type === 'DONE' && m.command === name) || m.type === 'ERR';
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (waiter === entry) waiter = null;
        resolve(null);
      }, timeoutMs);
      const entry = {
        matches,
        resolve(msg) {
          clearTimeout(timer);
          resolve(msg);
        },
      };
      waiter = entry;
      writer.write(encoder.encode(line)).catch(() => markLost('보내기에 실패했어요'));
    });
  }

  async function resync() {
    for (let i = 0; i < RESYNC_TRIES; i += 1) {
      if (lost) return false;
      const msg = await exchange(protocol.ping(), timeouts.PING);
      if (msg && msg.type === 'PONG') return true;
    }
    return false;
  }

  async function run(line) {
    if (lost) return err('NOT_CONNECTED');
    if (needResync) {
      if (!(await resync())) {
        markLost('AIHand 가 응답하지 않아요');
        return err('NO_RESPONSE');
      }
      needResync = false;
    }
    const name = protocol.commandName(line);
    const msg = await exchange(line, timeouts[name]);
    if (lost) return msg ?? err('DISCONNECTED');
    if (!msg) {
      needResync = true;
      onResult({ ok: false, text: '응답이 늦어 다음으로 넘어갔어요' });
      return err('TIMEOUT');
    }
    if (msg.type === 'ERR') onResult({ ok: false, text: `로봇 오류: ${msg.message}` });
    else onResult({ ok: true });
    return msg;
  }

  /** 명령 줄을 큐에 넣는다. 줄 만들기(이름 검사)는 부르는 쪽에서 먼저 해서 잘못된 이름은 바로 throw 된다. */
  function send(line) {
    const p = queue.then(() => run(line));
    queue = p.catch(() => {});
    return p;
  }

  return {
    kind: 'serial',

    // ---- ctx.robot 으로 공개되는 부분 (mock.js 와 같은 모양) ----
    hello: () => send(protocol.hello()),
    showPose: (name) => send(protocol.pose(name)),
    react: (kind) => send(protocol.react(kind)),
    rest: () => send(protocol.rest()),

    // ---- 대시보드 전용 ----
    speed: (value) => send(protocol.speed(value)),
    /** WonderCam 모드 전환 ('TAG' | 'NUM'). DONE,CAM 또는 ERR,NO_CAM 등으로 resolve */
    camMode: (mode) => send(protocol.cam(mode)),
    /** 연결 확인. 펌웨어가 막 켜졌을 수도 있으니 RESYNC_TRIES 번까지 PING 을 보낸다 */
    async check() {
      const p = queue.then(resync);
      queue = p.catch(() => {});
      return p;
    },
    isLost: () => lost,
    /** 포트 닫기 (onLost 는 부르지 않는다) */
    async close() {
      closing = true;
      try {
        await reader.cancel();
      } catch {
        /* 이미 닫힘 */
      }
      await reading;
      try {
        writer.releaseLock();
        reader.releaseLock();
        await port.close();
      } catch {
        /* 이미 닫힘 */
      }
    },
  };
}
