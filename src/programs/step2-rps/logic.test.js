import { describe, it, expect } from 'vitest';
import {
  HANDS,
  CONDITIONS,
  outcome,
  judge,
  answerFor,
  makeQuestion,
  isRpsHand,
} from './logic.js';

describe('outcome: 가위바위보 승패 (사용자 기준)', () => {
  const cases = [
    // [사용자, 로봇, 결과]
    ['ROCK', 'V', 'win'],
    ['ROCK', 'PAPER', 'lose'],
    ['ROCK', 'ROCK', 'draw'],
    ['PAPER', 'ROCK', 'win'],
    ['PAPER', 'V', 'lose'],
    ['PAPER', 'PAPER', 'draw'],
    ['V', 'PAPER', 'win'],
    ['V', 'ROCK', 'lose'],
    ['V', 'V', 'draw'],
  ];
  it.each(cases)('%s vs 로봇 %s → %s', (user, robot, expected) => {
    expect(outcome(user, robot)).toBe(expected);
  });

  it('가위바위보 손이 아니면 에러', () => {
    expect(() => outcome('INDEX', 'ROCK')).toThrow();
    expect(() => outcome('ROCK', null)).toThrow();
  });
});

describe('조건 5종', () => {
  it('조건은 정확히 5개, 원래 기획 문구', () => {
    expect(CONDITIONS.map((c) => c.text)).toEqual([
      '이겨주세요',
      '져주세요',
      '비겨주세요',
      '이기지도 비기지도 마세요',
      '지지도 비기지도 마세요',
    ]);
  });

  it('모든 조건 × 로봇 손마다 정답은 정확히 하나', () => {
    for (const c of CONDITIONS) {
      for (const robot of HANDS) {
        const correct = HANDS.filter((u) => judge(c.id, robot, u).correct);
        expect(correct).toHaveLength(1);
        expect(correct[0]).toBe(answerFor(c.id, robot));
      }
    }
  });

  it('로봇이 바위일 때 조건별 정답', () => {
    expect(answerFor('WIN', 'ROCK')).toBe('PAPER');
    expect(answerFor('LOSE', 'ROCK')).toBe('V');
    expect(answerFor('DRAW', 'ROCK')).toBe('ROCK');
    expect(answerFor('NO_WIN_NO_DRAW', 'ROCK')).toBe('V'); // = 져라
    expect(answerFor('NO_LOSE_NO_DRAW', 'ROCK')).toBe('PAPER'); // = 이겨라
  });

  it('"이기지도 비기지도 마세요" 는 져야 정답', () => {
    expect(judge('NO_WIN_NO_DRAW', 'PAPER', 'ROCK')).toEqual({ correct: true, outcome: 'lose', answer: 'ROCK' });
    expect(judge('NO_WIN_NO_DRAW', 'PAPER', 'V').correct).toBe(false); // 이김
    expect(judge('NO_WIN_NO_DRAW', 'PAPER', 'PAPER').correct).toBe(false); // 비김
  });

  it('"지지도 비기지도 마세요" 는 이겨야 정답', () => {
    expect(judge('NO_LOSE_NO_DRAW', 'V', 'ROCK')).toEqual({ correct: true, outcome: 'win', answer: 'ROCK' });
    expect(judge('NO_LOSE_NO_DRAW', 'V', 'PAPER').correct).toBe(false); // 짐
    expect(judge('NO_LOSE_NO_DRAW', 'V', 'V').correct).toBe(false); // 비김
  });

  it('없는 조건이면 에러', () => {
    expect(() => judge('NOT_WIN', 'ROCK', 'ROCK')).toThrow();
  });
});

describe('makeQuestion', () => {
  it('rand 를 고정하면 같은 문제', () => {
    expect(makeQuestion('normal', () => 0)).toEqual({ robotHand: 'ROCK', conditionId: 'WIN' });
    expect(makeQuestion('normal', () => 0.99)).toEqual({ robotHand: 'V', conditionId: 'NO_LOSE_NO_DRAW' });
  });
  it('쉬움에서는 기본 조건 3개만 나온다', () => {
    expect(makeQuestion('easy', () => 0.99).conditionId).toBe('DRAW');
  });
  it('모르는 난이도는 쉬움으로', () => {
    expect(makeQuestion('???', () => 0.99).conditionId).toBe('DRAW');
  });
});

describe('isRpsHand', () => {
  it('가위·바위·보만 true', () => {
    expect(HANDS.every(isRpsHand)).toBe(true);
    expect(isRpsHand('THUMB')).toBe(false);
    expect(isRpsHand(null)).toBe(false);
  });
});
