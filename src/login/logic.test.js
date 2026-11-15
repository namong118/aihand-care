import { describe, it, expect } from 'vitest';
import { startFace, trackFace, heldMs, findUserByFace, judgeFace, FACE_HOLD_MS, BLIP_MS, UNKNOWN_FACE } from './logic.js';

const users = [
  { userId: 'u-2026-11-13T10:00:00.000Z', displayName: '봄날 어르신', faceId: 1, consentAt: '2026-11-13T10:00:00.000Z' },
  { userId: 'u-2026-11-13T10:05:00.000Z', displayName: '해바라기님', faceId: 2, consentAt: '2026-11-13T10:05:00.000Z' },
  { userId: 'u-2026-11-13T10:10:00.000Z', displayName: '호칭만 등록', faceId: null, consentAt: null },
];

/** [시각, faceId] 목록을 차례로 넣은 상태 */
function feed(events) {
  return events.reduce((s, [t, id]) => trackFace(s, id, t), startFace());
}

describe('trackFace', () => {
  it('같은 번호가 이어지면 처음 본 시각을 유지한다', () => {
    const s = feed([[0, 1], [500, 1], [1000, 1]]);
    expect(s).toEqual({ faceId: 1, since: 0, gap: null });
  });

  it('번호가 바뀌면 처음부터 다시 잰다', () => {
    const s = feed([[0, 1], [800, 2]]);
    expect(s).toEqual({ faceId: 2, since: 800, gap: null });
  });

  it('잠깐(BLIP_MS 이하) 안 보였다가 같은 번호면 이어 센다 (#76)', () => {
    const s = feed([[0, 1], [800, null], [800 + BLIP_MS, 1]]);
    expect(s).toEqual({ faceId: 1, since: 0, gap: null });
  });

  it('오래(BLIP_MS 넘게) 안 보였다가 다시 보이면 처음부터 다시 잰다', () => {
    const s = feed([[0, 1], [800, null], [800 + BLIP_MS + 1, 1]]);
    expect(s).toEqual({ faceId: 1, since: 800 + BLIP_MS + 1, gap: null });
  });

  it('잠깐 끼는 unknown 과 null 이 이어져도 끼어든 처음부터 시간을 잰다', () => {
    const s = feed([[0, 1], [800, UNKNOWN_FACE], [1000, null], [1200, 1]]);
    expect(s.since).toBe(0);
    const t = feed([[0, 1], [800, UNKNOWN_FACE], [1000, null], [1400, 1]]);
    expect(t.since).toBe(1400);
  });

  it('숫자 3과 글자 "3"은 같은 얼굴', () => {
    const s = feed([[0, 3], [500, '3']]);
    expect(s.since).toBe(0);
  });
});

describe('heldMs', () => {
  it('이어진 시간을 돌려준다', () => {
    expect(heldMs(feed([[100, 1]]), 1100)).toBe(1000);
  });
  it('안 보이면 0', () => {
    expect(heldMs(startFace(), 5000)).toBe(0);
    expect(heldMs(feed([[0, 1], [100, null]]), 5000)).toBe(0);
    // 잠깐 안 보이는 동안은 계속 센다
    expect(heldMs(feed([[0, 1], [100, null]]), 100 + BLIP_MS)).toBe(100 + BLIP_MS);
  });
});

describe('findUserByFace', () => {
  it('번호로 사용자를 찾는다', () => {
    expect(findUserByFace(users, 2).displayName).toBe('해바라기님');
  });
  it('등록 안 된 번호, null, unknown 이면 null', () => {
    expect(findUserByFace(users, 9)).toBeNull();
    expect(findUserByFace(users, null)).toBeNull();
    expect(findUserByFace(users, UNKNOWN_FACE)).toBeNull();
  });
  it('얼굴 없이 호칭만 등록한 사용자는 얼굴로 찾지 않는다', () => {
    expect(findUserByFace(users, null)).toBeNull();
  });
});

describe('judgeFace', () => {
  it('1.5초 경계: 1499ms는 아직, 1500ms면 확정', () => {
    const s = feed([[0, 1]]);
    expect(judgeFace(s, FACE_HOLD_MS - 1, users)).toEqual({ status: 'waiting' });
    const r = judgeFace(s, FACE_HOLD_MS, users);
    expect(r.status).toBe('user');
    expect(r.user.userId).toBe('u-2026-11-13T10:00:00.000Z');
  });

  it('흔들리는 입력: 1과 2가 번갈아 오면 확정하지 않는다', () => {
    const s = feed([[0, 1], [400, 2], [800, 1], [1200, 2], [1600, 1]]);
    expect(judgeFace(s, 2000, users)).toEqual({ status: 'waiting' });
    // 마지막 1이 1.5초 이어지면 확정
    expect(judgeFace(s, 1600 + FACE_HOLD_MS, users).status).toBe('user');
  });

  it('중간에 잠깐(0.1초) 안 보여도 이어 세서 1.5초에 확정 (#76)', () => {
    const s = feed([[0, 1], [1000, null], [1100, 1]]);
    expect(judgeFace(s, FACE_HOLD_MS - 1, users)).toEqual({ status: 'waiting' });
    expect(judgeFace(s, FACE_HOLD_MS, users).status).toBe('user');
  });

  it('잠깐 끼는 unknown 도 무시한다 (#76: 0.24~0.6초)', () => {
    const s = feed([[0, 2], [600, UNKNOWN_FACE], [1000, 2]]);
    expect(judgeFace(s, FACE_HOLD_MS, users).user.displayName).toBe('해바라기님');
  });

  it('안 보인 채 BLIP_MS 가 지나면 기다리기로 바뀐다 (확정하지 않음)', () => {
    const s = feed([[0, 1], [1000, null]]);
    expect(judgeFace(s, 1000 + BLIP_MS + 1, users)).toEqual({ status: 'waiting' });
    expect(judgeFace(s, 5000, users)).toEqual({ status: 'waiting' });
  });

  it('번호를 세다가 모르는 얼굴이 이어지면 unknown 으로 (끼어든 시각부터 1.5초)', () => {
    const s = feed([[0, 1], [1000, UNKNOWN_FACE]]);
    expect(judgeFace(s, 1000 + FACE_HOLD_MS - 1, users)).toEqual({ status: 'waiting' });
    expect(judgeFace(s, 1000 + FACE_HOLD_MS, users)).toEqual({ status: 'unknown' });
  });

  it('모르는 얼굴이 1.5초 이어지면 unknown', () => {
    const s = feed([[0, UNKNOWN_FACE]]);
    expect(judgeFace(s, 1000, users)).toEqual({ status: 'waiting' });
    expect(judgeFace(s, FACE_HOLD_MS, users)).toEqual({ status: 'unknown' });
  });

  it('등록 안 된 번호로 확정되면 모르는 얼굴과 같다', () => {
    const s = feed([[0, 9]]);
    expect(judgeFace(s, FACE_HOLD_MS, users)).toEqual({ status: 'unknown' });
  });

  it('아무것도 안 보이면 계속 기다린다', () => {
    expect(judgeFace(startFace(), 10000, users)).toEqual({ status: 'waiting' });
  });

  it('확정 시간은 바꿀 수 있다 (실물 테스트 때 조정)', () => {
    const s = feed([[0, 2]]);
    expect(judgeFace(s, 1000, users, 1000).status).toBe('user');
  });
});
