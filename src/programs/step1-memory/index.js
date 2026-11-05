// STEP 1 기억손: logic 과 screen 을 연결한다. core 는 import 하지 않고 ctx 만 쓴다.

import poses from '../../data/poses.json';
import { sequenceLength, makeSequence, judgeSequence } from './logic.js';
import { createScreen } from './screen.js';

const ID = 'step1-memory';

let session = null;

function holdMs(ctx) {
  return ctx.settings.speed === 'SLOW' ? 1500 : 1000;
}

/** 손모양 하나를 보여준 뒤 기억할 시간 */
function showGapMs(ctx) {
  return ctx.settings.speed === 'SLOW' ? 1500 : 800;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 손모양 하나 입력받기: 손 인식(waitForPose)과 화면 버튼 중 먼저 들어온 것.
 * since 이후에 만든 손모양만 인정한다. 화면이 닫히면 null.
 */
async function pickOne(ctx, screen, s, { count, given, since }) {
  const stop = new AbortController();
  s.waits.add(stop);
  const picked = await Promise.race([
    ctx.hand
      .waitForPose({ holdMs: holdMs(ctx), since, signal: stop.signal })
      .then((pose) => pose && { name: pose.name, via: 'hand' }),
    new Promise((resolve) => {
      screen.recall({ count, given }, (name) => resolve({ name, via: 'button' }));
    }),
  ]);
  stop.abort();
  s.waits.delete(stop);
  return s.alive ? picked : null;
}

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
  const vias = [];
  const reactions = [];
  let since = Date.now();

  while (given.length < count) {
    const picked = await pickOne(ctx, screen, s, { count, given, since });
    if (!picked) return;
    const now = Date.now();
    reactions.push(now - since);
    since = now; // 다음 입력은 지금 이후에 만든 손모양만 인정
    given.push(picked.name);
    vias.push(picked.via);
  }

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
      inputVia: vias, // 입력마다 'hand' 손 인식 | 'button' 화면 버튼
    },
  });
  screen.end(() => playRound(ctx, screen, s).catch((err) => console.error(err)));
}

export default {
  id: ID,
  title: '기억손',

  mount(container, ctx) {
    // waits: 기다리는 중인 손 입력들. unmount 할 때 모두 멈춘다
    session = { alive: true, waits: new Set() };
    const s = session;
    const screen = createScreen(container, poses);
    screen.intro(sequenceLength(ctx.settings.difficulty), () =>
      playRound(ctx, screen, s).catch((err) => console.error(err)),
    );
  },

  unmount() {
    if (!session) return;
    session.alive = false;
    session.waits.forEach((w) => w.abort());
    session = null;
  },
};
