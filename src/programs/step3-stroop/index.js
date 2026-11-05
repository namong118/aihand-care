// STEP 3 색깔손: logic 과 screen 을 연결한다. core 는 import 하지 않고 ctx 만 쓴다.

import colors from '../../data/colors.json';
import { makeRound, judge, gapMs, summarizeRound } from './logic.js';
import { createScreen } from './screen.js';

const ID = 'step3-stroop';

let session = null; // 지금 화면의 실행 상태. unmount 하면 alive = false

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 문제 하나의 답 받기: 색 카드와 화면 버튼 중 먼저 들어온 것.
 * 반환: { color, via } 또는 화면이 닫히면 null
 * TODO [검증 필요] 카드를 잠깐 스치듯 보여줬을 때도 답으로 칠지는 실물 카드 인식 확인 후 정한다 (#5)
 */
function pickOne(ctx, screen, s, q, progress) {
  return new Promise((resolve) => {
    let finished = false;
    const finish = (picked) => {
      if (finished) return;
      finished = true;
      offCard();
      s.cancels.delete(cancel);
      resolve(picked);
    };
    const cancel = () => finish(null);
    s.cancels.add(cancel);

    // 색 카드 입력: ctx.card.onCard 는 { color } 만 준다 (Mock: 키보드 R/B/Y/G 또는 Mock 패널 버튼)
    const offCard = ctx.card.onCard((e) => finish({ color: e.color, via: 'card' }));
    // 화면 버튼 입력 (대체 입력)
    screen.question(q, progress, (color) => finish({ color, via: 'button' }));
  });
}

async function playRound(ctx, screen, s) {
  const startedAt = new Date().toISOString();
  const difficulty = ctx.settings.difficulty;
  const questions = makeRound(colors, difficulty);
  const answers = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const shownAt = Date.now();
    const picked = await pickOne(ctx, screen, s, q, { index: i + 1, count: questions.length });
    if (!picked || !s.alive) return;

    const reactionMs = Date.now() - shownAt;
    const result = judge(q, picked.color);
    answers.push({
      correct: result.correct,
      reactionMs,
      word: q.wordColor,
      ink: q.inkColor,
      congruent: q.congruent,
      picked: picked.color,
      pickedWord: result.pickedWord,
      inputVia: picked.via, // 'card' 색 카드 | 'button' 화면 버튼
    });

    screen.feedback({ correct: result.correct, inkColor: q.inkColor });
    await ctx.robot.react(result.correct ? 'ok' : 'retry');
    if (!s.alive) return;

    // 다음 문제 전 쉬는 시간 (마지막 문제 뒤에는 바로 결과)
    if (i < questions.length - 1) {
      await wait(gapMs(ctx.settings.speed));
      if (!s.alive) return;
    }
  }

  const summary = summarizeRound(answers);
  ctx.log.record({
    program: ID,
    user: ctx.settings.user,
    startedAt,
    endedAt: new Date().toISOString(),
    ...summary,
    skipped: 0,
    detail: {
      difficulty,
      questions: answers.map(({ correct, ...rest }) => rest),
    },
  });
  screen.end(summary, () => playRound(ctx, screen, s).catch((err) => console.error(err)));
}

export default {
  id: ID,
  title: '색깔손',

  mount(container, ctx) {
    // cancels: 기다리는 중인 답 입력들. unmount 할 때 모두 멈춘다
    session = { alive: true, cancels: new Set() };
    const s = session;
    const screen = createScreen(container, colors);
    screen.intro(() => playRound(ctx, screen, s).catch((err) => console.error(err)));
  },

  unmount() {
    if (!session) return;
    session.alive = false;
    session.cancels.forEach((cancel) => cancel());
    session = null;
  },
};
