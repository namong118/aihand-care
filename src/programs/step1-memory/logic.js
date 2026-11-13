// STEP 1 숫자 기억: 문제 생성과 판정 (순수 함수, DOM·ctx 사용 금지)
//
// 로봇이 손가락으로 숫자 몇 개를 차례로 보여준 뒤 손을 내린다.
// 사용자는 기억해서 같은 순서로 숫자 카드(1~5, AIHand 교구 카드)를 하나씩 WonderCam에 보여준다.

/** 숫자 카드 */
export const CARD_NUMBERS = [1, 2, 3, 4, 5];

/** 숫자 → 로봇 손모양 (data/poses.json 에 있는 이름만) */
export const POSE_BY_NUMBER = { 1: 'INDEX', 2: 'V', 3: 'THREE', 4: 'FOUR', 5: 'PAPER' };

export function poseForNumber(n) {
  const name = POSE_BY_NUMBER[n];
  if (!name) throw new Error(`숫자 카드는 1~5 입니다: ${n}`);
  return name;
}

/** 한 회차 문제 수 */
export const QUESTIONS_PER_ROUND = 5;

/** 한 문제에 도전하는 횟수. 처음 해내지 못하면 로봇이 한 번 더 보여 주고 다시 한다 */
export const MAX_TRIES = 2;

/** 난이도별로 첫 문제에서 기억할 숫자 개수 */
export const LENGTH_BY_DIFFICULTY = { easy: 1, normal: 2, hard: 3 };

/** 난이도별로 늘어날 수 있는 최대 개수 (카드가 1~5 한 장씩이라 5가 끝) */
export const MAX_LENGTH_BY_DIFFICULTY = { easy: 3, normal: 4, hard: 5 };

export function sequenceLength(difficulty) {
  return LENGTH_BY_DIFFICULTY[difficulty] ?? LENGTH_BY_DIFFICULTY.easy;
}

export function maxLength(difficulty) {
  return MAX_LENGTH_BY_DIFFICULTY[difficulty] ?? MAX_LENGTH_BY_DIFFICULTY.easy;
}

/**
 * 문제 결과 이름.
 *   tries: 도전마다 해냈는지 [false, true] / skipped: 건너뛰었는지
 * 반환: 'first' 한 번에 | 'second' 다시 해서 | 'shown' 두 번 다 아니어서 함께 확인 | 'skipped' 건너뜀
 */
export function questionStatus(tries, skipped = false) {
  if (tries[0] === true) return 'first';
  if (tries[1] === true) return 'second';
  if (skipped) return 'skipped';
  return 'shown';
}

/**
 * 다음 문제의 숫자 개수.
 *   한 번에 해내면 하나 늘린다 (난이도 최대까지)
 *   다시 해서 해내면 그대로
 *   함께 확인했거나 건너뛰면 하나 줄인다 (1개보다 적게는 안 함)
 */
export function nextLength(current, status, difficulty) {
  if (status === 'first') return Math.min(current + 1, maxLength(difficulty));
  if (status === 'second') return current;
  return Math.max(current - 1, 1);
}

/**
 * 회차 요약 (ctx.log.record 공통 필드용).
 *   items: [{ status, reactionMs }]  reactionMs = 그 문제 첫 도전에서 숫자 하나 입력에 걸린 평균 시간, 건너뛰면 null
 * 반환: { total, done, skipped, avgReactionMs }  done = 해낸 문제 수 (한 번에 + 다시 해서)
 */
export function summarizeRound(items) {
  const times = items.map((x) => x.reactionMs).filter((ms) => Number.isFinite(ms));
  return {
    total: items.length,
    done: items.filter((x) => x.status === 'first' || x.status === 'second').length,
    skipped: items.filter((x) => x.status === 'skipped').length,
    avgReactionMs: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null,
  };
}

/**
 * 기억할 숫자 순서 만들기. 한 문제 안에서 같은 숫자는 두 번 나오지 않는다
 * (숫자 카드가 숫자마다 한 장뿐이라서).
 * @param items  고를 수 있는 숫자 목록
 * @param length 몇 개 (items 개수 이하)
 * @param rand   0 이상 1 미만을 돌려주는 함수 (테스트에서 고정값 사용)
 */
export function makeSequence(items, length, rand = Math.random) {
  if (length > items.length) throw new Error(`숫자 ${items.length}개로 겹치지 않게 ${length}개를 만들 수 없습니다.`);
  const left = [...items];
  const seq = [];
  for (let i = 0; i < length; i++) {
    const k = Math.floor(rand() * left.length);
    seq.push(left[k]);
    left.splice(k, 1); // 고른 숫자는 다시 고르지 않는다
  }
  return seq;
}

/**
 * 판정. 순서와 숫자가 모두 같아야 정답.
 * 반환: { correct, matched } matched = 자리까지 맞은 개수
 */
export function judgeSequence(expected, given) {
  let matched = 0;
  for (let i = 0; i < expected.length; i++) {
    if (given[i] === expected[i]) matched += 1;
  }
  return {
    correct: matched === expected.length && given.length === expected.length,
    matched,
  };
}
