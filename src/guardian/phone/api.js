// 보호자 폰 앱: Supabase 에서 요약 읽기 (supabase-js 없이 fetch 만, docs/decisions.md 4번)
// 폰 앱은 주소와 공개 키만 쓴다. 스테이션 비밀값(VITE_STATION_KEY)은 쓰지 않는다.
// ⚠️ import.meta.env 를 통째로 넘기지 않는다: 통째로 쓰면 빌드 파일에 모든 VITE_ 값이 들어간다.

import { rpcUrl, parseSummaries } from './logic.js';

const CONFIG = {
  url: import.meta.env.VITE_SUPABASE_URL,
  key: import.meta.env.VITE_SUPABASE_ANON_KEY,
};

/** 주소·공개 키가 있으면 true. 없으면 진짜 기록을 읽을 수 없다 (#demo 예시는 된다) */
export function hasApi() {
  return Boolean(CONFIG.url && CONFIG.key);
}

/**
 * 그 연결 코드에 묶인 분의 요약 목록 (최근 것부터). 끊긴 코드·모르는 코드는 빈 목록.
 * 인터넷이 없거나 서버가 답하지 않으면 에러를 낸다.
 */
export async function fetchSummaries(code) {
  const res = await fetch(rpcUrl(CONFIG.url, 'get_summaries'), {
    method: 'POST',
    headers: { apikey: CONFIG.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`요약을 읽지 못했어요 (HTTP ${res.status})`);
  return parseSummaries(await res.json());
}
