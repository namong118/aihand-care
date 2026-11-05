import { describe, it, expect } from 'vitest';
import {
  HANDS,
  CONDITIONS,
  outcome,
  judge,
  answerFor,
  makeQuestion,
  isRpsHand,
  shouldAcceptPose,
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

describe('shouldAcceptPose', () => {
  const opts = { now: 10_000, sinceMs: 8_000, minStableMs: 1_000 };
  it('문제 뒤에 만든 손을 1초 유지하면 확정', () => {
    expect(shouldAcceptPose({ name: 'ROCK', stableMs: 1_500 }, opts)).toBe(true);
  });
  it('유지 시간이 짧으면 아직', () => {
    expect(shouldAcceptPose({ name: 'ROCK', stableMs: 500 }, opts)).toBe(false);
  });
  it('문제 전부터 들고 있던 손은 인정하지 않는다', () => {
    expect(shouldAcceptPose({ name: 'ROCK', stableMs: 3_000 }, opts)).toBe(false);
  });
  it('가위바위보 손이 아니거나 손이 없으면 무시', () => {
    expect(shouldAcceptPose({ name: 'INDEX', stableMs: 1_500 }, opts)).toBe(false);
    expect(shouldAcceptPose({ name: null, stableMs: 0 }, opts)).toBe(false);
    expect(isRpsHand('THUMB')).toBe(false);
  });
});
