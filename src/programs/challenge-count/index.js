// 도전 활동 "이어 세기" (기본 활동 가위바위보의 짝, 홈 가위바위보 카드 아래 칸). core 는 import 하지 않고 ctx 만 쓴다.
//
// 한 회차 = 한 판:
//   시작 화면에서 1·2·3단계 고르기 (미리 선택: ctx.settings.challengeLevel, 없으면 1단계)
//   → 이번 끝 숫자·한 번에 셀 수 있는 개수 안내 (판마다 무작위)
//   → 사용자가 먼저: 손가락 개수(웹캠 손 인식) 또는 화면 버튼으로 몇 개 셀지
//   → 로봇이 생각한 뒤 손가락으로 개수를 보여 주며 이어 셈
//   → 끝 숫자를 부른 쪽이 생기면 끝. 로봇이 불렀으면 칭찬
//   → ctx.log.record 로 한 번 기록

import { levelSpec, defaultLevel, makeGame, allowedCounts, countFrom, robotCount, countPose, poseCount, summarizeGame } from './logic.js';
import { createScreen } from './screen.js';

const ID = 'challenge-count';

let session = null; // 지금 화면의 실행 상태. unmount 하면 alive = false

const isSlow = (ctx) => ctx.settings.speed === 'SLOW';
/** 손가락 개수를 이 시간 유지하면 확정 */
const holdMs = (ctx) => (isSlow(ctx) ? 1500 : 1000);
/** 로봇이 생각하는 척하는 시간, 센 수를 보여 주는 시간 */
const thinkMs = (ctx) => (isSlow(ctx) ? 1500 : 1000);
const showMs = (ctx) => (isSlow(ctx) ? 2200 : 1500);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** 로봇 명령이 실패해도 활동은 이어 간다 (화면 글자가 주 흐름) */
async function robot(promise) {
  try {
    await promise;
  } catch (err) {
    console.error('이어 세기 로봇 명령 오류', err);
  }
}

/**
 * 내 차례 입력: 손가락 개수(waitForPose)와 화면 버튼·그만하기 중 먼저 들어온 것.
 * 반환: { count, via } | { stop: true } | 화면이 닫히면 null
 */
async function waitCount(ctx, screen, s, allowed) {
  const since = Date.now();
  const stop = new AbortController();
  s.waits.add(stop);
  const offPose = ctx.hand.onPose((pose) => {
    if (!s.alive) return;
    const count = poseCount(pose?.name);
    if (!pose?.code) screen.showHand({ kind: 'none' });
    else if (count) screen.showHand({ kind: 'count', count, ok: allowed.includes(count) });
    else screen.showHand({ kind: 'other' });
  });
  stop.signal.addEventListener('abort', offPose);
  const fromScreen = new Promise((resolve) => {
    s.answer = resolve; // 화면 버튼이 s.answer({ count, via: 'button' }) / s.answer({ stop: true })
  });
  // 끝 숫자를 넘는 개수의 손모양은 받지 않는다
  const fromHand = ctx.hand
    .waitForPose({ holdMs: holdMs(ctx), since, names: allowed.map(countPose), signal: stop.signal })
    .then((pose) => pose && { count: poseCount(pose.name), via: 'hand' });
  const picked = await Promise.race([fromHand, fromScreen]);
  stop.abort();
  s.waits.delete(stop);
  s.answer = null;
  if (!s.alive || !picked) return null;
  return { ...picked, reactionMs: Date.now() - since };
}

