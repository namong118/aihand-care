// STEP 2 사고력 가위바위보: 문제 생성과 판정 (순수 함수, DOM·ctx 사용 금지)
//
// 손모양 이름은 data/poses.json 을 따른다: 바위 = ROCK, 보 = PAPER, 가위 = V

export const HANDS = ['ROCK', 'PAPER', 'V'];

export const HAND_LABELS = {
  ROCK: '바위',
  PAPER: '보',
  V: '가위',
};

// key 가 value 를 이긴다
const BEATS = {
  ROCK: 'V', // 바위 > 가위
  V: 'PAPER', // 가위 > 보
  PAPER: 'ROCK', // 보 > 바위
};

/**
 * 조건 5종. target 은 사용자가 만들어야 하는 결과.
 * "이기지도 비기지도 마세요" 는 결국 져야 하고,
 * "지지도 비기지도 마세요" 는 결국 이겨야 한다 (정답은 항상 하나).
 */
export const CONDITIONS = [
  { id: 'WIN', text: '이겨주세요', target: 'win' },
  { id: 'LOSE', text: '져주세요', target: 'lose' },
  { id: 'DRAW', text: '비겨주세요', target: 'draw' },
  { id: 'NO_WIN_NO_DRAW', text: '이기지도 비기지도 마세요', target: 'lose' },
  { id: 'NO_LOSE_NO_DRAW', text: '지지도 비기지도 마세요', target: 'win' },
];

/** 난이도별로 나올 수 있는 조건 */
export const CONDITIONS_BY_DIFFICULTY = {
  easy: ['WIN', 'LOSE', 'DRAW'],
  normal: ['WIN', 'LOSE', 'DRAW', 'NO_WIN_NO_DRAW', 'NO_LOSE_NO_DRAW'],
  hard: ['WIN', 'LOSE', 'DRAW', 'NO_WIN_NO_DRAW', 'NO_LOSE_NO_DRAW'],
};

export function isRpsHand(name) {
  return HANDS.includes(name);
}

function assertHand(name) {
  if (!isRpsHand(name)) throw new Error(`가위바위보 손이 아닙니다: ${name}`);
}

export function findCondition(conditionId) {
  const c = CONDITIONS.find((x) => x.id === conditionId);
  if (!c) throw new Error(`없는 조건입니다: ${conditionId}`);
  return c;
}

/** 사용자 손(user) 기준 승패: 'win' | 'lose' | 'draw' */
export function outcome(user, robot) {
  assertHand(user);
  assertHand(robot);
  if (user === robot) return 'draw';
  return BEATS[user] === robot ? 'win' : 'lose';
}

/** 조건과 로봇 손이 주어졌을 때 정답 손 (항상 하나) */
export function answerFor(conditionId, robotHand) {
  const { target } = findCondition(conditionId);
  return HANDS.find((h) => outcome(h, robotHand) === target);
}

/**
 * 판정.
 * 반환: { correct, outcome, answer }
 *   outcome: 사용자 기준 승패, answer: 정답 손
 */
export function judge(conditionId, robotHand, userHand) {
  const result = outcome(userHand, robotHand);
  const { target } = findCondition(conditionId);
  return {
    correct: result === target,
    outcome: result,
    answer: answerFor(conditionId, robotHand),
  };
}

/** 문제 하나 만들기. rand 는 0 이상 1 미만을 돌려주는 함수 (테스트에서 고정값 사용) */
export function makeQuestion(difficulty = 'easy', rand = Math.random) {
  const ids = CONDITIONS_BY_DIFFICULTY[difficulty] ?? CONDITIONS_BY_DIFFICULTY.easy;
  const pick = (list) => list[Math.floor(rand() * list.length)];
  return {
    robotHand: pick(HANDS),
    conditionId: pick(ids),
  };
}

// ---------- 지금 보이는 손 표시 ----------

/**
 * 문제 화면의 "지금 보이는 손" 표시 내용 (손 인식이 되고 있는지 어르신이 알 수 있게).
 * 판단은 ctx.hand.waitForPose 확정 규칙과 같다: 문제가 나온(since) 뒤에 새로 낸 가위·바위·보를 holdMs 유지.
 *   pose: ctx.hand.onPose 로 받은 값 { code, name, stableMs }, now: 지금 시각
 * 반환:
 *   { kind: 'none' }                  손이 안 보임
 *   { kind: 'other' }                 가위·바위·보가 아닌 손모양
 *   { kind: 'old', hand }             문제가 나오기 전부터 들고 있던 손 (새로 내야 함)
 *   { kind: 'holding', hand, ratio }  유지 중. ratio 0~1 (1이면 곧 확정)
 */
export function handFeedback(pose, { now, since, holdMs }) {
  if (!pose || !pose.code) return { kind: 'none' };
  if (!isRpsHand(pose.name)) return { kind: 'other' };
  if (now - pose.stableMs < since) return { kind: 'old', hand: pose.name };
  return { kind: 'holding', hand: pose.name, ratio: Math.min(1, Math.max(0, pose.stableMs / holdMs)) };
}

