import { describe, it, expect } from 'vitest';
import {
  USERS_KEY,
  NAME_MAX,
  cleanName,
  makeUserId,
  fromStoredUser,
  makeUser,
  findByFace,
  sortByName,
  createUserStore,
  createMemoryStorage,
} from './users.js';

const T0 = Date.parse('2026-11-13T10:00:00.000Z');

function store(start = T0) {
  let t = start;
  const storage = createMemoryStorage();
  return { storage, users: createUserStore({ storage, now: () => t }), tick: (ms) => (t += ms) };
}

describe('cleanName', () => {
  it('앞뒤 빈칸을 빼고 가운데 빈칸은 하나로', () => {
    expect(cleanName('  봄날   어르신 ')).toBe('봄날 어르신');
    expect(cleanName(null)).toBe('');
  });
});

describe('makeUserId', () => {
  it('시각 기반 ID', () => {
    expect(makeUserId(T0)).toBe('u-2026-11-13T10:00:00.000Z');
    expect(makeUserId(new Date(T0))).toBe('u-2026-11-13T10:00:00.000Z');
  });
  it('같은 시각이면 1ms 뒤로', () => {
    expect(makeUserId(T0, ['u-2026-11-13T10:00:00.000Z'])).toBe('u-2026-11-13T10:00:00.001Z');
  });
});

describe('makeUser', () => {
  const users = [{ userId: 'u-a', displayName: '해바라기님', faceId: 2, consentAt: '2026-11-13T09:00:00.000Z' }];

  it('얼굴 번호와 동의 시각을 함께 저장', () => {
    const u = makeUser(users, { displayName: ' 봄날 어르신 ', faceId: 1, consentAt: 'c' }, T0);
    expect(u).toEqual({ userId: 'u-2026-11-13T10:00:00.000Z', displayName: '봄날 어르신', faceId: 1, consentAt: 'c' });
  });

  it('얼굴 없이 호칭만 등록하면 faceId·consentAt 은 null', () => {
    const u = makeUser(users, { displayName: '봄날 어르신', consentAt: 'c' }, T0);
    expect(u.faceId).toBeNull();
    expect(u.consentAt).toBeNull();
  });

  it('호칭이 비었거나 너무 길면 에러', () => {
    expect(() => makeUser(users, { displayName: '   ' }, T0)).toThrow('호칭');
    expect(() => makeUser(users, { displayName: '가'.repeat(NAME_MAX + 1) }, T0)).toThrow(`${NAME_MAX}글자`);
  });

  it('같은 호칭, 같은 얼굴 번호는 받지 않는다', () => {
    expect(() => makeUser(users, { displayName: '해바라기님' }, T0)).toThrow('같은 호칭');
    expect(() => makeUser(users, { displayName: '새 분', faceId: '2' }, T0)).toThrow('얼굴 번호');
  });
});

describe('findByFace', () => {
  const users = [
    { userId: 'u-a', displayName: '가', faceId: 3, consentAt: null },
    { userId: 'u-b', displayName: '나', faceId: null, consentAt: null },
  ];
  it('숫자 3과 글자 "3"은 같은 번호', () => {
    expect(findByFace(users, '3').userId).toBe('u-a');
  });
  it('null 이나 없는 번호면 null (호칭만 등록한 사람을 찾지 않는다)', () => {
    expect(findByFace(users, null)).toBeNull();
    expect(findByFace(users, 9)).toBeNull();
  });
});

describe('fromStoredUser', () => {
  it('읽을 수 없는 값은 null', () => {
    expect(fromStoredUser(null)).toBeNull();
    expect(fromStoredUser({ displayName: '가' })).toBeNull();
    expect(fromStoredUser({ userId: 'u-a', displayName: ' ' })).toBeNull();
  });
  it('빠진 값은 null 로 채운다', () => {
    expect(fromStoredUser({ userId: 'u-a', displayName: '가' })).toEqual({
      userId: 'u-a',
      displayName: '가',
      faceId: null,
      consentAt: null,
    });
  });
});

describe('sortByName', () => {
  it('가나다순, 원래 배열은 그대로', () => {
    const users = [{ displayName: '해님' }, { displayName: '가람님' }, { displayName: '나리님' }];
    expect(sortByName(users).map((u) => u.displayName)).toEqual(['가람님', '나리님', '해님']);
    expect(users[0].displayName).toBe('해님');
  });
});

describe('createUserStore', () => {
  it('추가·찾기·목록', () => {
    const { users, tick } = store();
    const a = users.add({ displayName: '해바라기님', faceId: 1, consentAt: 'c' });
    tick(1000);
    users.add({ displayName: '봄날 어르신' });
    expect(users.list().map((u) => u.displayName)).toEqual(['봄날 어르신', '해바라기님']);
    expect(users.findByFace(1).userId).toBe(a.userId);
    expect(users.findById(a.userId).displayName).toBe('해바라기님');
  });

  it('같은 시각에 두 명을 넣어도 ID가 겹치지 않는다', () => {
    const { users } = store();
    const a = users.add({ displayName: '가' });
    const b = users.add({ displayName: '나' });
    expect(a.userId).not.toBe(b.userId);
  });

  it('지우면 WonderCam에서 지울 얼굴 번호를 알려 준다', () => {
    const { users } = store();
    const a = users.add({ displayName: '가', faceId: 4, consentAt: 'c' });
    expect(users.remove(a.userId)).toEqual({ user: a, forgetFaceId: 4 });
    expect(users.list()).toEqual([]);
    expect(users.remove(a.userId)).toBeNull();
  });

  it('호칭만 등록한 사람을 지우면 지울 얼굴 번호는 null', () => {
    const { users } = store();
    const a = users.add({ displayName: '가' });
    expect(users.remove(a.userId).forgetFaceId).toBeNull();
  });

  it('정해 둔 키에 저장하고, 깨진 값은 빈 목록으로 읽는다', () => {
    const { storage, users } = store();
    users.add({ displayName: '가' });
    expect(JSON.parse(storage.getItem(USERS_KEY))).toHaveLength(1);
    storage.setItem(USERS_KEY, '{깨짐');
    expect(users.list()).toEqual([]);
  });
});
