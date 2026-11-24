import { describe, it, expect } from 'vitest';
import {
  HANDS,
  CONDITIONS,
  outcome,
  judge,
  answerFor,
  makeQuestion,
  isRpsHand,
  QUESTIONS_PER_ROUND,
  makeRound,
  revealMs,
  hintFor,
  explain,
  handText,
  questionStatus,
  summarizeRound,
  handFeedback,
  shouldShowNotice,
} from './logic.js';

describe('outcome: 가위바위보 승패 (사용자 기준)', () => {
  const cases = [
    // [사용자, 로봇, 결과]
    ['ROCK', 'V', 'win'],
    ['ROCK', 'PAPER', 'lose'],
    ['ROCK', 'ROCK', 'draw'],
    ['PAPER', 'ROCK', 'win'],
    ['PAPER', 'V', 'lose'],
    ['PAPER', 'PAPER', 'draw'],
    ['V', 'PAPER', 'win'],
    ['V', 'ROCK', 'lose'],
    ['V', 'V', 'draw'],
  ];
  it.each(cases)('%s vs 로봇 %s → %s', (user, robot, expected) => {
    expect(outcome(user, robot)).toBe(expected);
  });

  it('가위바위보 손이 아니면 에러', () => {
    expect(() => outcome('INDEX', 'ROCK')).toThrow();
    expect(() => outcome('ROCK', null)).toThrow();
  });
});

describe('조건 5종', () => {
  it('조건은 정확히 5개, 원래 기획 문구', () => {
    expect(CONDITIONS.map((c) => c.text)).toEqual([
      '이겨주세요',
      '져주세요',
      '비겨주세요',
      '이기지도 비기지도 마세요',
      '지지도 비기지도 마세요',
    ]);
  });

  it('모든 조건 × 로봇 손마다 정답은 정확히 하나', () => {
    for (const c of CONDITIONS) {
      for (const robot of HANDS) {
        const correct = HANDS.filter((u) => judge(c.id, robot, u).correct);
        expect(correct).toHaveLength(1);
        expect(correct[0]).toBe(answerFor(c.id, robot));
      }
    }
  });

  it('로봇이 바위일 때 조건별 정답', () => {
    expect(answerFor('WIN', 'ROCK')).toBe('PAPER');
    expect(answerFor('LOSE', 'ROCK')).toBe('V');
    expect(answerFor('DRAW', 'ROCK')).toBe('ROCK');
    expect(answerFor('NO_WIN_NO_DRAW', 'ROCK')).toBe('V'); // = 져라
    expect(answerFor('NO_LOSE_NO_DRAW', 'ROCK')).toBe('PAPER'); // = 이겨라
  });

  it('"이기지도 비기지도 마세요" 는 져야 정답', () => {
    expect(judge('NO_WIN_NO_DRAW', 'PAPER', 'ROCK')).toEqual({ correct: true, outcome: 'lose', answer: 'ROCK' });
    expect(judge('NO_WIN_NO_DRAW', 'PAPER', 'V').correct).toBe(false); // 이김
    expect(judge('NO_WIN_NO_DRAW', 'PAPER', 'PAPER').correct).toBe(false); // 비김
  });

  it('"지지도 비기지도 마세요" 는 이겨야 정답', () => {
    expect(judge('NO_LOSE_NO_DRAW', 'V', 'ROCK')).toEqual({ correct: true, outcome: 'win', answer: 'ROCK' });
    expect(judge('NO_LOSE_NO_DRAW', 'V', 'PAPER').correct).toBe(false); // 짐
    expect(judge('NO_LOSE_NO_DRAW', 'V', 'V').correct).toBe(false); // 비김
  });

  it('없는 조건이면 에러', () => {
    expect(() => judge('NOT_WIN', 'ROCK', 'ROCK')).toThrow();
  });
});

describe('makeQuestion', () => {
  it('rand 를 고정하면 같은 문제', () => {
    expect(makeQuestion('normal', () => 0)).toEqual({ robotHand: 'ROCK', conditionId: 'WIN' });
    expect(makeQuestion('normal', () => 0.99)).toEqual({ robotHand: 'V', conditionId: 'NO_LOSE_NO_DRAW' });
  });
  it('쉬움에서는 기본 조건 3개만 나온다', () => {
    expect(makeQuestion('easy', () => 0.99).conditionId).toBe('DRAW');
  });
  it('모르는 난이도는 쉬움으로', () => {
    expect(makeQuestion('???', () => 0.99).conditionId).toBe('DRAW');
  });
});

