// 얼굴 로그인: 얼굴 번호 확정과 사용자 찾기 (순수 함수, DOM·ctx 사용 금지)
//
// WonderCam이 알려 주는 얼굴 번호(ctx.card.onFace → { faceId })는 프레임마다 튈 수 있다.
//   faceId: 학습된 얼굴 번호, 모르는 얼굴이면 'unknown', 안 보이면 null
// 같은 번호가 FACE_HOLD_MS 이상 이어질 때만 그 사람으로 확정한다.
// (손모양 확정 src/core/hand/wait.js 와 같은 원리: 바뀌면 처음부터 다시 잰다)
// #76 실물 확인 (2026-11-15):
//   - 얼굴이 보이는 동안에도 0.24~0.6초짜리 'unknown'·null 이 끼어든다
//     → 번호를 세는 중에 BLIP_MS 이하로 잠깐 끼는 'unknown'·null 은 무시하고 이어 센다
//   - 비슷한 얼굴은 1↔2 가 번갈아 나온다 → 다른 번호로 바뀌면 지금처럼 처음부터 다시 (다른 사람으로 확정되지 않게)
//
// 쓰는 법 (화면 쪽)
//   let state = startFace();
//   onFace(({ faceId }) => { state = trackFace(state, faceId, Date.now()); });
//   // 번호는 바뀔 때만 오므로, 확정은 타이머로도 확인한다
//   setInterval(() => { const r = judgeFace(state, Date.now(), users); ... }, 100);

/** 같은 얼굴 번호가 이만큼(ms) 이어지면 확정. 실물 테스트 때 조정 */
export const FACE_HOLD_MS = 1500;

/** 번호를 세는 중 이보다 짧게 끼는 'unknown'·null 은 무시한다 (#76: 0.24~0.6초짜리가 끼어듦) */
export const BLIP_MS = 500;

/** 모르는 얼굴을 뜻하는 값 (WonderCam 'FACE,UNKNOWN') */
export const UNKNOWN_FACE = 'unknown';

/**
 * 재기 시작 상태: 아직 아무 얼굴도 안 보임
 *   faceId, since: 지금 세고 있는 값과 처음 본 시각
 *   gap: 번호를 세는 중 끼어든 'unknown'·null ({ faceId, since }). BLIP_MS 가 지나야 진짜로 바뀐 것으로 친다
 */
export function startFace() {
  return { faceId: null, since: null, gap: null };
}

/**
 * 새 입력을 받아 다음 상태를 만든다.
 *   같은 값이 이어지면 since 를 그대로 둔다
 *   번호를 세는 중에 'unknown'·null 이 오면 바로 바꾸지 않고 gap 으로 둔다. BLIP_MS 안에 같은 번호가 다시 오면 이어 센다
 *   그 밖에 바뀌면(다른 번호 등) 지금부터 다시 잰다
 */
export function trackFace(state, faceId, now) {
  const id = faceId ?? null;
  const s = settleFace(state, now);
  if (s && s.since !== null && sameFace(s.faceId, id)) return s.gap ? { ...s, gap: null } : s;
  if (s && s.since !== null && isNumber(s.faceId) && !isNumber(id)) {
    return { ...s, gap: { faceId: id, since: s.gap ? s.gap.since : now } };
  }
  return { faceId: id, since: now, gap: null };
}

/** gap 이 BLIP_MS 넘게 이어졌으면 그 값으로 바뀐 것으로 친다 (그 값을 처음 본 시각부터) */
export function settleFace(state, now) {
  if (!state || !state.gap || now - state.gap.since <= BLIP_MS) return state;
  return { faceId: state.gap.faceId, since: state.gap.since, gap: null };
}

/** 지금 값이 이어진 시간(ms). 안 보이면(null) 0 */
export function heldMs(state, now) {
  const s = settleFace(state, now);
  if (!s || s.faceId === null || s.since === null) return 0;
  return Math.max(0, now - s.since);
}

/** 사용자 목록에서 얼굴 번호로 찾기. 없으면 null */
export function findUserByFace(users, faceId) {
  if (faceId === null || faceId === undefined || faceId === UNKNOWN_FACE) return null;
  return users.find((u) => u.faceId !== null && u.faceId !== undefined && sameFace(u.faceId, faceId)) ?? null;
}

/**
 * 지금 상태 판단
 *   { status: 'waiting' }        아직 확정 전 (안 보임, 바뀌는 중, 1.5초 안 됨)
 *   { status: 'user', user }     등록된 사용자로 확정
 *   { status: 'unknown' }        모르는 얼굴, 또는 등록 안 된 번호로 확정
 * users: [{ userId, displayName, faceId, consentAt }]
 */
export function judgeFace(state, now, users, holdMs = FACE_HOLD_MS) {
  state = settleFace(state, now);
  if (!state || state.faceId === null) return { status: 'waiting' };
  if (heldMs(state, now) < holdMs) return { status: 'waiting' };
  if (state.faceId === UNKNOWN_FACE) return { status: 'unknown' };
  const user = findUserByFace(users, state.faceId);
  return user ? { status: 'user', user } : { status: 'unknown' };
}

// 학습된 얼굴 번호인지 (null·'unknown' 이 아님)
function isNumber(id) {
  return id !== null && id !== UNKNOWN_FACE;
}

// 번호가 숫자(3)로 오든 글자('3')로 오든 같은 얼굴로 본다
function sameFace(a, b) {
  if (a === null || b === null) return a === b;
  return String(a) === String(b);
}
