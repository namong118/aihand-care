import { describe, it, expect } from 'vitest';
import { sequenceLength, makeSequence, judgeSequence, shouldAcceptPose } from './logic.js';

const NAMES = ['ROCK', 'PAPER', 'V'];

describe('sequenceLength', () => {
  it('난이도별 개수', () => {
    expect(sequenceLength('easy')).toBe(1);
    expect(sequenceLength('normal')).toBe(2);
    expect(sequenceLength('hard')).toBe(3);
    expect(sequenceLength('???')).toBe(1);
  });
});

describe('makeSequence', () => {
  it('요청한 길이만큼 만든다', () => {
    expect(makeSequence(NAMES, 3)).toHaveLength(3);
  });
  it('같은 손모양이 연달아 나오지 않는다', () => {
    // rand 가 항상 0 이면 매번 첫 번째 후보를 고른다
    expect(makeSequence(NAMES, 4, () => 0)).toEqual(['ROCK', 'PAPER', 'ROCK', 'PAPER']);
    for (let k = 0; k < 50; k++) {
      const seq = makeSequence(NAMES, 5);
      for (let i = 1; i < seq.length; i++) expect(seq[i]).not.toBe(seq[i - 1]);
    }
  });
  it('손모양이 1개뿐이면 에러', () => {
    expect(() => makeSequence(['ROCK'], 2)).toThrow();
  });
});

describe('judgeSequence', () => {
  it('순서까지 같으면 정답', () => {
    expect(judgeSequence(['ROCK', 'V'], ['ROCK', 'V'])).toEqual({ correct: true, matched: 2 });
  });
  it('순서가 다르면 다시', () => {
    expect(judgeSequence(['ROCK', 'V'], ['V', 'ROCK'])).toEqual({ correct: false, matched: 0 });
  });
  it('일부만 맞으면 맞은 개수를 센다', () => {
    expect(judgeSequence(['ROCK', 'V', 'PAPER'], ['ROCK', 'PAPER', 'PAPER'])).toEqual({
      correct: false,
      matched: 2,
    });
  });
  it('개수가 모자라면 정답이 아니다', () => {
    expect(judgeSequence(['ROCK', 'V'], ['ROCK']).correct).toBe(false);
  });
});

describe('shouldAcceptPose', () => {
  const opts = { now: 10_000, sinceMs: 8_000, minStableMs: 1_000 };
  it('제시 뒤에 만든 손모양을 유지하면 확정', () => {
    expect(shouldAcceptPose({ name: 'THUMB', stableMs: 1_200 }, opts)).toBe(true);
  });
  it('이전부터 들고 있던 손은 인정하지 않는다', () => {
    expect(shouldAcceptPose({ name: 'THUMB', stableMs: 2_500 }, opts)).toBe(false);
  });
  it('손이 없거나 짧으면 아직', () => {
    expect(shouldAcceptPose({ name: null, stableMs: 0 }, opts)).toBe(false);
    expect(shouldAcceptPose({ name: 'ROCK', stableMs: 300 }, opts)).toBe(false);
  });
});
