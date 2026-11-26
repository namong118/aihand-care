import { describe, it, expect } from 'vitest';
import { cleanText, splitSentences, toSpoken, fileNameFor, uniqueSentences } from './voice-text.js';

describe('cleanText', () => {
  it('그림 글자를 빼고 띄어쓰기를 하나로 줄인다', () => {
    expect(cleanText('로봇이 ✊  주먹(바위)를 냈어요.')).toBe('로봇이 주먹(바위)를 냈어요.');
    expect(cleanText('✌️ 브이')).toBe('브이');
  });
  it('빈 값은 빈 글자', () => {
    expect(cleanText(null)).toBe('');
    expect(cleanText('  ')).toBe('');
  });
});

describe('splitSentences', () => {
  it('마침표·느낌표·물음표 뒤 띄어쓰기에서 끊는다', () => {
    expect(splitSentences('잘하셨어요! 글자 색은 빨강이었어요.')).toEqual(['잘하셨어요!', '글자 색은 빨강이었어요.']);
    expect(splitSentences('다시 해 볼까요? 도움말: 잘 보세요.')).toEqual(['다시 해 볼까요?', '도움말: 잘 보세요.']);
  });
  it('뒤에 띄어쓰기가 없는 점에서는 끊지 않는다', () => {
    expect(splitSentences('“보!”에서 1.5초 걸렸어요.')).toEqual(['“보!”에서 1.5초 걸렸어요.']);
  });
  it('끝에 부호가 없는 문장도 하나로 본다', () => {
    expect(splitSentences('이겨주세요')).toEqual(['이겨주세요']);
  });
  it('빈 글자는 빈 목록', () => {
    expect(splitSentences('')).toEqual([]);
  });
});

describe('toSpoken', () => {
  it('개수를 세는 말 앞의 숫자는 우리말 수로', () => {
    expect(toSpoken('5문제를 모두 마쳤어요.')).toBe('다섯 문제를 모두 마쳤어요.');
    expect(toSpoken('이번에는 숫자 3개예요.')).toBe('이번에는 숫자 세 개예요.');
    expect(toSpoken('5판을 모두 함께 해 주셨어요.')).toBe('다섯 판을 모두 함께 해 주셨어요.');
  });
  it('번호(번)는 그대로 둔다', () => {
    expect(toSpoken('문제 3번.')).toBe('문제 3번.');
  });
});

describe('fileNameFor', () => {
  it('같은 문장은 같은 이름, 다른 문장은 다른 이름', () => {
    expect(fileNameFor('잘하셨어요!')).toBe(fileNameFor('잘하셨어요!'));
    expect(fileNameFor('잘하셨어요!')).not.toBe(fileNameFor('잘하셨어요.'));
    expect(fileNameFor('잘하셨어요!')).toMatch(/^[0-9a-f]{8}\.wav$/);
  });
});

describe('uniqueSentences', () => {
  it('문장으로 나눠 겹치는 것을 뺀다', () => {
    expect(uniqueSentences(['좋아요! 다음이에요.', '좋아요!'])).toEqual(['다음이에요.', '좋아요!']);
  });
});
