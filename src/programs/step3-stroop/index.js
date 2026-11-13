// STEP 3 색깔손: logic 과 screen 을 연결한다. core 는 import 하지 않고 ctx 만 쓴다.

import colors from '../../data/colors.json';
import { makeRound, judge, gapMs, summarizeRound, isPerfect, NO_ANSWER_HINT_MS } from './logic.js';
import { createScreen } from './screen.js';
import { stopSpeaking } from './voice.js';

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
    // 오래 답이 없으면 안내: 카드를 들고 있으면 다시 인식하지 않으므로 내렸다가 다시 보여 달라고 한다 (#14)
    const hintTimer = setTimeout(
      () => screen.hint('카드를 내렸다가 다시 보여 주세요. 아래 버튼을 눌러도 돼요.'),
      NO_ANSWER_HINT_MS,
    );
    const finish = (picked) => {
      if (finished) return;
      finished = true;
      clearTimeout(hintTimer);
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

  // 카메라를 태그 모드로 맞춘 다음 시작한다. STEP 1 다음이면 숫자 모드라 바꾸는 데 최대 약 5초 걸리고,
  // 그동안 보여 준 카드는 읽히지 않는다. 구독하면 core 가 태그 모드로 바꾸고, 해제해도 모드는 그대로다
  screen.waiting('카메라를 준비하고 있어요. 잠시만 기다려 주세요.');
  const offWarmup = ctx.card.onCard(() => {});
  await ctx.card.ready();
  offWarmup();
  if (!s.alive) return;

  // 로봇 역할: 회차 시작 신호로 인사한다
  await ctx.robot.hello();
  if (!s.alive) return;

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
    startedAt,
    endedAt: new Date().toISOString(),
    ...summary,
    skipped: 0,
    detail: {
      difficulty,
      questions: answers.map(({ correct, ...rest }) => rest),
    },
  });
  // 로봇 역할: 모두 맞히면 한 번 더 인사한다
  if (isPerfect(summary)) {
    await ctx.robot.hello();
    if (!s.alive) return;
  }
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
    stopSpeaking();
    session.cancels.forEach((cancel) => cancel());
    session = null;
  },
};
