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

/**
 * 이번 회차에서 한 문제에 도전하는 횟수.
 * 나의 시작 찾기(findStart)는 한 번만: 다시 하기를 권하지 않고, 놓치면 함께 확인한 뒤 넘어간다 (2026-11-27 A).
 * 그래야 기록(status 'shown', done 0)대로 쉬운 단계가 추천된다
 */
export function maxTries(findStart = false) {
  return findStart ? 1 : MAX_TRIES;
}

/** 난이도별로 첫 문제에서 기억할 숫자 개수 */
export const LENGTH_BY_DIFFICULTY = { easy: 1, normal: 2, hard: 3 };

/** 난이도별로 늘어날 수 있는 최대 개수 (카드가 1~5 한 장씩이라 5가 끝) */
export const MAX_LENGTH_BY_DIFFICULTY = { easy: 3, normal: 4, hard: 5 };

/** 나의 시작 찾기 짧은 판: 숫자 3개를 한 문제만 (ctx.settings.findStart) */
export const FIND_START_ROUND = { questions: 1, length: 3 };

/**
 * 한 회차 계획: 문제 수와 첫 문제의 숫자 개수.
 * 나의 시작 찾기면 난이도와 관계없이 FIND_START_ROUND
 */
export function roundPlan(difficulty, findStart = false) {
  if (findStart) return { ...FIND_START_ROUND };
  return { questions: QUESTIONS_PER_ROUND, length: sequenceLength(difficulty) };
}

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

// ---------- 음성 안내 (#61) ----------
// 화면과 음성이 같은 문구를 쓰도록 여기 모아 둔다. 음성 파일은 voiceLines() 의 문장으로 만든다 (npm run voice).
// 로봇이 보여 주는 숫자는 읽지 않는다 (로봇 손을 보고 기억하는 활동).

/** 시작 화면 */
export const INTRO_VOICE = '로봇이 손가락으로 숫자를 차례로 보여 줘요. 잘 보고 기억했다가, 같은 순서로 숫자 카드를 보여 주세요.';

/** 로봇이 보여 주기 전: 몇 개를 기억할지. attempt 2 = 같은 숫자를 한 번 더 */
export function announceLine(count, attempt = 1) {
  const head = attempt > 1 ? '같은 숫자를 한 번 더 보여 드릴게요.' : `이번에는 숫자 ${count}개예요.`;
  return `${head} 로봇을 잘 보고 기억해 주세요.`;
}

/** 카드로 답할 차례 */
export function recallLine(count) {
  return `숫자 ${count}개를 순서대로 보여 주세요`;
}

/** 해냈을 때. attempt 2 = 다시 보고 해냄 */
export function goodLine(attempt) {
  return attempt > 1 ? '잘하셨어요! 다시 보고 해내셨어요.' : '잘하셨어요! 순서까지 똑같아요.';
}

/** 처음 해내지 못했을 때 */
export const RETRY_TEXT = '다시 해 볼까요? 로봇이 같은 순서를 한 번 더 보여 줄게요.';

/** 두 번째도 해내지 못했을 때 */
export const REVEAL_TEXT = '함께 순서를 확인해 볼까요?';

/** 회차 끝 */
export function summaryLine(count) {
  return `${count}문제를 모두 함께 해 주셨어요. 수고하셨어요!`;
}

/** STEP 1에서 음성으로 읽을 수 있는 문구 전부 (음성 파일 만들기용) */
export function voiceLines() {
  const lines = [INTRO_VOICE, goodLine(1), goodLine(2), RETRY_TEXT, REVEAL_TEXT, summaryLine(QUESTIONS_PER_ROUND)];
  const most = Math.max(...Object.values(MAX_LENGTH_BY_DIFFICULTY));
  for (let n = 1; n <= most; n++) lines.push(announceLine(n, 1), recallLine(n));
  lines.push(announceLine(1, 2));
  return lines;
}
