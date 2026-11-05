// STEP 2 사고력 가위바위보: logic 과 screen 을 연결한다. core 는 import 하지 않고 ctx 만 쓴다.

import { makeQuestion, judge, findCondition, shouldAcceptPose } from './logic.js';
import { createScreen } from './screen.js';

const ID = 'step2-rps';

let session = null; // 지금 화면의 실행 상태. unmount 하면 alive = false

function confirmMs(ctx) {
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
  let answered = false;

  const answer = async (userHand, via) => {
    if (answered || !s.alive) return;
    answered = true;
    offPose();

    const reactionMs = Date.now() - shownAt;
    const result = judge(q.conditionId, q.robotHand, userHand);
    screen.feedback({
      correct: result.correct,
      userHand,
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
        userHand,
        outcome: result.outcome,
        inputVia: via, // 'hand' 손 인식 | 'button' 화면 버튼
      },
    });
    screen.end(() => playRound(ctx, screen, s).catch((err) => console.error(err)));
  };

  // 손 인식 입력
  const offPose = ctx.hand.onPose((pose) => {
    if (shouldAcceptPose(pose, { now: Date.now(), sinceMs: shownAt, minStableMs: confirmMs(ctx) })) {
      answer(pose.name, 'hand');
    }
  });
  s.offs.push(offPose);

  // 화면 버튼 입력 (대체 입력)
  screen.question({ robotHand: q.robotHand, conditionText: condition.text }, (hand) => answer(hand, 'button'));
}

export default {
  id: ID,
  title: '사고력 가위바위보',

  mount(container, ctx) {
    session = { alive: true, offs: [] };
    const s = session;
    const screen = createScreen(container);
    screen.intro(() => playRound(ctx, screen, s).catch((err) => console.error(err)));
  },

  unmount() {
    if (!session) return;
    session.alive = false;
    session.offs.forEach((off) => off());
    session = null;
  },
};
