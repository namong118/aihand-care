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
