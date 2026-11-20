// 도전 활동 "숫자 야구" (기본 활동 숫자 기억의 짝, 홈 숫자 기억 카드 아래 칸). core 는 import 하지 않고 ctx 만 쓴다.
//
// 한 회차 = 한 판:
//   시작 화면에서 1·2·3단계 고르기 (미리 선택: ctx.settings.challengeLevel, 없으면 1단계)
//   → 숫자 모드 준비 → 로봇 인사 → 로봇이 숫자를 몰래 정함
//   → 사용자가 숫자 카드(또는 화면 버튼)로 한 번에 count 개를 냄
//   → 로봇이 손가락으로 스트라이크 개수 → 볼 개수 (0개는 주먹), 화면에도 글자로
//   → 다 맞히면 칭찬 / 8번을 다 쓰거나 "정답 보기"면 로봇이 정답을 손가락으로 차례로 보여 줌
//   → ctx.log.record 로 한 번 기록

import {
  levelSpec,
  defaultLevel,
  makeSecret,
  addDigit,
  judgeGuess,
  isSolved,
  excludedDigits,
  countPose,
  summarizeGame,
} from './logic.js';
import { createScreen } from './screen.js';

const ID = 'challenge-baseball';

let session = null; // 지금 화면의 실행 상태. unmount 하면 alive = false

const isSlow = (ctx) => ctx.settings.speed === 'SLOW';
/** 로봇이 힌트 손모양을 들고 있는 시간 */
const holdMs = (ctx) => (isSlow(ctx) ? 2200 : 1400);
/** 정답을 보여 줄 때 숫자 하나 사이 */
const revealGapMs = (ctx) => (isSlow(ctx) ? 1500 : 900);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** 로봇 명령이 실패해도 활동은 이어 간다 (화면 글자가 주 흐름) */
async function robot(promise) {
  try {
    await promise;
  } catch (err) {
    console.error('숫자 야구 로봇 명령 오류', err);
  }
}

/**
 * 입력 하나 받기: 숫자 카드와 화면 숫자 버튼 중 먼저 들어온 것.
 * 반환: { number, via } / { restart: true } / { stop: true } / 화면이 닫히면 null
 */
function pickOne(screen, s, view) {
  return new Promise((resolve) => {
    const finish = (picked) => {
      if (s.pending !== finish) return;
      s.pending = null;
      resolve(s.alive ? picked : null);
    };
    s.pending = finish; // 숫자 카드가 들어오면 mount 의 구독이 이 함수를 부른다
    screen.guessing(
      view,
      (number) => finish({ number, via: 'button' }),
      () => finish({ restart: true }),
      () => finish({ stop: true }),
    );
  });
}

/**
 * 한 번 내기 (count 개). 반환: { guess, vias, reactionMs } / 그만하기면 { stop: true } / 화면이 닫히면 null
 * 같은 숫자를 또 내면 넣지 않고 짧게 알려 준다 (카드가 숫자마다 한 장뿐이라 보통은 생기지 않음).
 */
async function collectGuess(screen, s, base) {
  let guess = [];
  let vias = [];
  let notice = null;
  let since = Date.now();

  while (guess.length < base.count) {
    const picked = await pickOne(screen, s, { ...base, guess, notice });
    if (!picked) return null;
    if (picked.stop) return { stop: true };
    if (picked.restart) {
      guess = [];
      vias = [];
      notice = null;
      since = Date.now();
      continue;
    }
    const r = addDigit(guess, picked.number, base.count);
    if (!r.added) {
      notice = r.reason === 'dup' ? `${picked.number}: 이미 낸 숫자예요` : null;
      continue;
    }
    guess = r.guess;
    vias.push(picked.via);
    notice = null;
  }
  return { guess, vias, reactionMs: Date.now() - since };
}

