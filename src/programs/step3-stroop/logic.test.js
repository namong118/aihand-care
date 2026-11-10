import { describe, it, expect } from 'vitest';
import { makeQuestion, judge, makeRound, gapMs, summarizeRound, QUESTIONS_PER_ROUND, isPerfect, NO_ANSWER_HINT_MS } from './logic.js';
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
