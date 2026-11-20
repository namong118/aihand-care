// 도전 활동 "숫자 야구" (기본 활동 숫자 기억의 짝): 문제 만들기와 판정 (순수 함수, DOM·ctx 사용 금지)
//
// 로봇이 1~5 중 서로 다른 숫자 몇 개를 몰래 정한다. 사용자는 숫자 카드로 순서를 맞혀 본다.
// 낼 때마다 로봇이 손가락으로 알려 준다:
//   스트라이크 = 숫자와 자리가 모두 맞은 개수, 볼 = 숫자는 있지만 자리가 다른 개수

/** 숫자 카드 (교구 카드 1~5, 숫자마다 한 장) */
export const CARD_NUMBERS = [1, 2, 3, 4, 5];

/**
 * 단계 (도전 활동은 모두 1·2·3단계, #132)
 *   count: 맞힐 숫자 개수, helper: "없는 숫자" 표시 도움, maxTries: 낼 수 있는 횟수
 */
export const LEVELS = {
  1: { count: 3, helper: true, maxTries: 8 },
  2: { count: 3, helper: false, maxTries: 8 },
  3: { count: 4, helper: false, maxTries: 8 },
};

/** 단계 값. 1·2·3 이 아니면 1단계 */
export function levelSpec(level) {
  return LEVELS[defaultLevel(level)];
}

/** 시작 화면에서 미리 고를 단계. ctx.settings.challengeLevel 이 1·2·3 이면 그대로, 아니면 1 */
export function defaultLevel(value) {
  return [1, 2, 3].includes(value) ? value : 1;
}

/**
 * 로봇이 정할 숫자. 서로 다른 숫자 count 개 (카드가 숫자마다 한 장뿐)
 * @param rand 0 이상 1 미만을 돌려주는 함수 (테스트에서 고정값)
 */
export function makeSecret(count, rand = Math.random) {
  if (count > CARD_NUMBERS.length) throw new Error(`숫자는 ${CARD_NUMBERS.length}개까지예요: ${count}`);
  const left = [...CARD_NUMBERS];
  const secret = [];
  for (let i = 0; i < count; i++) {
    const k = Math.min(left.length - 1, Math.floor(rand() * left.length));
    secret.push(left[k]);
    left.splice(k, 1);
  }
  return secret;
}

/**
 * 내는 중인 숫자에 하나 더하기.
 * 반환: { guess, added } / 더하지 않으면 reason: 'dup'(이미 낸 숫자) | 'full'(다 냄) | 'bad'(1~5가 아님)
 */
export function addDigit(guess, number, count) {
  if (!CARD_NUMBERS.includes(number)) return { guess, added: false, reason: 'bad' };
  if (guess.length >= count) return { guess, added: false, reason: 'full' };
  if (guess.includes(number)) return { guess, added: false, reason: 'dup' };
  return { guess: [...guess, number], added: true };
}

/** 판정: { strike, ball } */
export function judgeGuess(secret, guess) {
  let strike = 0;
  let ball = 0;
  guess.forEach((n, i) => {
    if (secret[i] === n) strike += 1;
    else if (secret.includes(n)) ball += 1;
  });
  return { strike, ball };
}

/** 다 맞혔는지 */
export function isSolved(result, count) {
  return result.strike === count;
}

/**
 * 1단계 도움: 확실히 없는 숫자.
 * 스트라이크·볼이 모두 0인 판에 낸 숫자는 정답에 없다.
 * history: [{ guess, strike, ball }]
 */
export function excludedDigits(history) {
  const out = new Set();
  for (const row of history) {
    if (row.strike === 0 && row.ball === 0) row.guess.forEach((n) => out.add(n));
  }
  return [...out].sort((a, b) => a - b);
}

/** 개수 → 로봇 손모양. 0개는 주먹, 1~5는 손가락 수 (data/poses.json 이름만) */
const POSE_BY_COUNT = ['ROCK', 'INDEX', 'V', 'THREE', 'FOUR', 'PAPER'];

export function countPose(n) {
  const name = POSE_BY_COUNT[n];
  if (!name) throw new Error(`개수는 0~5 입니다: ${n}`);
  return name;
}

/**
 * 기록용 요약 (ctx.log.record 공통 필드). 한 회차 = 한 판.
 *   game: { solved, stopped, history: [{ reactionMs }] }
 *   total 1, done 다 맞히면 1, skipped "그만하기"면 1, avgReactionMs 한 번 내는 데 걸린 평균 시간
 */
export function summarizeGame(game) {
  const times = game.history.map((r) => r.reactionMs).filter((ms) => Number.isFinite(ms));
  return {
    total: 1,
    done: game.solved ? 1 : 0,
    skipped: game.stopped ? 1 : 0,
    avgReactionMs: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null,
  };
}
