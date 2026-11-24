// 코스 끝 "오늘의 한마디" 만들기: 손 인식이 쉬는 중일 때만 AI 에게 묻고, 답을 검사해서 쓴다.
// 어떤 경우에도 인사 하나는 돌려준다 (AI 를 못 쓰면 미리 써 둔 인사). 화면이 멈추지 않게 오류를 던지지 않는다.

import { askLlm } from './llm.js';
import { buildMessages, cleanGreeting, checkGreeting, fallbackGreeting } from './greeting-logic.js';

const TAG = '[AI 인사]';

/**
 * @param o.summary    summarizeCourse() 결과
 * @param o.titleOf    프로그램 id → 화면 이름
 * @param o.name       호칭 (손님이면 null)
 * @param o.canUseAi   손 인식이 쉬는 중인지 (라즈베리파이 열: 손 인식과 AI 를 함께 돌리지 않는다)
 * @param o.ask        AI 묻기 함수 (시험에서 바꿀 수 있게. 기본 askLlm)
 * @returns {Promise<{ text: string, source: 'ai' | 'fallback', reason?: string }>}
 */
export async function makeCourseGreeting({ summary, titleOf, name = null, canUseAi, ask = askLlm }) {
  const fallback = (reason) => {
    console.info(`${TAG} 미리 써 둔 인사를 써요 (${reason})`);
    return { text: fallbackGreeting(summary), source: 'fallback', reason };
  };
  try {
    if (!canUseAi()) return fallback('손 인식 중');
    const raw = await ask(buildMessages({ summary, titleOf, name }));
    if (raw === null) return fallback('AI 서버 없음·시간 초과');
    const text = cleanGreeting(raw);
    const check = checkGreeting(text);
    if (!check.ok) {
      console.info(`${TAG} AI 답을 쓰지 않아요: ${check.reason}${check.word ? ` "${check.word}"` : ''} — ${text}`);
      return fallback(`검사 ${check.reason}`);
    }
    return { text, source: 'ai' };
  } catch (err) {
    console.error(`${TAG} 오류`, err);
    return fallback('오류');
  }
}
