// STEP 2 동시에 가위바위보 진행 ("하나만 해 보기"로 들어왔을 때만 고를 수 있다).
// core 는 import 하지 않고 ctx 만 쓴다. 판정은 logic.js, 화면은 screen.js.
//
// 한 판의 흐름:
//   "가위" → "바위" → "보!"(글자 + 음성). "보!" 순간 로봇이 손을 낸다 (사용자도 같이 낸다)
//   → 손 인식(waitForPose) 또는 화면 버튼 중 먼저 들어온 손
//   → 손을 만든 시각이 "보!"에 맞았는지(timingOf) + 승패(outcome) → 결과 화면 → 다음 판
// 손 입력은 "가위"부터 받기 시작한다. 너무 먼저 낸 손은 waitForPose 의 since 규칙으로 걸러진다.

import { HANDS, QUICK_GAMES, EARLY_MS, quickTiming, makeQuickRound, quickResult, quickMessage, summarizeQuick } from './logic.js';
import { speak } from './voice.js';

const ID = 'step2-rps';

const isSlow = (ctx) => ctx.settings.speed === 'SLOW';
/** "가위" "바위" "보!" 사이 간격 (사고력 모드와 같다) */
const beatMs = (ctx) => (isSlow(ctx) ? 1100 : 750);
/** 결과를 보여 주고 다음 판으로 넘어가기 전 시간 */
const resultMs = (ctx) => (isSlow(ctx) ? 3500 : 2500);

const wait = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

/** 로봇 명령이 실패해도 활동은 이어 간다 */
async function robot(promise) {
  try {
    await promise;
  } catch (err) {
    console.error('STEP 2 로봇 명령 오류', err);
  }
}

/**
 * 한 판. 반환: 기록용 결과 { robotHand, hand, via, timing, timingMs, outcome } / 화면이 닫히면 null
 * s: index.js 의 실행 상태 (alive, waits, timers, answer)
 */
async function playGame(ctx, screen, s, robotHand, index, total) {
  const { holdMs, lateMs } = quickTiming(ctx.settings.difficulty, ctx.settings.speed);
  const beat = beatMs(ctx);
  const startAt = Date.now();
  // "보!" 예정 시각보다 EARLY_MS 전부터 만든 손만 인정 (그 전부터 들고 있던 손은 너무 먼저 낸 것)
  const since = startAt + 2 * beat - EARLY_MS;

  // 1) 입력 받기 시작: 손 인식과 화면 버튼 중 먼저 들어온 것
  const stop = new AbortController();
  s.waits.add(stop);
  let lastPose = null; // 판이 끝났을 때 확정이 안 됐으면 이유(너무 먼저/늦게/알아보지 못함/안 보임)를 알려 주는 데 쓴다
  let sawHand = false; // 손 입력을 받기 시작한(since) 뒤 손이 한 번이라도 보였는지
  const offPose = ctx.hand.onPose((pose) => {
    lastPose = pose;
    if (pose?.code && Date.now() >= since) sawHand = true;
  });
  stop.signal.addEventListener('abort', offPose);
  const fromHand = ctx.hand
    .waitForPose({ holdMs, since, names: HANDS, signal: stop.signal })
    .then((pose) => pose && { hand: pose.name, via: 'hand', formedAt: Date.now() - pose.stableMs });
  const fromButton = new Promise((resolve) => {
    s.answer = resolve; // 화면 버튼은 누른 순간을 손을 만든 시각으로 본다. 화면이 닫히면 null
  });
  const first = Promise.race([fromHand, fromButton]);

  screen.quickPlay({ index, total, holdSec: holdMs / 1000 }, (hand) =>
    s.answer?.({ hand, via: 'button', formedAt: Date.now() }),
  );

  // 2) "가위" → "바위" → "보!". 먼저 손을 내도 구호는 끝까지 하고 로봇도 낸다 (진짜 가위바위보처럼)
  const words = ['가위', '바위', '보!'];
  for (let i = 0; i < words.length; i++) {
    if (!s.alive) return null;
    screen.quickWord(words[i]);
    speak(words[i]);
    if (i < words.length - 1) await wait(startAt + (i + 1) * beat - Date.now());
  }
  if (!s.alive) return null;
  const goAt = Date.now();
  const robotDone = robot(ctx.robot.showPose(robotHand)); // 기다리지 않는다: 사용자와 동시에

  // 3) "보!" 뒤 lateMs 안에 만든 손이 확정될 시간까지 기다린다
  const deadline = new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), lateMs + holdMs + 300);
    s.timers.add(t);
  });
  const input = await Promise.race([first, deadline]);
  stop.abort();
  s.waits.delete(stop);
  s.answer = null;
  if (!s.alive) return null;

  // 4) 판정과 결과
  const result = quickResult({ robotHand, input, goAt, lateMs, lastPose, sawHand, now: Date.now() });
  const msg = quickMessage(result);
  screen.quickResult({ robotHand, userHand: input?.hand ?? null, msg, timingMs: result.timing === 'ontime' ? result.timingMs : null });
  speak(msg.text);
  await robotDone;
  if (!s.alive) return null;
  if (result.outcome === 'win') await robot(ctx.robot.react('ok')); // 이기면 로봇이 칭찬
  if (!s.alive) return null;
  await wait(resultMs(ctx));
  if (!s.alive) return null;
  await robot(ctx.robot.rest()); // 다음 판 전에 손을 내려 둔다
  if (!s.alive) return null;

  return { robotHand, hand: input?.hand ?? null, via: input?.via ?? null, ...result };
}

/** 동시에 가위바위보 한 회차 (QUICK_GAMES 판). 끝까지 하면 기록하고 요약 화면 */
export async function playQuickRound(ctx, screen, s) {
  const startedAt = new Date().toISOString();
  const { difficulty, speed } = ctx.settings;
  const hands = makeQuickRound(QUICK_GAMES);
  const games = [];

  for (let i = 0; i < hands.length; i++) {
    const game = await playGame(ctx, screen, s, hands[i], i + 1, hands.length);
    if (!game) return; // 화면이 닫힘: 끝까지 하지 않은 회차는 기록하지 않는다
    games.push(game);
  }

  const { wins, draws, losses, ...common } = summarizeQuick(games);
  ctx.log.record({
    program: ID,
    startedAt,
    endedAt: new Date().toISOString(),
    ...common, // total, done(제때 낸 판), skipped(손이 안 보인 판), avgReactionMs("보!"부터 손을 만들 때까지)
    detail: {
      mode: 'quick',
      difficulty,
      speed,
      lateMs: quickTiming(difficulty, speed).lateMs,
      wins,
      draws,
      losses,
      // 판마다: 로봇 손, 낸 손, 입력 방법, 때(ontime|early|late|none), "보!" 기준 ms, 승패
      games: games.map(({ robotHand, hand, via, timing, timingMs, outcome }) => ({ robotHand, hand, via, timing, timingMs, outcome })),
    },
  });

  speak(`${games.length}판을 모두 함께 해 주셨어요. 수고하셨어요!`);
  screen.quickSummary({ games, sum: { wins, draws, losses, ...common } }, () =>
    playQuickRound(ctx, screen, s).catch((err) => console.error(err)),
  );
}
