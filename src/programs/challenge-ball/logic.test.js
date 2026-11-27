import { PLAY_LEVEL } from './logic.js';
import { describe, it, expect } from 'vitest';
import {
  EXCHANGES, ALL_PAIRS, levelSpec, defaultLevel, otherHand, makeInstructions, samePair, instructionText,
  beatMs, hideMs, receiveHoldMs, receiveWaitMs, RECEIVE_POSES, isReceivePose, summarizeSession,
} from './logic.js';

// 매번 다른 값을 주는 간단한 의사 난수 (seed 고정)
const lcg = (seed) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

describe('levelSpec · defaultLevel', () => {
  it('3단계만 지시를 가린다', () => {
    expect(levelSpec(1).hide).toBe(false);
    expect(levelSpec(2).hide).toBe(false);
    expect(levelSpec(3).hide).toBe(true);
  });

  it('1~3이 아니면 1단계', () => {
    expect(levelSpec(0)).toEqual(levelSpec(1));
    expect(levelSpec(undefined)).toEqual(levelSpec(1));
  });

  it('미리 고른 단계: 1·2·3이면 그대로, 아니면 1', () => {
    expect(defaultLevel(2)).toBe(2);
    expect(defaultLevel(3)).toBe(3);
    expect(defaultLevel(undefined)).toBe(1);
    expect(defaultLevel(4)).toBe(1);
    expect(defaultLevel('2')).toBe(1);
  });
});

describe('otherHand · samePair · instructionText', () => {
  it('반대 손', () => {
    expect(otherHand('right')).toBe('left');
    expect(otherHand('left')).toBe('right');
  });

  it('같은 지시인지', () => {
    expect(samePair({ give: 'right', receive: 'left' }, { give: 'right', receive: 'left' })).toBe(true);
    expect(samePair({ give: 'right', receive: 'left' }, { give: 'left', receive: 'left' })).toBe(false);
    expect(samePair(undefined, { give: 'left', receive: 'left' })).toBe(false);
  });

  it('지시 글자', () => {
    expect(instructionText({ give: 'right', receive: 'left' })).toBe('오른손으로 건네고, 왼손으로 받아요');
    expect(instructionText({ give: 'left', receive: 'left' })).toBe('왼손으로 건네고, 왼손으로 받아요');
    expect(instructionText({ give: 'any', receive: 'same' })).toBe('편한 손으로 건네고, 같은 손으로 받아요');
  });
});

describe('makeInstructions', () => {
  it('기본 횟수는 한 회차 주고받기 수 (쥐는 횟수 10번 이하)', () => {
    expect(makeInstructions(1)).toHaveLength(EXCHANGES);
    expect(EXCHANGES).toBeLessThanOrEqual(10);
  });

  it('1단계: 손을 정하지 않고 편한 손으로 건네고 같은 손으로 받기', () => {
    expect(makeInstructions(1, 3)).toEqual([
      { give: 'any', receive: 'same' },
      { give: 'any', receive: 'same' },
      { give: 'any', receive: 'same' },
    ]);
    expect(makeInstructions(1, 1, 'left')).toEqual([{ give: 'any', receive: 'same' }]);
  });

  it('손을 모르는 값으로 주면 2단계는 오른손부터', () => {
    expect(makeInstructions(2, 1, 'up')).toEqual([{ give: 'right', receive: 'left' }]);
  });

  it('2단계: 건네는 손과 받는 손이 다르고, 번마다 번갈아', () => {
    expect(makeInstructions(2, 4, 'right')).toEqual([
      { give: 'right', receive: 'left' },
      { give: 'left', receive: 'right' },
      { give: 'right', receive: 'left' },
      { give: 'left', receive: 'right' },
    ]);
    expect(makeInstructions(2, 2, 'left')[0]).toEqual({ give: 'left', receive: 'right' });
  });

  it('3단계: 4가지 지시 중에서, 바로 앞과 같은 지시는 이어 나오지 않음', () => {
    for (const seed of [1, 2, 3, 42, 777, 2026]) {
      const list = makeInstructions(3, 30, 'right', lcg(seed));
      expect(list).toHaveLength(30);
      list.forEach((p, i) => {
        expect(ALL_PAIRS.some((q) => samePair(p, q))).toBe(true);
        if (i > 0) expect(samePair(p, list[i - 1])).toBe(false);
      });
    }
  });

  it('3단계: 충분히 하면 4가지가 모두 나온다', () => {
    const list = makeInstructions(3, 40, 'right', lcg(7));
    for (const pair of ALL_PAIRS) expect(list.some((p) => samePair(p, pair))).toBe(true);
  });

  it('3단계: rand 가 1에 가까워도 범위 안에서 고른다', () => {
    const list = makeInstructions(3, 5, 'right', () => 0.9999999);
    list.forEach((p) => expect(ALL_PAIRS.some((q) => samePair(p, q))).toBe(true));
  });

  it('돌려준 목록을 고쳐도 ALL_PAIRS 는 그대로', () => {
    const list = makeInstructions(3, 1, 'right', () => 0);
    list[0].give = 'left';
    list[0].receive = 'left';
    expect(ALL_PAIRS[0]).toEqual({ give: 'right', receive: 'right' });
  });
});

describe('시간 값', () => {
  it('속도 느리게면 더 길다', () => {
    for (const fn of [beatMs, hideMs, receiveHoldMs, receiveWaitMs]) {
      expect(fn('SLOW')).toBeGreaterThan(fn('NORMAL'));
    }
  });

  it('받을 손을 기다리며 공을 쥐는 시간은 15초를 넘지 않는다 (서보 보호)', () => {
    expect(receiveWaitMs('NORMAL')).toBeLessThanOrEqual(15000);
    expect(receiveWaitMs('SLOW')).toBeLessThanOrEqual(15000);
  });

  it('받기 모양 확정은 1초 안 (손을 받친 채 오래 들지 않게)', () => {
    expect(receiveHoldMs('NORMAL')).toBeLessThan(1000);
    expect(receiveHoldMs('SLOW')).toBeLessThan(1000);
  });
});

describe('받기 모양', () => {
  it('펼친 손(PAPER)과 엄지만 접힌 손(FOUR)을 받기로 본다', () => {
    expect(RECEIVE_POSES).toEqual(['PAPER', 'FOUR']);
    expect(isReceivePose('PAPER')).toBe(true);
    expect(isReceivePose('FOUR')).toBe(true);
    expect(isReceivePose('ROCK')).toBe(false);
    expect(isReceivePose('V')).toBe(false);
    expect(isReceivePose(null)).toBe(false);
  });
});

describe('summarizeSession', () => {
  it('total = 주고받기로 한 횟수, done = 끝까지 주고받은 횟수, 반응 시간은 재지 않음', () => {
    const exchanges = [
      { give: 'right', receive: 'left', retries: 0, replays: 0 },
      { give: 'left', receive: 'right', retries: 1, replays: 0 },
    ];
    expect(summarizeSession(exchanges)).toEqual({ total: EXCHANGES, done: 2, skipped: 0, avgReactionMs: null });
    expect(summarizeSession([], 4)).toEqual({ total: 4, done: 0, skipped: 0, avgReactionMs: null });
  });
});

describe('PLAY_LEVEL (한 가지로만, 2026-11-27)', () => {
  it('화면에서 하는 단계는 1단계: 편한 손으로 건네고 같은 손으로 받기', () => {
    expect(PLAY_LEVEL).toBe(1);
    expect(makeInstructions(PLAY_LEVEL, 2)).toEqual([{ give: 'any', receive: 'same' }, { give: 'any', receive: 'same' }]);
  });
});
