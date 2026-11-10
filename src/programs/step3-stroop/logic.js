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
