import { describe, it, expect } from 'vitest';
import {
  CARD_NUMBERS,
  POSE_BY_NUMBER,
  poseForNumber,
  sequenceLength,
  makeSequence,
  judgeSequence,
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
