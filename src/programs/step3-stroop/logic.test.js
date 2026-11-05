import { describe, it, expect } from 'vitest';
import { makeQuestion, judge } from './logic.js';
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

describe('colors.json', () => {
  it('4색, 화면 이름과 표시 색이 있다', () => {
    expect(colors.map((c) => c.color)).toEqual(['red', 'blue', 'yellow', 'green']);
    for (const c of colors) {
      expect(c.label).toBeTruthy();
      expect(c.hex).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
