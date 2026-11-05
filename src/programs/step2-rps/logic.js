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

/**
 * 손 인식 입력을 "확정"할지 정한다.
 * - 가위바위보 손이어야 하고
 * - minStableMs 이상 같은 모양을 유지했고
 * - 문제가 나온 뒤(sinceMs 이후)에 만든 손모양이어야 한다
 *   (문제 전부터 들고 있던 손이 바로 답이 되는 것을 막는다)
 */
export function shouldAcceptPose(pose, { now, sinceMs, minStableMs }) {
  if (!pose || !isRpsHand(pose.name)) return false;
  if (pose.stableMs < minStableMs) return false;
  const startedAt = now - pose.stableMs;
  return startedAt >= sinceMs;
}
