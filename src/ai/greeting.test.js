import { describe, it, expect, vi } from 'vitest';
import { makeCourseGreeting } from './greeting.js';
import { askLlm } from './llm.js';
import { FALLBACK_GREETINGS, FALLBACK_ALL_DONE } from './greeting-logic.js';

const titleOf = (id) => ({ 'step4-coach': '손운동', 'step2-rps': '가위바위보' })[id] ?? id;
const summary = { finished: false, activities: [{ program: 'step4-coach', status: 'played' }] };
const FALLBACKS = [...FALLBACK_GREETINGS, ...FALLBACK_ALL_DONE];

vi.spyOn(console, 'info').mockImplementation(() => {});

describe('makeCourseGreeting', () => {
  it('손 인식이 쉬는 중이고 AI 답이 괜찮으면 AI 인사', async () => {
    const ask = vi.fn(async () => '"오늘 손운동을 함께해서 즐거웠어요. 다음에 또 만나요!"');
    const g = await makeCourseGreeting({ summary, titleOf, canUseAi: () => true, ask });
    expect(g).toEqual({ text: '오늘 손운동을 함께해서 즐거웠어요. 다음에 또 만나요!', source: 'ai' });
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('손 인식 중이면 AI 에게 묻지 않는다 (라즈베리파이 열)', async () => {
    const ask = vi.fn();
    const g = await makeCourseGreeting({ summary, titleOf, canUseAi: () => false, ask });
    expect(ask).not.toHaveBeenCalled();
    expect(g.source).toBe('fallback');
    expect(FALLBACKS).toContain(g.text);
  });

  it('AI 가 건강 조언·효과를 말하면 버리고 미리 써 둔 인사', async () => {
    const ask = async () => '오늘 활동이 치매 예방에 도움이 될 거예요!';
    const g = await makeCourseGreeting({ summary, titleOf, canUseAi: () => true, ask });
    expect(g.source).toBe('fallback');
    expect(g.reason).toContain('banned');
    expect(FALLBACKS).toContain(g.text);
  });

  it('AI 서버가 없거나 오류여도 인사는 나온다', async () => {
    const none = await makeCourseGreeting({ summary, titleOf, canUseAi: () => true, ask: async () => null });
    expect(none.source).toBe('fallback');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const thrown = await makeCourseGreeting({
      summary,
      titleOf,
      canUseAi: () => true,
      ask: async () => {
        throw new Error('x');
      },
    });
    expect(thrown.source).toBe('fallback');
  });
});

describe('askLlm', () => {
  it('OpenAI 형식 답에서 글자를 꺼낸다', async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: '안녕하세요' } }] }) }));
    expect(await askLlm([{ role: 'user', content: 'x' }], { fetchFn })).toBe('안녕하세요');
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('/ai/v1/chat/completions');
    expect(JSON.parse(init.body).max_tokens).toBe(80);
  });

  it('서버 오류·연결 실패·이상한 형식이면 null', async () => {
    expect(await askLlm([], { fetchFn: async () => ({ ok: false }) })).toBeNull();
    expect(await askLlm([], { fetchFn: async () => { throw new Error('ECONNREFUSED'); } })).toBeNull();
    expect(await askLlm([], { fetchFn: async () => ({ ok: true, json: async () => ({}) }) })).toBeNull();
  });

  it('시간이 지나면 멈추고 null', async () => {
    const fetchFn = (url, { signal }) =>
      new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));
    expect(await askLlm([], { fetchFn, timeoutMs: 10 })).toBeNull();
  });
});
