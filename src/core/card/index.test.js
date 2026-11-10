import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCard } from './index.js';
import { createRobot } from '../robot/index.js';
import colors from '../../data/colors.json';
import poses from '../../data/poses.json';

/**
 * 가짜 AIHand(펌웨어 F2) 포트. PING 에 PONG, CAM 에 camReply, 다른 명령에 DONE 으로 바로 답한다.
 * robotSays(text) 로 로봇이 보내는 줄(TAG 등)을 흉내 낸다.
 */
function fakeRobotPort({ camReply = 'DONE,CAM' } = {}) {
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
        if (name === 'CAM') reply = camReply;
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
    expect(f.sent).toEqual(['PING', 'CAM,TAG', 'SPEED,NORMAL']);
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

  it('펌웨어 F1 이면(ERR,UNKNOWN_CMD) F2 가 필요하다고 안내한다', async () => {
    const { robot, card } = setup(fakeRobotPort({ camReply: 'ERR,UNKNOWN_CMD' }));
    await connect(robot);
    expect(card.status()).toMatchObject({ state: 'missing', note: '펌웨어 F2가 필요해요' });
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