describe('makeRound: 한 회차 문제 목록', () => {
  it('기본 5문제', () => {
    expect(makeRound('normal')).toHaveLength(QUESTIONS_PER_ROUND);
    expect(QUESTIONS_PER_ROUND).toBe(5);
  });

  it('난이도에 맞는 조건만 나온다', () => {
    for (let n = 0; n < 50; n++) {
      for (const q of makeRound('easy')) {
        expect(['WIN', 'LOSE', 'DRAW']).toContain(q.conditionId);
        expect(HANDS).toContain(q.robotHand);
      }
    }
  });

  it('바로 앞 문제와 같은 조건이 연달아 나오지 않는다', () => {
    for (let n = 0; n < 200; n++) {
      const round = makeRound('normal');
      for (let i = 1; i < round.length; i++) {
        expect(round[i].conditionId).not.toBe(round[i - 1].conditionId);
      }
    }
  });

  it('rand 를 고정해도 끝난다 (같은 조건이어도 그대로 씀)', () => {
    const round = makeRound('normal', 3, () => 0);
    expect(round).toEqual([
      { robotHand: 'ROCK', conditionId: 'WIN' },
      { robotHand: 'ROCK', conditionId: 'WIN' },
      { robotHand: 'ROCK', conditionId: 'WIN' },
    ]);
  });
});

describe('revealMs: 어려움에서 로봇 손을 보여 주는 시간', () => {
  it('어려움만 시간이 있다', () => {
    expect(revealMs('hard', 'NORMAL')).toBe(3000);
    expect(revealMs('hard', 'SLOW')).toBe(4500);
    expect(revealMs('normal', 'NORMAL')).toBeNull();
    expect(revealMs('easy', 'SLOW')).toBeNull();
  });
});

describe('도움말과 설명 문구', () => {
  it('꼬인 조건 도움말은 뜻을 풀어 준다', () => {
    expect(hintFor('NO_WIN_NO_DRAW')).toContain('져주세요');
    expect(hintFor('NO_LOSE_NO_DRAW')).toContain('이겨주세요');
    expect(hintFor('WIN')).toContain('다시 잘 보고');
  });

  it('설명에는 항상 정답 손이 들어 있다', () => {
    for (const c of CONDITIONS) {
      for (const robot of HANDS) {
        expect(explain(c.id, robot)).toContain(handText(answerFor(c.id, robot)));
      }
    }
  });

  it('설명 예시', () => {
    expect(explain('WIN', 'ROCK')).toBe('로봇이 ✊ 바위를 냈어요. 이기려면 ✋ 보를 내면 돼요.');
    expect(explain('NO_WIN_NO_DRAW', 'PAPER')).toBe(
      '로봇이 ✋ 보를 냈어요. “이기지도 비기지도 마세요”는 져 주라는 뜻이에요. 지려면 ✊ 바위를 내면 돼요.',
    );
  });

  it('handText 는 가위바위보 손만', () => {
    expect(handText('V')).toBe('✌️ 가위');
    expect(() => handText('THUMB')).toThrow();
  });

  it('“틀렸습니다”·“실패” 같은 말을 쓰지 않는다', () => {
    const texts = CONDITIONS.flatMap((c) => [hintFor(c.id), ...HANDS.map((r) => explain(c.id, r))]);
    for (const t of texts) expect(t).not.toMatch(/틀렸|실패|오답/);
  });
});

describe('questionStatus: 문제 하나의 결과', () => {
  it.each([
    [[true], false, 'first'],
    [[false, true], false, 'second'],
    [[false, false], false, 'shown'],
    [[], true, 'skipped'],
    [[false], true, 'skipped'],
  ])('%j 건너뜀=%s → %s', (tries, skipped, expected) => {
    expect(questionStatus(tries, skipped)).toBe(expected);
  });
});

