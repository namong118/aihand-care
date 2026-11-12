// STEP 2 사고력 가위바위보: logic 과 screen 을 연결한다. core 는 import 하지 않고 ctx 만 쓴다.
//
// 한 회차 = 5문제. 문제 하나의 흐름:
//   "가위, 바위, 보!"(글자 + 음성) → 로봇이 손을 냄 → 조건 표시 → 사용자 답(손 인식 또는 화면 버튼, 건너뛰기 가능)
//   → 맞으면 칭찬 반응 / 처음 맞지 않으면 "다시 해 볼까요?" + 도움말 → 한 번 더
//   → 두 번째도 맞지 않으면 답을 함께 확인하고 로봇이 그 손을 보여 준다
// 어려움: 로봇 손을 3초(천천히 4.5초)만 보여 주고 내린다. 제한 시간은 없다.
// 회차가 끝나면 요약 화면을 보여 주고 ctx.log.record 로 한 번 기록한다.

import {
  HANDS,
  QUESTIONS_PER_ROUND,
  MAX_TRIES,
  findCondition,
  judge,
  makeRound,
  revealMs,
  hintFor,
  explain,
  questionStatus,
  summarizeRound,
  handFeedback,
  shouldShowNotice,
} from './logic.js';
import { createScreen } from './screen.js';
import { speak, stopSpeaking } from './voice.js';

const ID = 'step2-rps';

let session = null; // 지금 화면의 실행 상태. unmount 하면 alive = false

const isSlow = (ctx) => ctx.settings.speed === 'SLOW';

/** 손모양을 이 시간 유지하면 답으로 확정 */
const holdMs = (ctx) => (isSlow(ctx) ? 1500 : 1000);
/** "가위" "바위" "보!" 사이 간격 */
const beatMs = (ctx) => (isSlow(ctx) ? 1100 : 750);
/** 칭찬을 보여 준 뒤 다음 문제로 넘어가기 전 쉬는 시간 */
const restMs = (ctx) => (isSlow(ctx) ? 2000 : 1200);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** 로봇 명령이 실패해도 활동은 이어 간다 (화면 안내가 주 흐름) */
async function robot(promise) {
  try {
    await promise;
  } catch (err) {
    console.error('STEP 2 로봇 명령 오류', err);
  }
}

/** 화면 버튼 하나 누를 때까지 기다리기. 화면이 닫히면 null */
function waitClick(s, show) {
  return new Promise((resolve) => {
    s.answer = resolve;
    show(() => s.answer?.(true));
  }).finally(() => {
    s.answer = null;
  });
}

/**
 * 답 기다리기: 손 인식(waitForPose)과 화면 버튼·건너뛰기 중 먼저 들어온 것.
 * 반환: { hand, via } | { skip: true } | 화면이 닫히면 null
 */
async function waitAnswer(ctx, screen, s, since) {
  const stop = new AbortController();
  s.waits.add(stop);
  // 기다리는 동안 손 인식에 이상이 있으면(손이 안 보임 등) 그 상태가 잠깐 계속될 때만 안내한다.
  // 확정은 waitForPose 가 한다. kind: 지금 상태, kindAt: 그 상태가 시작된 시각
  let kind = null;
  let kindAt = since;
  const offPose = ctx.hand.onPose((pose) => {
    if (!s.alive) return;
    const now = Date.now();
    const fb = handFeedback(pose, { now, since, holdMs: holdMs(ctx) });
    if (fb.kind !== kind) {
      kind = fb.kind;
      kindAt = now;
    }
    screen.showHand(fb, shouldShowNotice(fb.kind, now - kindAt));
  });
  stop.signal.addEventListener('abort', offPose);
  const fromScreen = new Promise((resolve) => {
    s.answer = resolve; // 화면 버튼이 s.answer({ hand, via: 'button' }) / s.answer({ skip: true }) 를 부른다
  });
  const fromHand = ctx.hand
    .waitForPose({ holdMs: holdMs(ctx), since, names: HANDS, signal: stop.signal })
    .then((pose) => pose && { hand: pose.name, via: 'hand' });
  const picked = await Promise.race([fromHand, fromScreen]);
  stop.abort(); // 버튼이 먼저면 기다리던 손 입력을 멈춘다
  s.waits.delete(stop);
  s.answer = null;
  return s.alive ? picked : null;
}

async function countdown(ctx, screen, s, progress) {
  const words = ['가위', '바위', '보!'];
  for (let i = 0; i < words.length; i++) {
    if (!s.alive) return;
    screen.countdown(words[i], progress);
    speak(words[i]);
    if (i < words.length - 1) await wait(beatMs(ctx));
  }
}

