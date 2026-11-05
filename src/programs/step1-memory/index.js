// STEP 1 기억손: logic 과 screen 을 연결한다. core 는 import 하지 않고 ctx 만 쓴다.

import poses from '../../data/poses.json';
import { sequenceLength, makeSequence, judgeSequence, shouldAcceptPose } from './logic.js';
import { createScreen } from './screen.js';

const ID = 'step1-memory';

let session = null;

function confirmMs(ctx) {
  return ctx.settings.speed === 'SLOW' ? 1500 : 1000;
}

/** 손모양 하나를 보여준 뒤 기억할 시간 */
function showGapMs(ctx) {
  return ctx.settings.speed === 'SLOW' ? 1500 : 800;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function playRound(ctx, screen, s) {
  const startedAt = new Date().toISOString();
  const count = sequenceLength(ctx.settings.difficulty);
  const expected = makeSequence(
    poses.map((p) => p.name),
    count,
  );

  // 1) 로봇이 차례로 보여주기
  for (let i = 0; i < expected.length; i++) {
    screen.watching(i + 1, count);
    await ctx.robot.showPose(expected[i]);
    await wait(showGapMs(ctx));
    if (!s.alive) return;
  }
  // 2) 로봇 손 내리기 → 기억해서 재현
  await ctx.robot.rest();
  if (!s.alive) return;

  const given = [];
  const reactions = [];
  let sinceMs = Date.now();
  let finished = false;

  const pick = async (name, via) => {
    if (finished || !s.alive) return;
    const now = Date.now();
    reactions.push(now - sinceMs);
    sinceMs = now; // 다음 입력은 지금 이후에 만든 손모양만 인정
    given.push(name);

    if (given.length < count) {
      screen.recall({ count, given }, (n) => pick(n, 'button'));
      return;
    }

    finished = true;
    offPose();
    const result = judgeSequence(expected, given);
    screen.feedback({ correct: result.correct, expected, given });
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
      avgReactionMs: Math.round(reactions.reduce((a, b) => a + b, 0) / reactions.length),
      detail: {
        difficulty: ctx.settings.difficulty,
        expected,
        given,
        matched: result.matched,
        lastInputVia: via,
      },
    });
    screen.end(() => playRound(ctx, screen, s).catch((err) => console.error(err)));
  };

  const offPose = ctx.hand.onPose((pose) => {
    if (shouldAcceptPose(pose, { now: Date.now(), sinceMs, minStableMs: confirmMs(ctx) })) {
      pick(pose.name, 'hand');
    }
  });
  s.offs.push(offPose);

  screen.recall({ count, given }, (n) => pick(n, 'button'));
}

export default {
  id: ID,
  title: '기억손',

  mount(container, ctx) {
    session = { alive: true, offs: [] };
    const s = session;
    const screen = createScreen(container, poses);
    screen.intro(sequenceLength(ctx.settings.difficulty), () =>
      playRound(ctx, screen, s).catch((err) => console.error(err)),
    );
  },

  unmount() {
    if (!session) return;
    session.alive = false;
    session.offs.forEach((off) => off());
    session = null;
  },
};
