import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isConfirmedPose, makeWaitForPose } from './wait.js';
import { createMockHand } from './mock.js';
import poses from '../../data/poses.json';

describe('isConfirmedPose', () => {
  const opts = { now: 10_000, since: 8_000, holdMs: 1_000 };

  it('since 뒤에 만든 손모양을 holdMs 이상 유지하면 확정', () => {
    expect(isConfirmedPose({ name: 'ROCK', stableMs: 1_500 }, opts)).toBe(true);
    expect(isConfirmedPose({ name: 'ROCK', stableMs: 2_000 }, opts)).toBe(true); // 경계: 딱 since 에 시작
  });
  it('유지 시간이 짧으면 아직', () => {
    expect(isConfirmedPose({ name: 'ROCK', stableMs: 500 }, opts)).toBe(false);
  });
  it('since 전부터 들고 있던 손은 인정하지 않는다', () => {
    expect(isConfirmedPose({ name: 'ROCK', stableMs: 3_000 }, opts)).toBe(false);
  });
  it('손이 없거나 이름 없는 모양이면 무시', () => {
    expect(isConfirmedPose({ name: null, stableMs: 0 }, opts)).toBe(false);
    expect(isConfirmedPose(null, opts)).toBe(false);
  });
  it('names 를 주면 그 안의 손모양만', () => {
    const rps = { ...opts, names: ['ROCK', 'PAPER', 'V'] };
    expect(isConfirmedPose({ name: 'V', stableMs: 1_500 }, rps)).toBe(true);
    expect(isConfirmedPose({ name: 'INDEX', stableMs: 1_500 }, rps)).toBe(false);
  });
});

describe('waitForPose (Mock 손과 함께)', () => {
  let t;
  let hand;
  let waitForPose;

  beforeEach(() => {
    vi.useFakeTimers();
    t = 0;
    hand = createMockHand({ poses, now: () => t });
    waitForPose = makeWaitForPose(hand.onPose, () => t);
  });
  afterEach(() => {
    hand.destroy();
    vi.useRealTimers();
  });

  async function advance(ms) {
    for (let i = 0; i < ms / 100; i++) {
      t += 100;
      await vi.advanceTimersByTimeAsync(100);
    }
  }

  it('손모양을 holdMs 동안 유지하면 그 pose 로 resolve', async () => {
    let got;
    waitForPose({ holdMs: 1000 }).then((p) => (got = p));
    hand.select('V');
    await advance(900);
    expect(got).toBeUndefined();
    await advance(100);
    expect(got).toMatchObject({ name: 'V', code: '01100', stableMs: 1000 });
  });

  it('부르기 전부터 들고 있던 손은 다른 모양으로 바꿔야 확정', async () => {
    hand.select('ROCK');
    await advance(2000);
    let got;
    waitForPose({ holdMs: 500 }).then((p) => (got = p));
    await advance(1000);
    expect(got).toBeUndefined();
    hand.select('PAPER');
    await advance(500);
    expect(got?.name).toBe('PAPER');
  });

  it('names 밖의 손모양은 무시', async () => {
    let got;
    waitForPose({ holdMs: 300, names: ['ROCK'] }).then((p) => (got = p));
    hand.select('THUMB');
    await advance(600);
    expect(got).toBeUndefined();
    hand.select('ROCK');
    await advance(300);
    expect(got?.name).toBe('ROCK');
  });

  it('abort 하면 null 로 resolve 되고 구독이 풀린다', async () => {
    const ac = new AbortController();
    let got;
    waitForPose({ holdMs: 300, signal: ac.signal }).then((p) => (got = p));
    ac.abort();
    await advance(100);
    expect(got).toBe(null);
  });

  it('이미 abort 된 signal 이면 바로 null', async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(waitForPose({ signal: ac.signal })).resolves.toBe(null);
  });
});
