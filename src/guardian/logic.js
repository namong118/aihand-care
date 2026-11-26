// 보호자 앱(#62) 스테이션 쪽 순수 함수: 연결 코드, QR 주소, 보낼지 판단, 대기열.
// DOM·localStorage·네트워크를 쓰지 않는다. 그래서 logic.test.js 로 모두 시험할 수 있다.
// 설계: docs/guardian-app.md 2번(연결 코드), 4번(보내는 데이터), 5번(대기열·Mock)

/** 스테이션 localStorage 키 */
export const OUTBOX_KEY = 'aihand-care.outbox.v1'; // 보낼 것 대기열
export const PAIRINGS_KEY = 'aihand-care.pairings.v1'; // 연결 목록 [{ code, userId, createdAt }]
export const FAILED_KEY = 'aihand-care.outbox-failed.v1'; // 다시 보내도 안 되는 것을 빼 둔 곳 (최근 FAILED_MAX 개)

/** QR 주소의 앞부분. 폰은 라즈베리파이(127.0.0.1)를 열 수 없으므로 언제나 GitHub Pages 배포 주소 */
export const APP_BASE = 'https://namong118.github.io/aihand-care/';

// ---- 연결 코드 ----

/** 연결 코드에 쓰는 31글자: 헷갈리는 0·O·1·I·L을 뺐다 */
export const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 12;

/**
 * 연결 코드 12글자를 만든다 (예: 'ABCDEFGHJKMN').
 * fillRandom: 배열을 무작위 숫자로 채우는 함수. 실제로는 (a) => crypto.getRandomValues(a),
 *   테스트에서는 정해진 숫자를 넣는 함수를 넘긴다.
 * 32비트 숫자를 31로 나눈 나머지를 쓴다 (치우침은 1억분의 1 정도라 무시해도 된다).
 */
export function makeCode(fillRandom) {
  const nums = new Uint32Array(CODE_LENGTH);
  fillRandom(nums);
  let code = '';
  for (const n of nums) code += CODE_CHARS[n % CODE_CHARS.length];
  return code;
}

/** 연결 코드가 맞는 모양인지 (12글자, CODE_CHARS 글자만) */
export function isValidCode(code) {
  if (typeof code !== 'string' || code.length !== CODE_LENGTH) return false;
  return [...code].every((c) => CODE_CHARS.includes(c));
}

/** 화면에 보여 줄 모양: 'ABCDEFGHJKMN' → 'ABCD-EFGH-JKMN' */
export function formatCode(code) {
  return String(code).match(/.{1,4}/g)?.join('-') ?? '';
}

/**
 * QR에 넣을 주소: <배포 base>guardian/#c=CODE&n=호칭
 * '#' 뒤는 서버로 가지 않으므로 호칭은 폰에만 전해진다 (설계 3번)
 */
export function pairingUrl(code, displayName, base = APP_BASE) {
  const root = base.endsWith('/') ? base : `${base}/`;
  return `${root}guardian/#c=${code}&n=${encodeURIComponent(displayName)}`;
}

/** QR 주소에서 코드와 호칭을 꺼낸다. 없으면 null (drawQr Mock, 나중에 폰 앱에서도 쓴다) */
export function parsePairingUrl(url) {
  const hash = String(url).split('#')[1];
  if (!hash) return { code: null, name: null };
  const params = new URLSearchParams(hash);
  return { code: params.get('c'), name: params.get('n') };
}

// ---- 진짜로 보낼지, Mock 인지 ----

export const ENV_NAMES = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_STATION_KEY'];

/**
 * 세 값 중 하나라도 없으면 Mock (보내지 않고 "보낸 것처럼" 처리).
 * env: import.meta.env 같은 객체
 * 반환: { mock, missing } missing 은 빠진 이름 목록 (콘솔 안내용, 값 자체는 담지 않는다)
 */
export function sendMode(env = {}) {
  const missing = ENV_NAMES.filter((name) => !env[name]);
  return { mock: missing.length > 0, missing };
}

// ---- 코스 요약을 보낼지 ----

/**
 * 보내지 않는 경우 (설계 5번 "언제 보내나")
 *   손님(userId: null), 로그인 기능 전 코스(who: 'unknown'), 보호자 앱을 연결하지 않은 분
 * 반환: { send: true } 또는 { send: false, reason }
 */
export function shouldSend(summary, pairings) {
  if (!summary || typeof summary !== 'object' || !summary.courseId) return { send: false, reason: 'no-summary' };
  if (summary.who === 'unknown') return { send: false, reason: 'unknown' };
  if (!summary.userId) return { send: false, reason: 'guest' };
  if (!pairings.some((p) => p.userId === summary.userId)) return { send: false, reason: 'no-pairing' };
  return { send: true };
}

/** 보내지 않는 이유를 콘솔에 남길 때 쓰는 말 */
export const SKIP_TEXT = {
  'no-summary': '요약이 비어 있어요',
  unknown: '로그인 기능 전 코스예요',
  guest: '손님 코스예요',
  'no-pairing': '보호자 앱을 연결하지 않은 분이에요',
};

// ---- 연결 목록 ----

