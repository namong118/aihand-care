import { describe, it, expect, vi } from 'vitest';
import { createMockCard, CARD_NUMBERS, isCardNumber } from './mock.js';
import colors from '../../data/colors.json';

describe('createMockCard (키보드·버튼 대신 입력)', () => {
  it('숫자 카드는 1~5', () => {
    expect(CARD_NUMBERS).toEqual([1, 2, 3, 4, 5]);
    expect(isCardNumber(3)).toBe(true);
    expect(isCardNumber(0)).toBe(false);
    expect(isCardNumber('3')).toBe(false);
  });

  it('emitNumber → onNumber({ number }), 색 카드 구독에는 가지 않는다', () => {
    const card = createMockCard({ colors });
    const num = vi.fn();
    const color = vi.fn();
    card.onNumber(num);
    card.onCard(color);
    card.emitNumber(4);
    expect(num).toHaveBeenCalledWith({ number: 4 });
    expect(color).not.toHaveBeenCalled();
  });

  it('1~5 가 아니면 바로 에러', () => {
    const card = createMockCard({ colors });
    expect(() => card.emitNumber(6)).toThrow();
  });
});
