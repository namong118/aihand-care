import { describe, it, expect, vi } from 'vitest';
import { createSerialCard } from './serial.js';

describe('createSerialCard (WonderCam 태그 → 색)', () => {
  it('태그 번호를 색으로 바꿔 onCard 로 알린다', () => {
    const card = createSerialCard();
    const cb = vi.fn();
    card.onCard(cb);
    card.handleTag('0');
    card.handleTag('3');
    expect(cb.mock.calls).toEqual([[{ color: 'red' }], [{ color: 'green' }]]);
    expect(card.shown()).toEqual({ id: '3', color: 'green' });
  });

  it('카드가 사라지면(null) 알리지 않고 보이는 카드만 비운다', () => {
    const card = createSerialCard();
    const cb = vi.fn();
    card.onCard(cb);
    card.handleTag('1');
    card.handleTag(null);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(card.shown()).toBe(null);
  });

  it('카드를 내렸다가 다시 보여 주면 다시 알린다', () => {
    const card = createSerialCard();
    const cb = vi.fn();
    card.onCard(cb);
    card.handleTag('2');
    card.handleTag(null);
    card.handleTag('2');
    expect(cb.mock.calls).toEqual([[{ color: 'yellow' }], [{ color: 'yellow' }]]);
  });

  it('표에 없는 번호는 무시하고 경고만 남긴다', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const card = createSerialCard();
    const cb = vi.fn();
    card.onCard(cb);
    card.handleTag('7');
    expect(cb).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    expect(card.shown()).toEqual({ id: '7', color: null });
    warn.mockRestore();
  });

  it('구독을 해제하면 더 이상 받지 않는다', () => {
    const card = createSerialCard();
    const cb = vi.fn();
    const off = card.onCard(cb);
    off();
    card.handleTag('0');
    expect(cb).not.toHaveBeenCalled();
  });
});
