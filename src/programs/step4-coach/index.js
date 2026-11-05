// STEP 4 손운동 코칭: logic 과 screen 을 연결한다. core 는 import 하지 않고 ctx 만 쓴다.

import poses from '../../data/poses.json';
import routines from '../../data/routines.json';
import { expandRoutine, holdProgress, summarizeSteps } from './logic.js';
import { createScreen } from './screen.js';

const ID = 'step4-coach';

let session = null;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 동작 하나: 손 인식 확인('detected'), "따라 했어요"('manual'), 건너뛰기('skipped') 중 먼저 온 것.
 * 화면이 닫히면 null.
 */
async function runStep(ctx, screen, s, info) {
  const { step } = info;
  const holdMs = step.holdMs ?? 1000;
  const since = Date.now();
  const stop = new AbortController();
  s.waits.add(stop);

  // 유지 게이지: onPose 의 stableMs 로 계속 보여준다.
  // 동작 시작 전부터 들고 있던 손은 확정되지 않으므로 게이지도 0 으로 둔다.
  const offGauge = ctx.hand.onPose((pose) => {
    const fresh = Date.now() - pose.stableMs >= since;
    screen.gauge(fresh ? holdProgress(pose, step) : 0, pose.stableMs, holdMs);
  });

  const method = await Promise.race([
    ctx.hand
      .waitForPose({ holdMs, since, names: [step.pose], signal: stop.signal })
      .then((pose) => (pose ? 'detected' : null)),
    new Promise((resolve) => {
      screen.step(info, {
        onDone: () => resolve('manual'),
        onSkip: () => resolve('skipped'),
      });
    }),
  ]);
  offGauge();
  stop.abort();
  s.waits.delete(stop);
  if (!s.alive || !method) return null;
  return { method, reactionMs: method === 'skipped' ? null : Date.now() - since };
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
    if (!result) return;
    results.push(result);
    if (result.method !== 'skipped') {
      screen.stepDone(result.method);
      await wait(ctx.settings.speed === 'SLOW' ? 1000 : 500);
      if (!s.alive) return;
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
      // 완료 방식별 개수 { detected, manual, skipped } — 결과 화면에 표시된다
      methods: summary.methods,
      // 동작마다 { pose, method, reactionMs }
      steps: steps.map((st, i) => ({
        pose: st.pose,
        method: results[i].method,
        reactionMs: results[i].reactionMs,
      })),
    },
  });
  screen.end(() => playRound(ctx, screen, s, routine).catch((err) => console.error(err)));
}

export default {
  id: ID,
  title: '손운동 코칭',

  mount(container, ctx) {
    // waits: 기다리는 중인 손 입력들. unmount 할 때 모두 멈춘다
    session = { alive: true, waits: new Set() };
    const s = session;
    const routine = routines[0]; // TODO: 루틴이 여러 개가 되면 고르는 화면 추가
    const screen = createScreen(container, poses);
    screen.intro(routine, () => playRound(ctx, screen, s, routine).catch((err) => console.error(err)));
  },

  unmount() {
    if (!session) return;
    session.alive = false;
    session.waits.forEach((w) => w.abort());
    session = null;
  },
};
