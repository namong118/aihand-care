import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCard } from './index.js';
import { createRobot } from '../robot/index.js';
import colors from '../../data/colors.json';
import poses from '../../data/poses.json';

/**
 * 가짜 AIHand 포트. PING 에 PONG, CAM 에 camReply, 다른 명령에 DONE 으로 바로 답한다.
 * camReply: 문자열이면 모든 CAM 명령에 같은 답, 함수면 (보낸 줄) => 답, null 이면 답하지 않음(직접 robotSays)
 * firmware: 'F3'(기본) 은 CAM,TAG·CAM,NUM 모두 DONE,CAM / 'F2' 는 CAM,NUM 에 ERR,BAD_ARG
 * robotSays(text) 로 로봇이 보내는 줄(TAG·NUM 등)을 흉내 낸다.
 */
function fakeRobotPort({ firmware = 'F3', camReply } = {}) {
  if (camReply === undefined) {
    camReply = firmware === 'F2' ? (line) => (line === 'CAM,NUM' ? 'ERR,BAD_ARG' : 'DONE,CAM') : 'DONE,CAM';
  }
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
        const name = line.split(',')[0];
        let reply = `DONE,${name}`;
        if (name === 'PING') reply = 'PONG';
        if (name === 'CAM') reply = typeof camReply === 'function' ? camReply(line) : camReply;
        if (reply === null) return;
        controller.enqueue(enc.encode(`${reply}\n`));
      },
    }),
    close: vi.fn(async () => {}),
  };
  return {
    port,
    sent,
    robotSays: (text) => controller.enqueue(enc.encode(text)),
    unplug: () => controller.error(new Error('lost')),
  };
}

/** ports 를 차례로 여는 로봇 전환기 + 카드 전환기. got 에 onCard 로 받은 색이 쌓인다 */
function setup(...ports) {
  const queue = ports.length ? ports : [fakeRobotPort()];
  const robot = createRobot({ poses, supported: () => true, openPort: async () => queue.shift().port });
  const card = createCard({ colors, robot });
  const got = [];
  card.onCard((e) => got.push(e.color));
  return { robot, card, got };
}

async function connect(robot) {
  await robot.connect({ speed: 'NORMAL' });
  await vi.advanceTimersByTimeAsync(0); // CAM,TAG 응답 처리
}

describe('createCard (Mock ↔ 실제 WonderCam 전환)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('처음에는 Mock (개발자 입력 버튼·키보드)', () => {
    const { card } = setup();
    expect(card.kind).toBe('mock');
    expect(card.status()).toMatchObject({ state: 'mock', mock: true });
  });

  it('로봇이 없으면 Mock 만 쓴다', () => {
    const card = createCard({ colors });
    expect(card.status()).toMatchObject({ state: 'mock', mock: true });
  });

  it('AIHand 를 연결하면 CAM,TAG 로 확인하고, TAG 줄을 색으로 받는다', async () => {
    const f = fakeRobotPort();
    const { robot, card, got } = setup(f);
    await connect(robot);
    expect(f.sent).toEqual(['PING', 'CAM,TAG', 'SPEED,NORMAL', 'REST']); // REST: 연결 때 쉬는 자세 (robot/index.js)
    expect(card.kind).toBe('serial');
    expect(card.status()).toMatchObject({ state: 'connected', mock: false, note: '태그 모드 · 보이는 카드 없음' });

    f.robotSays('TAG,0\n');
    await vi.advanceTimersByTimeAsync(0);
    expect(got).toEqual(['red']);
    expect(card.status().note).toBe('태그 모드 · 보이는 카드: 빨강 (태그 0)');

    f.robotSays('TAG,NONE\nTAG,2\n');
    await vi.advanceTimersByTimeAsync(0);
    expect(got).toEqual(['red', 'yellow']);
  });

  it('카드 상태가 바뀌면 onChange 로 알린다 (개발자 입력 상태 갱신용)', async () => {
    const f = fakeRobotPort();
    const { robot, card } = setup(f);
    await connect(robot);
    const onChange = vi.fn();
    card.onChange(onChange);
    f.robotSays('TAG,1\n');
    await vi.advanceTimersByTimeAsync(0);
    expect(onChange).toHaveBeenCalled();
  });

  it('로봇 명령을 기다리는 중에 온 TAG 줄도 받는다', async () => {
    const f = fakeRobotPort();
    const { robot, got } = setup(f);
    await connect(robot);
    const p = robot.showPose('V');
    f.robotSays('TAG,1\n');
    await p;
    await vi.advanceTimersByTimeAsync(0);
    expect(got).toEqual(['blue']);
  });

  it('WonderCam 이 없으면(ERR,NO_CAM) 카드는 Mock 을 유지하고 안내한다. 로봇은 실제 그대로', async () => {
    const f = fakeRobotPort({ camReply: 'ERR,NO_CAM' });
    const { robot, card, got } = setup(f);
    await connect(robot);
    expect(robot.kind).toBe('serial');
    expect(card.kind).toBe('mock');
    expect(card.status()).toMatchObject({ state: 'missing', mock: true });
    expect(card.status().note).toContain('WonderCam을 찾지 못했어요');
    f.robotSays('TAG,0\n');
    await vi.advanceTimersByTimeAsync(0);
    expect(got).toEqual([]);
  });

  it('펌웨어 F1 이면(ERR,UNKNOWN_CMD) F3 가 필요하다고 안내한다', async () => {
    const { robot, card } = setup(fakeRobotPort({ camReply: 'ERR,UNKNOWN_CMD' }));
    await connect(robot);
    expect(card.status()).toMatchObject({ state: 'missing', note: '펌웨어 F3가 필요해요' });
  });

  it('USB 가 빠지면 카드도 Mock 으로 돌아가고, 다시 연결하면 다시 확인한다', async () => {
    const f1 = fakeRobotPort();
    const f2 = fakeRobotPort();
    const { robot, card, got } = setup(f1, f2);
    await connect(robot);
    expect(card.kind).toBe('serial');

    f1.unplug();
    await vi.advanceTimersByTimeAsync(0);
    expect(card.kind).toBe('mock');
    expect(card.status()).toMatchObject({ state: 'disconnected', mock: true });

    await connect(robot);
    expect(f2.sent).toContain('CAM,TAG');
    expect(card.kind).toBe('serial');
    f2.robotSays('TAG,3\n');
    await vi.advanceTimersByTimeAsync(0);
    expect(got).toEqual(['green']);
  });
});

