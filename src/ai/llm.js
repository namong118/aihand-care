// 오프라인 AI(작은 언어 모델) 부르기. 라즈베리파이 안에서 도는 llama.cpp 서버(llama-server)에 묻는다.
// 인터넷을 쓰지 않는다: 앱 → /ai (Vite 서버가 같은 기기의 127.0.0.1:8080 으로 넘김, vite.config.js) → llama-server
// 서버가 없거나(노트북·배포 주소) 느리거나 오류면 null → 미리 써 둔 인사를 쓴다. 설치: docs/ai-greeting.md

/** llama-server 의 OpenAI 형식 대화 주소 (vite.config.js 의 /ai 넘기기) */
export const AI_URL = '/ai/v1/chat/completions';

/**
 * 이 시간 안에 답이 없으면 포기하고 미리 써 둔 인사를 쓴다.
 * 노트북(2026-11-24, Kanana 1.5 2.1B Q4, CPU 3개) 중간값 4.7초·첫 번째 14초. 라즈베리파이 5는 더 느릴 것 [검증 필요]
 */
export const AI_TIMEOUT_MS = 20000;

/**
 * 대화(messages)를 보내고 답 글자를 받는다. 실패하면 null (오류를 던지지 않는다)
 * @param {Array<{ role, content }>} messages
 * @param {{ timeoutMs?: number, fetchFn?: typeof fetch }} [o]
 */
export async function askLlm(messages, { timeoutMs = AI_TIMEOUT_MS, fetchFn = globalThis.fetch } = {}) {
  if (typeof fetchFn !== 'function') return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchFn(AI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // 짧은 인사만: 토큰 수를 제한해서 오래 계산하지 않게 한다 (라즈베리파이 열)
      body: JSON.stringify({ messages, max_tokens: 80, temperature: 0.7 }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    return typeof text === 'string' ? text : null;
  } catch {
    return null; // 서버 없음·시간 초과·형식 오류
  } finally {
    clearTimeout(timer);
  }
}
