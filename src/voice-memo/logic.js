// 보호자에게 남길 한마디 (시제품, 팀 확인 전). 순수 함수만 둔다 (DOM·마이크 사용 금지).
//
// 시제품 범위: 코스 끝에 녹음 → 다시 듣기 → 이 기기(스테이션)에만 저장. 보호자 폰으로 보내지 않는다.
// 보내기는 동의서(#83)·보호자 앱 설계(docs/guardian-app.md: "Supabase 에는 활동 요약만")를 팀이 바꾼 뒤에 만든다.

/** 한 번에 녹음할 수 있는 가장 긴 시간 */
export const MAX_RECORD_MS = 20000;

/** 사용자마다 기기에 남겨 두는 한마디 수. 넘으면 오래된 것부터 지운다 (목소리가 계속 쌓이지 않게) */
export const KEEP_PER_USER = 3;

/**
 * 코스 끝에 "가족에게 한마디 남기기"를 보여 줄지.
 * 로그인한 분만 (손님은 연결된 보호자가 없다). summary: summarizeCourse() 결과
 */
export function canOfferMemo(summary) {
  return Boolean(summary && summary.userId);
}

/** 0:05 처럼 분:초 */
export function clockText(ms) {
  const sec = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

/** 녹음 중 남은 시간 글자: "0:05 / 0:20" */
export function progressText(elapsedMs, maxMs = MAX_RECORD_MS) {
  return `${clockText(Math.min(elapsedMs, maxMs))} / ${clockText(maxMs)}`;
}

/**
 * 브라우저가 녹음할 수 있는 형식 고르기. isSupported: MediaRecorder.isTypeSupported
 * Chrome·Chromium 은 webm/opus. 모두 안 되면 '' (브라우저 기본값)
 */
export function pickMimeType(isSupported) {
  const list = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  return list.find((t) => isSupported(t)) ?? '';
}

/**
 * 마이크 고르기: 자브라 스피커폰이 있으면 그것, 없으면 기본 마이크(null).
 * devices: navigator.mediaDevices.enumerateDevices() 결과 (마이크 허락 전에는 label 이 비어 있다)
 */
export function pickMicId(devices) {
  const mics = devices.filter((d) => d.kind === 'audioinput');
  const jabra = mics.find((d) => /jabra|speak 510/i.test(d.label ?? ''));
  return jabra ? jabra.deviceId : null;
}

/**
 * 저장할 때 지울 한마디 고르기: 같은 사용자 것 중 최근 keep 개만 남긴다.
 *   memos: [{ id, userId, createdAt }], 반환: 지울 id 목록
 */
export function memosToDrop(memos, userId, keep = KEEP_PER_USER) {
  return memos
    .filter((m) => m.userId === userId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(keep)
    .map((m) => m.id);
}

/** 저장할 한마디 정보 (녹음 파일 blob 은 따로 붙인다) */
export function memoMeta({ summary, durationMs, mimeType, now = new Date() }) {
  const createdAt = now.toISOString();
  return {
    id: `memo-${createdAt}`,
    userId: summary.userId,
    courseId: summary.courseId,
    createdAt,
    durationMs: Math.round(durationMs),
    mimeType,
    sent: false, // 보호자 폰으로 보냈는지 (시제품에서는 늘 false)
  };
}
