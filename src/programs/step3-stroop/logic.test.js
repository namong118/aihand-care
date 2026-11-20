import { describe, it, expect } from 'vitest';
import {
  makeQuestion, judge, makeRound, gapMs, summarizeRound, QUESTIONS_PER_ROUND, isPerfect, NO_ANSWER_HINT_MS,
  SHUFFLE_SPEC, shuffleSpec, makeStart, makeSwaps, applySwaps, pickAsks, positionPose, judgeShuffle,
} from './logic.js';
import colors from '../../data/colors.json';

describe('makeQuestion', () => {
  it('쉬움: 글자 뜻과 색이 같다', () => {
    for (let i = 0; i < 30; i++) {
      const q = makeQuestion(colors, 'easy');
      expect(q.wordColor).toBe(q.inkColor);
      expect(q.congruent).toBe(true);
    }
  });

  it('어려움: 글자 뜻과 색이 항상 다르다', () => {
    for (let i = 0; i < 30; i++) {
      const q = makeQuestion(colors, 'hard');
      expect(q.wordColor).not.toBe(q.inkColor);
      expect(q.congruent).toBe(false);
    }
  });

  it('보통: rand 에 따라 같거나 다르다', () => {
    expect(makeQuestion(colors, 'normal', () => 0).congruent).toBe(true);
    expect(makeQuestion(colors, 'normal', () => 0.9).congruent).toBe(false);
  });

  it('색은 red·blue·yellow·green 중 하나', () => {
    const q = makeQuestion(colors, 'hard');
    expect(['red', 'blue', 'yellow', 'green']).toContain(q.wordColor);
    expect(['red', 'blue', 'yellow', 'green']).toContain(q.inkColor);
  });

  it('색이 1개뿐이면 에러', () => {
    expect(() => makeQuestion([colors[0]], 'hard')).toThrow();
  });
});

describe('judge', () => {
  const q = { wordColor: 'blue', inkColor: 'red', congruent: false };
  it('글자 색 카드를 보여주면 정답', () => {
    expect(judge(q, 'red')).toEqual({ correct: true, pickedWord: false });
  });
  it('글자 뜻 카드를 보여주면 pickedWord', () => {
    expect(judge(q, 'blue')).toEqual({ correct: false, pickedWord: true });
  });
  it('다른 색', () => {
    expect(judge(q, 'green')).toEqual({ correct: false, pickedWord: false });
  });
});

describe('makeRound', () => {
  it('기본 문제 수만큼 만든다', () => {
    expect(makeRound(colors, 'normal')).toHaveLength(QUESTIONS_PER_ROUND);
    expect(makeRound(colors, 'normal', 3)).toHaveLength(3);
  });

  it('같은 문제가 연달아 나오지 않는다', () => {
    for (const difficulty of ['easy', 'normal', 'hard']) {
      for (let i = 0; i < 30; i++) {
        const round = makeRound(colors, difficulty, 10);
        for (let j = 1; j < round.length; j++) {
          const same =
            round[j].wordColor === round[j - 1].wordColor && round[j].inkColor === round[j - 1].inkColor;
          expect(same).toBe(false);
        }
      }
    }
  });

  it('난이도 규칙을 회차 전체에서 지킨다', () => {
    expect(makeRound(colors, 'easy', 10).every((q) => q.congruent)).toBe(true);
    expect(makeRound(colors, 'hard', 10).every((q) => !q.congruent)).toBe(true);
  });

  it('rand 가 늘 같아도 멈추지 않고 끝난다', () => {
    expect(makeRound(colors, 'easy', 3, () => 0)).toHaveLength(3);
  });
});

describe('gapMs', () => {
  it('천천히(SLOW)면 더 길게 쉰다', () => {
    expect(gapMs('SLOW')).toBeGreaterThan(gapMs('NORMAL'));
  });
});

describe('summarizeRound', () => {
  it('정답 수와 평균 반응 시간', () => {
    const answers = [
      { correct: true, reactionMs: 1000 },
      { correct: false, reactionMs: 2000 },
      { correct: true, reactionMs: 1500 },
    ];
    expect(summarizeRound(answers)).toEqual({ total: 3, done: 2, avgReactionMs: 1500 });
  });

  it('답이 없으면 평균은 null', () => {
    expect(summarizeRound([])).toEqual({ total: 0, done: 0, avgReactionMs: null });
  });
});

