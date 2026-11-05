// 손모양 code ↔ 이름 변환. mock.js 와 mediapipe.js 가 같이 쓴다.

/**
 * 5비트 code('01100' 등)를 poses.json 의 이름('V' 등)으로 바꾼다.
 * 손이 없거나(null) 목록에 없는 모양이면 null.
 */
export function codeToName(code, poses) {
  if (code === null || code === undefined) return null;
  const found = poses.find((p) => p.code === code);
  return found ? found.name : null;
}

/** 이름('V')을 code('01100')로 바꾼다. 없으면 null. */
export function nameToCode(name, poses) {
  const found = poses.find((p) => p.name === name);
  return found ? found.code : null;
}
