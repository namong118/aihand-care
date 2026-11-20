// 도전 활동 "카드 섞기": 카드 4장이 뒤집혀 섞이고, 로봇이 손가락으로 묻는 자리의 카드 색을 답한다 (순수 함수, DOM·ctx 사용 금지)
//
// 자리는 코드 안에서 0~3, 화면·로봇에서는 1~4로 쓴다.
// 색은 'red' | 'blue' | 'yellow' | 'green' 으로만 다룬다 (카드 ID는 몰라도 된다).

/** 자리 수 (카드 4장) */
export const SLOTS = 4;

/** 한 회차 판 수 */
export const ROUNDS = 5;

/**
 * 단계별 값 (11/20 A가 시험 페이지로 확인한 값)
 *   swaps: 자리 바꾸는 횟수, moveMs: 카드 한 장이 한 번 움직이는 시간, asks: 한 판에 묻는 자리 수
 */
export const LEVELS = {
  1: { swaps: 4, moveMs: 1000, asks: 1 },
  2: { swaps: 6, moveMs: 800, asks: 2 },
  3: { swaps: 8, moveMs: 600, asks: 2 },
};

/** 단계 값. 1~3이 아니면 1단계, 속도 느리게면 moveMs ×1.5 */
export function levelSpec(level, speed = 'NORMAL') {
  const base = LEVELS[level] ?? LEVELS[1];
  const moveMs = speed === 'SLOW' ? Math.round(base.moveMs * 1.5) : base.moveMs;
  return { ...base, moveMs };
}

/** 시작 화면에서 미리 선택할 단계. challengeLevel 이 1·2·3이면 그대로, 없거나 다른 값이면 1 */
export function defaultLevel(challengeLevel) {
  return [1, 2, 3].includes(challengeLevel) ? challengeLevel : 1;
}

/** "카드를 잘 보세요" 앞면을 보여 주는 시간(ms) */
export function showMs(speed) {
  return speed === 'SLOW' ? 3000 : 2000;
}

/** 묻기·판 사이 쉬는 시간(ms). 결과 문구를 읽을 시간을 준다 */
export function gapMs(speed) {
  return speed === 'SLOW' ? 2500 : 1500;
}

/** 답을 기다린 지 이만큼(ms) 지나면 "카드를 내렸다가 다시 보여 주세요" 안내 (#14: 카드를 들고 있으면 다시 인식하지 않음) */
export const NO_ANSWER_HINT_MS = 10000;

/**
 * 색 4개를 무작위 순서로. colors 는 data/colors.json 모양 또는 'red' 같은 색 이름 목록
 * 반환 예: ['blue', 'red', 'green', 'yellow']
 */
export function makeStart(colors, rand = Math.random) {
  const list = colors.map((c) => (typeof c === 'string' ? c : c.color));
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/** 서로 다른 두 자리 한 쌍 (작은 번호가 앞) */
function makePair(rand) {
  const a = Math.min(SLOTS - 1, Math.floor(rand() * SLOTS));
  let b = Math.min(SLOTS - 2, Math.floor(rand() * (SLOTS - 1)));
  if (b >= a) b += 1;
  return a < b ? [a, b] : [b, a];
}

/**
 * 바꿀 자리 쌍 목록. 예: [[0, 2], [1, 3], [0, 1]]
 * 바로 앞과 같은 쌍은 다시 뽑는다 (되돌려져서 너무 쉬워짐). rand 가 늘 같은 값이면 20번 시도 후 그대로 넣는다.
 */
export function makeSwaps(count, rand = Math.random) {
  const list = [];
  while (list.length < count) {
    const prev = list[list.length - 1];
    let pair = makePair(rand);
    for (let tries = 0; prev && pair[0] === prev[0] && pair[1] === prev[1] && tries < 20; tries++) {
      pair = makePair(rand);
    }
    list.push(pair);
  }
  return list;
}

/** 섞은 뒤의 배치 (새 배열을 돌려주고 원본은 그대로 둔다) */
export function applySwaps(order, swaps) {
  const next = [...order];
  for (const [a, b] of swaps) [next[a], next[b]] = [next[b], next[a]];
  return next;
}

/** 물어볼 자리 count 개 (서로 다름) */
export function pickAsks(count, rand = Math.random) {
  const slots = Array.from({ length: SLOTS }, (_, i) => i);
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  return slots.slice(0, Math.min(count, SLOTS));
}

/** 자리 0~3 → 로봇 손가락 손모양 (1 검지, 2 브이, 3 손가락 셋, 4 손가락 넷) */
export const POSITION_POSES = ['INDEX', 'V', 'THREE', 'FOUR'];

export function positionPose(position) {
  if (!Number.isInteger(position) || position < 0 || position >= POSITION_POSES.length) {
    throw new Error(`자리 번호는 0~3이어야 합니다: ${position}`);
  }
  return POSITION_POSES[position];
}

/** 판정: 그 자리의 실제 색(answer)과 고른 색이 같은지 */
export function judgeShuffle(finalOrder, position, color) {
  const answer = finalOrder[position];
  return { correct: color === answer, answer };
}

/**
 * 회차 요약 (ctx.log.record 공통 필드용)
 * answers: 물은 횟수만큼 [{ correct, reactionMs }, ...]
 */
export function summarizeRound(answers) {
  const total = answers.length;
  const done = answers.filter((a) => a.correct).length;
  const avgReactionMs = total
    ? Math.round(answers.reduce((sum, a) => sum + a.reactionMs, 0) / total)
    : null;
  return { total, done, avgReactionMs };
}
