import { describe, it, expect } from 'vitest';
import { voiceLines, questionLine, hintLine, inkLine, endLine } from './lines.js';
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

  it('다르게 골랐을 때 같은 문제를 다시 하는 것처럼 들리는 말이 없다 (다음 문제로 넘어감)', () => {
    for (const line of RETRY_LINES) {
      for (const word of ['다시', '한 번 더', '찾아 주세요']) expect(line).not.toContain(word);
    }
  });

  it('맞게 골랐을 때 멘트에는 색 이름이 없다 (뒤에 "글자 색은 OO이었어요."가 따로 붙음)', () => {
    for (const line of GOOD_LINES) {
      for (const name of COLOR_NAMES) expect(line).not.toContain(name);
    }
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

describe('음성 문구 (#61)', () => {
  const colors = COLOR_NAMES.map((label) => ({ label }));

  it('읽을 수 있는 문구가 voiceLines 에 모두 들어 있다', () => {
    const lines = voiceLines(colors, 5);
    for (let i = 1; i <= 5; i++) expect(lines).toContain(questionLine(i));
    for (const idle of IDLE_LINES) expect(lines).toContain(hintLine(idle));
    for (const label of COLOR_NAMES) expect(lines).toContain(inkLine(label));
    expect(lines).toContain(endLine(5, 5));
    expect(lines).toContain(endLine(5, 3));
  });

  it('문제 문구에 글자 뜻(색 이름)을 넣지 않는다', () => {
    for (let i = 1; i <= 5; i++) for (const name of COLOR_NAMES) expect(questionLine(i)).not.toContain(name);
  });

  it('음성 문구에 쓰지 않는 말이 없다', () => {
    for (const line of voiceLines(colors, 5)) for (const word of FORBIDDEN) expect(line).not.toContain(word);
  });
});
