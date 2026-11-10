// STEP 1 기억손 (숫자 순서 기억): logic 과 screen 을 연결한다. core 는 import 하지 않고 ctx 만 쓴다.
//
// 흐름: 숫자 카드 구독 → 카메라가 숫자 모드가 될 때까지 기다림(ctx.card.ready)
//       → 로봇이 숫자를 손가락으로 차례로 보여줌 → REST
//       → 사용자가 숫자 카드를 같은 순서로 하나씩 보여줌 (화면 숫자 버튼도 됨) → 판정 → REACT → 기록

import { CARD_NUMBERS, poseForNumber, sequenceLength, makeSequence, judgeSequence } from './logic.js';
import { createScreen } from './screen.js';

const ID = 'step1-memory';

let session = null;

/** 숫자 하나를 보여준 뒤 기억할 시간 */
function showGapMs(ctx) {
  return ctx.settings.speed === 'SLOW' ? 1500 : 800;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 입력 하나 받기: 숫자 카드(ctx.card.onNumber)와 화면 숫자 버튼 중 먼저 들어온 것.
 * 반환: { number, via } / "처음부터 다시"면 { restart: true } / 화면이 닫히면 null
 * 카드 하나 = 입력 하나. 펌웨어는 보이는 숫자가 바뀔 때만 알리므로, 들고 있는 카드는 다시 들어오지 않는다.
 */
function pickOne(screen, s, { count, given }) {
  return new Promise((resolve) => {
    const finish = (picked) => {
      if (s.pending !== finish) return; // 이미 끝남
      s.pending = null;
      resolve(s.alive ? picked : null);
    };
    s.pending = finish; // 숫자 카드가 들어오면 mount 의 구독이 이 함수를 부른다
    screen.recall(
      { count, given },
      (number) => finish({ number, via: 'button' }),
      () => finish({ restart: true }),
    );
  });
}

async function playRound(ctx, screen, s) {
  const startedAt = new Date().toISOString();
  const count = sequenceLength(ctx.settings.difficulty);

  // 0) 카메라가 숫자 모드가 된 다음 시작한다 (모드 전환은 최대 약 5초, 보통 바로)
  screen.preparing();
  await ctx.card.ready();
  if (!s.alive) return;

  const expected = makeSequence(CARD_NUMBERS, count);

  // 1) 로봇이 숫자를 손가락으로 차례로 보여주기
  for (let i = 0; i < expected.length; i++) {
    screen.watching(i + 1, count);
    await ctx.robot.showPose(poseForNumber(expected[i]));
    await wait(showGapMs(ctx));
    if (!s.alive) return;
  }
  // 2) 로봇 손 내리기 → 기억해서 숫자 카드로 재현
  await ctx.robot.rest();
  if (!s.alive) return;

  let given = [];
  let vias = [];
  let reactions = [];
  let since = Date.now();

  while (given.length < count) {
    const picked = await pickOne(screen, s, { count, given });
    if (!picked) return;
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

  const result = judgeSequence(expected, given);
  screen.feedback({ correct: result.correct, expected, given });
  await ctx.robot.react(result.correct ? 'ok' : 'retry');
  if (!s.alive) return;

  ctx.log.record({
    program: ID,
    startedAt,
    endedAt: new Date().toISOString(),
    total: 1,
    done: result.correct ? 1 : 0,
    skipped: 0,
    avgReactionMs: Math.round(reactions.reduce((a, b) => a + b, 0) / reactions.length),
    detail: {
      difficulty: ctx.settings.difficulty,
      expected,
      given,
      matched: result.matched,
      inputVia: vias, // 입력마다 'card' 숫자 카드 | 'button' 화면 버튼
    },
  });
  screen.end(() => playRound(ctx, screen, s).catch((err) => console.error(err)));
}

export default {
  id: ID,
  title: '기억손',

  mount(container, ctx) {
    // pending: 지금 입력을 기다리는 중이면 그 입력을 끝내는 함수
    session = { alive: true, pending: null, offNumber: null };
    const s = session;

    // 숫자 카드 구독은 시작할 때 한 번. 구독하면 core 가 WonderCam 을 숫자 모드로 바꾸기 시작한다.
    // 입력 단계가 아닐 때(로봇이 보여주는 중 등) 들어온 카드는 버린다.
    s.offNumber = ctx.card.onNumber(({ number }) => s.pending?.({ number, via: 'card' }));

    const screen = createScreen(container);
    screen.intro(sequenceLength(ctx.settings.difficulty), () =>
      playRound(ctx, screen, s).catch((err) => console.error(err)),
    );
  },

  unmount() {
    if (!session) return;
    const s = session;
    s.alive = false;
    s.pending?.(null);
    s.offNumber?.();
    session = null;
  },
};
