import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockRobot, handSvg } from './mock.js';
import poses from '../../data/poses.json';

describe('createMockRobot', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('0.8초 뒤 DONE 으로 resolve 된다', async () => {
    const robot = createMockRobot({ poses });
    let done = null;
    robot.showPose('ROCK').then((r) => (done = r));
    await vi.advanceTimersByTimeAsync(799);
    expect(done).toBe(null);
    expect(robot.getState()).toMatchObject({ code: '00000', busy: true, lastCommand: 'POSE,ROCK' });
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toEqual({ type: 'DONE', command: 'POSE' });
    expect(robot.getState().busy).toBe(false);
  });

  it('명령은 하나씩 차례로 처리된다', async () => {
    const robot = createMockRobot({ poses });
    const order = [];
    robot.showPose('V').then(() => order.push('V'));
    robot.react('ok').then(() => order.push('ok'));
    await vi.advanceTimersByTimeAsync(800);
    expect(order).toEqual(['V']);
    await vi.advanceTimersByTimeAsync(800);
    expect(order).toEqual(['V', 'ok']);
  });

  it('없는 손모양이면 바로 에러', () => {
    const robot = createMockRobot({ poses });
    expect(() => robot.showPose('NOPE')).toThrow();
  });

  it('handSvg 는 펴진 손가락 수만큼 "펴짐" 을 표시한다', () => {
    const svg = handSvg('01100');
    expect(svg.match(/<title>[^<]*펴짐/g)).toHaveLength(2);
  });
});