async function playGame(ctx, screen, s, level) {
  const startedAt = new Date().toISOString();
  const spec = levelSpec(level);
  const { count, maxTries } = spec;

  // 0) 카메라가 숫자 모드가 된 다음 시작 (모드 전환은 최대 약 5초, 보통 바로)
  screen.preparing();
  await ctx.card.ready();
  if (!s.alive) return;

  // 1) 로봇이 숫자를 몰래 정한다
  screen.thinking({ count });
  await robot(ctx.robot.hello());
  if (!s.alive) return;
  const secret = makeSecret(count);

  const history = [];
  let solved = false;
  let stopped = false;

  for (let tryNo = 1; tryNo <= maxTries; tryNo++) {
    const base = {
      level,
      tryNo,
      maxTries,
      count,
      history,
      excluded: spec.helper ? excludedDigits(history) : [],
    };

    // 2) 숫자 count 개 내기
    const answer = await collectGuess(screen, s, base);
    if (!answer) return; // 화면이 닫힘: 끝까지 하지 않은 판은 기록하지 않는다
    if (answer.stop) {
      stopped = true;
      break;
    }

    // 3) 판정 → 로봇이 손가락으로 스트라이크, 볼 순서로 (입력은 이동안 받지 않는다)
    const result = judgeGuess(secret, answer.guess);
    history.push({ guess: answer.guess, ...result, inputVia: answer.vias, reactionMs: answer.reactionMs });

    const view = { ...base, guess: answer.guess, result };
    screen.judged({ ...view, showing: 'strike' });
    await robot(ctx.robot.showPose(countPose(result.strike)));
    await wait(holdMs(ctx));
    if (!s.alive) return;
    screen.judged({ ...view, showing: 'ball' });
    await robot(ctx.robot.showPose(countPose(result.ball)));
    await wait(holdMs(ctx));
    if (!s.alive) return;

    if (isSolved(result, count)) {
      solved = true;
      break;
    }
    await robot(ctx.robot.rest());
    if (!s.alive) return;
  }

  // 4) 끝: 맞혔으면 칭찬, 아니면 정답을 화면과 로봇 손가락으로 함께 확인
  const again = () => start(ctx, screen, s, level);
  const levels = () => showLevels(ctx, screen, s);
  if (solved) {
    screen.solved({ secret, tries: history.length }, again, levels);
    await robot(ctx.robot.react('ok'));
  } else {
    screen.revealed({ secret, history }, again, levels);
    for (const n of secret) {
      if (!s.alive) return;
      await robot(ctx.robot.showPose(countPose(n)));
      await wait(revealGapMs(ctx));
    }
  }
  await robot(ctx.robot.rest());
  if (!s.alive) return;

  ctx.log.record({
    program: ID,
    startedAt,
    endedAt: new Date().toISOString(),
    ...summarizeGame({ solved, stopped, history }), // total 1, done, skipped, avgReactionMs
    detail: {
      level,
      speed: ctx.settings.speed,
      count,
      secret,
      solved,
      stopped,
      tries: history.length,
      // 낼 때마다: 낸 숫자, 스트라이크, 볼, 입력 방법('card'|'button' 숫자마다), 한 번 내는 데 걸린 시간
      history,
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
  title: '숫자 야구',

  mount(container, ctx) {
    session = { alive: true, pending: null, offNumber: null };
    const s = session;

    // 숫자 카드 구독은 처음 한 번. 구독하면 core 가 WonderCam 을 숫자 모드로 바꾸기 시작한다.
    // 내는 단계가 아닐 때(로봇이 힌트를 보여 주는 중 등) 들어온 카드는 버린다.
    s.offNumber = ctx.card.onNumber(({ number }) => s.pending?.({ number, via: 'card' }));

    const screen = createScreen(container);
    showLevels(ctx, screen, s);
  },

  unmount() {
    if (!session) return;
    const s = session;
    s.alive = false;
    s.pending?.(null);
    s.offNumber?.();
    session = null;
  },
};
