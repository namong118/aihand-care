import { describe, it, expect } from 'vitest';
import { CARD_COLORS, isCardColor, tagIdToColor } from './cards.js';
import tags from './tags.json';
import colors from '../../data/colors.json';

describe('카드 색', () => {
  it('4색: red, blue, yellow, green', () => {
    expect(CARD_COLORS).toEqual(['red', 'blue', 'yellow', 'green']);
    expect(isCardColor('red')).toBe(true);
    expect(isCardColor('RED')).toBe(false);
  });
  it('data/colors.json 의 색과 같다', () => {
    expect(colors.map((c) => c.color)).toEqual(CARD_COLORS);
  });
});

describe('tagIdToColor', () => {
  it('tags.json 의 ID 를 색으로 바꾼다', () => {
    expect(tagIdToColor('RED')).toBe('red');
    expect(tagIdToColor('GREEN')).toBe('green');
  });
  it('모르는 ID 면 null', () => {
    expect(tagIdToColor('7')).toBe(null);
    expect(tagIdToColor(undefined)).toBe(null);
  });
  it('다른 변환표도 쓸 수 있다 (예: AprilTag 번호)', () => {
    expect(tagIdToColor('3', { 3: 'blue' })).toBe('blue');
    expect(tagIdToColor('4', { 4: 'purple' })).toBe(null);
  });
  it('변환표의 색은 모두 카드 색', () => {
    for (const c of Object.values(tags.ids)) expect(isCardColor(c)).toBe(true);
  });
});
