// STEP 3 색깔손: 문제 생성과 판정 (순수 함수, DOM·ctx 사용 금지)
//
// 화면에 색 이름 글자(예: "파랑")를 다른 색 잉크(예: 빨간색)로 보여준다.
// 사용자는 글자의 "뜻"이 아니라 "글자 색"과 같은 색깔 카드를 WonderCam에 보여준다.
// colors 는 data/colors.json 모양: [{ color: 'red', label: '빨강', hex: '#...' }, ...]
// 색은 'red' | 'blue' | 'yellow' | 'green' 으로만 다룬다 (카드 ID는 몰라도 된다).

/**
 * 난이도별 문제 종류
 *   easy:   글자 뜻과 색이 같다 (연습)
 *   normal: 같을 때도, 다를 때도 있다
 *   hard:   항상 다르다
 */
export const MODE_BY_DIFFICULTY = { easy: 'same', normal: 'mixed', hard: 'different' };

/**
 * 문제 하나 만들기
 * 반환: { wordColor, inkColor, congruent }
 *   wordColor: 글자의 뜻, inkColor: 글자 색(정답), congruent: 뜻과 색이 같은지
 */
export function makeQuestion(colors, difficulty = 'easy', rand = Math.random) {
  if (colors.length < 2) throw new Error('색이 2개 이상 있어야 합니다.');
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const mode = MODE_BY_DIFFICULTY[difficulty] ?? 'same';

  const word = pick(colors);
  let same;
  if (mode === 'same') same = true;
  else if (mode === 'different') same = false;
  else same = rand() < 0.5;

  const ink = same ? word : pick(colors.filter((c) => c.color !== word.color));
  return { wordColor: word.color, inkColor: ink.color, congruent: same };
}

/** 한 회차 문제 수 */
export const QUESTIONS_PER_ROUND = 5;

/**
 * 한 회차 문제 목록 만들기. 바로 앞 문제와 똑같은 문제(뜻·색 모두 같음)는 연달아 내지 않는다.
 * rand 가 늘 같은 값을 주면(테스트 등) 다시 뽑아도 같아서, 20번 시도 후에는 그대로 넣는다.
 */
export function makeRound(colors, difficulty = 'easy', count = QUESTIONS_PER_ROUND, rand = Math.random) {
  const list = [];
  while (list.length < count) {
    const prev = list[list.length - 1];
    let q = makeQuestion(colors, difficulty, rand);
    for (let tries = 0; prev && isSame(prev, q) && tries < 20; tries++) {
      q = makeQuestion(colors, difficulty, rand);
    }
    list.push(q);
  }
  return list;
}

function isSame(a, b) {
  return a.wordColor === b.wordColor && a.inkColor === b.inkColor;
}

/** 문제 사이 쉬는 시간(ms). 결과 문구를 읽을 시간을 준다. */
export function gapMs(speed) {
  return speed === 'SLOW' ? 2500 : 1500;
}

/**
 * 회차 요약 (ctx.log.record 공통 필드용)
 * answers: [{ correct, reactionMs }, ...]
 */
export function summarizeRound(answers) {
  const total = answers.length;
  const done = answers.filter((a) => a.correct).length;
  const avgReactionMs = total
    ? Math.round(answers.reduce((sum, a) => sum + a.reactionMs, 0) / total)
    : null;
  return { total, done, avgReactionMs };
}

/** 판정: 보여준 카드 색이 글자 색과 같으면 정답. 글자 뜻을 고른 것인지도 알려준다. */
export function judge(question, color) {
  return {
    correct: color === question.inkColor,
    pickedWord: !question.congruent && color === question.wordColor,
  };
}

/** 답을 기다린 지 이만큼(ms) 지나면 "카드를 내렸다가 다시 보여 주세요" 안내를 보여 준다 (#14: 카드를 들고 있으면 다시 인식하지 않음) */
export const NO_ANSWER_HINT_MS = 10000;

/** 회차를 모두 맞혔는지 (로봇이 한 번 더 인사하는 조건). summary = summarizeRound 결과 */
export function isPerfect(summary) {
  return summary.total > 0 && summary.done === summary.total;
}

// ---------------------------------------------------------------------------
// 카드 섞기 (#132): 카드 4장이 뒤집혀 섞이고, 물어본 자리의 카드 색을 답한다.
// 자리는 코드 안에서 0~3, 화면·로봇에서는 1~4로 쓴다.
// ---------------------------------------------------------------------------

/** 자리 수 (카드 4장) */
export const SLOTS = 4;

/** 한 회차 판 수 */
export const SHUFFLE_ROUNDS = 5;

/**
 * 단계별 값 (11/20 A가 시험 페이지로 확인한 값)
 *   swaps: 자리 바꾸는 횟수, moveMs: 카드 한 장이 한 번 움직이는 시간, asks: 한 판에 묻는 자리 수
 */
export const SHUFFLE_SPEC = {
  easy: { swaps: 2, moveMs: 1200, asks: 1 },
  normal: { swaps: 4, moveMs: 1000, asks: 1 },
  hard: { swaps: 6, moveMs: 800, asks: 2 },
  challenge: { swaps: 8, moveMs: 600, asks: 2 },
};

/** 단계 값. challenge 가 true 면 도전 값, 속도 느리게면 moveMs ×1.5 */
export function shuffleSpec(difficulty = 'easy', challenge = false, speed = 'NORMAL') {
  const base = challenge ? SHUFFLE_SPEC.challenge : SHUFFLE_SPEC[difficulty] ?? SHUFFLE_SPEC.easy;
  const moveMs = speed === 'SLOW' ? Math.round(base.moveMs * 1.5) : base.moveMs;
  return { ...base, moveMs };
}

/** "카드를 잘 보세요" 앞면을 보여 주는 시간(ms) */
export function showMs(speed) {
  return speed === 'SLOW' ? 3000 : 2000;
}

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
