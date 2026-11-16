import { describe, it, expect } from 'vitest';
import { FACE_ID_MAX, freeFaceIds, checkRegistered } from './register.js';

describe('freeFaceIds', () => {
  it('아무도 없으면 1~5번 모두', () => {
    expect(freeFaceIds([])).toEqual([1, 2, 3, 4, 5]);
    expect(FACE_ID_MAX).toBe(5);
  });

  it('쓰는 번호는 빼고, 호칭만 등록한 사람은 번호를 차지하지 않는다', () => {
    const users = [{ faceId: 2 }, { faceId: '4' }, { faceId: null }];
    expect(freeFaceIds(users)).toEqual([1, 3, 5]);
  });

  it('다 차면 빈 목록', () => {
    const users = [1, 2, 3, 4, 5].map((faceId) => ({ faceId }));
    expect(freeFaceIds(users)).toEqual([]);
  });
});

describe('checkRegistered', () => {
  it('방금 등록한 사람으로 알아보면 ok', () => {
    expect(checkRegistered({ status: 'user', user: { userId: 'u-a' } }, 'u-a')).toBe('ok');
  });
  it('다른 사람으로 알아보면 other', () => {
    expect(checkRegistered({ status: 'user', user: { userId: 'u-b' } }, 'u-a')).toBe('other');
  });
  it('모르는 얼굴, 아직 확정 전', () => {
    expect(checkRegistered({ status: 'unknown' }, 'u-a')).toBe('unknown');
    expect(checkRegistered({ status: 'waiting' }, 'u-a')).toBe('waiting');
    expect(checkRegistered(null, 'u-a')).toBe('waiting');
  });
});
