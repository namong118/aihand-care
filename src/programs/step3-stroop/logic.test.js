import { describe, it, expect } from 'vitest';
import { makeQuestion, judge } from './logic.js';
import tags from '../../data/tags.json';

describe('makeQuestion', () => {
  it('쉬움: 글자 뜻과 색이 같다', () => {
    for (let i = 0; i < 30; i++) {
      const q = makeQuestion(tags, 'easy');
      expect(q.wordId).toBe(q.inkId);
      expect(q.congruent).toBe(true);
    }
  });

  it('어려움: 글자 뜻과 색이 항상 다르다', () => {
    for (let i = 0; i < 30; i++) {
      const q = makeQuestion(tags, 'hard');
      expect(q.wordId).not.toBe(q.inkId);
      expect(q.congruent).toBe(false);
    }
  });

  it('보통: rand 에 따라 같거나 다르다', () => {
    expect(makeQuestion(tags, 'normal', () => 0).congruent).toBe(true);
    expect(makeQuestion(tags, 'normal', () => 0.9).congruent).toBe(false);
  });

  it('id 는 tags.json 에 있는 값', () => {
    const ids = tags.map((t) => t.id);
    const q = makeQuestion(tags, 'hard');
    expect(ids).toContain(q.wordId);
    expect(ids).toContain(q.inkId);
  });

  it('색이 1개뿐이면 에러', () => {
    expect(() => makeQuestion([tags[0]], 'hard')).toThrow();
  });
});

describe('judge', () => {
  const q = { wordId: 'BLUE', inkId: 'RED', congruent: false };
  it('글자 색을 고르면 정답', () => {
    expect(judge(q, 'RED')).toEqual({ correct: true, pickedWord: false });
  });
  it('글자 뜻을 고르면 pickedWord', () => {
    expect(judge(q, 'BLUE')).toEqual({ correct: false, pickedWord: true });
  });
  it('다른 색', () => {
    expect(judge(q, 'GREEN')).toEqual({ correct: false, pickedWord: false });
  });
});

describe('tags.json', () => {
  it('4색, 키보드 R/B/Y/G', () => {
    expect(tags.map((t) => t.key)).toEqual(['R', 'B', 'Y', 'G']);
  });
});
