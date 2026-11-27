// 도전 활동 "공 주고받기" (기본 활동 손운동의 짝, 홈 손운동 카드 아래 칸). core 는 import 하지 않고 ctx 만 쓴다.
//
// 한 회차 = 4번 주고받기:
//   시작 화면 [시작하기]. 단계는 하나뿐 (PLAY_LEVEL, 2026-11-27 실물 테스트: 단계 차이가 잘 느껴지지 않아 한 가지로)
//   → 로봇 인사
//   → 번마다: 손 지시 보기("편한 손으로 건네고, 같은 손으로 받아요") → [준비됐어요]
//            → 건네기: 로봇이 손을 펴고(PAPER) "셋, 둘, 하나" 뒤 쥔다(ROCK)
//            → 받기: 웹캠에 펼친 손(PAPER·FOUR)이 보이거나 [손을 받쳤어요]를 누르면 로봇이 손을 편다(PAPER).
//                    10초(느리게 15초) 안에 둘 다 없으면 "셋, 둘, 하나" 뒤 편다 (공을 오래 쥐지 않게)
//            → 받은 뒤: [다음으로] 또는 공이 떨어졌으면 [다시 건네기] (저절로 넘어가지 않음)
//   → 4번 끝: 칭찬 → 쉬는 자세 → ctx.log.record 한 번
//
// 받기만 손 인식(ctx.hand.waitForPose)을 쓴다 (2026-11-26 A). 왼손·오른손은 확인하지 않는다 (사용자를 믿는다).
// 건네기·공이 잡혔는지는 확인하지 않는다. 손 인식이 안 될 때를 위해 받기에도 화면 버튼이 있다.
//
// 꼭 지킬 것 (#132 공 주고받기 계획, 11/23 실물 확인):
//   - 공을 쥔 동안(s.holding)에는 showPose('PAPER') 말고 다른 로봇 명령을 보내지 않는다 (공이 떨어진다)
//   - 끝날 때는 언제나 공을 먼저 돌려준다. 그만하기는 안내 후 PAPER, 화면을 떠나면(unmount) 바로 PAPER
//   - 로봇 응답 DONE 은 시간이 지나면 온다. 공이 정말 잡혔는지는 사람이 눈으로 본다

import {
  EXCHANGES,
  HAND_TEXT,
  RECEIVE_POSES,
  PLAY_LEVEL,
  levelSpec,
  makeInstructions,
  instructionText,
  beatMs,
  hideMs,
  receiveHoldMs,
  receiveWaitMs,
  isReceivePose,
  summarizeSession,
} from './logic.js';
import { createScreen } from './screen.js';

const ID = 'challenge-ball';

let session = null; // 지금 화면의 실행 상태. unmount 하면 alive = false

/** 로봇 명령이 실패해도 활동은 이어 간다 (화면 글자가 주 흐름) */
async function robot(promise) {
  try {
    await promise;
  } catch (err) {
    console.error('공 주고받기 로봇 명령 오류', err);
  }
}

/**
 * 화면 버튼이나 시간을 기다린다.
 * 반환: 버튼 값('ready'·'placed'·'next'·'again'·'stop') | 'timeout'(ms 가 지남) | null(화면이 닫힘)
 * ms 가 null 이면 버튼만 기다린다.
 */
function waitInput(s, ms = null) {
  return new Promise((resolve) => {
    // 로봇이 움직이는 동안(기다리기 전에) 누른 버튼은 줄 서 있다가 바로 받는다
    if (s.queued !== null) {
      const value = s.queued;
      s.queued = null;
      resolve(value);
      return;
    }
    let timer = null;
    const done = (value) => {
      if (timer) {
        clearTimeout(timer);
        s.timers.delete(timer);
      }
      if (s.answer === done) s.answer = null;
      resolve(value);
    };
    s.answer = done;
    if (ms !== null) {
      timer = setTimeout(() => done('timeout'), ms);
      s.timers.add(timer);
    }
  });
}

/** 화면 버튼이 부르는 함수: 기다리는 중이면 바로 넘기고, 아니면 줄 세워 둔다 */
function sender(s, value) {
  return () => {
    if (s.answer) s.answer(value);
    else s.queued = value;
  };
}

/** 새 화면을 그린다. 앞 화면에서 줄 서 있던 버튼 입력은 버린다 (그만하기는 남겨 둔다) */
function show(screen, s, opts) {
  if (s.queued !== 'stop') s.queued = null;
  screen.stage(opts);
}

