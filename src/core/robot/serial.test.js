import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSerialRobot, TIMEOUT_MS, RESYNC_TRIES } from './serial.js';

/** 진짜 포트 대신 쓰는 가짜 포트. robotSays(text) 로 로봇이 보낸 글자를 흉내 낸다 */
function fakePort() {
  const sent = [];
  let controller;
  const decoder = new TextDecoder();
  const port = {
    readable: new ReadableStream({
      start(c) {
        controller = c;
      },
    }),
    writable: new WritableStream({
      write(chunk) {
        sent.push(decoder.decode(chunk));
      },
    }),
    close: vi.fn(async () => {}),
  };
  const encoder = new TextEncoder();
  return {
    port,
    sent,
    robotSays: (text) => controller.enqueue(encoder.encode(text)),
    unplug: () => controller.error(new Error('device lost')),
  };
}

/** 보낸 줄이 n 개가 될 때까지 기다린다 */
async function untilSent(sent, n) {
  for (let i = 0; i < 50 && sent.length < n; i += 1) await vi.advanceTimersByTimeAsync(0);
  expect(sent.length).toBe(n);
}

describe('createSerialRobot', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('명령을 보내고 DONE 을 받으면 parse 결과로 resolve 된다', async () => {
    const f = fakePort();
    const robot = createSerialRobot({ port: f.port });
    const p = robot.showPose('V');
    await untilSent(f.sent, 1);
    expect(f.sent[0]).toBe('POSE,V\n');
    f.robotSays('DONE,POSE\r\n');
    await expect(p).resolves.toEqual({ type: 'DONE', command: 'POSE' });
  });

  it('한 줄이 여러 조각으로 와도 합쳐서 읽는다', async () => {
    const f = fakePort();
    const robot = createSerialRobot({ port: f.port });
    const p = robot.rest();
    await untilSent(f.sent, 1);
    f.robotSays('DO');
    f.robotSays('NE,RE');
    f.robotSays('ST\n');
    await expect(p).resolves.toEqual({ type: 'DONE', command: 'REST' });
  });

  it('명령은 하나씩 보낸다: 앞 명령의 DONE 전에는 다음 명령을 보내지 않는다', async () => {
    const f = fakePort();
    const robot = createSerialRobot({ port: f.port });
    const a = robot.showPose('ROCK');
    const b = robot.react('ok');
    await untilSent(f.sent, 1);
    await vi.advanceTimersByTimeAsync(500);
    expect(f.sent).toEqual(['POSE,ROCK\n']);
    f.robotSays('DONE,POSE\n');
    await a;
    await untilSent(f.sent, 2);
    expect(f.sent[1]).toBe('REACT,OK\n');
    f.robotSays('DONE,REACT\n');
    await expect(b).resolves.toEqual({ type: 'DONE', command: 'REACT' });
  });

  it('잡음 줄과 TAG 줄, 다른 명령의 DONE 은 기다리는 명령에 영향이 없다', async () => {
    const f = fakePort();
    const robot = createSerialRobot({ port: f.port });
    let result = null;
    robot.hello().then((r) => (result = r));
    await untilSent(f.sent, 1);
    f.robotSays('A05595C$\nTAG,3\nDONE,POSE\nPONG\n');
    await vi.advanceTimersByTimeAsync(100);
    expect(result).toBe(null);
    f.robotSays('DONE,HELLO\n');
    await vi.advanceTimersByTimeAsync(0);
    expect(result).toEqual({ type: 'DONE', command: 'HELLO' });
  });

  it('ERR 를 받으면 ERR 로 resolve 되고 알림을 보낸다', async () => {
    const f = fakePort();
    const onResult = vi.fn();
    const robot = createSerialRobot({ port: f.port, onResult });
    const p = robot.showPose('THUMB');
    await untilSent(f.sent, 1);
    f.robotSays('ERR,UNKNOWN_POSE\n');
    await expect(p).resolves.toEqual({ type: 'ERR', message: 'UNKNOWN_POSE' });
    expect(onResult).toHaveBeenCalledWith({ ok: false, text: '로봇 오류: UNKNOWN_POSE' });
  });

  it('잘못된 손모양 이름은 Promise 전에 바로 throw 한다', () => {
    const f = fakePort();
    const robot = createSerialRobot({ port: f.port });
    expect(() => robot.showPose('nope')).toThrow();
    expect(() => robot.react('maybe')).toThrow();
  });

  it('시간 초과는 reject 하지 않고 TIMEOUT 으로 resolve 된다 (명령별 시간)', async () => {
    const f = fakePort();
    const onResult = vi.fn();
    const robot = createSerialRobot({ port: f.port, onResult });
    let result = null;
    robot.react('retry').then((r) => (result = r));
    await untilSent(f.sent, 1);
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS.REACT - 1);
    expect(result).toBe(null);
    await vi.advanceTimersByTimeAsync(1);
    expect(result).toEqual({ type: 'ERR', message: 'TIMEOUT' });
    expect(onResult).toHaveBeenCalledWith({ ok: false, text: expect.any(String) });
  });

  it('시간 초과 뒤에는 PING 으로 순서를 맞추고, 늦게 온 DONE 은 다음 명령의 짝이 되지 않는다', async () => {
    const f = fakePort();
    const robot = createSerialRobot({ port: f.port });
    const first = robot.showPose('V');
    await untilSent(f.sent, 1);
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS.POSE);
    await expect(first).resolves.toEqual({ type: 'ERR', message: 'TIMEOUT' });

    let second = null;
    robot.showPose('ROCK').then((r) => (second = r));
    await untilSent(f.sent, 2);
    expect(f.sent[1]).toBe('PING\n');
    f.robotSays('DONE,POSE\n'); // 첫 명령의 늦은 응답: 버려져야 한다
    await vi.advanceTimersByTimeAsync(0);
    expect(f.sent).toHaveLength(2);
    f.robotSays('PONG\n');
    await untilSent(f.sent, 3);
    expect(f.sent[2]).toBe('POSE,ROCK\n');
    expect(second).toBe(null);
    f.robotSays('DONE,POSE\n');
    await vi.advanceTimersByTimeAsync(0);
    expect(second).toEqual({ type: 'DONE', command: 'POSE' });
  });

  it('동작 중이라 PING 이 사라져도 재시도해서 PONG 을 받으면 이어간다', async () => {
    const f = fakePort();
    const robot = createSerialRobot({ port: f.port });
    robot.hello();
    await untilSent(f.sent, 1);
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS.HELLO);

    const next = robot.rest();
    await untilSent(f.sent, 2); // PING 1번째: 응답 없음
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS.PING);
    await untilSent(f.sent, 3); // PING 2번째
    expect(f.sent[2]).toBe('PING\n');
    f.robotSays('PONG\n');
    await untilSent(f.sent, 4);
    expect(f.sent[3]).toBe('REST\n');
    f.robotSays('DONE,REST\n');
    await expect(next).resolves.toEqual({ type: 'DONE', command: 'REST' });
  });

  it(`PING 을 ${RESYNC_TRIES}번 보내도 PONG 이 없으면 연결이 끊긴 것으로 본다`, async () => {
    const f = fakePort();
    const onLost = vi.fn();
    const robot = createSerialRobot({ port: f.port, onLost });
    robot.rest();
    await untilSent(f.sent, 1);
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS.REST);

    let result = null;
    robot.showPose('V').then((r) => (result = r));
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS.PING * RESYNC_TRIES);
    expect(f.sent.slice(1)).toEqual(Array(RESYNC_TRIES).fill('PING\n'));
    expect(result).toEqual({ type: 'ERR', message: 'NO_RESPONSE' });
    expect(onLost).toHaveBeenCalledTimes(1);
    await expect(robot.rest()).resolves.toEqual({ type: 'ERR', message: 'NOT_CONNECTED' });
  });

  it('USB 가 빠지면 기다리던 명령은 DISCONNECTED 로 끝나고 onLost 가 불린다', async () => {
    const f = fakePort();
    const onLost = vi.fn();
    const robot = createSerialRobot({ port: f.port, onLost });
    const p = robot.react('ok');
    await untilSent(f.sent, 1);
    f.unplug();
    await expect(p).resolves.toEqual({ type: 'ERR', message: 'DISCONNECTED' });
    expect(onLost).toHaveBeenCalledTimes(1);
    expect(robot.isLost()).toBe(true);
  });

  it('check() 는 PONG 을 받으면 true', async () => {
    const f = fakePort();
    const robot = createSerialRobot({ port: f.port });
    const p = robot.check();
    await untilSent(f.sent, 1);
    f.robotSays('PONG\n');
    await expect(p).resolves.toBe(true);
  });

  it('TAG 줄은 명령을 기다리는 중에도 onTag 로 넘긴다 (NONE 은 null)', async () => {
    const f = fakePort();
    const onTag = vi.fn();
    const robot = createSerialRobot({ port: f.port, onTag });
    const p = robot.rest();
    await untilSent(f.sent, 1);
    f.robotSays('TAG,2\nTAG,NONE\nDONE,REST\n');
    await expect(p).resolves.toEqual({ type: 'DONE', command: 'REST' });
    expect(onTag.mock.calls).toEqual([['2'], [null]]);
  });

  it('camMode 는 CAM,TAG 를 보내고 DONE,CAM 또는 ERR 로 끝난다', async () => {
    const f = fakePort();
    const robot = createSerialRobot({ port: f.port });
    const a = robot.camMode('TAG');
    await untilSent(f.sent, 1);
    expect(f.sent[0]).toBe('CAM,TAG\n');
    f.robotSays('DONE,CAM\n');
    await expect(a).resolves.toEqual({ type: 'DONE', command: 'CAM' });

    const b = robot.camMode('TAG');
    await untilSent(f.sent, 2);
    f.robotSays('ERR,NO_CAM\n');
    await expect(b).resolves.toEqual({ type: 'ERR', message: 'NO_CAM' });
  });

  it('WonderCam 모드 전환은 최악 약 5.1초가 걸려도 시간 초과가 아니다', async () => {
    const f = fakePort();
    const robot = createSerialRobot({ port: f.port });
    let result = null;
    robot.camMode('TAG').then((r) => (result = r));
    await untilSent(f.sent, 1);
    await vi.advanceTimersByTimeAsync(5100);
    f.robotSays('DONE,CAM\n');
    await vi.advanceTimersByTimeAsync(0);
    expect(result).toEqual({ type: 'DONE', command: 'CAM' });
  });

  it('NUM 줄은 onNumber 로 넘기고, RAW 측정 줄은 무시한다 (기다리는 명령에도 영향 없음)', async () => {
    const f = fakePort();
    const onNumber = vi.fn();
    const onTag = vi.fn();
    const robot = createSerialRobot({ port: f.port, onNumber, onTag });
    const p = robot.camMode('NUM');
    await untilSent(f.sent, 1);
    expect(f.sent[0]).toBe('CAM,NUM\n');
    f.robotSays('RAW,NUM,3,87\nNUM,3\nRAW,NUM,0,12\nNUM,NONE\nDONE,CAM\n');
    await expect(p).resolves.toEqual({ type: 'DONE', command: 'CAM' });
    expect(onNumber.mock.calls).toEqual([[3], [null]]);
    expect(onTag).not.toHaveBeenCalled();
  });
});