async function playGame(ctx, screen, s, level) {
  const spec = levelSpec(level);
  const { end, maxStep } = makeGame(level);
  const base = { level, end, maxStep };

  // 0) 이번 판 안내 → 시작하기
  const go = await new Promise((resolve) => {
    s.answer = resolve;
    screen.intro(base, () => resolve(true));
  });
  s.answer = null;
  if (!go || !s.alive) return;
  const startedAt = new Date().toISOString();
  await robot(ctx.robot.hello());
  if (!s.alive) return;

  let now = 0;
  const owners = {};
  const turns = [];
  let winner = null;
  let stopped = false;
  let robotSaid = null;

  const say = (who, count) => {
    const said = countFrom(now, count);
    for (const n of said) owners[n] = who;
    now += count;
    return said;
  };

  while (!winner) {
    // 1) 내 차례
    const allowed = allowedCounts(now, end, maxStep);
    screen.myTurn(
      { ...base, now, owners, fresh: robotSaid ?? [], robotSaid, allowed, holdSec: holdMs(ctx) / 1000 },
      (count) => s.answer?.({ count, via: 'button' }),
      () => s.answer?.({ stop: true }),
    );
    const picked = await waitCount(ctx, screen, s, allowed);
    if (!picked) return; // 화면이 닫힘: 끝까지 하지 않은 판은 기록하지 않는다
    if (picked.stop) {
      stopped = true;
      break;
    }
    const mine = say('me', picked.count);
    turns.push({ who: 'me', count: picked.count, from: mine[0], to: now, via: picked.via, reactionMs: picked.reactionMs });
    screen.counting({ ...base, owners, fresh: mine, who: 'me', said: mine });
    if (now >= end) {
      winner = 'robot';
      break;
    }
    await wait(800);
    if (!s.alive) return;

    // 2) 로봇 차례: 생각 → 손가락으로 개수 → 이어 셈
    screen.counting({ ...base, owners, fresh: mine, who: 'robot', said: null });
    await wait(thinkMs(ctx));
    if (!s.alive) return;
    const n = robotCount(now, end, maxStep, spec.smart);
    robotSaid = say('robot', n);
    turns.push({ who: 'robot', count: n, from: robotSaid[0], to: now });
    screen.counting({ ...base, owners, fresh: robotSaid, who: 'robot', said: robotSaid });
    await robot(ctx.robot.showPose(countPose(n)));
    await wait(showMs(ctx));
    if (!s.alive) return;
    await robot(ctx.robot.rest());
    if (!s.alive) return;
    if (now >= end) winner = 'me';
  }

  // 3) 끝
  const again = () => start(ctx, screen, s, level);
  const levels = () => showLevels(ctx, screen, s);
  screen.finished(
    { end, maxStep, owners, winner, myTurns: turns.filter((t) => t.who === 'me').length, hint: level === 1 },
    again,
    levels,
  );
  if (winner === 'me') await robot(ctx.robot.react('ok'));
  await robot(ctx.robot.rest());
  if (!s.alive) return;

  ctx.log.record({
    program: ID,
    startedAt,
    endedAt: new Date().toISOString(),
    ...summarizeGame({ winner, stopped, turns }), // total 1, done(로봇이 끝 숫자를 부름), skipped(그만함), avgReactionMs
    detail: {
      level,
      speed: ctx.settings.speed,
      end,
      maxStep,
      winner, // 'me' | 'robot' | null(그만함)
      stopped,
      // 차례마다: 누가, 몇 개, 어디부터 어디까지, (내 차례) 입력 방법 'hand'|'button', 고르는 데 걸린 시간
      turns,
    },
  });
}

function start(ctx, screen, s, level) {
  playGame(ctx, screen, s, level).catch((err) => console.error(err));
}

function showLevels(ctx, screen, s) {
  screen.levels({ selected: defaultLevel(ctx.settings.challengeLevel) }, (level) => start(ctx, screen, s, level));
}

export default {
  id: ID,
  title: '이어 세기',

  mount(container, ctx) {
    session = { alive: true, answer: null, waits: new Set() };
    const s = session;
    const screen = createScreen(container);
    showLevels(ctx, screen, s);
  },

  unmount() {
    if (!session) return;
    const s = session;
    s.alive = false;
    for (const stop of s.waits) stop.abort();
    s.waits.clear();
    s.answer?.(null);
    session = null;
  },
};

