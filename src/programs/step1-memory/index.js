// STEP 1 숫자 기억: logic 과 screen 을 연결한다. core 는 import 하지 않고 ctx 만 쓴다.
//
// 한 회차 = 5문제. 문제 하나의 흐름:
//   로봇이 숫자를 손가락으로 차례로 보여줌 → 손 내림(REST)
//   → 사용자가 숫자 카드를 같은 순서로 하나씩 보여줌 (화면 숫자 버튼도 됨, 건너뛰기 가능) → 판정
//   → 해내면 칭찬 반응 / 처음 해내지 못하면 "다시 해 볼까요?" → 로봇이 같은 순서를 한 번 더 보여 주고 다시
//   → 두 번째도 해내지 못하면 순서를 함께 확인하고 다음 문제
// 다음 문제의 숫자 개수: 한 번에 해내면 하나 늘리고, 함께 확인했거나 건너뛰면 하나 줄인다 (logic.js nextLength).
// 회차가 끝나면 요약 화면을 보여 주고 ctx.log.record 로 한 번 기록한다.

import {
  CARD_NUMBERS,
  QUESTIONS_PER_ROUND,
  MAX_TRIES,
  poseForNumber,
  sequenceLength,
  makeSequence,
  judgeSequence,
  questionStatus,
  nextLength,
  summarizeRound,
} from './logic.js';
import { createScreen } from './screen.js';

const ID = 'step1-memory';

let session = null; // 지금 화면의 실행 상태. unmount 하면 alive = false

const isSlow = (ctx) => ctx.settings.speed === 'SLOW';

/** 숫자 하나를 보여준 뒤 기억할 시간 */
const showGapMs = (ctx) => (isSlow(ctx) ? 1500 : 800);
/** 칭찬을 보여 준 뒤 다음 문제로 넘어가기 전 쉬는 시간 */
const restMs = (ctx) => (isSlow(ctx) ? 2000 : 1200);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** 로봇 명령이 실패해도 활동은 이어 간다 (화면 안내가 주 흐름) */
async function robot(promise) {
  try {
    await promise;
  } catch (err) {
    console.error('STEP 1 로봇 명령 오류', err);
  }
}

/** 화면 버튼 하나 누를 때까지 기다리기. 화면이 닫히면 false */
function waitClick(s, show) {
  return new Promise((resolve) => {
    s.click = resolve;
    show(() => s.click?.(true));
  }).finally(() => {
    s.click = null;
  });
}

/**
 * 입력 하나 받기: 숫자 카드(ctx.card.onNumber)와 화면 숫자 버튼 중 먼저 들어온 것.
 * 반환: { number, via } / "처음부터 다시"면 { restart: true } / 건너뛰기면 { skip: true } / 화면이 닫히면 null
 * 카드 하나 = 입력 하나. 펌웨어는 보이는 숫자가 바뀔 때만 알리므로, 들고 있는 카드는 다시 들어오지 않는다.
 */
function pickOne(screen, s, view) {
  return new Promise((resolve) => {
    const finish = (picked) => {
      if (s.pending !== finish) return; // 이미 끝남
      s.pending = null;
      resolve(s.alive ? picked : null);
    };
    s.pending = finish; // 숫자 카드가 들어오면 mount 의 구독이 이 함수를 부른다
    screen.recall(
      view,
      (number) => finish({ number, via: 'button' }),
      () => finish({ restart: true }),
      () => finish({ skip: true }),
    );
  });
}

/** 로봇이 숫자를 손가락으로 차례로 보여 주고 손을 내린다. 화면이 닫히면 false */
async function showSequence(ctx, screen, s, expected, progress) {
  for (let i = 0; i < expected.length; i++) {
    screen.watching({ ...progress, step: i + 1, count: expected.length });
    await robot(ctx.robot.showPose(poseForNumber(expected[i])));
    await wait(showGapMs(ctx));
    if (!s.alive) return false;
  }
  await robot(ctx.robot.rest());
  return s.alive;
}

/**
 * 숫자를 다 입력할 때까지 받기.
 * 반환: { given, vias, reactions } / 건너뛰기면 { skip: true } / 화면이 닫히면 null
 * "처음부터 다시"를 누르면 그 전 입력과 반응 시간은 버린다.
 */
async function collectAnswer(screen, s, count, progress) {
  let given = [];
  let vias = [];
  let reactions = [];
  let since = Date.now();

  while (given.length < count) {
    const picked = await pickOne(screen, s, { ...progress, count, given });
    if (!picked) return null;
    if (picked.skip) return { skip: true };
    if (picked.restart) {
      // 처음부터 다시: 이번 입력을 모두 비운다 (로봇은 다시 보여주지 않는다)
      given = [];
      vias = [];
      reactions = [];
      since = Date.now();
      continue;
    }
    const now = Date.now();
    reactions.push(now - since);
    since = now;
    given.push(picked.number);
    vias.push(picked.via);
  }
  return { given, vias, reactions };
}

