import { describe, it, expect } from 'vitest';
import {
  LEVELS, ROUNDS, levelSpec, defaultLevel, makeStart, makeSwaps, applySwaps, pickAsks, positionPose, judgeShuffle, summarizeRound,
} from './logic.js';
import colors from '../../data/colors.json';

// 정해진 값을 차례로 돌려주는 rand (테스트용)
const seq = (...values) => {
  let i = 0;
  return () => values[i++ % values.length];
};
// 매번 다른 값을 주는 간단한 의사 난수 (seed 고정)
const lcg = (seed) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

describe('applySwaps', () => {
  it('한 쌍 바꾸기', () => {
    expect(applySwaps(['red', 'blue', 'yellow', 'green'], [[0, 2]])).toEqual(['yellow', 'blue', 'red', 'green']);
  });

  it('여러 번 바꾸기', () => {
    expect(applySwaps(['red', 'blue', 'yellow', 'green'], [[0, 1], [1, 3], [2, 3]])).toEqual(['blue', 'green', 'red', 'yellow']);
  });

  it('같은 쌍을 두 번 바꾸면 원래대로, 원본은 그대로', () => {
    const order = ['red', 'blue', 'yellow', 'green'];
    expect(applySwaps(order, [[1, 2], [1, 2]])).toEqual(order);
    applySwaps(order, [[0, 3]]);
    expect(order).toEqual(['red', 'blue', 'yellow', 'green']);
  });
});

describe('makeSwaps', () => {
  it('개수, 자리 0~3, 한 쌍의 두 자리는 다름', () => {
    for (const seed of [1, 2, 3, 42, 777]) {
      const swaps = makeSwaps(8, lcg(seed));
      expect(swaps).toHaveLength(8);
      for (const [a, b] of swaps) {
        expect(a).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThanOrEqual(3);
        expect(a).not.toBe(b);
      }
    }
    // rand 가 1 에 가까워도 범위 안
    for (const [a, b] of makeSwaps(3, () => 0.9999)) {
      expect(a).not.toBe(b);
      expect(b).toBeLessThanOrEqual(3);
    }
  });

  it('바로 앞과 같은 쌍이 연달아 나오지 않음', () => {
    for (const seed of [1, 5, 9, 123, 2026]) {
      const swaps = makeSwaps(12, lcg(seed));
      for (let i = 1; i < swaps.length; i++) expect(swaps[i]).not.toEqual(swaps[i - 1]);
    }
    // 두 번째에 같은 쌍 [0,1]이 나오면 다시 뽑는다
    expect(makeSwaps(2, seq(0, 0, 0, 0, 0.9, 0.9))).toEqual([[0, 1], [2, 3]]);
  });
});

describe('makeStart', () => {
  it('색 4개가 한 번씩', () => {
    for (const seed of [1, 2, 3]) {
      expect([...makeStart(colors, lcg(seed))].sort()).toEqual(['blue', 'green', 'red', 'yellow']);
    }
    expect([...makeStart(['red', 'blue', 'yellow', 'green'], () => 0)].sort()).toEqual(['blue', 'green', 'red', 'yellow']);
  });
});

describe('pickAsks', () => {
  it('서로 다른 자리', () => {
    for (const seed of [1, 2, 3, 4]) {
      const asks = pickAsks(2, lcg(seed));
      expect(asks).toHaveLength(2);
      expect(asks[0]).not.toBe(asks[1]);
      for (const p of asks) expect([0, 1, 2, 3]).toContain(p);
    }
    expect(pickAsks(1, () => 0)).toHaveLength(1);
  });
});

describe('levelSpec', () => {
  it('단계별 값, 느리게 ×1.5, 범위 밖이면 1단계', () => {
    expect(levelSpec(1)).toEqual({ swaps: 4, moveMs: 1000, asks: 1 });
    expect(levelSpec(2)).toEqual({ swaps: 6, moveMs: 800, asks: 2 });
    expect(levelSpec(3)).toEqual({ swaps: 8, moveMs: 600, asks: 2 });
    expect(levelSpec(2, 'SLOW').moveMs).toBe(1200);
    expect(levelSpec(3, 'SLOW').moveMs).toBe(900);
    expect(levelSpec(0)).toEqual(levelSpec(1));
    expect(levelSpec(4)).toEqual(levelSpec(1));
    expect(levelSpec(undefined)).toEqual(levelSpec(1));
    expect(LEVELS[1].moveMs).toBe(1000); // 원본 값은 그대로
  });
});

describe('defaultLevel', () => {
  it('1·2·3 그대로, 없거나 다른 값이면 1', () => {
    expect([1, 2, 3].map((v) => defaultLevel(v))).toEqual([1, 2, 3]);
    for (const v of [undefined, null, 4, 0, '2', 1.5]) expect(defaultLevel(v)).toBe(1);
  });
});

describe('positionPose', () => {
  it('0~3 → 손모양, 범위 밖이면 오류', () => {
    expect([0, 1, 2, 3].map((p) => positionPose(p))).toEqual(['INDEX', 'V', 'THREE', 'FOUR']);
    expect(() => positionPose(4)).toThrow();
    expect(() => positionPose(-1)).toThrow();
    expect(() => positionPose(1.5)).toThrow();
  });
});

describe('judgeShuffle', () => {
  it('같은 색 / 다른 색, answer 는 그 자리의 실제 색', () => {
    const final = ['blue', 'red', 'green', 'yellow'];
    expect(judgeShuffle(final, 2, 'green')).toEqual({ correct: true, answer: 'green' });
    expect(judgeShuffle(final, 0, 'red')).toEqual({ correct: false, answer: 'blue' });
  });
});

describe('summarizeRound', () => {
  it('합계와 반응 시간 평균', () => {
    expect(summarizeRound([
      { correct: true, reactionMs: 1000 },
      { correct: false, reactionMs: 2000 },
      { correct: true, reactionMs: 3001 },
    ])).toEqual({ total: 3, done: 2, avgReactionMs: 2000 });
  });

  it('빈 배열', () => {
    expect(summarizeRound([])).toEqual({ total: 0, done: 0, avgReactionMs: null });
  });

  it('한 회차는 5판', () => {
    expect(ROUNDS).toBe(5);
  });
});