describe('summarizeRound: 회차 요약', () => {
  it('한 번에·다시 해서 = done, 건너뜀 = skipped, 반응 시간은 첫 답 평균', () => {
    const items = [
      { status: 'first', reactionMs: 2000 },
      { status: 'second', reactionMs: 4000 },
      { status: 'shown', reactionMs: 3000 },
      { status: 'skipped', reactionMs: null },
      { status: 'first', reactionMs: 1001 },
    ];
    expect(summarizeRound(items)).toEqual({ total: 5, done: 3, skipped: 1, avgReactionMs: 2500 });
  });

  it('모두 건너뛰면 반응 시간은 null', () => {
    expect(summarizeRound([{ status: 'skipped', reactionMs: null }])).toEqual({
      total: 1,
      done: 0,
      skipped: 1,
      avgReactionMs: null,
    });
  });
});

describe('handFeedback: 지금 보이는 손 표시', () => {
  const opts = { now: 10_000, since: 8_000, holdMs: 1000 };

  it('손이 없으면 none', () => {
    expect(handFeedback(null, opts)).toEqual({ kind: 'none' });
    expect(handFeedback({ code: null, name: null, stableMs: 0 }, opts)).toEqual({ kind: 'none' });
  });

  it('가위바위보가 아닌 손모양이면 other', () => {
    expect(handFeedback({ code: '10000', name: 'THUMB', stableMs: 500 }, opts)).toEqual({ kind: 'other' });
    expect(handFeedback({ code: '10101', name: null, stableMs: 500 }, opts)).toEqual({ kind: 'other' });
  });

  it('문제가 나오기 전부터 들고 있던 손이면 old', () => {
    // 10초 - 2.5초 = 7.5초부터 들고 있음 → 문제(8초)보다 먼저
    expect(handFeedback({ code: '00000', name: 'ROCK', stableMs: 2500 }, opts)).toEqual({ kind: 'old', hand: 'ROCK' });
  });

  it('문제 뒤에 낸 손은 유지 비율을 보여 준다', () => {
    expect(handFeedback({ code: '00000', name: 'ROCK', stableMs: 400 }, opts)).toEqual({
      kind: 'holding',
      hand: 'ROCK',
      ratio: 0.4,
    });
    expect(handFeedback({ code: '11111', name: 'PAPER', stableMs: 1800 }, opts).ratio).toBe(1);
  });

  it('holding 이 1에 닿는 때 = waitForPose 확정 규칙과 같다', () => {
    // 확정 조건: stableMs >= holdMs 이고 now - stableMs >= since
    const pose = { code: '01100', name: 'V', stableMs: 1000 };
    expect(handFeedback(pose, { now: 9_000, since: 8_000, holdMs: 1000 })).toEqual({ kind: 'holding', hand: 'V', ratio: 1 });
    expect(handFeedback(pose, { now: 8_999, since: 8_000, holdMs: 1000 }).kind).toBe('old');
  });
});

describe('shouldShowNotice: 이상이 있을 때만 안내', () => {
  it.each([
    ['holding', 10_000, false], // 잘 되는 중에는 절대 안 띄움
    ['none', 2999, false], // 손을 아직 안 든 건 정상
    ['none', 3000, true],
    ['other', 999, false],
    ['other', 1000, true],
    ['old', 1000, true],
  ])('%s 가 %sms 계속 → %s', (kind, ms, expected) => {
    expect(shouldShowNotice(kind, ms)).toBe(expected);
  });
});

describe('isRpsHand', () => {
  it('가위·바위·보만 true', () => {
    expect(HANDS.every(isRpsHand)).toBe(true);
    expect(isRpsHand('THUMB')).toBe(false);
    expect(isRpsHand(null)).toBe(false);
  });
});

// ---------- 동시에 가위바위보 ----------
import {
  HANDS,
  QUICK_GAMES,
  EARLY_MS,
  quickTiming,
  makeQuickRound,
  timingOf,
  quickResult,
  quickMessage,
  timingText,
  summarizeQuick,
  seenText,
} from './logic.js';

describe('quickTiming: 동시에 가위바위보 시간 값', () => {
  it('난이도가 어려울수록 제때로 보는 시간이 짧다', () => {
    const e = quickTiming('easy', 'NORMAL').lateMs;
    const n = quickTiming('normal', 'NORMAL').lateMs;
    const h = quickTiming('hard', 'NORMAL').lateMs;
    expect(e).toBeGreaterThan(n);
    expect(n).toBeGreaterThan(h);
  });

  it('천천히면 확정 시간과 제때 시간이 더 길다', () => {
    const normal = quickTiming('normal', 'NORMAL');
    const slow = quickTiming('normal', 'SLOW');
    expect(slow.holdMs).toBeGreaterThan(normal.holdMs);
    expect(slow.lateMs).toBe(normal.lateMs + 500);
  });

  it('모르는 난이도는 쉬움으로', () => {
    expect(quickTiming('???', 'NORMAL')).toEqual(quickTiming('easy', 'NORMAL'));
  });
});

