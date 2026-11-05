// STEP 4 손운동 코칭: logic 과 screen 을 연결한다. core 는 import 하지 않고 ctx 만 쓴다.

import poses from '../../data/poses.json';
import routines from '../../data/routines.json';
import { expandRoutine, isStepDone, summarizeSteps } from './logic.js';
import { createScreen } from './screen.js';

const ID = 'step4-coach';

let session = null;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** 동작 하나: 로봇 시범 → 사용자가 따라 하면(손 인식 또는 버튼) 'done', 건너뛰면 'skipped' */
function runStep(ctx, screen, s, info) {
  return new Promise((resolve) => {
    const sinceMs = Date.now();
    let settled = false;

    const finish = (status) => {
      if (settled) return;
      settled = true;
      offPose();
      resolve({ status, reactionMs: status === 'done' ? Date.now() - sinceMs : null });
    };

    const offPose = ctx.hand.onPose((pose) => {
      if (isStepDone(pose, info.step, { now: Date.now(), sinceMs })) finish('done');
    });
    s.offs.push(offPose);
    s.cancelStep = () => finish('skipped');

    screen.step(info, {
      onDone: () => finish('done'),
      onSkip: () => finish('skipped'),
    });
  });
}

async function playRound(ctx, screen, s, routine) {
  const startedAt = new Date().toISOString();
  const steps = expandRoutine(routine);
  const results = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    screen.waiting('로봇 시범을 봐 주세요.');
    // 보면서 반복: 로봇은 시범 손모양을 든 채로 있고, 사용자가 동시에 따라 한다
    await ctx.robot.showPose(step.pose);
    if (!s.alive) return;

    const result = await runStep(ctx, screen, s, { index: i + 1, count: steps.length, step });
    if (!s.alive) return;
    results.push(result);
    if (result.status === 'done') {
      screen.stepDone();
      await wait(ctx.settings.speed === 'SLOW' ? 1000 : 500);
    }
  }

  const summary = summarizeSteps(results);
  screen.finish(summary);
  // 코칭은 맞고 틀림이 없으므로 끝나면 항상 칭찬 반응
  await ctx.robot.react('ok');
  await ctx.robot.rest();
  if (!s.alive) return;

  ctx.log.record({
    program: ID,
    user: ctx.settings.user,
    startedAt,
    endedAt: new Date().toISOString(),
    total: summary.total,
    done: summary.done,
    skipped: summary.skipped,
    avgReactionMs: summary.avgReactionMs,
    detail: {
      routine: routine.id,
      steps: steps.map((st, i) => ({ pose: st.pose, status: results[i].status })),
    },
  });
  screen.end(() => playRound(ctx, screen, s, routine).catch((err) => console.error(err)));
}

export default {
  id: ID,
  title: '손운동 코칭',

  mount(container, ctx) {
    session = { alive: true, offs: [], cancelStep: null };
    const s = session;
    const routine = routines[0]; // TODO: 루틴이 여러 개가 되면 고르는 화면 추가
    const screen = createScreen(container, poses);
    screen.intro(routine, () => playRound(ctx, screen, s, routine).catch((err) => console.error(err)));
  },

  unmount() {
    if (!session) return;
    session.alive = false;
    session.offs.forEach((off) => off());
    session.cancelStep?.(); // 기다리던 동작을 끝내서 진행 루프가 멈추게 한다
    session = null;
  },
};