/** "셋, 둘, 하나". 중간에 버튼을 누르면 그 값, 다 세면 'timeout', 화면이 닫히면 null */
async function countdown(s, screen, speed) {
  for (const word of ['셋', '둘', '하나']) {
    screen.prompt(word);
    const r = await waitInput(s, beatMs(speed));
    if (r !== 'timeout') return r;
  }
  return 'timeout';
}

/**
 * 받을 손 기다리기: 웹캠에 받기 모양(펼친 손)이 확정되거나, [손을 받쳤어요]를 누르거나, 시간이 다 될 때까지.
 * 확정 규칙은 공통 waitForPose (이 단계가 시작된 뒤에 만든 손을 receiveHoldMs 유지).
 * 기다리는 동안 손 상태를 안내 줄에 보여 준다.
 * 반환: 'hand' | 'received'(버튼) | 'timeout' | 'stop' | null(화면이 닫힘)
 */
async function waitReceive(ctx, screen, s, speed) {
  const since = Date.now();
  const stop = new AbortController();
  s.waits.add(stop);
  const off = ctx.hand.onPose((pose) => {
    if (!s.alive) return;
    if (!pose?.code) screen.prompt('손을 펴서 받쳐 주세요');
    else if (!isReceivePose(pose.name)) screen.prompt('손가락을 모두 펴 주세요');
    // 이 단계 전부터 펴고 있던 손은 확정되지 않는다 (공통 규칙) → 한 번 내렸다 펴 달라고
    else if (Date.now() - pose.stableMs < since) screen.prompt('손을 잠깐 내렸다가 다시 펴 주세요');
    else screen.prompt('손이 보여요! 그대로 받쳐 주세요');
  });
  const fromHand = ctx.hand
    .waitForPose({ holdMs: receiveHoldMs(speed), since, names: RECEIVE_POSES, signal: stop.signal })
    .then((pose) => (pose ? 'hand' : null));
  const fromInput = waitInput(s, receiveWaitMs(speed));
  const r = await Promise.race([fromHand, fromInput]);
  // 지고 남은 쪽 정리: 손 기다리기를 멈추고, 버튼 기다리기(와 그 타이머)도 끝낸다
  off();
  stop.abort();
  s.waits.delete(stop);
  if (s.answer) s.answer(null);
  return s.alive ? r : null;
}

/** 그만하기를 눌렀는데 로봇이 공을 쥐고 있으면: 안내하고 세고 나서 손을 편다 */
async function giveBack(ctx, screen, s, base) {
  if (!s.holding) return true;
  show(screen, s, { ...base, hidden: false, active: 'receive', prompt: '', sub: '공을 먼저 돌려 드릴게요. 손을 받쳐 주세요.' });
  const r = await countdown(s, screen, ctx.settings.speed);
  if (r === null || !s.alive) return false; // 화면이 닫힘: unmount 가 손을 편다
  screen.prompt('놓아요!');
  await robot(ctx.robot.showPose('PAPER'));
  s.holding = false;
  return s.alive;
}

/** 그만하기로 끝: 기록하지 않는다 (끝까지 하지 않은 회차) */
async function stopSession(ctx, screen, s, { level, done }) {
  await robot(ctx.robot.rest()); // 공은 이미 돌려줬다 (giveBack)
  if (!s.alive) return;
  screen.stopped({ done }, () => start(ctx, screen, s, level));
}