describe('makeQuickRound: 로봇이 낼 손 목록', () => {
  it('기본 판 수만큼, 모두 가위·바위·보', () => {
    const list = makeQuickRound();
    expect(list).toHaveLength(QUICK_GAMES);
    list.forEach((hand) => expect(HANDS).toContain(hand));
  });

  it('같은 손이 세 번 연달아 나오지 않는다 (rand 고정)', () => {
    const list = makeQuickRound(6, () => 0);
    for (let i = 2; i < list.length; i++) {
      expect(list[i] === list[i - 1] && list[i] === list[i - 2]).toBe(false);
    }
  });
});

describe('timingOf: "보!"에 맞춰 냈는지', () => {
  const goAt = 10_000;
  it.each([
    [goAt - EARLY_MS - 1, 'early'],
    [goAt - EARLY_MS, 'ontime'],
    [goAt, 'ontime'],
    [goAt + 1000, 'ontime'],
    [goAt + 1001, 'late'],
  ])('손 만든 시각 %d → %s', (formedAt, expected) => {
    expect(timingOf(formedAt, goAt, 1000)).toBe(expected);
  });
});

describe('quickResult: 한 판 결과', () => {
  const goAt = 10_000;
  const lateMs = 1000;

  it('제때 내면 승패를 정한다', () => {
    const r = quickResult({ robotHand: 'V', input: { hand: 'ROCK', formedAt: goAt + 400 }, goAt, lateMs });
    expect(r).toEqual({ timing: 'ontime', timingMs: 400, outcome: 'win' });
  });

  it('늦게 내면 승패를 따지지 않는다', () => {
    const r = quickResult({ robotHand: 'V', input: { hand: 'ROCK', formedAt: goAt + 1500 }, goAt, lateMs });
    expect(r).toEqual({ timing: 'late', timingMs: 1500, outcome: null });
  });

  it('너무 먼저 내도 승패를 따지지 않는다 (화면 버튼)', () => {
    const r = quickResult({ robotHand: 'V', input: { hand: 'PAPER', formedAt: goAt - 800 }, goAt, lateMs });
    expect(r.timing).toBe('early');
    expect(r.outcome).toBeNull();
  });

  it('확정된 손이 없고, "보!" 전부터 들고 있던 손이 보이면 early', () => {
    const now = goAt + 2000;
    const lastPose = { name: 'ROCK', stableMs: 3000 }; // goAt - 1000 에 만든 손
    expect(quickResult({ robotHand: 'V', input: null, goAt, lateMs, lastPose, now }).timing).toBe('early');
  });

  it('확정된 손이 없고, "보!" 뒤 늦게 만든 손이 보이면 late', () => {
    const now = goAt + 1600;
    const lastPose = { name: 'PAPER', stableMs: 200 }; // goAt + 1400 에 만든 손 (확정 전에 판이 끝남)
    expect(quickResult({ robotHand: 'V', input: null, goAt, lateMs, lastPose, now })).toEqual({
      timing: 'late',
      timingMs: 1400,
      outcome: null,
    });
  });

  it('확정된 손이 없고 손도 안 보이면 none', () => {
    const now = goAt + 2000;
    const lastPose = { name: null, stableMs: 0 };
    expect(quickResult({ robotHand: 'V', input: null, goAt, lateMs, lastPose, now }).timing).toBe('none');
    expect(quickResult({ robotHand: 'V', input: null, goAt, lateMs, now }).timing).toBe('none');
  });

  it('손은 보였지만 가위·바위·보로 확정되지 않으면 unclear ("손이 안 보였어요"가 아님)', () => {
    const now = goAt + 2000;
    // 다른 모양(검지 하나)으로 인식됨
    const other = { name: 'INDEX', code: '01000', stableMs: 500 };
    expect(quickResult({ robotHand: 'V', input: null, goAt, lateMs, lastPose: other, sawHand: true, now })).toEqual({
      timing: 'unclear',
      timingMs: null,
      outcome: null,
    });
    // 손을 냈다가 확정 전에 내림 → 마지막은 손 없음
    const gone = { name: null, code: null, stableMs: 0 };
    expect(quickResult({ robotHand: 'V', input: null, goAt, lateMs, lastPose: gone, sawHand: true, now }).timing).toBe('unclear');
  });

  it('마지막 손이 가위·바위·보면 손을 봤어도 early·late 로 알려 준다', () => {
    const now = goAt + 2000;
    const lastPose = { name: 'ROCK', code: '00000', stableMs: 3000 }; // "보!" 훨씬 전부터
    expect(quickResult({ robotHand: 'V', input: null, goAt, lateMs, lastPose, sawHand: true, now }).timing).toBe('early');
  });
});