/**
 * 손 인식 안내는 이상이 있을 때만, 그 상태가 잠깐 계속될 때만 띄운다 (잘 되고 있으면 아무것도 안 띄움).
 *   none(손 안 보임): 문제가 막 나왔을 때는 손을 아직 안 든 게 정상이라 3초 기다린다
 *   other·old: 손을 바꾸는 중에 잠깐 지나가는 모양일 수 있어 1초 기다린다
 *   holding(잘 되는 중): 띄우지 않는다
 * kindMs: 지금 kind 가 계속된 시간
 */
export const NOTICE_DELAY_MS = { none: 3000, other: 1000, old: 1000 };

export function shouldShowNotice(kind, kindMs) {
  const delay = NOTICE_DELAY_MS[kind];
  return delay !== undefined && kindMs >= delay;
}

// ---------- 한 회차 (여러 문제) ----------

/** 한 회차 문제 수 */
export const QUESTIONS_PER_ROUND = 5;

/** 한 문제에 답할 수 있는 횟수. 두 번째도 맞지 않으면 답을 함께 확인하고 넘어간다 */
export const MAX_TRIES = 2;

/** 화면에 손 이름과 함께 보여 줄 그림 글자 (색이 아니라 모양으로도 구분되게) */
export const HAND_EMOJI = {
  ROCK: '✊',
  PAPER: '✋',
  V: '✌️',
};

/** "✊ 바위" 처럼 그림 + 이름 */
export function handText(name) {
  assertHand(name);
  return `${HAND_EMOJI[name]} ${HAND_LABELS[name]}`;
}

/**
 * 한 회차 문제 목록. 바로 앞 문제와 같은 조건은 되도록 피한다 (같은 말이 연달아 나오면 지루하다).
 * 반환: [{ robotHand, conditionId }, ...]
 */
export function makeRound(difficulty = 'easy', count = QUESTIONS_PER_ROUND, rand = Math.random) {
  const list = [];
  for (let i = 0; i < count; i++) {
    let q = makeQuestion(difficulty, rand);
    // 앞 문제와 조건이 같으면 몇 번 다시 뽑는다. 그래도 같으면 그대로 쓴다 (rand 를 고정한 테스트에서 무한 반복 방지)
    for (let t = 0; t < 10 && i > 0 && q.conditionId === list[i - 1].conditionId; t++) {
      q = makeQuestion(difficulty, rand);
    }
    list.push(q);
  }
  return list;
}

/**
 * 어려움 난이도: 로봇 손을 이 시간만 보여 주고 내린다 (기억해서 답하기).
 * 쉬움·보통은 null (계속 보여 준다). 속도 "천천히"(SLOW)면 1.5배.
 */
export function revealMs(difficulty, speed) {
  if (difficulty !== 'hard') return null;
  return speed === 'SLOW' ? 4500 : 3000;
}

/** 첫 번째 답이 맞지 않았을 때 보여 줄 도움말. 꼬인 조건은 뜻을 풀어 준다 */
export function hintFor(conditionId) {
  const c = findCondition(conditionId);
  if (c.id === 'NO_WIN_NO_DRAW') return `도움말: “${c.text}”는 “져주세요”와 같은 뜻이에요.`;
  if (c.id === 'NO_LOSE_NO_DRAW') return `도움말: “${c.text}”는 “이겨주세요”와 같은 뜻이에요.`;
  return '도움말: 로봇이 낸 손을 다시 잘 보고 생각해 보세요.';
}

const TARGET_WORD = { win: '이기려면', lose: '지려면', draw: '비기려면' };

/** 두 번째도 맞지 않았을 때 함께 확인하는 설명. 예: "로봇이 ✊ 바위를 냈어요. 이기려면 ✋ 보를 내면 돼요." */
export function explain(conditionId, robotHand) {
  const c = findCondition(conditionId);
  const answer = answerFor(conditionId, robotHand);
  const lines = [`로봇이 ${handText(robotHand)}를 냈어요.`];
  if (c.id === 'NO_WIN_NO_DRAW') lines.push(`“${c.text}”는 져 주라는 뜻이에요.`);
  if (c.id === 'NO_LOSE_NO_DRAW') lines.push(`“${c.text}”는 이기라는 뜻이에요.`);
  lines.push(`${TARGET_WORD[c.target]} ${handText(answer)}를 내면 돼요.`);
  return lines.join(' ');
}

/**
 * 문제 하나의 결과.
 *   tries: 낸 답마다 맞았는지 [false, true] 처럼, skipped: 건너뛰었는지
 * 반환: 'first'(한 번에) | 'second'(다시 해서) | 'shown'(답을 함께 확인) | 'skipped'(건너뜀)
 */
export function questionStatus(tries, skipped = false) {
  if (tries[0] === true) return 'first';
  if (tries[1] === true) return 'second';
  if (skipped) return 'skipped';
  return 'shown';
}

/**
 * 회차 요약 (ctx.log.record 공통 필드용).
 *   items: [{ status, reactionMs }]  reactionMs = 문제가 나온 뒤 첫 답까지 걸린 시간, 건너뛰면 null
 * 반환: { total, done, skipped, avgReactionMs }
 *   done: 조건에 맞게 낸 문제 수 (한 번에 + 다시 해서), avgReactionMs: 첫 답 시간 평균 (없으면 null)
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