async function playSession(ctx, screen, s, level) {
  const speed = ctx.settings.speed;
  const spec = levelSpec(level);
  const pairs = makeInstructions(level, EXCHANGES);
  const startedAt = new Date().toISOString();
  const exchanges = []; // 끝까지 주고받은 번: { give, receive, retries, replays }

  screen.waiting('로봇이 인사해요. 공 하나를 준비해 주세요.');
  await robot(ctx.robot.hello());
  if (!s.alive) return;

  const stopBtn = { label: '그만하기', variant: 'secondary', onClick: sender(s, 'stop') };
  const stopHere = () => stopSession(ctx, screen, s, { level, done: exchanges.length });

  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    const base = { level, index: i + 1, count: pairs.length, pair };
    let replays = 0;
    let retries = 0;
    // 3단계: 가린 지시를 이 화면 동안 다시 보여 준다 (여러 번 눌러도 됨, 횟수만 기록)
    const replayBtn = spec.hide
      ? {
          label: '다시 보기',
          variant: 'secondary',
          repeat: true,
          onClick: () => {
            replays += 1;
            screen.reveal(pair, s.active);
          },
        }
      : null;

    // 1) 손 지시 보기. 3단계는 시간이 지나면 가려진다
    s.active = null;
    show(screen, s, {
      ...base,
      hidden: false,
      active: null,
      prompt: instructionText(pair),
      sub: spec.hide ? `잘 보고 기억해 주세요. ${hideMs(speed) / 1000}초 뒤에 가려져요.` : '준비되면 아래 버튼을 눌러 주세요.',
      buttons: [{ label: '준비됐어요', onClick: sender(s, 'ready') }, stopBtn],
    });
    let r = await waitInput(s, spec.hide ? hideMs(speed) : null);
    if (r === null || !s.alive) return;
    if (r === 'stop') return stopHere();
    if (r === 'timeout') {
      // 3단계: 시간이 지나면 지시를 가리고, [준비됐어요]를 눌러야 넘어간다 (사람이 준비하기 전에 로봇이 움직이지 않게)
      show(screen, s, {
        ...base,
        hidden: true,
        active: null,
        prompt: '기억해 두셨나요?',
        sub: '준비되면 아래 버튼을 눌러 주세요.',
        buttons: [{ label: '준비됐어요', onClick: sender(s, 'ready') }, replayBtn, stopBtn].filter(Boolean),
      });
      r = await waitInput(s);
      if (r === null || !s.alive) return;
      if (r === 'stop') return stopHere();
    }

    let finished = false;
    while (!finished) {
      // 2) 건네기: 로봇이 손을 펴고 "셋, 둘, 하나" 뒤 쥔다. [공을 댔어요]를 누르면 바로 쥔다
      s.active = 'give';
      show(screen, s, {
        ...base,
        hidden: spec.hide,
        active: 'give',
        prompt: '로봇이 손을 펴요',
        // 2026-11-27 실물 테스트: 공을 일찍 떼면 다 쥐기 전에 떨어진다 → 다 쥘 때까지 대고 있도록 안내
        sub: spec.hide
          ? '기억한 손으로 공을 로봇 손바닥 가운데에 대 주세요. 로봇이 다 쥘 때까지 떼지 마세요.'
          : `${HAND_TEXT[pair.give]}으로 공을 로봇 손바닥 가운데에 대 주세요. 로봇이 다 쥘 때까지 떼지 마세요.`,
        buttons: [{ label: '공을 댔어요', onClick: sender(s, 'placed') }, replayBtn, stopBtn].filter(Boolean),
      });
      await robot(ctx.robot.showPose('PAPER'));
      if (!s.alive) return;
      r = await countdown(s, screen, speed);
      if (r === null || !s.alive) return;
      if (r === 'stop') return stopHere(); // 아직 쥐지 않았다
      s.holding = true; // 명령을 보내기 전에 표시한다 (그사이 화면을 떠나도 unmount 가 손을 펴게)
      screen.prompt('잡는 중이에요. 공을 그대로 대고 계세요');
      await robot(ctx.robot.showPose('ROCK'));
      if (!s.alive) return; // 다 쥔 뒤(DONE) 받기 화면으로 바뀐다

      // 3) 받기: 웹캠에 펼친 손이 보이거나 [손을 받쳤어요]를 누르면 손을 편다.
      //    그동안 로봇은 공을 쥐고 있으므로 receiveWaitMs 를 넘기지 않는다
      s.active = 'receive';
      show(screen, s, {
        ...base,
        hidden: spec.hide,
        active: 'receive',
        prompt: '손을 펴서 받쳐 주세요',
        sub: spec.hide ? '기억한 손을 펴서 로봇 손 아래에 받쳐 주세요.' : `${HAND_TEXT[pair.receive]}을 펴서 로봇 손 아래에 받쳐 주세요.`,
        buttons: [{ label: '손을 받쳤어요', onClick: sender(s, 'received') }, replayBtn, stopBtn].filter(Boolean),
      });
      r = await waitReceive(ctx, screen, s, speed);
      if (r === null || !s.alive) return;
      if (r === 'stop') {
        if (await giveBack(ctx, screen, s, base)) stopHere();
        return;
      }
      let stopAfter = false;
      if (r === 'timeout') {
        // 손이 보이지 않음: 공을 오래 쥐지 않게 세고 나서 내려놓는다. 이때 그만하기를 눌러도 곧 펴므로 편 뒤 끝낸다
        show(screen, s, {
          ...base,
          hidden: spec.hide,
          active: 'receive',
          prompt: '',
          sub: '손을 받쳐 주세요. 로봇이 곧 공을 내려놓아요.',
          buttons: [stopBtn],
        });
        const c = await countdown(s, screen, speed);
        if (c === null || !s.alive) return;
        stopAfter = c === 'stop';
      }

      // 4) 손을 펴서 공을 내려놓는다
      screen.prompt('놓아요!');
      await robot(ctx.robot.showPose('PAPER'));
      s.holding = false;
      if (!s.alive) return;
      if (stopAfter) return stopHere();

      // 5) 받은 뒤: 공이 떨어졌으면 [다시 건네기] (같은 지시로 다시)
      s.active = null;
      show(screen, s, {
        ...base,
        hidden: false,
        active: null,
        prompt: '공을 돌려 드렸어요',
        sub: spec.hide
          ? `이번에는 ${HAND_TEXT[pair.give]} → ${HAND_TEXT[pair.receive]}이었어요. 공이 떨어졌으면 다시 건네 주세요.`
          : '공이 떨어졌으면 다시 건네 주세요.',
        buttons: [
          { label: i < pairs.length - 1 ? '다음으로' : '마치기', onClick: sender(s, 'next') },
          { label: '다시 건네기', variant: 'secondary', onClick: sender(s, 'again') },
          stopBtn,
        ],
      });
      // 저절로 넘어가지 않는다: 공이 떨어져 줍는 동안 다음 번으로 넘어가면 [다시 건네기]를 놓친다
      r = await waitInput(s);
      if (r === null || !s.alive) return;
      if (r === 'stop') return stopHere();
      if (r === 'again') retries += 1;
      else finished = true;
    }
    exchanges.push({ give: pair.give, receive: pair.receive, retries, replays });
  }

  // 6) 끝: 손이 비었으니 칭찬해도 된다
  screen.waiting('다 하셨어요!');
  await robot(ctx.robot.react('ok'));
  if (!s.alive) return;
  await robot(ctx.robot.rest());
  if (!s.alive) return;

  // 끝까지 한 회차만 기록한다
  const summary = summarizeSession(exchanges, pairs.length);
  ctx.log.record({
    program: ID,
    startedAt,
    endedAt: new Date().toISOString(),
    ...summary, // total = 주고받기로 한 횟수, done = 끝까지 주고받은 횟수, avgReactionMs = null
    detail: {
      level,
      speed,
      hand: null, // 1단계도 손을 고르지 않는다 (2026-11-27). 예전 기록에는 'right'|'left' 가 있을 수 있다
      // 번마다: 건넨 손·받은 손(지시 기준: 'right'|'left', 1단계는 'any'·'same'), 다시 건넨 수, 다시 보기 수
      exchanges,
    },
  });
  screen.finished({ done: summary.done }, () => start(ctx, screen, s, level));
}