/** 문제 하나. 반환: 기록용 결과 / 화면이 닫히면 null */
async function playQuestion(ctx, screen, s, count, index, total) {
  const progress = { index, total };
  const expected = makeSequence(CARD_NUMBERS, count);
  const tries = []; // 도전마다 해냈는지
  const attempts = []; // 기록용: 도전마다 보여 준 숫자, 입력 방법, 자리까지 맞은 개수
  let reactionMs = null; // 첫 도전에서 숫자 하나 입력에 걸린 평균 시간
  let skipped = false;

  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    // 1) 로봇이 보여 주기 (다시 할 때도 같은 순서를 다시 보여 준다)
    if (!(await showSequence(ctx, screen, s, expected, progress))) return null;

    // 2) 기억해서 숫자 카드로 보여 주기
    const answer = await collectAnswer(screen, s, count, { ...progress, attempt });
    if (!answer) return null;
    if (answer.skip) {
      skipped = true;
      break;
    }
    if (attempt === 1) {
      reactionMs = Math.round(answer.reactions.reduce((a, b) => a + b, 0) / answer.reactions.length);
    }

    // 3) 판정
    const result = judgeSequence(expected, answer.given);
    tries.push(result.correct);
    attempts.push({ given: answer.given, inputVia: answer.vias, matched: result.matched });

    if (result.correct) {
      screen.good({ given: answer.given, attempt });
      await robot(ctx.robot.react('ok'));
      if (!s.alive) return null;
      await wait(restMs(ctx));
      break;
    }

    if (attempt < MAX_TRIES) {
      // 처음 해내지 못함: 준비되면 "다시 보기" → 로봇이 같은 순서를 한 번 더 보여 준다
      const again = waitClick(s, (onAgain) => screen.retry({ given: answer.given }, onAgain));
      await robot(ctx.robot.react('retry'));
      if (!(await again)) return null;
      continue;
    }

    // 두 번째도 해내지 못함: 순서를 함께 확인한다
    await robot(ctx.robot.react('retry'));
    if (!s.alive) return null;
    const next = waitClick(s, (onNext) =>
      screen.reveal({ expected, given: answer.given, isLast: index === total }, onNext),
    );
    if (!(await next)) return null;
  }

  return { count, expected, status: questionStatus(tries, skipped), reactionMs, attempts };
}

async function playRound(ctx, screen, s) {
  const startedAt = new Date().toISOString();
  const { difficulty, speed } = ctx.settings;

  // 0) 카메라가 숫자 모드가 된 다음 시작한다 (모드 전환은 최대 약 5초, 보통 바로)
  screen.preparing();
  await ctx.card.ready();
  if (!s.alive) return;

  const items = [];
  let count = sequenceLength(difficulty);
  for (let i = 1; i <= QUESTIONS_PER_ROUND; i++) {
    const item = await playQuestion(ctx, screen, s, count, i, QUESTIONS_PER_ROUND);
    if (!item) return; // 화면이 닫힘: 끝까지 하지 않은 회차는 기록하지 않는다
    items.push(item);
    count = nextLength(count, item.status, difficulty);
  }

  await robot(ctx.robot.rest());
  if (!s.alive) return;

  ctx.log.record({
    program: ID,
    startedAt,
    endedAt: new Date().toISOString(),
    ...summarizeRound(items), // total, done, skipped, avgReactionMs
    detail: {
      difficulty,
      speed,
      // 문제마다: 숫자 개수, 로봇이 보여 준 순서, 결과(first|second|shown|skipped), 첫 도전 반응 시간,
      // 도전마다 [{ given, inputVia: 'card'|'button' 입력마다, matched }]
      questions: items,
    },
  });

  screen.summary({ rows: items }, () => start(ctx, screen, s));
}

function start(ctx, screen, s) {
  playRound(ctx, screen, s).catch((err) => console.error(err));
}

export default {
  id: ID,
  title: '숫자 기억',

  mount(container, ctx) {
    // pending: 숫자 입력을 기다리는 중이면 그 입력을 끝내는 함수, click: 화면 버튼을 기다리는 중이면 그 resolve
    session = { alive: true, pending: null, click: null, offNumber: null };
    const s = session;

    // 숫자 카드 구독은 시작할 때 한 번. 구독하면 core 가 WonderCam 을 숫자 모드로 바꾸기 시작한다.
    // 입력 단계가 아닐 때(로봇이 보여주는 중 등) 들어온 카드는 버린다.
    s.offNumber = ctx.card.onNumber(({ number }) => s.pending?.({ number, via: 'card' }));

    const screen = createScreen(container);
    screen.intro({ total: QUESTIONS_PER_ROUND, count: sequenceLength(ctx.settings.difficulty) }, () =>
      start(ctx, screen, s),
    );
  },

  unmount() {
    if (!session) return;
    const s = session;
    s.alive = false;
    s.pending?.(null);
    s.click?.(false); // 버튼을 기다리던 흐름도 끝낸다
    s.offNumber?.();
    session = null;
  },
};
