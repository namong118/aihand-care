import { describe, it, expect } from 'vitest';
import {
  MAX_RECORD_MS,
  KEEP_PER_USER,
  canOfferMemo,
  clockText,
  progressText,
  pickMimeType,
  pickMicId,
  memosToDrop,
  memoMeta,
} from './logic.js';

describe('canOfferMemo: 한마디 남기기를 보여 줄지', () => {
  it('로그인한 분만', () => {
    expect(canOfferMemo({ userId: 'u-1', who: 'user' })).toBe(true);
    expect(canOfferMemo({ userId: null, who: 'guest' })).toBe(false);
    expect(canOfferMemo(null)).toBe(false);
  });
});

describe('시간 글자', () => {
  it('분:초', () => {
    expect(clockText(0)).toBe('0:00');
    expect(clockText(5400)).toBe('0:05');
    expect(clockText(65000)).toBe('1:05');
    expect(clockText(-100)).toBe('0:00');
  });
  it('녹음 진행: 최대 시간을 넘지 않는다', () => {
    expect(progressText(5000)).toBe('0:05 / 0:20');
    expect(progressText(25000)).toBe('0:20 / 0:20');
    expect(MAX_RECORD_MS).toBe(20000);
  });
});

describe('pickMimeType', () => {
  it('되는 형식 중 앞의 것', () => {
    expect(pickMimeType((t) => t.startsWith('audio/webm'))).toBe('audio/webm;codecs=opus');
    expect(pickMimeType((t) => t === 'audio/mp4')).toBe('audio/mp4');
    expect(pickMimeType(() => false)).toBe('');
  });
});

describe('pickMicId: 자브라가 있으면 자브라 마이크', () => {
  it('자브라 우선, 없으면 기본(null)', () => {
    const devices = [
      { kind: 'audioinput', deviceId: 'a', label: '마이크 배열(Realtek(R) Audio)' },
      { kind: 'audioinput', deviceId: 'b', label: 'ECHO 취소 스피커폰(Jabra SPEAK 510 USB)' },
      { kind: 'audiooutput', deviceId: 'c', label: 'Jabra SPEAK 510 USB' },
    ];
    expect(pickMicId(devices)).toBe('b');
    expect(pickMicId(devices.slice(0, 1))).toBeNull();
    expect(pickMicId([{ kind: 'audioinput', deviceId: 'x', label: '' }])).toBeNull(); // 허락 전
  });
});

describe('memosToDrop: 사용자마다 최근 몇 개만 남기기', () => {
  const memos = [
    { id: 'm1', userId: 'u', createdAt: '2026-11-20T10:00:00.000Z' },
    { id: 'm2', userId: 'u', createdAt: '2026-11-21T10:00:00.000Z' },
    { id: 'm3', userId: 'u', createdAt: '2026-11-22T10:00:00.000Z' },
    { id: 'm4', userId: 'u', createdAt: '2026-11-23T10:00:00.000Z' },
    { id: 'x1', userId: 'other', createdAt: '2026-11-01T10:00:00.000Z' },
  ];
  it('가장 오래된 것부터 지운다. 다른 분 것은 건드리지 않는다', () => {
    expect(memosToDrop(memos, 'u')).toEqual(['m1']);
    expect(memosToDrop(memos, 'u', 2)).toEqual(['m2', 'm1']);
    expect(memosToDrop(memos, 'other')).toEqual([]);
    expect(KEEP_PER_USER).toBe(3);
  });
});

describe('memoMeta', () => {
  it('누구의 어느 코스 한마디인지, 보내지 않은 상태로', () => {
    const now = new Date('2026-11-24T12:00:00.000Z');
    expect(memoMeta({ summary: { userId: 'u', courseId: 'c' }, durationMs: 4321.6, mimeType: 'audio/webm', now })).toEqual({
      id: 'memo-2026-11-24T12:00:00.000Z',
      userId: 'u',
      courseId: 'c',
      createdAt: '2026-11-24T12:00:00.000Z',
      durationMs: 4322,
      mimeType: 'audio/webm',
      sent: false,
    });
  });
});
