import { describe, it, expect } from 'vitest';
import {
  CARD_NUMBERS,
  POSE_BY_NUMBER,
  poseForNumber,
  sequenceLength,
  maxLength,
  makeSequence,
  judgeSequence,
  questionStatus,
  nextLength,
  summarizeRound,
  MAX_LENGTH_BY_DIFFICULTY,
} from './logic.js';
import poses from '../../data/poses.json';

describe('숫자 ↔ 손모양', () => {
  it('1 INDEX, 2 V, 3 THREE, 4 FOUR, 5 PAPER', () => {
    expect(CARD_NUMBERS.map(poseForNumber)).toEqual(['INDEX', 'V', 'THREE', 'FOUR', 'PAPER']);
  });
  it('모두 data/poses.json 에 있는 손모양', () => {
    const names = poses.map((p) => p.name);
    for (const name of Object.values(POSE_BY_NUMBER)) expect(names).toContain(name);
  });
  it('1~5 가 아니면 에러', () => {
    expect(() => poseForNumber(0)).toThrow();
    expect(() => poseForNumber(6)).toThrow();
  });
});

describe('sequenceLength', () => {
  it('난이도별 개수 (지금 값 1·2·3)', () => {
    expect(sequenceLength('easy')).toBe(1);
    expect(sequenceLength('normal')).toBe(2);
    expect(sequenceLength('hard')).toBe(3);
    expect(sequenceLength('???')).toBe(1);
  });
});

describe('makeSequence', () => {
  it('요청한 길이만큼 만든다', () => {
    expect(makeSequence(CARD_NUMBERS, 3)).toHaveLength(3);
  });
  it('한 문제 안에서 같은 숫자가 두 번 나오지 않는다 (카드가 한 장씩뿐)', () => {
    // rand 가 항상 0 이면 남은 것 중 첫 번째를 고른다
    expect(makeSequence(CARD_NUMBERS, 5, () => 0)).toEqual([1, 2, 3, 4, 5]);
    for (let k = 0; k < 100; k++) {
      const seq = makeSequence(CARD_NUMBERS, 3);
      expect(new Set(seq).size).toBe(seq.length);
      for (const n of seq) expect(CARD_NUMBERS).toContain(n);
    }
  });
  it('rand 가 1 에 가까워도 범위를 벗어나지 않는다', () => {
    expect(makeSequence(CARD_NUMBERS, 3, () => 0.9999)).toEqual([5, 4, 3]);
  });
  it('숫자 개수보다 길게는 만들 수 없다', () => {
    expect(() => makeSequence(CARD_NUMBERS, 6)).toThrow();
  });
  it('어려움(3개)까지 만들 수 있다', () => {
    expect(makeSequence(CARD_NUMBERS, sequenceLength('hard'))).toHaveLength(3);
  });
});

describe('judgeSequence', () => {
  it('순서까지 같으면 정답', () => {
    expect(judgeSequence([3, 1], [3, 1])).toEqual({ correct: true, matched: 2 });
  });
  it('순서가 다르면 다시', () => {
    expect(judgeSequence([3, 1], [1, 3])).toEqual({ correct: false, matched: 0 });
  });
  it('일부만 맞으면 맞은 개수를 센다', () => {
    expect(judgeSequence([3, 1, 5], [3, 2, 5])).toEqual({ correct: false, matched: 2 });
  });
  it('개수가 모자라면 정답이 아니다', () => {
    expect(judgeSequence([3, 1], [3]).correct).toBe(false);
  });
});

describe('maxLength', () => {
  it('난이도별 최대 개수 쉬움 3, 보통 4, 어려움 5', () => {
    expect(maxLength('easy')).toBe(3);
    expect(maxLength('normal')).toBe(4);
    expect(maxLength('hard')).toBe(5);
    expect(maxLength('???')).toBe(3);
  });
  it('최대 개수도 카드 수(5) 안에서 겹치지 않게 만들 수 있다', () => {
    for (const n of Object.values(MAX_LENGTH_BY_DIFFICULTY)) {
      expect(n).toBeLessThanOrEqual(CARD_NUMBERS.length);
      expect(makeSequence(CARD_NUMBERS, n)).toHaveLength(n);
    }
  });
});

describe('questionStatus', () => {
  it('한 번에 해내면 first', () => {
    expect(questionStatus([true])).toBe('first');
  });
  it('두 번째에 해내면 second', () => {
    expect(questionStatus([false, true])).toBe('second');
  });
  it('두 번 다 아니면 shown (함께 확인)', () => {
    expect(questionStatus([false, false])).toBe('shown');
  });
  it('건너뛰면 skipped (처음이든 다시 하다가든)', () => {
    expect(questionStatus([], true)).toBe('skipped');
    expect(questionStatus([false], true)).toBe('skipped');
  });
});

describe('nextLength', () => {
  it('한 번에 해내면 하나 늘린다', () => {
    expect(nextLength(2, 'first', 'normal')).toBe(3);
  });
  it('난이도 최대보다 늘리지 않는다', () => {
    expect(nextLength(3, 'first', 'easy')).toBe(3);
    expect(nextLength(4, 'first', 'normal')).toBe(4);
    expect(nextLength(5, 'first', 'hard')).toBe(5);
  });
  it('다시 해서 해내면 그대로', () => {
    expect(nextLength(2, 'second', 'normal')).toBe(2);
  });
  it('함께 확인했거나 건너뛰면 하나 줄인다', () => {
    expect(nextLength(3, 'shown', 'hard')).toBe(2);
    expect(nextLength(3, 'skipped', 'hard')).toBe(2);
  });
  it('1개보다 적게는 줄이지 않는다', () => {
    expect(nextLength(1, 'shown', 'easy')).toBe(1);
  });
});

describe('summarizeRound', () => {
  it('해낸 문제 수, 건너뛴 수, 반응 시간 평균', () => {
    const items = [
      { status: 'first', reactionMs: 1000 },
      { status: 'second', reactionMs: 2000 },
      { status: 'shown', reactionMs: 3000 },
      { status: 'skipped', reactionMs: null },
      { status: 'first', reactionMs: 1999 },
    ];
    expect(summarizeRound(items)).toEqual({ total: 5, done: 3, skipped: 1, avgReactionMs: 2000 });
  });
  it('반응 시간이 하나도 없으면 null', () => {
    expect(summarizeRound([{ status: 'skipped', reactionMs: null }]).avgReactionMs).toBeNull();
  });
});