/** 문제 하나. 반환: 기록용 결과 / 화면이 닫히면 null */
async function playQuestion(ctx, screen, s, q, index, total) {
  const condition = findCondition(q.conditionId);
  const progress = { index, total };
  const hideAfter = revealMs(ctx.settings.difficulty, ctx.settings.speed);
  const tries = []; // 답마다 맞았는지
  const answers = []; // 기록용: 낸 손, 입력 방법, 승패, 걸린 시간
  let skipped = false;

  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    // 1) "가위, 바위, 보!" 와 함께 로봇이 손을 낸다 (다시 할 때도 로봇이 다시 보여 준다)
    await countdown(ctx, screen, s, progress);
    if (!s.alive) return null;
    await robot(ctx.robot.showPose(q.robotHand));
    if (!s.alive) return null;

    // 2) 문제 보여 주기
    const shownAt = Date.now();
    screen.question(
      { ...progress, robotHand: q.robotHand, conditionText: condition.text, attempt, holdSec: holdMs(ctx) / 1000 },
      (hand) => s.answer?.({ hand, via: 'button' }),
      () => s.answer?.({ skip: true }),
    );
    speak(condition.text);

    // 어려움: 정해진 시간 뒤 화면과 로봇 모두 손을 내린다
    let hideTimer = null;
    if (hideAfter) {
      hideTimer = setTimeout(() => {
        if (!s.alive) return;
        screen.hideRobot();
        robot(ctx.robot.rest());
      }, hideAfter);
      s.timers.add(hideTimer);
    }

    // 3) 답 받기 (제한 시간 없음)
    const picked = await waitAnswer(ctx, screen, s, shownAt);
    clearTimeout(hideTimer);
    s.timers.delete(hideTimer);
    if (!picked) return null;
    if (picked.skip) {
      skipped = true;
      break;
    }

    // 4) 판정
    const reactionMs = Date.now() - shownAt;
    const result = judge(q.conditionId, q.robotHand, picked.hand);
    tries.push(result.correct);
    answers.push({ hand: picked.hand, via: picked.via, outcome: result.outcome, reactionMs });

    if (result.correct) {
      screen.good({ userHand: picked.hand, attempt });
      speak('잘하셨어요!');
      await robot(ctx.robot.react('ok'));
      if (!s.alive) return null;
      await wait(restMs(ctx));
      break;
    }

    if (attempt < MAX_TRIES) {
      // 처음 맞지 않음: 도움말을 보여 주고, 준비되면 "다시 하기"
      const hint = hintFor(q.conditionId);
      speak(`다시 해 볼까요? ${hint}`);
      const again = waitClick(s, (onAgain) => screen.retry({ userHand: picked.hand, hint }, onAgain));
      await robot(ctx.robot.react('retry'));
      if (!(await again)) return null;
      continue;
    }

    // 두 번째도 맞지 않음: 답을 함께 확인하고 로봇이 그 손을 보여 준다
    const text = explain(q.conditionId, q.robotHand);
    speak(text);
    const next = waitClick(s, (onNext) =>
      screen.reveal({ text, answer: result.answer, isLast: index === total }, onNext),
    );
    await robot(ctx.robot.showPose(result.answer));
    if (!(await next)) return null;
  }

  return {
    robotHand: q.robotHand,
    condition: q.conditionId,
    conditionText: condition.text,
    status: questionStatus(tries, skipped),
    reactionMs: answers[0]?.reactionMs ?? null, // 첫 답까지 걸린 시간
    answers,
  };
}

async function playRound(ctx, screen, s) {
  const startedAt = new Date().toISOString();
  const { difficulty, speed } = ctx.settings;
  const questions = makeRound(difficulty, QUESTIONS_PER_ROUND);
  const items = [];

  for (let i = 0; i < questions.length; i++) {
    const item = await playQuestion(ctx, screen, s, questions[i], i + 1, questions.length);
    if (!item) return; // 화면이 닫힘: 끝까지 하지 않은 회차는 기록하지 않는다
    items.push(item);
  }

  await robot(ctx.robot.rest());
  if (!s.alive) return;

  ctx.log.record({
    program: ID,
    startedAt,
    endedAt: new Date().toISOString(),
    ...summarizeRound(items), // total, done, skipped, avgReactionMs
    detail: {
      difficulty,
      speed,
      // 문제마다: 로봇 손, 조건, 결과(first|second|shown|skipped), 낸 답들 [{ hand, via: 'hand'|'button', outcome, reactionMs }]
      questions: items.map(({ robotHand, condition, status, answers }) => ({ robotHand, condition, status, answers })),
    },
  });

  speak(`${items.length}문제를 모두 함께 해 주셨어요. 수고하셨어요!`);
  screen.summary({ rows: items }, () => start(ctx, screen, s));
}

function start(ctx, screen, s) {
  playRound(ctx, screen, s).catch((err) => console.error(err));
}

export default {
  id: ID,
  title: '사고력 가위바위보',

  mount(container, ctx) {
    // waits: 기다리는 중인 손 입력, timers: 어려움 손 내리기 타이머, answer: 화면 버튼을 기다리는 중이면 그 resolve
    session = { alive: true, waits: new Set(), timers: new Set(), answer: null };
    const s = session;
    const screen = createScreen(container);
    const reveal = revealMs(ctx.settings.difficulty, ctx.settings.speed);
    screen.intro({ total: QUESTIONS_PER_ROUND, revealSec: reveal ? reveal / 1000 : null }, () => start(ctx, screen, s));
  },

  unmount() {
    if (!session) return;
    session.alive = false;
    session.waits.forEach((w) => w.abort());
    session.timers.forEach((t) => clearTimeout(t));
    session.answer?.(null); // 버튼을 기다리던 흐름도 끝낸다
    session = null;
    stopSpeaking();
  },
};
