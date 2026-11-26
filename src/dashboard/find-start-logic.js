// 나의 시작 찾기: 순서 정하기, 시작 단계 추천, 기록 표시 (순수 함수, DOM 사용 금지)
//
// 기본 활동을 짧게 해 보고, 해내시면 짝 도전 활동도 짧게 해 본 뒤 "이 단계부터 시작해 보세요"를 보여 준다.
// 활동 짝과 추천 단계는 src/data/find-start.json. ready 가 false 인 짝은 아직 하지 않고 "준비 중"으로만 보인다.
// 추천은 시작 단계를 고르는 것뿐이다. 점수·판정처럼 보이는 값은 만들지 않는다.
// 진행은 대시보드(main.js)가 한다. 프로그램은 ctx.settings.findStart 가 true 면 짧은 판으로 한다.

/** 기본 활동 난이도 (설정의 난이도와 같은 값) */
export const BASIC_LEVELS = ['easy', 'normal', 'hard'];

/** 도전 활동 단계 */
export const CHALLENGE_LEVELS = [1, 2, 3];

/** 짧은 판 하나의 결과: 해냄 | 해 봄(해내지 못함) | 건너뜀 */
export const OUTCOMES = ['done', 'tried', 'skipped'];

const isChallengeId = (id) => id.startsWith('challenge-');

/** 이 활동에 맞는 단계 값인지 (도전 활동은 1·2·3, 기본 활동은 easy·normal·hard) */
export function isLevelFor(id, level) {
  return isChallengeId(id) ? CHALLENGE_LEVELS.includes(level) : BASIC_LEVELS.includes(level);
}

function checkRecommend(group) {
  for (const key of ['both', 'basic', 'none']) {
    const r = group.recommend?.[key];
    if (!r || !isLevelFor(group.basic, r.basic) || !isLevelFor(group.challenge, r.challenge)) {
      throw new Error(`find-start.json ${group.id}: recommend.${key} 값이 맞지 않아요`);
    }
  }
}

/**
 * find-start.json 읽기. 모르는 활동 id 가 있거나 ready 짝의 추천 값이 틀리면 오류.
 * @param json      { groups: [...] }
 * @param knownIds  있는 활동 id 목록 (catalog.js 의 기본 활동 + 도전 활동)
 */
export function loadFindStart(json, knownIds) {
  const known = new Set(knownIds);
  return (json.groups ?? []).map((g) => {
    for (const id of [g.basic, g.challenge]) {
      if (!known.has(id)) throw new Error(`find-start.json ${g.id}: 모르는 활동 ${id}`);
    }
    const group = { ...g, ready: g.ready === true };
    if (group.ready) checkRecommend(group);
    return group;
  });
}

/** 지금 해 볼 수 있는 짝만 */
export function readyGroups(groups) {
  return groups.filter((g) => g.ready);
}

/**
 * 짧은 판 기록 → 결과. 짧은 판의 문제·판을 모두 해냈으면 'done', 아니면 'tried'.
 * (짧은 판이 여러 문제일 때 하나만 해내고 어려움을 추천하지 않게 "모두"로 본다)
 */
export function outcomeOf(record) {
  const total = record?.total ?? 0;
  return total > 0 && (record?.done ?? 0) >= total ? 'done' : 'tried';
}

/**
 * 짧은 판 하나가 끝난 뒤 어디로 갈지.
 *   기본 활동을 해냈으면 → 같은 짝의 도전 활동 (그 전에 안내 화면)
 *   그 밖(기본 활동을 해내지 못함·건너뜀, 도전 활동이 끝남) → 다음 짝의 기본 활동
 *   더 없으면 null (추천 화면)
 * @param count  해 볼 짝 개수
 * @param pos    { index, role: 'basic' | 'challenge' }
 */
export function nextPosition(count, pos, outcome) {
  if (pos.role === 'basic' && outcome === 'done') return { index: pos.index, role: 'challenge' };
  const index = pos.index + 1;
  return index < count ? { index, role: 'basic' } : null;
}

/**
 * 짝 하나의 추천 시작 단계. 기본 활동을 건너뛰었으면 null (지금 설정 그대로).
 *   기본·도전 모두 해냄 → recommend.both
 *   기본만 해냄        → recommend.basic
 *   기본을 해내지 못함 → recommend.none
 * @param result { basic: outcome, challenge: outcome | undefined }
 * @returns { basic, challenge } | null
 */
export function recommendFor(group, result) {
  const basic = result?.basic;
  if (!basic || basic === 'skipped') return null;
  if (basic !== 'done') return { ...group.recommend.none };
  return { ...(result.challenge === 'done' ? group.recommend.both : group.recommend.basic) };
}

/** 나의 시작 찾기 한 번의 id */
export function newFindStartId(now = new Date()) {
  return `find-${now.getTime()}`;
}

/** 짧은 판 기록에 detail.findStart = { id, group, role } 를 붙인다 */
export function tagFindStart(record, { id, group, role }) {
  return { ...record, detail: { ...(record.detail ?? {}), findStart: { id, group, role } } };
}

/** 기록의 detail.findStart. 나의 시작 찾기 기록이 아니면 null */
export function findStartOf(record) {
  const f = record?.detail?.findStart;
  return f && typeof f.id === 'string' ? f : null;
}

/** 저장된 시작 단계 정리: 활동에 맞지 않는 값은 버린다. { 'step1-memory': 'normal', 'challenge-baseball': 1 } */
export function cleanLevels(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [id, level] of Object.entries(raw)) {
    if (isLevelFor(id, level)) out[id] = level;
  }
  return out;
}

/**
 * 이 활동을 열 때 넘길 설정. 그분이 시작 단계를 정해 둔 활동이면 그 단계로 바꾼다.
 *   기본 활동 → difficulty, 도전 활동 → challengeLevel (시작 화면에서 미리 골라 둠)
 *   levels: 로그인한 분의 시작 단계 (user-levels.js). 손님·하나만 해 보기는 {} → 홈 설정 그대로
 * 원래 설정 객체는 바꾸지 않는다.
 */
export function settingsFor(id, settings, levels = {}) {
  const level = levels?.[id];
  if (!isLevelFor(id, level)) return { ...settings };
  return isChallengeId(id) ? { ...settings, challengeLevel: level } : { ...settings, difficulty: level };
}
