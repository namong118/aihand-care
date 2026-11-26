import { describe, it, expect } from 'vitest';
import {
  BANNED_WORDS,
  cleanGreeting,
  checkGreeting,
  FALLBACK_GREETINGS,
  FALLBACK_ALL_DONE,
  fallbackGreeting,
  buildMessages,
} from './greeting-logic.js';

const titleOf = (id) => ({ 'step4-coach': '손운동', 'step2-rps': '가위바위보', 'step1-memory': '숫자 기억', 'step3-stroop': '색깔손' })[id];
const all = (status = 'played') => ({
  finished: true,
  activities: ['step4-coach', 'step2-rps', 'step1-memory', 'step3-stroop'].map((program) => ({ program, status })),
});

describe('cleanGreeting: AI 답 다듬기', () => {
  it('따옴표·그림 글자·머리말·줄바꿈을 정리한다', () => {
    expect(cleanGreeting('인사: "오늘 함께해서 즐거웠어요! 🙂\n다음에 또 만나요."')).toBe('오늘 함께해서 즐거웠어요! 다음에 또 만나요.');
  });
  it('앞의 두 문장까지만', () => {
    expect(cleanGreeting('고마워요. 즐거웠어요. 또 만나요. 안녕히 가세요.')).toBe('고마워요. 즐거웠어요.');
  });
  it('빈 값', () => {
    expect(cleanGreeting(null)).toBe('');
  });
});

describe('checkGreeting: 금지어·형식 검사', () => {
  it('따뜻한 인사는 통과', () => {
    expect(checkGreeting('오늘 함께해 주셔서 고마워요. 다음에 또 만나요!')).toEqual({ ok: true });
  });

  it('지어낸 건강 조언·효과 주장은 버린다', () => {
    const bad = [
      '오늘 활동으로 치매 예방에 도움이 될 거예요!',
      '손운동은 건강에 좋아요. 또 만나요!',
      '기억력이 좋아지셨네요. 고마워요!',
      '두뇌가 튼튼해지는 시간이었어요.',
      '꾸준히 하시면 효과가 있을 거예요.',
      '혈압 약을 잘 챙겨 드세요.',
    ];
    for (const text of bad) expect(checkGreeting(text)).toMatchObject({ ok: false, reason: 'banned' });
  });

  it('점수·평가처럼 들리는 말도 버린다', () => {
    expect(checkGreeting('오늘 점수가 아주 높아요!')).toMatchObject({ ok: false, reason: 'banned' });
    expect(checkGreeting('조금 부족했지만 괜찮아요.')).toMatchObject({ ok: false, reason: 'banned' });
    expect(checkGreeting('정말 잘하셨어요! 다음에 봐요.')).toMatchObject({ ok: false, reason: 'banned' });
  });

  it('띄어 써도 금지어를 찾는다 (실제 모델 답: "즐겁게 잘 하셨어요")', () => {
    expect(checkGreeting('오늘 활동 즐겁게 잘 하셨어요. 다음에도 꼭 다시 만나요!')).toMatchObject({ ok: false, reason: 'banned', word: '잘하셨' });
    expect(checkGreeting('오늘 활동이 도움이  되었길 바라요.')).toMatchObject({ ok: false, reason: 'banned' });
  });

  it('숫자·영어·한자가 섞이면 버린다', () => {
    expect(checkGreeting('오늘 4개 활동을 함께했어요.')).toMatchObject({ ok: false, reason: 'number' });
    expect(checkGreeting('Thank you 오늘 즐거웠어요!')).toMatchObject({ ok: false, reason: 'not-korean' });
    expect(checkGreeting('오늘 즐거웠어요 再見!')).toMatchObject({ ok: false, reason: 'not-korean' });
  });

  it('너무 짧거나 길면 버린다', () => {
    expect(checkGreeting('')).toMatchObject({ ok: false, reason: 'empty' });
    expect(checkGreeting('안녕')).toMatchObject({ ok: false, reason: 'short' });
    expect(checkGreeting('즐거웠어요 '.repeat(20).trim())).toMatchObject({ ok: false, reason: 'long' });
  });
});

describe('미리 써 둔 인사', () => {
  it('모두 검사를 통과한다 (금지어 없음)', () => {
    for (const text of [...FALLBACK_GREETINGS, ...FALLBACK_ALL_DONE]) expect(checkGreeting(text)).toEqual({ ok: true });
  });

  it('네 가지를 모두 했을 때만 "모두 함께" 인사가 섞인다', () => {
    expect(FALLBACK_ALL_DONE).toContain(fallbackGreeting(all(), () => 0));
    const some = { finished: false, activities: [{ program: 'step4-coach', status: 'played' }, { program: 'step2-rps', status: 'skipped' }] };
    for (const r of [0, 0.3, 0.6, 0.99]) expect(FALLBACK_GREETINGS).toContain(fallbackGreeting(some, () => r));
  });

  it('금지어 목록이 비어 있지 않다', () => {
    expect(BANNED_WORDS.length).toBeGreaterThan(20);
  });
});

describe('buildMessages: AI 에게 보낼 대화', () => {
  it('활동 이름과 호칭만 넣고 숫자는 넣지 않는다', () => {
    const summary = {
      ...all(),
      activities: all().activities.map((a) => ({ ...a, done: 3, total: 5, avgReactionMs: 1200 })),
    };
    const [system, user] = buildMessages({ summary, titleOf, name: '햇살' });
    expect(system.role).toBe('system');
    expect(system.content).toContain('건강');
    expect(user.content).toContain('손운동, 가위바위보, 숫자 기억, 색깔손');
    expect(user.content).toContain('호칭: 햇살');
    expect(user.content).toContain('모두 함께했다');
    expect(user.content).not.toMatch(/[0-9]/);
  });

  it('건너뛴 활동은 넣지 않고, 손님이면 호칭이 없다', () => {
    const summary = { finished: false, activities: [{ program: 'step4-coach', status: 'played' }, { program: 'step2-rps', status: 'skipped' }] };
    const [, user] = buildMessages({ summary, titleOf });
    expect(user.content).toContain('오늘 함께한 활동: 손운동');
    expect(user.content).not.toContain('가위바위보');
    expect(user.content).not.toContain('호칭');
  });
});