describe('숫자 카드와 카메라 모드 자동 전환 (펌웨어 F3)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /** 아무것도 구독하지 않은 카드 전환기 */
  function bare(...ports) {
    const robot = createRobot({ poses, supported: () => true, openPort: async () => ports.shift().port });
    const card = createCard({ colors, robot });
    return { robot, card };
  }
  const camLines = (f) => f.sent.filter((l) => l.startsWith('CAM'));

  it('onNumber 를 구독하면 CAM,NUM 을 보내고, NUM 줄을 숫자로 받는다', async () => {
    const f = fakeRobotPort();
    const { robot, card } = bare(f);
    await connect(robot);
    expect(card.mode).toBe('TAG'); // 연결하면 처음에는 태그 모드

    const nums = [];
    card.onNumber((e) => nums.push(e.number));
    await expect(card.ready()).resolves.toBe(true);
    expect(camLines(f)).toEqual(['CAM,TAG', 'CAM,NUM']);
    expect(card.mode).toBe('NUM');

    f.robotSays('NUM,3\nNUM,NONE\nNUM,5\n');
    await vi.advanceTimersByTimeAsync(0);
    expect(nums).toEqual([3, 5]);
    expect(card.status().note).toBe('숫자 모드 · 보이는 숫자: 5');
  });

  it('RAW 측정 줄은 무시한다', async () => {
    const f = fakeRobotPort();
    const { robot, card } = bare(f);
    await connect(robot);
    const nums = [];
    card.onNumber((e) => nums.push(e.number));
    await card.ready();
    f.robotSays('RAW,NUM,4,55\nRAW,NUM,4,91\nNUM,4\n');
    await vi.advanceTimersByTimeAsync(0);
    expect(nums).toEqual([4]);
  });

  it('숫자 모드일 때는 TAG 줄을, 태그 모드일 때는 NUM 줄을 받지 않는다', async () => {
    const f = fakeRobotPort();
    const { robot, card } = bare(f);
    await connect(robot);
    const nums = [];
    const got = [];
    card.onNumber((e) => nums.push(e.number));
    card.onCard((e) => got.push(e.color));

    // 마지막 구독이 onCard → 태그 모드
    await card.ready();
    f.robotSays('NUM,2\n');
    await vi.advanceTimersByTimeAsync(0);
    expect(nums).toEqual([]);

    card.onNumber(() => {});
    await card.ready();
    f.robotSays('TAG,0\n');
    await vi.advanceTimersByTimeAsync(0);
    expect(got).toEqual([]);
  });

  it('TAG ↔ NUM 자동 전환: 구독을 해제해도 모드는 그대로, 다른 종류를 구독하면 바뀐다', async () => {
    const f = fakeRobotPort();
    const { robot, card } = bare(f);
    await connect(robot);

    const offNum = card.onNumber(() => {});
    await card.ready();
    offNum();
    await vi.advanceTimersByTimeAsync(0);
    expect(card.mode).toBe('NUM'); // 해제해도 그대로

    // STEP 3 처럼 문제마다 onCard 구독·해제를 되풀이해도 CAM,TAG 는 한 번만
    for (let i = 0; i < 3; i += 1) {
      const off = card.onCard(() => {});
      await card.ready();
      off();
    }
    expect(card.mode).toBe('TAG');
    expect(camLines(f)).toEqual(['CAM,TAG', 'CAM,NUM', 'CAM,TAG']);
  });

  it('모드를 바꾸는 동안 상태는 "모드 바꾸는 중", ready 는 바꾸기가 끝날 때 resolve', async () => {
    const f = fakeRobotPort({ camReply: (line) => (line === 'CAM,NUM' ? null : 'DONE,CAM') });
    const { robot, card } = bare(f);
    await connect(robot);
    card.onNumber(() => {});
    let ready = null;
    card.ready().then((r) => (ready = r));
    await vi.advanceTimersByTimeAsync(3000); // 카메라가 전환에 3초 걸리는 중
    expect(card.status()).toMatchObject({ state: 'switching', note: '숫자 모드로' });
    expect(ready).toBe(null);

    f.robotSays('DONE,CAM\n');
    await vi.advanceTimersByTimeAsync(0);
    expect(ready).toBe(true);
    expect(card.status().state).toBe('connected');
  });

  it('바꾸는 중에 원하는 모드가 다시 바뀌면, 끝난 뒤 이어서 바꾸고 ready 는 그때 resolve', async () => {
    const f = fakeRobotPort();
    const { robot, card } = bare(f);
    await connect(robot);
    card.onNumber(() => {});
    card.onCard(() => {});
    await expect(card.ready()).resolves.toBe(true);
    expect(card.mode).toBe('TAG');
    expect(camLines(f)).toEqual(['CAM,TAG', 'CAM,NUM', 'CAM,TAG']);
  });

  it('CAM,NUM 이 실패하면(ERR,CAM_MODE) Mock 숫자 입력으로 계속하고, 같은 연결에서 다시 시도하지 않는다', async () => {
    const f = fakeRobotPort({ camReply: (line) => (line === 'CAM,NUM' ? 'ERR,CAM_MODE' : 'DONE,CAM') });
    const { robot, card } = bare(f);
    await connect(robot);
    card.onNumber(() => {});
    await expect(card.ready()).resolves.toBe(false);
    expect(card.mode).toBe(null);
    expect(card.status()).toMatchObject({ state: 'missing', mock: true });
    expect(card.status().note).toContain('WonderCam 모드를 바꾸지 못했어요');

    card.onNumber(() => {});
    await card.ready();
    expect(f.sent.filter((l) => l === 'CAM,NUM')).toHaveLength(1);
  });

  it('카메라가 없으면(ERR,NO_CAM) 숫자 모드도 시도하지 않는다', async () => {
    const f = fakeRobotPort({ camReply: 'ERR,NO_CAM' });
    const { robot, card } = bare(f);
    await connect(robot);
    card.onNumber(() => {});
    await expect(card.ready()).resolves.toBe(false);
    expect(camLines(f)).toEqual(['CAM,TAG']);
  });

  it('펌웨어 F2 로 연결하면: 색 카드는 실제, 숫자 카드는 F3 가 필요하다고 안내하고 Mock 으로', async () => {
    const f = fakeRobotPort({ firmware: 'F2' });
    const { robot, card } = bare(f);
    await connect(robot);
    expect(card.mode).toBe('TAG');

    card.onNumber(() => {});
    await expect(card.ready()).resolves.toBe(false);
    expect(card.mode).toBe('TAG'); // F2 는 BAD_ARG 뒤에도 태그 모드 그대로
    expect(card.status().note).toContain('숫자 카드는 펌웨어 F3가 필요해요');

    const got = [];
    card.onCard((e) => got.push(e.color));
    await expect(card.ready()).resolves.toBe(true);
    f.robotSays('TAG,1\n');
    await vi.advanceTimersByTimeAsync(0);
    expect(got).toEqual(['blue']);
    expect(camLines(f)).toEqual(['CAM,TAG', 'CAM,NUM']); // 이미 태그 모드라 다시 보내지 않는다
  });

  it('숫자 화면을 연 채로 AIHand 를 연결하면 처음부터 CAM,NUM 으로 맞춘다', async () => {
    const f = fakeRobotPort();
    const { robot, card } = bare(f);
    card.onNumber(() => {});
    await expect(card.ready()).resolves.toBe(false); // 아직 연결 전: Mock 만
    await connect(robot);
    expect(f.sent).toEqual(['PING', 'CAM,NUM', 'SPEED,NORMAL', 'REST']);
    expect(card.mode).toBe('NUM');
  });

  it('숫자 모드에서 연결이 끊기면 Mock 으로 돌아간다', async () => {
    const f = fakeRobotPort();
    const { robot, card } = bare(f);
    await connect(robot);
    card.onNumber(() => {});
    await card.ready();
    f.unplug();
    await vi.advanceTimersByTimeAsync(0);
    expect(card.mode).toBe(null);
    expect(card.status()).toMatchObject({ state: 'disconnected', mock: true });
    await expect(card.ready()).resolves.toBe(false);
  });
});
