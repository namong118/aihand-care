import { describe, it, expect } from 'vitest';
import { START_LINES, IDLE_LINES, GOOD_LINES, RETRY_LINES, pickLine, goodLine, retryLine, startLine, idleLine } from './lines.js';

const COLOR_NAMES = ['빨강', '파랑', '노랑', '초록'];
const FORBIDDEN = ['틀렸', '틀린', '정답', '점수', '맞힌', '맞히', '실패'];

describe('반응 멘트', () => {
  it('피하기로 한 말이 없다', () => {
    for (const line of [...START_LINES, ...IDLE_LINES, ...GOOD_LINES, ...RETRY_LINES]) {
      for (const word of FORBIDDEN) expect(line).not.toContain(word);
    }
  });

  it('시작·기다릴 때·다르게 골랐을 때는 색 이름을 말하지 않는다 (답을 알려 주지 않게)', () => {
    for (const line of [...START_LINES, ...IDLE_LINES, ...RETRY_LINES]) {
      for (const name of COLOR_NAMES) expect(line).not.toContain(name);
    }
  });

  it('맞게 골랐을 때 {color}는 고른 색 이름으로 바뀐다', () => {
    const last = () => 0.999; // 마지막 문장 = {color} 문장
    expect(goodLine('파랑', last)).toBe('파랑, 잘 고르셨어요!');
    expect(goodLine('파랑', () => 0)).toBe('잘하셨어요!');
  });

  it('pickLine 은 범위 안에서 고른다', () => {
    expect(pickLine(['a', 'b'], () => 0)).toBe('a');
    expect(pickLine(['a', 'b'], () => 0.5)).toBe('b');
    expect(pickLine(['a', 'b'], () => 1)).toBe('b');
    expect(RETRY_LINES).toContain(retryLine());
    expect(START_LINES).toContain(startLine());
    expect(IDLE_LINES).toContain(idleLine());
  });
});
