// 도전 활동 "카드 섞기" (#132): logic 과 screen 을 연결한다. core 는 import 하지 않고 ctx 만 쓴다.
// 색깔손(STEP 3)과 같은 색깔 카드로 답하지만, step3-stroop 코드는 import 하지 않는다.

import colors from '../../data/colors.json';
import {
  ROUNDS, NO_ANSWER_HINT_MS, levelSpec, defaultLevel, showMs, gapMs,
  makeStart, makeSwaps, applySwaps, pickAsks, positionPose, judgeShuffle, summarizeRound,
} from './logic.js';
import { createScreen } from './screen.js';

const ID = 'challenge-shuffle';

let session = null; // 지금 화면의 실행 상태. unmount 하면 alive = false

/** ms 동안 기다리기. 화면을 닫으면 타이머를 지운다 */
function wait(s, ms) {
  return new Promise((resolve) => {
    const t = setTimeout(() => {
      s.timers.delete(t);
      resolve();
    }, ms);
    s.timers.add(t);
  });
}

/**
 * 답 하나 받기: 색 카드와 화면 버튼 중 먼저 들어온 것. 반환: { color, via } 또는 화면이 닫히면 null
 * 답을 물을 때만 onCard 를 구독하므로, 카드 섞는 동안 보여 준 카드는 버려진다.
 * TODO [검증 필요] 카드를 잠깐 스치듯 보여줬을 때도 답으로 칠지는 실물 카드 인식 확인 후 정한다 (#17)
 */
function pickOne(ctx, screen, s, position) {
  return new Promise((resolve) => {
    let finished = false;
    // 오래 답이 없으면 안내: 카드를 들고 있으면 다시 인식하지 않으므로 내렸다가 다시 보여 달라고 한다 (#14)
    const hintTimer = setTimeout(
      () => screen.hint('카드를 내렸다가 다시 보여 주세요. 색 버튼을 눌러도 돼요.'),
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
    screen.ask(position, (color) => finish({ color, via: 'button' }));
  });
}

/** 시작 화면 (단계 고르기). 미리 선택은 ctx.settings.challengeLevel, 없으면 1단계 */
function showIntro(ctx, screen, s) {
  screen.intro(defaultLevel(ctx.settings.challengeLevel), (level) => {
    playRound(ctx, screen, s, level).catch((err) => console.error(err));
  });
}

/** 한 회차: 앞면 보기 → 뒤집기 → 섞기 → 로봇 손가락으로 자리 묻기 → 답 → 뒤집어 보여 주기, 5판 */
async function playRound(ctx, screen, s, level) {
  const startedAt = new Date().toISOString();
  const speed = ctx.settings.speed;
  const spec = levelSpec(level, speed);
  const answers = []; // summarizeRound 용 (물은 횟수만큼)
  const rounds = [];

  // 카메라를 태그 모드로 맞춘 다음 시작한다. 숫자 모드였으면 바꾸는 데 최대 약 5초 걸리고,
  // 그동안 보여 준 카드는 읽히지 않는다. 구독하면 core 가 태그 모드로 바꾸고, 해제해도 모드는 그대로다
  screen.waiting('카메라를 준비하고 있어요. 잠시만 기다려 주세요.');
  const offWarmup = ctx.card.onCard(() => {});
  await ctx.card.ready();
  offWarmup();
  if (!s.alive) return;

  // 로봇 역할: 회차 시작 신호로 인사한다
  await ctx.robot.hello();
  if (!s.alive) return;

  for (let r = 0; r < ROUNDS; r++) {
    const start = makeStart(colors);
    const swaps = makeSwaps(spec.swaps);
    const final = applySwaps(start, swaps);
    const asks = pickAsks(spec.asks);

    screen.board(start, { index: r + 1, count: ROUNDS }, level);
    screen.say('카드를 잘 보세요.');
    await wait(s, showMs(speed));
    if (!s.alive) return;
    await screen.flipAll(false);
    if (!s.alive) return;

    screen.say('카드를 섞어요. 눈으로 잘 따라가 보세요.');
    const shown = await screen.shuffle(swaps, spec.moveMs);
    if (!s.alive) return;
    // 화면에서 움직인 결과와 계산한 배치가 같은지 맞춘다 (판정은 계산한 배치로)
    if (shown.join() !== final.join()) console.warn('[challenge-shuffle] 화면 배치와 계산한 배치가 다릅니다', shown, final);

    const roundAsks = [];
    for (let k = 0; k < asks.length; k++) {
      const position = asks[k];
      // 로봇이 손가락으로 자리를 묻는다. 손이 움직이는 동안에도 답은 받는다
      const posing = ctx.robot.showPose(positionPose(position));
      const askedAt = Date.now();
      const picked = await pickOne(ctx, screen, s, position);
      if (!picked || !s.alive) return;

      const reactionMs = Date.now() - askedAt;
      const result = judgeShuffle(final, position, picked.color);
      roundAsks.push({
        position, // 0~3 (화면에서는 1~4번 자리)
        answer: result.answer,
        picked: picked.color,
        correct: result.correct,
        inputVia: picked.via, // 'card' 색 카드 | 'button' 화면 버튼
        reactionMs,
      });
      answers.push({ correct: result.correct, reactionMs });

      // 다른 색이어도 다시 묻지 않는다 (섞인 기억은 다시 떠올릴 수 없으니)
      await screen.reveal(position, { correct: result.correct, answer: result.answer, more: k < asks.length - 1 });
      await posing;
      if (!s.alive) return;
      await ctx.robot.react(result.correct ? 'ok' : 'retry');
      if (!s.alive) return;
      await wait(s, gapMs(speed));
      if (!s.alive) return;
    }
    rounds.push({ start, swaps, final, asks: roundAsks });

    // 판 끝: 4장 모두 앞면으로 보여 주고 다음 판
    await screen.revealAll();
    if (!s.alive) return;
    if (r < ROUNDS - 1) {
      await wait(s, gapMs(speed));
      if (!s.alive) return;
    }
  }

  // 끝까지 한 회차만 기록한다
  const summary = summarizeRound(answers);
  ctx.log.record({
    program: ID,
    startedAt,
    endedAt: new Date().toISOString(),
    ...summary, // total = 물은 횟수, done = 같은 색을 고른 수
    skipped: 0,
    detail: { level, speed, rounds },
  });
  // 로봇 역할: 끝나면 쉬는 자세
  await ctx.robot.rest();
  if (!s.alive) return;
  screen.end(
    summary,
    ROUNDS,
    () => playRound(ctx, screen, s, level).catch((err) => console.error(err)),
    () => showIntro(ctx, screen, s),
  );
}

export default {
  id: ID,
  title: '카드 섞기',

  mount(container, ctx) {
    // cancels: 기다리는 중인 답 입력들, timers: 기다리는 타이머. unmount 할 때 모두 멈춘다
    const screen = createScreen(container, colors);
    session = { alive: true, cancels: new Set(), timers: new Set(), screen };
    showIntro(ctx, screen, session);
  },

  unmount() {
    if (!session) return;
    session.alive = false;
    session.cancels.forEach((cancel) => cancel());
    session.timers.forEach((t) => clearTimeout(t));
    session.screen.destroy();
    session = null;
  },
};
