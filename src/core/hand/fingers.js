// 손 랜드마크 21개 → 손가락별 펴짐 여부 → 5비트 code. mediapipe.js 가 쓴다.
// DOM·웹캠을 쓰지 않는 순수 함수라서 fingers.test.js 로 테스트한다.
//
// 랜드마크 번호 (MediaPipe Hand Landmarker)
//   0 손목
//   엄지 1~4, 검지 5~8, 중지 9~12, 약지 13~16, 새끼 17~20
//   (손가락마다 순서대로 뿌리(MCP) → 둘째 마디(PIP) → 셋째 마디(DIP) → 끝(TIP). 엄지는 CMC·MCP·IP·TIP)
//
// 좌표는 worldLandmarks(손 중심 기준 3D, 미터)를 넣는다. 화면 좌표(landmarks)보다
// 손 크기·카메라 거리·손 기울기의 영향을 덜 받는다.

const WRIST = 0;
// [끝, 둘째 마디] 번호. 검지·중지·약지·새끼
const FINGERS = [
  [8, 6],
  [12, 10],
  [16, 14],
  [20, 18],
];
const THUMB_TIP = 4;
const THUMB_IP = 3;
const PINKY_MCP = 17;

// 판정 기준값. 라즈베리파이 + C270 으로 다시 확인한다 [검증 필요]
export const THRESHOLDS = {
  // 검지~새끼: (손목~손가락 끝) ÷ (손목~둘째 마디) 가 이보다 크면 펴짐.
  // 펴면 약 1.3, 접으면 1보다 작다
  finger: 1.1,
  // 엄지: (엄지 끝~새끼 뿌리) ÷ (엄지 셋째 마디~새끼 뿌리) 가 이보다 크면 펴짐 (엄지 끝이 바깥을 향함).
  // 2026-11-11 개발 PC 웹캠 측정: 펴짐 손바닥 1.15·엄지 척 1.29, 접힘 손가락 넷 0.99·주먹 0.95 → 가운데 1.07.
  // (엄지 끝~검지 뿌리 거리는 손바닥 0.45 < 손가락 넷 0.6 으로 거꾸로 나와 쓰지 않는다)
  thumbOut: 1.07,
};

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * 엄지 판정 값 (기준값을 실물로 맞출 때 개발자 입력 측정 줄에 "엄지 바깥"으로 보여준다).
 * (엄지 끝~새끼 뿌리) ÷ (엄지 셋째 마디~새끼 뿌리). THRESHOLDS.thumbOut 보다 크면 펴짐
 */
export function thumbOut(lm) {
  return dist(lm[THUMB_TIP], lm[PINKY_MCP]) / (dist(lm[THUMB_IP], lm[PINKY_MCP]) || 1);
}

/**
 * 손가락별 펴짐 여부.
 * @param {{x:number,y:number,z?:number}[]} lm  랜드마크 21개
 * @returns {boolean[]} [엄지, 검지, 중지, 약지, 새끼], true = 펴짐
 */
export function fingersUp(lm, t = THRESHOLDS) {
  if (!Array.isArray(lm) || lm.length < 21) throw new Error('랜드마크 21개가 필요합니다');
  const wrist = lm[WRIST];
  const thumb = thumbOut(lm) > t.thumbOut;

  const others = FINGERS.map(([tip, pip]) => dist(wrist, lm[tip]) > dist(wrist, lm[pip]) * t.finger);
  return [thumb, ...others];
}

/** 랜드마크 21개 → 5비트 code ('01100' 등). 랜드마크가 없으면 null */
export function landmarksToCode(lm, t = THRESHOLDS) {
  if (!lm) return null;
  return fingersUp(lm, t)
    .map((up) => (up ? '1' : '0'))
    .join('');
}

/**
 * 한두 프레임만 튀는 code 를 무시한다.
 * 같은 code 가 frames 번 연속으로 나와야 바뀐 것으로 친다.
 * (손가락이 경계에 있으면 프레임마다 0/1 이 바뀌어 stableMs 가 계속 0 이 되는 것을 막는다)
 *
 * @returns {(code: string|null) => string|null}  프레임마다 부르면 지금 확정된 code 를 돌려준다
 */
export function createCodeSmoother(frames = 2) {
  let stable = null;
  let candidate = null;
  let count = 0;
  return function push(code) {
    if (code === candidate) {
      count += 1;
    } else {
      candidate = code;
      count = 1;
    }
    if (count >= frames) stable = candidate;
    return stable;
  };
}

/**
 * MediaPipe 의 왼손/오른손 이름은 거울처럼 뒤집힌 화면(셀카)을 기준으로 한다.
 * 웹캠 영상은 뒤집지 않고 넣으므로 반대로 바꿔 준다. [검증 필요] 실물에서 왼손·오른손으로 확인
 */
export function flipHandedness(name) {
  if (name === 'Left') return 'Right';
  if (name === 'Right') return 'Left';
  return null;
}