/** 그 사용자의 연결 목록, 먼저 연결한 것부터 */
export function pairingsOf(pairings, userId) {
  return pairings
    .filter((p) => p.userId === userId)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

export function addPairing(pairings, pairing) {
  return [...pairings, pairing];
}

export function removePairing(pairings, code) {
  return pairings.filter((p) => p.code !== code);
}

export function removeUserPairings(pairings, userId) {
  return pairings.filter((p) => p.userId !== userId);
}

// ---- 대기열 ----
// 한 칸: { id, kind, userId, courseId?, code?, payload?, addedAt, tries, lastTriedAt, lastError }
// id 는 같은 일을 두 번 넣지 않으려고 쓴다 (요약은 courseId 로 중복을 막는다)

export const KINDS = ['pairing', 'summary', 'revoke', 'forget'];

/**
 * 보내는 순서. 숫자가 작을수록 먼저.
 *   pairing(연결 코드)이 먼저 가야 Supabase가 summary(요약)를 받아 준다.
 *   revoke(연결 끊기)는 그 전 요약 뒤에, forget(사용자 지우기)은 맨 마지막에.
 */
const ORDER = { pairing: 0, summary: 1, revoke: 2, forget: 3 };

function item(fields, now) {
  return { ...fields, addedAt: new Date(now).toISOString(), tries: 0, lastTriedAt: null, lastError: null };
}

export function pairingItem({ code, userId }, now) {
  return item({ id: `pairing:${code}`, kind: 'pairing', userId, code }, now);
}

export function summaryItem(summary, now) {
  const { userId, courseId } = summary;
  return item({ id: `summary:${userId}:${courseId}`, kind: 'summary', userId, courseId, payload: summary }, now);
}

/** userId 는 Supabase로 보내지 않는다. 사용자를 지울 때 대기열에서 함께 빼려고 둔다 */
export function revokeItem({ code, userId }, now) {
  return item({ id: `revoke:${code}`, kind: 'revoke', userId, code }, now);
}

export function forgetItem(userId, now) {
  return item({ id: `forget:${userId}`, kind: 'forget', userId }, now);
}

/** 대기열에 넣는다. 같은 id 가 이미 있으면 그대로 둔다 (같은 코스를 두 번 넣지 않음) */
export function enqueue(outbox, newItem) {
  if (outbox.some((it) => it.id === newItem.id)) return outbox;
  return [...outbox, newItem];
}

/** 보낼 순서대로 (종류 순서 → 넣은 시각 순서) */
export function orderOutbox(outbox) {
  return [...outbox].sort(
    (a, b) => ORDER[a.kind] - ORDER[b.kind] || String(a.addedAt).localeCompare(String(b.addedAt)),
  );
}

/** 보내기 성공: 대기열에서 뺀다 */
export function markSent(outbox, id) {
  return outbox.filter((it) => it.id !== id);
}

/** 보내기 실패: 남겨 두고 tries 를 올린다 */
export function markFailed(outbox, id, now, error) {
  return outbox.map((it) =>
    it.id === id
      ? { ...it, tries: it.tries + 1, lastTriedAt: new Date(now).toISOString(), lastError: String(error ?? '') }
      : it,
  );
}

/**
 * 사용자 지우기: 아직 못 보낸 그 사람의 일(연결·요약·끊기)은 빼고, 지우기 요청 하나만 넣는다.
 * Supabase 쪽 forget_user 가 그 사람의 연결과 요약을 모두 지운다.
 */
export function forgetInOutbox(outbox, userId, now) {
  return enqueue(
    outbox.filter((it) => it.userId !== userId),
    forgetItem(userId, now),
  );
}

/**
 * 대기열을 순서대로 보낸다.
 *   성공한 칸은 빼고, 하나라도 실패하면 거기서 멈춘다 (남은 것은 다음 시도에).
 *   멈추는 이유: 실패는 대개 인터넷이 끊겼거나 비밀값이 틀린 것이라 뒤의 것도 실패한다.
 *   그리고 연결 코드(pairing)가 못 갔는데 요약(summary)을 먼저 보내면 Supabase가 받지 않는다.
 * 다만 다시 보내도 똑같이 안 되는 에러(err.permanent, 400·409)는 그 칸만 빼서 drop(칸, 에러)에 넘기고
 *   다음 칸을 계속 보낸다. 그 한 칸 때문에 다른 분들 요약이 막히지 않게 (2026-11-22 결정 A).
 * localStorage·네트워크는 인자로 받는다 (테스트에서는 가짜를 넘긴다).
 *   load() → 대기열, save(대기열), send(칸) → 성공하면 resolve, 실패하면 reject, now() → ms
 *   drop(칸, 에러) → 빼 둔 칸을 보관 (없으면 버린다)
 * 보내는 동안 새로 들어온 칸을 잃지 않도록 칸마다 load() 로 다시 읽는다.
 * 반환: { sent, dropped, failed, error } 보낸 수, 빼 둔 수, 멈춘 칸(없으면 null)과 그 에러 글자
 */
export async function flushOutbox({ load, save, send, now, drop = () => {} }) {
  const tried = new Set();
  let sent = 0;
  let dropped = 0;
  for (;;) {
    const next = orderOutbox(load()).find((it) => !tried.has(it.id));
    if (!next) return { sent, dropped, failed: null, error: null };
    tried.add(next.id);
    try {
      await send(next);
      save(markSent(load(), next.id));
      sent += 1;
    } catch (err) {
      const message = String(err?.message ?? err);
      if (err?.permanent) {
        save(markSent(load(), next.id));
        drop(next, message);
        dropped += 1;
        continue;
      }
      save(markFailed(load(), next.id, now(), message));
      return { sent, dropped, failed: next, error: message };
    }
  }
}

// ---- Supabase 로 보내기 (설계 4번 "표"의 스테이션 함수 4개) ----

/**
 * RPC 주소: https://xxx.supabase.co + register_pairing → https://xxx.supabase.co/rest/v1/rpc/register_pairing
 * Supabase 화면에서 주소를 '…/rest/v1/'까지 복사해 넣어도 맞게, 끝의 /rest/v1 은 뗀다.
 */
export function rpcUrl(baseUrl, name) {
  const root = String(baseUrl).replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
  return `${root}/rest/v1/rpc/${name}`;
}

/**
 * 대기열 한 칸 → 부를 함수 이름과 보낼 값. 모든 스테이션 함수는 첫 값으로 비밀값을 받는다.
 * 보낼 값은 설계 4번 표에 적은 것만: revoke 칸의 userId 는 스테이션 안에서만 쓰고 보내지 않는다.
 */
export function rpcRequest(item, stationKey) {
  switch (item.kind) {
    case 'pairing':
      return { name: 'register_pairing', body: { station_key: stationKey, code: item.code, user_id: item.userId } };
    case 'summary':
      return { name: 'push_summary', body: { station_key: stationKey, user_id: item.userId, summary: item.payload } };
    case 'revoke':
      return { name: 'revoke_pairing', body: { station_key: stationKey, code: item.code } };
    case 'forget':
      return { name: 'forget_user', body: { station_key: stationKey, user_id: item.userId } };
    default:
      throw new Error(`모르는 종류: ${item.kind}`);
  }
}

/**
 * 다시 보내도 똑같이 안 되는 응답인지.
 *   400 모양이 맞지 않음 (22023), 409 연결 코드가 다른 분께 이미 쓰임 (23505)
 * 나머지(403 비밀값, 404 함수 없음, 5xx, 인터넷 끊김)는 고치면 되니 대기열에 남겨 다시 보낸다.
 */
export function isPermanentStatus(status) {
  return status === 400 || status === 409;
}

/** 응답 상태 → 콘솔에 남길 안내 (Supabase 가 준 message 를 덧붙인다) */
export function sendErrorText(status, message = '') {
  const lead =
    {
      400: '보낸 값의 모양이 맞지 않아요',
      403: '스테이션 비밀값이 맞지 않아요 (.env.local VITE_STATION_KEY 와 Supabase station_keys 확인)',
      404: 'Supabase 에서 함수를 찾지 못했어요 (주소나 schema.sql 확인)',
      409: '연결 코드가 다른 분께 이미 쓰였어요',
    }[status] ?? `Supabase 가 답하지 않아요 (HTTP ${status})`;
  return message && !lead.includes(message) ? `${lead}: ${message}` : lead;
}

// ---- 빼 둔 것 (FAILED_KEY) ----

export const FAILED_MAX = 20;

/** 빼 둔 칸 보관: 에러와 시각을 붙이고, 오래된 것부터 지워 FAILED_MAX 개만 남긴다 */
export function addFailed(list, item, error, now) {
  const entry = { ...item, failedAt: new Date(now).toISOString(), error: String(error ?? '') };
  return [...list, entry].slice(-FAILED_MAX);
}

/** outboxStatus() 의 모양. failed 는 다시 보내도 안 돼서 빼 둔 수 */
export function outboxStatusOf(outbox, { lastSentAt = null, mock, failed = 0 }) {
  return { waiting: outbox.length, lastSentAt, mock, failed };
}

// ---- 저장된 값 읽기 (깨졌으면 빈 목록) ----

function parseList(raw) {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** localStorage 에서 읽은 글자 → 대기열. 모양이 틀린 칸은 버린다 */
export function parseOutbox(raw) {
  return parseList(raw)
    .filter((it) => it && typeof it === 'object' && typeof it.id === 'string' && KINDS.includes(it.kind))
    .map((it) => ({ ...it, tries: Number.isInteger(it.tries) ? it.tries : 0 }));
}

/** localStorage 에서 읽은 글자 → 빼 둔 목록. 모양이 틀린 칸은 버린다 */
export function parseFailed(raw) {
  return parseList(raw).filter((it) => it && typeof it === 'object' && KINDS.includes(it.kind));
}

/** localStorage 에서 읽은 글자 → 연결 목록. 모양이 틀린 칸은 버린다 */
export function parsePairings(raw) {
  return parseList(raw).filter(
    (p) => p && typeof p === 'object' && isValidCode(p.code) && typeof p.userId === 'string' && p.userId,
  );
}
