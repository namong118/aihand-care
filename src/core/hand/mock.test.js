import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockHand } from './mock.js';
import { codeToName, nameToCode } from './codes.js';
import poses from '../../data/poses.json';

describe('codeToName / nameToCode', () => {
  it('code 와 이름을 서로 바꾼다', () => {
    expect(codeToName('01100', poses)).toBe('V');
    expect(nameToCode('ROCK', poses)).toBe('00000');
  });
  it('없는 값이면 null', () => {
    expect(codeToName(null, poses)).toBe(null);
    expect(codeToName('10101', poses)).toBe(null);
    expect(nameToCode('NOPE', poses)).toBe(null);
  });
});

describe('poses.json', () => {
  it('손모양 7개, 이름과 code 가 겹치지 않는다', () => {
    expect(poses).toHaveLength(7);
    expect(new Set(poses.map((p) => p.name)).size).toBe(7);
    expect(new Set(poses.map((p) => p.code)).size).toBe(7);
    for (const p of poses) expect(p.code).toMatch(/^[01]{5}$/);
  });
});

describe('createMockHand (토글 방식)', () => {
  let t;
  let hand;
  const events = [];

  beforeEach(() => {
    vi.useFakeTimers();
    t = 0;
    events.length = 0;
    hand = createMockHand({ poses, now: () => t });
    hand.onPose((p) => events.push(p));
  });
  afterEach(() => {
    hand.destroy();
    vi.useRealTimers();
  });

  function advance(ms) {
    for (let i = 0; i < ms / 100; i++) {
      t += 100;
      vi.advanceTimersByTime(100);
    }
  }

  it('한 번 누르면 계속 유지되고 stableMs 가 늘어난다', () => {
    hand.select('ROCK');
    advance(500);
    const last = events.at(-1);
    expect(last.name).toBe('ROCK');
    expect(last.code).toBe('00000');
    expect(last.stableMs).toBe(500);
    expect(events.length).toBe(6); // 누른 순간 1번 + 0.1초마다 5번
  });

  it('다른 손모양을 누르면 바뀌고 stableMs 가 0부터 다시 센다', () => {
    hand.select('ROCK');
    advance(300);
    hand.select('PAPER');
    expect(events.at(-1)).toMatchObject({ name: 'PAPER', stableMs: 0 });
    advance(200);
    expect(events.at(-1)).toMatchObject({ name: 'PAPER', stableMs: 200 });
  });

  it('같은 손모양을 다시 눌러도 stableMs 는 이어진다', () => {
    hand.select('V');
    advance(300);
    hand.select('V');
    expect(events.at(-1).stableMs).toBe(300);
  });

  it('손 내리기를 누르면 code null 을 보내고 멈춘다', () => {
    hand.select('ROCK');
    advance(200);
    hand.lower();
    expect(events.at(-1)).toEqual({ code: null, name: null, handedness: null, stableMs: 0 });
    const count = events.length;
    advance(500);
    expect(events.length).toBe(count);
  });

  it('구독 해제 함수를 부르면 더 받지 않는다', () => {
    const got = [];
    const off = hand.onPose((p) => got.push(p));
    hand.select('ROCK');
    off();
    advance(300);
    expect(got.length).toBe(1);
  });
});
