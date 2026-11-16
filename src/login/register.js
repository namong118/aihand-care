// 등록 화면(#84)의 순수 함수. DOM·ctx 사용 금지
//
// WonderCam은 얼굴을 1~5번까지 학습한다 (공식 확장 Hiwonder/WonderCam: 얼굴 번호 1~5).
// 공식 확장에는 학습 명령이 없어서, ctx.card.learnFace 가 없으면 카메라 레버로 학습하고
// 카메라 화면에 나온 번호를 고른다. [검증 필요] #76 실물 확인 결과로 확정

/** WonderCam 얼굴 번호 최대값 */
export const FACE_ID_MAX = 5;

/** 아직 아무도 쓰지 않는 얼굴 번호들 (작은 번호부터) */
export function freeFaceIds(users, max = FACE_ID_MAX) {
  const used = new Set(users.filter((u) => u.faceId !== null).map((u) => String(u.faceId)));
  const free = [];
  for (let id = 1; id <= max; id++) if (!used.has(String(id))) free.push(id);
  return free;
}

/**
 * 인식 시험 결과 문구
 *   result: judgeFace 결과 ({ status, user })
 *   userId: 방금 등록한 사람
 * 반환: 'ok' 맞게 알아봄 / 'other' 다른 사람으로 알아봄 / 'unknown' 모르는 얼굴 / 'waiting' 아직
 */
export function checkRegistered(result, userId) {
  if (!result || result.status === 'waiting') return 'waiting';
  if (result.status === 'unknown') return 'unknown';
  return result.user?.userId === userId ? 'ok' : 'other';
}
