// 얼굴 로그인: 사용자 목록 저장 (#80)
//
// 사용자 한 명: { userId, displayName, faceId, consentAt }
//   userId      시각 기반 ID (예: 'u-2026-11-13T10:00:00.000Z')
//   displayName 호칭·별명 (실명 아님)
//   faceId      WonderCam이 학습한 얼굴 번호. 얼굴 없이 호칭만 등록하면 null
//   consentAt   얼굴 동의한 시각 (ISO). 얼굴 동의를 안 했으면 null
// 얼굴 사진·특징값은 여기에 저장하지 않는다. 얼굴 데이터는 WonderCam 모듈 안에만 있다.
// 저장 위치는 스테이션 브라우저 localStorage (기록과 같은 방식, src/core/log.js 참고).
// Supabase 동기화는 경민 님 #62 설계가 나오면 맞춘다.

export const USERS_KEY = 'aihand-care.users.v1';

/** 호칭 최대 글자 수 (화면 버튼에 한 줄로 들어가게) */
export const NAME_MAX = 12;

/** 호칭 다듬기: 앞뒤 빈칸 빼고, 가운데 빈칸은 하나로 */
export function cleanName(name) {
  return String(name ?? '').trim().replace(/\s+/g, ' ');
}

/**
 * 시각 기반 ID. 이미 있는 ID와 겹치면 1ms씩 뒤로 민다.
 * now: Date 또는 ms 숫자
 */
export function makeUserId(now, takenIds = []) {
  const taken = new Set(takenIds);
  let t = now instanceof Date ? now.getTime() : now;
  let id = `u-${new Date(t).toISOString()}`;
  while (taken.has(id)) {
    t += 1;
    id = `u-${new Date(t).toISOString()}`;
  }
  return id;
}

/** 저장소에서 읽은 한 명을 지금 모양으로. 읽을 수 없으면 null */
export function fromStoredUser(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.userId !== 'string' || !raw.userId) return null;
  const displayName = cleanName(raw.displayName);
  if (!displayName) return null;
  const faceId = raw.faceId === undefined || raw.faceId === '' ? null : raw.faceId;
  return {
    userId: raw.userId,
    displayName,
    faceId,
    consentAt: typeof raw.consentAt === 'string' ? raw.consentAt : null,
  };
}

/**
 * 새 사용자를 목록에 넣을 수 있는지 검사하고 만든다. 문제가 있으면 에러 (화면에서 안내).
 *   - 호칭이 비었거나 너무 길면
 *   - 같은 호칭이 이미 있으면 (호칭 버튼에서 구분이 안 됨)
 *   - 같은 얼굴 번호가 이미 다른 사람에게 있으면
 */
export function makeUser(users, { displayName, faceId = null, consentAt = null }, now) {
  const name = cleanName(displayName);
  if (!name) throw new Error('호칭을 적어 주세요.');
  if (name.length > NAME_MAX) throw new Error(`호칭은 ${NAME_MAX}글자까지 적을 수 있어요.`);
  if (users.some((u) => u.displayName === name)) throw new Error('같은 호칭이 이미 있어요. 다른 호칭을 적어 주세요.');
  const face = faceId ?? null;
  if (face !== null && findByFace(users, face)) throw new Error('이 얼굴 번호는 이미 다른 분이 쓰고 있어요.');
  return {
    userId: makeUserId(now, users.map((u) => u.userId)),
    displayName: name,
    faceId: face,
    consentAt: face === null ? null : consentAt,
  };
}

/** 얼굴 번호로 찾기. 숫자 3과 글자 '3'은 같은 번호. 없으면 null */
export function findByFace(users, faceId) {
  if (faceId === null || faceId === undefined) return null;
  return users.find((u) => u.faceId !== null && String(u.faceId) === String(faceId)) ?? null;
}

/** userId로 찾기. 없으면 null */
export function findById(users, userId) {
  return users.find((u) => u.userId === userId) ?? null;
}

/** 호칭 버튼 순서: 가나다순 */
export function sortByName(users) {
  return [...users].sort((a, b) => a.displayName.localeCompare(b.displayName, 'ko'));
}

/** 메모리 저장소 (테스트용, 또는 localStorage 를 쓸 수 없을 때) */
export function createMemoryStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
}

function defaultStorage() {
  try {
    const s = globalThis.localStorage;
    const probe = '__aihand_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    console.warn('localStorage 를 쓸 수 없어 사용자 목록을 메모리에만 저장합니다 (새로고침하면 사라짐).');
    return createMemoryStorage();
  }
}

/** 사용자 저장소 */
export function createUserStore({ storage = defaultStorage(), now = () => Date.now() } = {}) {
  function load() {
    try {
      const raw = storage.getItem(USERS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map(fromStoredUser).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  function save(users) {
    storage.setItem(USERS_KEY, JSON.stringify(users));
  }

  return {
    /** 전체 목록, 호칭 가나다순 */
    list() {
      return sortByName(load());
    },
    /** 한 명 추가. 추가된 사용자를 돌려준다. 문제가 있으면 에러 (makeUser 참고) */
    add(input) {
      const users = load();
      const user = makeUser(users, input, now());
      users.push(user);
      save(users);
      return user;
    },
    findByFace(faceId) {
      return findByFace(load(), faceId);
    },
    findById(userId) {
      return findById(load(), userId);
    },
    /**
     * 한 명 지우기. 없으면 null.
     * 반환: { user, forgetFaceId }
     *   forgetFaceId 가 null 이 아니면 "WonderCam에서도 이 얼굴(번호)을 지워 주세요" 안내를 띄운다
     */
    remove(userId) {
      const users = load();
      const user = findById(users, userId);
      if (!user) return null;
      save(users.filter((u) => u.userId !== userId));
      return { user, forgetFaceId: user.faceId };
    },
  };
}
