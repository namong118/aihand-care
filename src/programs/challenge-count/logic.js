// 도전 활동 "이어 세기" (기본 활동 가위바위보의 짝): 규칙과 로봇 전략 (순수 함수, DOM·ctx 사용 금지)
//
// 1부터 차례로 사용자와 로봇이 번갈아 수를 이어 센다. 한 번에 1개부터 maxStep 개까지.
// 끝 숫자를 부르게 되는 쪽이 그 판을 내준다. 사용자가 먼저 시작한다.
// 판마다 끝 숫자와 한 번에 셀 수 있는 개수가 바뀐다 (외운 방법 하나로 풀리지 않게).
//
// 이기는 방법: 내가 센 뒤 남은 수가 (끝 - 1 - 지금) 가 (maxStep + 1) 의 배수가 되게 한다.

/**
 * 단계 (도전 활동은 모두 1·2·3단계, #132)
 *   ends: 끝 숫자 범위 [최소, 최대], steps: 한 번에 셀 수 있는 최대 개수 후보
 *   smart: 로봇이 이기는 수를 고를 확률 (나머지는 아무 수나)
 */
export const LEVELS = {
  1: { ends: [15, 20], steps: [3], smart: 0.3 },
  2: { ends: [18, 25], steps: [2, 3], smart: 0.7 },
  3: { ends: [20, 25], steps: [3, 4], smart: 1 },
};

/** 손가락 개수 → 손모양 (웹캠 입력과 로봇 손 모두) */
const COUNT_POSES = { 1: 'INDEX', 2: 'V', 3: 'THREE', 4: 'FOUR' };

/** 단계 값. 1·2·3 이 아니면 1단계 */
export function levelSpec(level) {
  return LEVELS[defaultLevel(level)];
}

/** 나의 시작 찾기 짧은 판 (ctx.settings.findStart): 1단계 규칙, 끝 숫자만 10~13으로 짧게 */
export const FIND_START_GAME = { level: 1, ends: [10, 13] };

/** 이번 판에 쓸 단계 값. 나의 시작 찾기면 1단계에 끝 숫자만 짧게 */
export function gameSpec(level, findStart = false) {
  if (findStart) return { ...LEVELS[FIND_START_GAME.level], ends: [...FIND_START_GAME.ends] };
  return levelSpec(level);
}

/** 시작 화면에서 미리 고를 단계. ctx.settings.challengeLevel 이 1·2·3 이면 그대로, 아니면 1 */
export function defaultLevel(value) {
  return [1, 2, 3].includes(value) ? value : 1;
}

/** 개수 → 손모양 이름. 1~4 가 아니면 null */
export function countPose(n) {
  return COUNT_POSES[n] ?? null;
}

/** 손모양 이름 → 개수. 숫자 손모양이 아니면 null */
export function poseCount(name) {
  const hit = Object.entries(COUNT_POSES).find(([, pose]) => pose === name);
  return hit ? Number(hit[0]) : null;
}

/** 이번 판에 받을 손모양 (1 ~ maxStep) */
export function posesFor(maxStep) {
  return Array.from({ length: maxStep }, (_, i) => countPose(i + 1));
}

/**
 * 지금 차례인 쪽이 무엇을 해도 지는 자리인가 (상대가 끝까지 잘 둔다면).
 * now: 지금까지 센 마지막 수 (처음은 0)
 */
export function isLosingSpot(now, end, maxStep) {
  return (end - 1 - now) % (maxStep + 1) === 0;
}

/**
 * 판 만들기: 끝 숫자와 한 번에 셀 수 있는 개수.
 * 먼저 하는 사용자가 잘 두면 이길 수 있는 판만 만든다 (처음 자리가 지는 자리가 아니게).
 * @param rand 0 이상 1 미만 (테스트에서 고정값)
 * @param spec 단계 값 (없으면 levelSpec(level). 나의 시작 찾기는 gameSpec 결과를 넘긴다)
 */
export function makeGame(level, rand = Math.random, spec = levelSpec(level)) {
  const { ends, steps } = spec;
  const pick = (list) => list[Math.min(list.length - 1, Math.floor(rand() * list.length))];
  const maxStep = pick(steps);
  const candidates = [];
  for (let end = ends[0]; end <= ends[1]; end++) {
    if (!isLosingSpot(0, end, maxStep)) candidates.push(end);
  }
  return { end: pick(candidates), maxStep };
}

/**
 * 내가 마지막으로 부르면 좋은 수 (1단계 끝 화면 도움말). 끝 숫자 바로 앞부터 (maxStep + 1)씩 거꾸로.
 * 예: 끝 20, 3개씩 → [3, 7, 11, 15, 19]
 */
export function goodSpots(end, maxStep) {
  const spots = [];
  for (let n = end - 1; n >= 1; n -= maxStep + 1) spots.unshift(n);
  return spots;
}

/** 지금(now)에서 셀 수 있는 개수 목록. 끝 숫자를 넘지 않게 */
export function allowedCounts(now, end, maxStep) {
  const left = end - now;
  return Array.from({ length: Math.min(maxStep, left) }, (_, i) => i + 1);
}

/** 세기: now 다음부터 count 개. 반환: 이번에 센 수 목록 */
export function countFrom(now, count) {
  return Array.from({ length: count }, (_, i) => now + 1 + i);
}

/**
 * 로봇이 셀 개수.
 * - smart 확률로 이기는 수를 고른다 (상대를 지는 자리에 두는 수)
 * - 그 밖에는 아무 수나. 다만 끝 숫자는 피할 수 있으면 피한다 (일부러 지지는 않음)
 * - 이기는 수가 없으면(지는 자리) 끝 숫자만 피해서 아무 수나
 */
export function robotCount(now, end, maxStep, smart, rand = Math.random) {
  const allowed = allowedCounts(now, end, maxStep);
  const best = (end - 1 - now) % (maxStep + 1);
  if (best >= 1 && best <= maxStep && rand() < smart) return best;
  const safe = allowed.filter((n) => now + n < end);
  const list = safe.length ? safe : allowed;
  return list[Math.min(list.length - 1, Math.floor(rand() * list.length))];
}

/**
 * 숫자 뒤 조사 (읽는 소리 끝 받침 기준). 예: josa(23, '을', '를') → '을' (이십삼), josa(4, '을', '를') → '를' (사)
 * 끝자리 0 은 "십"으로 읽는다 (10·20 단위만 쓴다)
 */
export function josa(n, withFinal, withoutFinal) {
  const last = Math.abs(n) % 10;
  return [2, 4, 5, 9].includes(last) ? withoutFinal : withFinal;
}

/**
 * 한 판 기록 요약 (공통 필드). 사용자가 끝 숫자를 피하면 done 1, 그만하면 skipped 1.
 * turns: [{ who: 'me'|'robot', count, reactionMs? }]
 */
export function summarizeGame({ winner, stopped, turns }) {
  const mine = turns.filter((t) => t.who === 'me' && Number.isFinite(t.reactionMs));
  return {
    total: 1,
    done: winner === 'me' ? 1 : 0,
    skipped: stopped ? 1 : 0,
    avgReactionMs: mine.length ? Math.round(mine.reduce((a, t) => a + t.reactionMs, 0) / mine.length) : null,
  };
}
