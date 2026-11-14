import { describe, it, expect, vi } from 'vitest';
import { createMockCard, CARD_NUMBERS, isCardNumber, isFaceId } from './mock.js';
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

  it("얼굴 번호는 1 이상 정수, 'unknown', null", () => {
    expect(isFaceId(1)).toBe(true);
    expect(isFaceId(12)).toBe(true);
    expect(isFaceId('unknown')).toBe(true);
    expect(isFaceId(null)).toBe(true);
    expect(isFaceId(0)).toBe(false);
    expect(isFaceId('1')).toBe(false);
    expect(isFaceId(undefined)).toBe(false);
  });

  it('emitFace → onFace({ faceId }), 카드 구독에는 가지 않는다', () => {
    const card = createMockCard({ colors });
    const face = vi.fn();
    const num = vi.fn();
    card.onFace(face);
    card.onNumber(num);
    card.emitFace(2);
    card.emitFace('unknown');
    card.emitFace(null);
    expect(face.mock.calls.map((c) => c[0])).toEqual([{ faceId: 2 }, { faceId: 'unknown' }, { faceId: null }]);
    expect(num).not.toHaveBeenCalled();
  });

  it('얼굴 번호가 아니면 바로 에러', () => {
    const card = createMockCard({ colors });
    expect(() => card.emitFace(0)).toThrow();
    expect(() => card.emitFace('3')).toThrow();
  });
});