function start(ctx, screen, s, level) {
  playSession(ctx, screen, s, level).catch((err) => console.error(err));
}

/** 시작 화면. 단계 고르기 없이 [시작하기] (ctx.settings.challengeLevel 은 쓰지 않는다) */
function showIntro(ctx, screen, s) {
  screen.intro(() => start(ctx, screen, s, PLAY_LEVEL));
}

export default {
  id: ID,
  title: '공 주고받기',

  mount(container, ctx) {
    // answer: 지금 기다리는 버튼 입력, queued: 기다리기 전에 누른 버튼, timers: 기다리는 타이머,
    // waits: 기다리는 손 입력(AbortController), holding: 로봇이 공을 쥐고 있는지
    session = { alive: true, answer: null, queued: null, timers: new Set(), waits: new Set(), holding: false, active: null, ctx };
    const screen = createScreen(container);
    showIntro(ctx, screen, session);
  },

  unmount() {
    if (!session) return;
    const s = session;
    s.alive = false;
    s.timers.forEach((t) => clearTimeout(t));
    s.timers.clear();
    s.waits.forEach((w) => w.abort());
    s.waits.clear();
    s.answer?.(null);
    // 공을 쥔 채 화면을 떠나면 바로 손을 편다 (공이 떨어질 수 있어도 서보 보호가 먼저)
    if (s.holding) {
      s.holding = false;
      robot(s.ctx.robot.showPose('PAPER'));
    }
    session = null;
  },
};
