// STEP 2 사고력 가위바위보: logic 과 screen 을 연결한다. core 는 import 하지 않고 ctx 만 쓴다.

import { HANDS, makeQuestion, judge, findCondition } from './logic.js';
import { createScreen } from './screen.js';

const ID = 'step2-rps';

let session = null; // 지금 화면의 실행 상태. unmount 하면 alive = false

function holdMs(ctx) {
  return ctx.settings.speed === 'SLOW' ? 1500 : 1000;
}

async function playRound(ctx, screen, s) {
  const startedAt = new Date().toISOString();
  const q = makeQuestion(ctx.settings.difficulty);
  const condition = findCondition(q.conditionId);

  screen.waiting('로봇이 손을 내고 있어요. 잘 봐 주세요.');
  await ctx.robot.showPose(q.robotHand);
  if (!s.alive) return;

  const shownAt = Date.now();

  // 손 인식(waitForPose)과 화면 버튼 중 먼저 들어온 것을 답으로 쓴다.
  // 버튼이 먼저면 기다리던 손 입력은 stop.abort() 로 멈춘다.
  const stop = new AbortController();
  s.waits.add(stop);
  const picked = await Promise.race([
    ctx.hand
      .waitForPose({ holdMs: holdMs(ctx), since: shownAt, names: HANDS, signal: stop.signal })
      .then((pose) => pose && { hand: pose.name, via: 'hand' }),
    new Promise((resolve) => {
      screen.question({ robotHand: q.robotHand, conditionText: condition.text }, (hand) =>
        resolve({ hand, via: 'button' }),
      );
    }),
  ]);
  stop.abort();
  s.waits.delete(stop);
  if (!s.alive || !picked) return;

  const reactionMs = Date.now() - shownAt;
  const result = judge(q.conditionId, q.robotHand, picked.hand);
  screen.feedback({
    correct: result.correct,
    userHand: picked.hand,
    answer: result.answer,
    robotHand: q.robotHand,
    conditionText: condition.text,
  });

  await ctx.robot.react(result.correct ? 'ok' : 'retry');
  if (!s.alive) return;

  ctx.log.record({
    program: ID,
    user: ctx.settings.user,
    startedAt,
    endedAt: new Date().toISOString(),
    total: 1,
    done: result.correct ? 1 : 0,
    skipped: 0,
    avgReactionMs: reactionMs,
    detail: {
      difficulty: ctx.settings.difficulty,
      robotHand: q.robotHand,
      condition: q.conditionId,
      userHand: picked.hand,
      outcome: result.outcome,
      inputVia: picked.via, // 'hand' 손 인식 | 'button' 화면 버튼
    },
  });
  screen.end(() => playRound(ctx, screen, s).catch((err) => console.error(err)));
}

export default {
  id: ID,
  title: '사고력 가위바위보',

  mount(container, ctx) {
    // waits: 기다리는 중인 손 입력들. unmount 할 때 모두 멈춘다
    session = { alive: true, waits: new Set() };
    const s = session;
    const screen = createScreen(container);
    screen.intro(() => playRound(ctx, screen, s).catch((err) => console.error(err)));
  },

  unmount() {
    if (!session) return;
    session.alive = false;
    session.waits.forEach((w) => w.abort());
    session = null;
  },
};
