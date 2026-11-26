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
 * 조건 7종. targets 는 사용자가 만들어야 하는 결과 (그중 하나가 되면 맞음).
 * 원래 5종은 정답 손이 하나다:
 *   "이기지도 비기지도 마세요" 는 결국 져야 하고, "지지도 비기지도 마세요" 는 결국 이겨야 한다.
 * 어려움에만 나오는 2종은 정답 손이 둘이다 (#18, 2026-11-24 D 결정):
 *   "이기지 마세요" = 지거나 비기면 된다, "지지 마세요" = 이기거나 비기면 된다.
 */
export const CONDITIONS = [
  { id: 'WIN', text: '이겨주세요', targets: ['win'] },
  { id: 'LOSE', text: '져주세요', targets: ['lose'] },
  { id: 'DRAW', text: '비겨주세요', targets: ['draw'] },
  { id: 'NO_WIN_NO_DRAW', text: '이기지도 비기지도 마세요', targets: ['lose'] },
  { id: 'NO_LOSE_NO_DRAW', text: '지지도 비기지도 마세요', targets: ['win'] },
  { id: 'NO_WIN', text: '이기지 마세요', targets: ['lose', 'draw'] },
  { id: 'NO_LOSE', text: '지지 마세요', targets: ['win', 'draw'] },
];

/** 난이도별로 나올 수 있는 조건. 어려움은 보통 5종 + 정답이 둘인 2종 */
export const CONDITIONS_BY_DIFFICULTY = {
  easy: ['WIN', 'LOSE', 'DRAW'],
  normal: ['WIN', 'LOSE', 'DRAW', 'NO_WIN_NO_DRAW', 'NO_LOSE_NO_DRAW'],
  hard: ['WIN', 'LOSE', 'DRAW', 'NO_WIN_NO_DRAW', 'NO_LOSE_NO_DRAW', 'NO_WIN', 'NO_LOSE'],
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

/** 조건과 로봇 손이 주어졌을 때 정답 손 목록 (HANDS 순서). 원래 5종은 하나, NO_WIN·NO_LOSE 는 둘 */
export function answersFor(conditionId, robotHand) {
  const { targets } = findCondition(conditionId);
  return HANDS.filter((h) => targets.includes(outcome(h, robotHand)));
}

/**
 * 판정.
 * 반환: { correct, outcome, answers }
 *   outcome: 사용자 기준 승패, answers: 정답 손 목록 (하나 또는 둘)
 */
export function judge(conditionId, robotHand, userHand) {
  const result = outcome(userHand, robotHand);
  const { targets } = findCondition(conditionId);
  return {
    correct: targets.includes(result),
    outcome: result,
    answers: answersFor(conditionId, robotHand),
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
  if (c.id === 'NO_WIN') return `도움말: “${c.text}”는 지거나 비기면 된다는 뜻이에요.`;
  if (c.id === 'NO_LOSE') return `도움말: “${c.text}”는 이기거나 비기면 된다는 뜻이에요.`;
  return '도움말: 로봇이 낸 손을 다시 잘 보고 생각해 보세요.';
}

// 조건의 targets 를 이어 붙인 것 → 설명 앞말
const TARGET_WORD = {
  win: '이기려면',
  lose: '지려면',
  draw: '비기려면',
  'lose,draw': '지거나 비기려면',
  'win,draw': '이기거나 비기려면',
};

/** 손 목록을 말로: ['ROCK'] → "✊ 바위", ['ROCK', 'V'] → "✊ 바위나 ✌️ 가위" (가위·바위·보 모두 받침이 없어 "나") */
export function handsText(names) {
  return names.map(handText).join('나 ');
}

/**
 * 두 번째도 맞지 않았을 때 함께 확인하는 설명.
 *   예: "로봇이 ✊ 바위를 냈어요. 이기려면 ✋ 보를 내면 돼요."
 *   정답이 둘: "로봇이 ✊ 바위를 냈어요. “이기지 마세요”는 지거나 비기면 된다는 뜻이에요. 지거나 비기려면 ✊ 바위나 ✌️ 가위를 내면 돼요."
 */
export function explain(conditionId, robotHand) {
  const c = findCondition(conditionId);
  const answers = answersFor(conditionId, robotHand);
  const lines = [`로봇이 ${handText(robotHand)}를 냈어요.`];
  if (c.id === 'NO_WIN_NO_DRAW') lines.push(`“${c.text}”는 져 주라는 뜻이에요.`);
  if (c.id === 'NO_LOSE_NO_DRAW') lines.push(`“${c.text}”는 이기라는 뜻이에요.`);
  if (c.id === 'NO_WIN') lines.push(`“${c.text}”는 지거나 비기면 된다는 뜻이에요.`);
  if (c.id === 'NO_LOSE') lines.push(`“${c.text}”는 이기거나 비기면 된다는 뜻이에요.`);
  lines.push(`${TARGET_WORD[c.targets.join(',')]} ${handsText(answers)}를 내면 돼요.`);
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


// ---------- 동시에 가위바위보 ("하나만 해 보기" 전용, 진짜처럼 동시에 내기) ----------
//
// "가위, 바위, 보!"의 "보!"에 맞춰 로봇과 사용자가 함께 손을 낸다. 승패는 운이고,
// "보!"에 맞춰 제때 냈는지(손을 만든 시각 - "보!" 시각)를 활동 기록으로 남긴다.

/** 한 회차 판 수 */
export const QUICK_GAMES = 5;

/** "보!"보다 이 시간 안쪽으로 조금 먼저 낸 손은 제때 낸 것으로 본다 (사람은 구호와 함께 손을 내기 시작한다) */
export const EARLY_MS = 300;

/** "보!" 뒤 이 시간 안에 손을 만들면 제때 낸 것. 난이도별, 속도 "천천히"면 0.5초 더 준다 */
const LATE_MS = { easy: 1500, normal: 1000, hard: 700 };

/**
 * 동시에 가위바위보 시간 값.
 *   holdMs: 손모양을 이 시간 유지하면 확정 (사고력 모드보다 짧다. 빨리 내고 빨리 확정)
 *   lateMs: "보!" 뒤 이 시간 안에 낸 손까지 제때 낸 것
 */
export function quickTiming(difficulty, speed) {
  const slow = speed === 'SLOW';
  return {
    holdMs: slow ? 500 : 300,
    lateMs: (LATE_MS[difficulty] ?? LATE_MS.easy) + (slow ? 500 : 0),
  };
}

/** 로봇이 낼 손 목록. 같은 손이 세 번 연달아 나오지는 않게 한다 */
export function makeQuickRound(count = QUICK_GAMES, rand = Math.random) {
  const list = [];
  for (let i = 0; i < count; i++) {
    let hand = HANDS[Math.floor(rand() * HANDS.length)];
    if (i >= 2 && list[i - 1] === hand && list[i - 2] === hand) {
      hand = HANDS[(HANDS.indexOf(hand) + 1) % HANDS.length];
    }
    list.push(hand);
  }
  return list;
}

/**
 * 손을 낸 때가 "보!"에 맞았는지.
 *   formedAt: 손모양을 만든 시각, goAt: "보!" 시각
 * 반환: 'early'(너무 먼저) | 'ontime'(제때) | 'late'(늦게)
 */
export function timingOf(formedAt, goAt, lateMs) {
  const d = formedAt - goAt;
  if (d < -EARLY_MS) return 'early';
  if (d > lateMs) return 'late';
  return 'ontime';
}

/**
 * 한 판 결과.
 *   input: { hand, formedAt } | null(손이 확정되지 않음)
 *   lastPose: 판이 끝날 때 마지막으로 보인 손 { name, stableMs } (확정되지 않았을 때 이유(early/late/unclear/none)를 알려 주는 데만 쓴다)
 *   sawHand: 손 입력을 받기 시작한 뒤(since) 손이 한 번이라도 보였는지
 *   now: 판이 끝난 시각
 * 반환: { timing: 'ontime'|'early'|'late'|'unclear'|'none', timingMs, outcome: 'win'|'draw'|'lose'|null }
 *   unclear: 손은 보였지만 가위·바위·보로 확정되지 않음 (다른 모양으로 인식됨, 또는 확정 전에 손을 내림)
 *   none: 손이 한 번도 보이지 않음
 *   outcome 은 제때 냈을 때만 정한다 (늦게 내면 로봇 손을 보고 낼 수 있어서 승패를 따지지 않는다)
 */
export function quickResult({ robotHand, input, goAt, lateMs, lastPose = null, sawHand = false, now = goAt }) {
  if (input) {
    const timing = timingOf(input.formedAt, goAt, lateMs);
    return {
      timing,
      timingMs: Math.round(input.formedAt - goAt),
      outcome: timing === 'ontime' ? outcome(input.hand, robotHand) : null,
    };
  }
  // 확정된 손이 없음: 마지막에 보인 가위·바위·보를 언제 만들었는지로 이유를 알려 준다
  //   "보!" 훨씬 전부터 들고 있던 손 → 너무 먼저 / 그 뒤에 만들었지만 확정 전에 판이 끝남 → 늦게
  if (lastPose && isRpsHand(lastPose.name)) {
    const formedAt = now - lastPose.stableMs;
    const timing = formedAt < goAt - EARLY_MS ? 'early' : 'late';
    return { timing, timingMs: timing === 'late' ? Math.round(formedAt - goAt) : null, outcome: null };
  }
  // 손은 보였는데 가위·바위·보로 확정되지 않음: "손이 보이지 않았어요"라고 하면 사실과 다르다
  if (sawHand) return { timing: 'unclear', timingMs: null, outcome: null };
  return { timing: 'none', timingMs: null, outcome: null };
}

/** 한 판 결과 문구. "실패", "틀렸습니다" 같은 말은 쓰지 않는다 */
export function quickMessage({ timing, outcome: result }) {
  if (timing === 'ontime') {
    if (result === 'win') return { tone: 'good', text: '이기셨어요!' };
    if (result === 'draw') return { tone: 'info', text: '비겼어요!' };
    return { tone: 'info', text: '로봇이 이겼어요! 다음 판에 이겨 볼까요?' };
  }
  if (timing === 'early') return { tone: 'retry', text: '조금 빨랐어요. “보!” 소리에 맞춰 내 볼까요?' };
  if (timing === 'late') return { tone: 'retry', text: '조금 늦었어요. “보!” 소리에 맞춰 내 볼까요?' };
  if (timing === 'unclear') {
    return { tone: 'retry', text: '손 모양을 알아보지 못했어요. 다음 판에는 가위·바위·보를 카메라에 잠깐 멈춰서 보여 주세요.' };
  }
  return { tone: 'retry', text: '손이 보이지 않았어요. 다음 판에는 “보!”에 맞춰 손을 내 주세요.' };
}

/**
 * 캠 화면 아래 "지금 보이는 손" 글자. 사용자가 손이 어떻게 인식되는지 바로 볼 수 있게 한다.
 *   pose: ctx.hand.onPose 로 받은 값 { code, name }
 */
export function seenText(pose) {
  if (!pose || !pose.code) return '손이 안 보여요';
  if (isRpsHand(pose.name)) return `${handText(pose.name)}`;
  return '가위·바위·보가 아닌 모양';
}

/** "보!"에서 손을 낼 때까지 걸린 시간 글자. 먼저 낸 경우(0 이하)는 "거의 동시에" */
export function timingText(timingMs) {
  if (!Number.isFinite(timingMs)) return '';
  if (timingMs <= 100) return '“보!”와 거의 동시에';
  return `“보!”에서 ${(timingMs / 1000).toFixed(1)}초`;
}

/**
 * 동시에 가위바위보 회차 요약 (ctx.log.record 공통 필드 + 승패 수).
 *   games: [{ timing, timingMs, outcome }]
 * 반환: { total, done, skipped, avgReactionMs, wins, draws, losses }
 *   done: 제때 낸 판 수, skipped: 손이 보이지 않은 판 수
 *   avgReactionMs: 제때 낸 판의 "보!"부터 손을 만들 때까지 평균 (먼저 낸 것은 0으로 센다, 없으면 null)
 */
export function summarizeQuick(games) {
  const ontime = games.filter((g) => g.timing === 'ontime');
  const times = ontime.map((g) => Math.max(0, g.timingMs)).filter((ms) => Number.isFinite(ms));
  const count = (o) => ontime.filter((g) => g.outcome === o).length;
  return {
    total: games.length,
    done: ontime.length,
    skipped: games.filter((g) => g.timing === 'none').length,
    avgReactionMs: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null,
    wins: count('win'),
    draws: count('draw'),
    losses: count('lose'),
  };
}
