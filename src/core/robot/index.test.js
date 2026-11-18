import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRobot, PLUG_WAIT_MS } from './index.js';
import poses from '../../data/poses.json';

/** PING 에는 PONG, 다른 명령에는 DONE 으로 바로 답하는 가짜 AIHand 포트 */
function fakeRobotPort({ silent = false } = {}) {
  const sent = [];
  let controller;
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const port = {
    readable: new ReadableStream({ start: (c) => (controller = c) }),
    writable: new WritableStream({
      write(chunk) {
        const line = dec.decode(chunk).trim();
        sent.push(line);
        if (silent) return;
        const name = line.split(',')[0];
        controller.enqueue(enc.encode(name === 'PING' ? 'PONG\n' : `DONE,${name}\n`));
      },
    }),
    close: vi.fn(async () => {}),
  };
  return { port, sent, unplug: () => controller.error(new Error('lost')) };
}

describe('createRobot (Mock ↔ 실제 AIHand 전환)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('처음에는 Mock', () => {
    const robot = createRobot({ poses, supported: () => true });
    expect(robot.kind).toBe('mock');
    expect(robot.status()).toMatchObject({ state: 'mock', mock: true });
  });

  it('Chrome 이 아니면 안내 문구를 보여주고 Mock 을 유지한다', async () => {
    const robot = createRobot({ poses, supported: () => false });
    await expect(robot.connect()).resolves.toBe(false);
    expect(robot.status().note).toBe('연결하려면 Chrome에서 열어 주세요');
    expect(robot.kind).toBe('mock');
  });

  it('연결하면 PING 확인 후 실제 AIHand 를 쓰고, 진행 속도와 쉬는 자세를 보낸다', async () => {
    const f = fakeRobotPort();
    const robot = createRobot({ poses, supported: () => true, openPort: async () => f.port });
    const onChange = vi.fn();
    robot.onChange(onChange);
    await expect(robot.connect({ speed: 'SLOW' })).resolves.toBe(true);
    // REST: 서보의 첫 움직임은 최고 속도라서 연결할 때 미리 한 번 움직여 둔다
    expect(f.sent).toEqual(['PING', 'SPEED,SLOW', 'REST']);
    expect(robot.kind).toBe('serial');
    expect(robot.status()).toMatchObject({ state: 'connected', mock: false });
    expect(onChange).toHaveBeenCalled();

    await expect(robot.showPose('V')).resolves.toEqual({ type: 'DONE', command: 'POSE' });
    await robot.setSpeed('NORMAL');
    expect(f.sent.slice(3)).toEqual(['POSE,V', 'SPEED,NORMAL']);
  });

  it('PONG 이 없으면 연결하지 않고 Mock 을 유지한다', async () => {
    const f = fakeRobotPort({ silent: true });
    const robot = createRobot({ poses, supported: () => true, openPort: async () => f.port });
    const p = robot.connect();
    await vi.advanceTimersByTimeAsync(10000);
    await expect(p).resolves.toBe(false);
    expect(robot.kind).toBe('mock');
    expect(f.port.close).toHaveBeenCalled();
  });

  it('연결이 끊기면 Mock 으로 돌아가고 "연결 안 됨" 으로 표시한다', async () => {
    const f = fakeRobotPort();
    const robot = createRobot({ poses, supported: () => true, openPort: async () => f.port });
    await robot.connect();
    f.unplug();
    await vi.advanceTimersByTimeAsync(0);
    expect(robot.kind).toBe('mock');
    expect(robot.status()).toMatchObject({ state: 'disconnected', mock: true });
    expect(f.port.close).toHaveBeenCalled(); // 다시 연결할 수 있게 포트를 닫는다
    // 활동은 화면 속 로봇손으로 계속된다
    const p = robot.rest();
    await vi.advanceTimersByTimeAsync(800);
    await expect(p).resolves.toEqual({ type: 'DONE', command: 'REST' });
  });

  it('포트 고르기 창을 닫으면 조용히 Mock 유지', async () => {
    const robot = createRobot({
      poses,
      supported: () => true,
      openPort: async () => {
        throw Object.assign(new Error('no port'), { name: 'NotFoundError' });
      },
    });
    await expect(robot.connect()).resolves.toBe(false);
    expect(robot.status().note).toBe('화면 속 로봇손');
  });

  it('끊긴 뒤 "AIHand 연결" 을 다시 누르면 다시 연결된다', async () => {
    const first = fakeRobotPort();
    const second = fakeRobotPort();
    const ports = [first.port, second.port];
    const robot = createRobot({ poses, supported: () => true, openPort: async () => ports.shift() });
    await robot.connect();
    first.unplug();
    await vi.advanceTimersByTimeAsync(0);
    expect(robot.status().state).toBe('disconnected');
    await expect(robot.connect()).resolves.toBe(true);
    expect(robot.status()).toMatchObject({ state: 'connected', mock: false, note: '' });
    await expect(robot.rest()).resolves.toEqual({ type: 'DONE', command: 'REST' });
    expect(second.sent).toEqual(['PING', 'REST', 'REST']); // 연결 때 한 번 + 위에서 한 번
  });

  describe('자동 연결 (startAutoConnect, 키오스크)', () => {
    /** navigator.serial 의 'connect' 이벤트 흉내 */
    function fakeSerialEvents() {
      const handlers = new Set();
      return {
        addEventListener: (type, cb) => type === 'connect' && handlers.add(cb),
        removeEventListener: (type, cb) => type === 'connect' && handlers.delete(cb),
        plug: () => handlers.forEach((cb) => cb()),
        count: () => handlers.size,
      };
    }

    it('허락한 포트가 없으면 아무것도 하지 않고 Mock 을 유지한다', async () => {
      const openPort = vi.fn();
      const robot = createRobot({ poses, supported: () => true, openPort, openGranted: async () => null, serialEvents: fakeSerialEvents() });
      robot.startAutoConnect();
      await vi.advanceTimersByTimeAsync(0);
      expect(robot.kind).toBe('mock');
      expect(robot.status()).toMatchObject({ state: 'mock', note: '화면 속 로봇손', connecting: false });
      expect(openPort).not.toHaveBeenCalled(); // 고르기 창은 띄우지 않는다
    });

    it('허락한 포트가 없으면 "연결 중…"을 끄고 상태 표시줄에 알린다 (버튼이 계속 막히지 않게)', async () => {
      const robot = createRobot({ poses, supported: () => true, openGranted: async () => null, serialEvents: fakeSerialEvents() });
      const seen = []; // 상태 표시줄이 다시 그릴 때마다 보는 값
      robot.onChange(() => seen.push(robot.status().connecting));
      robot.startAutoConnect();
      await vi.advanceTimersByTimeAsync(0);
      expect(seen.at(-1)).toBe(false);
    });

    it('PONG 이 없어 실패해도 "연결 중…"을 끄고 알린다', async () => {
      const f = fakeRobotPort({ silent: true });
      const robot = createRobot({ poses, supported: () => true, openGranted: async () => f.port, serialEvents: fakeSerialEvents() });
      const seen = [];
      robot.onChange(() => seen.push(robot.status().connecting));
      robot.startAutoConnect();
      await vi.advanceTimersByTimeAsync(10000);
      expect(seen).toContain(true);
      expect(seen.at(-1)).toBe(false);
    });

    it('허락한 포트가 있으면 켤 때 바로 연결하고 그때의 진행 속도를 보낸다', async () => {
      const f = fakeRobotPort();
      const robot = createRobot({ poses, supported: () => true, openGranted: async () => f.port, serialEvents: fakeSerialEvents() });
      robot.startAutoConnect(() => 'SLOW');
      await vi.advanceTimersByTimeAsync(0);
      expect(robot.kind).toBe('serial');
      expect(f.sent).toEqual(['PING', 'SPEED,SLOW', 'REST']);
    });

    it('USB 를 다시 꽂으면 잠깐 기다렸다가 다시 연결한다', async () => {
      const first = fakeRobotPort();
      const second = fakeRobotPort();
      const granted = [first.port, second.port];
      const events = fakeSerialEvents();
      const robot = createRobot({ poses, supported: () => true, openGranted: async () => granted.shift() ?? null, serialEvents: events });
      robot.startAutoConnect();
      await vi.advanceTimersByTimeAsync(0);
      first.unplug();
      await vi.advanceTimersByTimeAsync(0);
      expect(robot.status().state).toBe('disconnected');

      events.plug();
      await vi.advanceTimersByTimeAsync(PLUG_WAIT_MS - 1);
      expect(robot.kind).toBe('mock'); // micro:bit 가 켜지는 동안은 기다린다
      await vi.advanceTimersByTimeAsync(1);
      expect(robot.kind).toBe('serial');
      expect(second.sent).toEqual(['PING', 'REST']);
    });

    it('이미 연결되어 있으면 꽂기 이벤트가 와도 다시 열지 않는다', async () => {
      const f = fakeRobotPort();
      const openGranted = vi.fn(async () => f.port);
      const events = fakeSerialEvents();
      const robot = createRobot({ poses, supported: () => true, openGranted, serialEvents: events });
      robot.startAutoConnect();
      await vi.advanceTimersByTimeAsync(0);
      events.plug();
      await vi.advanceTimersByTimeAsync(PLUG_WAIT_MS);
      expect(openGranted).toHaveBeenCalledTimes(1);
    });

    it('그만두기 함수를 부르면 꽂기 이벤트를 더 듣지 않는다', () => {
      const events = fakeSerialEvents();
      const robot = createRobot({ poses, supported: () => true, openGranted: async () => null, serialEvents: events });
      const stop = robot.startAutoConnect();
      expect(events.count()).toBe(1);
      stop();
      expect(events.count()).toBe(0);
    });

    it('Chrome 이 아니면 아무것도 하지 않는다', () => {
      const openGranted = vi.fn();
      const robot = createRobot({ poses, supported: () => false, openGranted, serialEvents: fakeSerialEvents() });
      robot.startAutoConnect();
      expect(openGranted).not.toHaveBeenCalled();
    });
  });
});