describe('colors.json', () => {
  it('4색, 화면 이름과 표시 색이 있다', () => {
    expect(colors.map((c) => c.color)).toEqual(['red', 'blue', 'yellow', 'green']);
    for (const c of colors) {
      expect(c.label).toBeTruthy();
      expect(c.hex).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe('isPerfect', () => {
  it('모두 맞히면 true', () => {
    expect(isPerfect({ total: 5, done: 5 })).toBe(true);
  });
  it('하나라도 다시 해 볼 문제가 있으면 false', () => {
    expect(isPerfect({ total: 5, done: 4 })).toBe(false);
  });
  it('문제가 없으면 false', () => {
    expect(isPerfect({ total: 0, done: 0 })).toBe(false);
  });
});

describe('NO_ANSWER_HINT_MS', () => {
  it('문제 사이 쉬는 시간보다 길다 (바로 안내가 뜨지 않게)', () => {
    expect(NO_ANSWER_HINT_MS).toBeGreaterThan(gapMs('SLOW'));
  });
});

describe('카드 섞기', () => {
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

  it('applySwaps: 한 쌍 바꾸기', () => {
    expect(applySwaps(['red', 'blue', 'yellow', 'green'], [[0, 2]])).toEqual(['yellow', 'blue', 'red', 'green']);
  });

  it('applySwaps: 여러 번 바꾸기', () => {
    expect(applySwaps(['red', 'blue', 'yellow', 'green'], [[0, 1], [1, 3], [2, 3]])).toEqual(['blue', 'green', 'red', 'yellow']);
  });

  it('applySwaps: 같은 쌍을 두 번 바꾸면 원래대로, 원본은 그대로', () => {
    const order = ['red', 'blue', 'yellow', 'green'];
    expect(applySwaps(order, [[1, 2], [1, 2]])).toEqual(order);
    applySwaps(order, [[0, 3]]);
    expect(order).toEqual(['red', 'blue', 'yellow', 'green']);
  });

  it('makeSwaps: 개수, 자리 0~3, 한 쌍의 두 자리는 다름', () => {
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

  it('makeSwaps: 바로 앞과 같은 쌍이 연달아 나오지 않음', () => {
    for (const seed of [1, 5, 9, 123, 2026]) {
      const swaps = makeSwaps(12, lcg(seed));
      for (let i = 1; i < swaps.length; i++) expect(swaps[i]).not.toEqual(swaps[i - 1]);
    }
    // 처음 두 번은 같은 쌍 [0,1]이 나와도 다시 뽑는다
    expect(makeSwaps(2, seq(0, 0, 0, 0, 0.9, 0.9))).toEqual([[0, 1], [2, 3]]);
  });

  it('makeStart: 색 4개가 한 번씩', () => {
    for (const seed of [1, 2, 3]) {
      const start = makeStart(colors, lcg(seed));
      expect([...start].sort()).toEqual(['blue', 'green', 'red', 'yellow']);
    }
    expect([...makeStart(['red', 'blue', 'yellow', 'green'], () => 0)].sort()).toEqual(['blue', 'green', 'red', 'yellow']);
  });

  it('pickAsks: 서로 다른 자리', () => {
    for (const seed of [1, 2, 3, 4]) {
      const asks = pickAsks(2, lcg(seed));
      expect(asks).toHaveLength(2);
      expect(asks[0]).not.toBe(asks[1]);
      for (const p of asks) expect([0, 1, 2, 3]).toContain(p);
    }
    expect(pickAsks(1, () => 0)).toHaveLength(1);
  });

  it('shuffleSpec: 난이도별 값, 도전이 우선, 느리게 ×1.5', () => {
    expect(shuffleSpec('easy')).toEqual({ swaps: 2, moveMs: 1200, asks: 1 });
    expect(shuffleSpec('normal')).toEqual({ swaps: 4, moveMs: 1000, asks: 1 });
    expect(shuffleSpec('hard')).toEqual({ swaps: 6, moveMs: 800, asks: 2 });
    expect(shuffleSpec('easy', true)).toEqual({ swaps: 8, moveMs: 600, asks: 2 });
    expect(shuffleSpec('hard', false, 'SLOW').moveMs).toBe(1200);
    expect(shuffleSpec('normal', true, 'SLOW').moveMs).toBe(900);
    expect(SHUFFLE_SPEC.easy.moveMs).toBe(1200); // 원본 값은 그대로
  });

  it('positionPose: 0~3 → 손모양, 범위 밖이면 오류', () => {
    expect([0, 1, 2, 3].map(positionPose)).toEqual(['INDEX', 'V', 'THREE', 'FOUR']);
    expect(() => positionPose(4)).toThrow();
    expect(() => positionPose(-1)).toThrow();
    expect(() => positionPose(1.5)).toThrow();
  });

  it('judgeShuffle: 같은 색 / 다른 색, answer 는 그 자리의 실제 색', () => {
    const final = ['blue', 'red', 'green', 'yellow'];
    expect(judgeShuffle(final, 2, 'green')).toEqual({ correct: true, answer: 'green' });
    expect(judgeShuffle(final, 0, 'red')).toEqual({ correct: false, answer: 'blue' });
  });
});
