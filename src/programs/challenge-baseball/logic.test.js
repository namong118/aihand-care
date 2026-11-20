import { describe, expect, it } from 'vitest';
import {
  LEVELS,
  levelSpec,
  defaultLevel,
  makeSecret,
  addDigit,
  judgeGuess,
  isSolved,
  excludedDigits,
  countPose,
  summarizeGame,
} from './logic.js';

/** 정해진 값을 차례로 돌려주는 rand */
const seq = (...values) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('단계', () => {
  it('1·2단계는 숫자 3개, 3단계는 4개', () => {
    expect(levelSpec(1).count).toBe(3);
    expect(levelSpec(2).count).toBe(3);
    expect(levelSpec(3).count).toBe(4);
  });

  it('도움은 1단계만', () => {
    expect([1, 2, 3].map((l) => levelSpec(l).helper)).toEqual([true, false, false]);
  });

  it('모든 단계가 8번까지', () => {
    for (const spec of Object.values(LEVELS)) expect(spec.maxTries).toBe(8);
  });

  it('범위 밖이면 1단계', () => {
    expect(levelSpec(0)).toBe(LEVELS[1]);
    expect(levelSpec('2')).toBe(LEVELS[1]);
    expect(levelSpec(undefined)).toBe(LEVELS[1]);
  });

  it('미리 고를 단계: 1·2·3 그대로, 나머지는 1', () => {
    expect(defaultLevel(2)).toBe(2);
    expect(defaultLevel(3)).toBe(3);
    for (const v of [undefined, null, 0, 4, '2', 'hard']) expect(defaultLevel(v)).toBe(1);
  });
});

describe('makeSecret', () => {
  it('서로 다른 1~5 숫자를 개수만큼', () => {
    for (let t = 0; t < 50; t++) {
      for (const count of [3, 4]) {
        const s = makeSecret(count);
        expect(s).toHaveLength(count);
        expect(new Set(s).size).toBe(count);
        for (const n of s) expect(n >= 1 && n <= 5).toBe(true);
      }
    }
  });

  it('rand 로 정해진다', () => {
    expect(makeSecret(3, seq(0))).toEqual([1, 2, 3]);
    expect(makeSecret(3, seq(0.99))).toEqual([5, 4, 3]);
  });

  it('rand 가 1을 돌려줘도 범위를 넘지 않는다', () => {
    expect(makeSecret(3, seq(1))).toEqual([5, 4, 3]);
  });

  it('6개 이상은 만들 수 없다', () => {
    expect(() => makeSecret(6)).toThrow();
  });
});

describe('addDigit', () => {
  it('하나씩 더한다', () => {
    expect(addDigit([], 3, 3)).toEqual({ guess: [3], added: true });
    expect(addDigit([3], 1, 3)).toEqual({ guess: [3, 1], added: true });
  });

  it('이미 낸 숫자는 더하지 않는다', () => {
    expect(addDigit([3, 1], 3, 3)).toEqual({ guess: [3, 1], added: false, reason: 'dup' });
  });

  it('다 냈으면 더하지 않는다', () => {
    expect(addDigit([1, 2, 3], 4, 3)).toMatchObject({ added: false, reason: 'full' });
  });

  it('1~5가 아니면 더하지 않는다', () => {
    expect(addDigit([], 6, 3)).toMatchObject({ added: false, reason: 'bad' });
    expect(addDigit([], 0, 3)).toMatchObject({ added: false, reason: 'bad' });
  });

  it('원래 배열은 바뀌지 않는다', () => {
    const g = [2];
    addDigit(g, 4, 3);
    expect(g).toEqual([2]);
  });
});

describe('judgeGuess', () => {
  const secret = [2, 5, 1];

  it('다 맞음', () => {
    expect(judgeGuess(secret, [2, 5, 1])).toEqual({ strike: 3, ball: 0 });
    expect(isSolved({ strike: 3, ball: 0 }, 3)).toBe(true);
  });

  it('숫자만 맞음', () => {
    expect(judgeGuess(secret, [1, 2, 5])).toEqual({ strike: 0, ball: 3 });
  });

  it('섞임', () => {
    expect(judgeGuess(secret, [2, 1, 4])).toEqual({ strike: 1, ball: 1 });
  });

  it('하나도 없음', () => {
    expect(judgeGuess(secret, [3, 4, 3])).toEqual({ strike: 0, ball: 0 });
    expect(isSolved({ strike: 0, ball: 0 }, 3)).toBe(false);
  });

  it('숫자 4개', () => {
    expect(judgeGuess([4, 1, 3, 5], [4, 3, 1, 2])).toEqual({ strike: 1, ball: 2 });
  });
});

describe('excludedDigits (1단계 도움)', () => {
  it('스트라이크·볼이 모두 0인 판의 숫자만', () => {
    const history = [
      { guess: [1, 2, 3], strike: 0, ball: 1 },
      { guess: [4, 5, 1], strike: 0, ball: 0 },
    ];
    expect(excludedDigits(history)).toEqual([1, 4, 5]);
  });

  it('없으면 빈 배열', () => {
    expect(excludedDigits([])).toEqual([]);
    expect(excludedDigits([{ guess: [1, 2, 3], strike: 1, ball: 0 }])).toEqual([]);
  });
});

describe('countPose', () => {
  it('0은 주먹, 1~5는 손가락 수', () => {
    expect([0, 1, 2, 3, 4, 5].map(countPose)).toEqual(['ROCK', 'INDEX', 'V', 'THREE', 'FOUR', 'PAPER']);
  });

  it('범위 밖이면 오류', () => {
    expect(() => countPose(6)).toThrow();
    expect(() => countPose(-1)).toThrow();
  });
});

describe('summarizeGame', () => {
  it('맞힘', () => {
    const game = { solved: true, stopped: false, history: [{ reactionMs: 3000 }, { reactionMs: 5000 }] };
    expect(summarizeGame(game)).toEqual({ total: 1, done: 1, skipped: 0, avgReactionMs: 4000 });
  });

  it('그만하기', () => {
    const game = { solved: false, stopped: true, history: [{ reactionMs: 2000 }] };
    expect(summarizeGame(game)).toEqual({ total: 1, done: 0, skipped: 1, avgReactionMs: 2000 });
  });

  it('낸 적 없음', () => {
    expect(summarizeGame({ solved: false, stopped: true, history: [] }).avgReactionMs).toBeNull();
  });
});