describe('quickMessage: 결과 문구', () => {
  it('"실패"·"틀렸" 같은 말을 쓰지 않는다', () => {
    const cases = [
      { timing: 'ontime', outcome: 'win' },
      { timing: 'ontime', outcome: 'draw' },
      { timing: 'ontime', outcome: 'lose' },
      { timing: 'early', outcome: null },
      { timing: 'late', outcome: null },
      { timing: 'unclear', outcome: null },
      { timing: 'none', outcome: null },
    ];
    for (const c of cases) {
      const { text } = quickMessage(c);
      expect(text).toBeTruthy();
      expect(text).not.toMatch(/실패|틀렸/);
    }
  });

  it('이기면 good', () => {
    expect(quickMessage({ timing: 'ontime', outcome: 'win' }).tone).toBe('good');
  });

  it('손이 안 보인 것과 모양을 알아보지 못한 것은 다른 문구', () => {
    expect(quickMessage({ timing: 'none', outcome: null }).text).toContain('손이 보이지 않았어요');
    expect(quickMessage({ timing: 'unclear', outcome: null }).text).toContain('손 모양을 알아보지 못했어요');
  });
});

describe('seenText: 캠 화면 아래 "지금 보이는 손"', () => {
  it('손 없음 / 가위·바위·보 / 다른 모양', () => {
    expect(seenText(null)).toBe('손이 안 보여요');
    expect(seenText({ code: null, name: null })).toBe('손이 안 보여요');
    expect(seenText({ code: '00000', name: 'ROCK' })).toBe('✊ 바위');
    expect(seenText({ code: '01000', name: 'INDEX' })).toBe('가위·바위·보가 아닌 모양');
    expect(seenText({ code: '11001', name: null })).toBe('가위·바위·보가 아닌 모양');
  });
});

describe('timingText', () => {
  it.each([
    [-200, '“보!”와 거의 동시에'],
    [100, '“보!”와 거의 동시에'],
    [450, '“보!”에서 0.5초'],
    [1200, '“보!”에서 1.2초'],
    [null, ''],
  ])('%s → %s', (ms, text) => {
    expect(timingText(ms)).toBe(text);
  });
});

describe('summarizeQuick: 회차 요약', () => {
  it('제때 낸 판만 done·승패·평균에 넣고, 먼저 낸 시간은 0으로 센다', () => {
    const games = [
      { timing: 'ontime', timingMs: 400, outcome: 'win' },
      { timing: 'ontime', timingMs: -200, outcome: 'lose' },
      { timing: 'ontime', timingMs: 800, outcome: 'draw' },
      { timing: 'late', timingMs: 1500, outcome: null },
      { timing: 'none', timingMs: null, outcome: null },
    ];
    expect(summarizeQuick(games)).toEqual({
      total: 5,
      done: 3,
      skipped: 1,
      avgReactionMs: 400, // (400 + 0 + 800) / 3
      wins: 1,
      draws: 1,
      losses: 1,
    });
  });

  it('제때 낸 판이 없으면 평균은 null', () => {
    expect(summarizeQuick([{ timing: 'none', timingMs: null, outcome: null }]).avgReactionMs).toBeNull();
  });

  it('손 모양을 알아보지 못한 판(unclear)은 건너뜀(skipped)에 넣지 않는다', () => {
    const games = [
      { timing: 'unclear', timingMs: null, outcome: null },
      { timing: 'none', timingMs: null, outcome: null },
    ];
    expect(summarizeQuick(games)).toMatchObject({ total: 2, done: 0, skipped: 1 });
  });
});
