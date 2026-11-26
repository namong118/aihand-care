// 사람마다 시작 단계 (docs/decisions.md 3번 "맞춤 단계")
//
// 나의 시작 찾기로 정하거나 설정에서 바꾼 시작 단계를 로그인한 분마다 저장한다.
//   { [userId]: { 활동 id: 단계 } }   예: { 'u-2026-…': { 'step1-memory': 'normal', 'challenge-baseball': 1 } }
// 손님(userId 가 null)은 저장하지 않는다. 사용자 목록(src/login/users.js)은 바꾸지 않고 userId 로만 잇는다.
// 지워진 사용자의 단계는 prune 으로 정리한다. 자동으로 단계를 올리지 않는다.

import { cleanLevels } from './find-start-logic.js';

export const LEVELS_KEY = 'aihand-care.levels.v1';

/** 저장소에서 읽은 값 정리: userId 마다 활동에 맞는 단계만 남기고, 빈 사람은 뺀다 */
export function cleanAll(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [userId, levels] of Object.entries(raw)) {
    if (!userId) continue;
    const clean = cleanLevels(levels);
    if (Object.keys(clean).length > 0) out[userId] = clean;
  }
  return out;
}

/** 한 분의 시작 단계. 손님(null)이나 정한 것이 없으면 {} */
export function levelsOf(all, userId) {
  return userId ? { ...(all[userId] ?? {}) } : {};
}

/**
 * 한 분의 시작 단계를 바꾼 새 전체 값 (원래 값은 그대로).
 *   changes: { 활동 id: 단계 | null }. null 이면 그 활동은 정하지 않은 것으로 (홈 설정대로)
 */
export function withLevels(all, userId, changes) {
  if (!userId) return { ...all };
  const next = { ...(all[userId] ?? {}) };
  for (const [id, level] of Object.entries(changes ?? {})) {
    if (level === null || level === undefined) delete next[id];
    else next[id] = level;
  }
  return cleanAll({ ...all, [userId]: next });
}

/** 지금 등록된 분들의 단계만 남긴다 (사용자를 지우면 그분의 단계도 지움) */
export function pruneUsers(all, userIds) {
  const keep = new Set(userIds);
  return Object.fromEntries(Object.entries(all).filter(([id]) => keep.has(id)));
}

function browserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** 사람별 시작 단계 저장소. storage 가 없으면 이번 실행 동안만 기억한다 */
export function createLevelStore({ storage = browserStorage() } = {}) {
  let memory = {};
  function load() {
    try {
      const raw = storage?.getItem(LEVELS_KEY);
      return raw ? cleanAll(JSON.parse(raw)) : { ...memory };
    } catch {
      return { ...memory };
    }
  }
  function save(all) {
    memory = all;
    try {
      storage?.setItem(LEVELS_KEY, JSON.stringify(all));
    } catch {
      // 저장이 안 되는 환경이면 이번 실행 동안만 유지된다
    }
  }
  return {
    /** 한 분의 시작 단계 ({}: 손님이거나 정한 것 없음) */
    get: (userId) => levelsOf(load(), userId),
    /** 한 분의 시작 단계 바꾸기. changes 의 null 은 "정하지 않음" */
    set: (userId, changes) => save(withLevels(load(), userId, changes)),
    /** 등록된 분들만 남기기 */
    prune: (userIds) => save(pruneUsers(load(), userIds)),
  };
}
