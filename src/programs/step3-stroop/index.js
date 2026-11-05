// STEP 3 색깔손: logic 과 screen 을 연결한다. core 는 import 하지 않고 ctx 만 쓴다.

import colors from '../../data/colors.json';
import { makeQuestion, judge } from './logic.js';
import { createScreen } from './screen.js';

const ID = 'step3-stroop';

let session = null;

async function playRound(ctx, screen, s) {
  const startedAt = new Date().toISOString();
  const q = makeQuestion(colors, ctx.settings.difficulty);

  const shownAt = Date.now();
  let answered = false;

  const answer = async (color, via) => {
    if (answered || !s.alive) return;
    answered = true;
    offCard();

    const reactionMs = Date.now() - shownAt;
    const result = judge(q, color);
    screen.feedback({ correct: result.correct, inkColor: q.inkColor });

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
        word: q.wordColor,
        ink: q.inkColor,
        congruent: q.congruent,
        picked: color,
        pickedWord: result.pickedWord,
        inputVia: via, // 'card' 색 카드 | 'button' 화면 버튼
      },
    });
    screen.end(() => playRound(ctx, screen, s).catch((err) => console.error(err)));
  };

  // 색 카드 입력: ctx.card.onCard 는 { color } 만 준다 (Mock: 키보드 R/B/Y/G 또는 Mock 패널 버튼)
  const offCard = ctx.card.onCard((e) => answer(e.color, 'card'));
  s.offs.push(offCard);

  // 화면 버튼 입력 (대체 입력)
  screen.question(q, (color) => answer(color, 'button'));
}

export default {
  id: ID,
  title: '색깔손',

  mount(container, ctx) {
    session = { alive: true, offs: [] };
    const s = session;
    const screen = createScreen(container, colors);
    screen.intro(() => playRound(ctx, screen, s).catch((err) => console.error(err)));
  },

  unmount() {
    if (!session) return;
    session.alive = false;
    session.offs.forEach((off) => off());
    session = null;
  },
};
