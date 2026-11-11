// 손 랜드마크 21개 → 5비트 손모양 code. mediapipe.js 가 쓰는 순수 함수 (DOM·웹캠 없음, 테스트 가능).
//
// MediaPipe 랜드마크 번호 (손목 0, 손가락마다 뿌리 → 끝 순서)
//   엄지 1·2·3·4, 검지 5·6·7·8, 중지 9·10·11·12, 약지 13·14·15·16, 새끼 17·18·19·20
//
// 3D 좌표(worldLandmarks, 단위 m)로 거리를 재므로 손이 기울거나 돌아가도 같은 기준이 적용된다.
// 아래 기준값으로 7개 손모양 인식을 실물 웹캠으로 확인함 (2026-11-11, D, docs/hardware-check.md 5번).
// [검증 필요] 고령자 손(굽은 손가락)·다른 조명에서는 아직 확인 전. 잘 안 되면 이 두 값을 조정한다.

/** 검지~새끼: [가운데 마디(PIP), 손끝(TIP)] 번호 */
const FINGERS = [
  [6, 8], // 검지
  [10, 12], // 중지
  [14, 16], // 약지
  [18, 20], // 새끼
];

/** 손끝이 가운데 마디보다 손목에서 이만큼(배) 더 멀어야 "펴짐" */
export const FINGER_RATIO = 1.1;
/** 엄지 끝이 검지 뿌리에서 손바닥 길이의 이만큼(배) 이상 떨어져야 "펴짐" */
export const THUMB_SPREAD = 0.5;

function dist(a, b) {
  const dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.hypot(a.x - b.x, a.y - b.y, dz);
}

/**
 * 엄지 펴짐 여부.
 * 접은 엄지는 손바닥을 가로질러 새끼 쪽으로 가므로, 엄지 끝(4)이 엄지 마디(3)보다 새끼 뿌리(17)에 가까워진다.
 * 주먹 옆에 엄지를 붙인 경우를 거르기 위해 엄지 끝이 검지 뿌리(5)에서 충분히 떨어져 있는지도 본다.
 */
function isThumbOpen(lm) {
  const palm = dist(lm[0], lm[9]); // 손목 ~ 중지 뿌리 = 손바닥 길이 (손 크기 기준)
  const awayFromPinky = dist(lm[4], lm[17]) > dist(lm[3], lm[17]);
  const awayFromIndex = dist(lm[4], lm[5]) > palm * THUMB_SPREAD;
  return awayFromPinky && awayFromIndex;
}

/** 검지~새끼 펴짐 여부: 손끝이 가운데 마디보다 손목에서 충분히 멀면 펴진 것 */
function isFingerOpen(lm, pip, tip) {
  return dist(lm[0], lm[tip]) > dist(lm[0], lm[pip]) * FINGER_RATIO;
}

/**
 * 랜드마크 21개를 5비트 code 로 바꾼다.
 * @param {{x:number, y:number, z?:number}[]} lm  랜드마크 21개 (worldLandmarks 권장)
 * @returns {string|null}  '01100' 같은 [엄지,검지,중지,약지,새끼] 문자열. 랜드마크가 모자라면 null
 */
export function landmarksToCode(lm) {
  if (!Array.isArray(lm) || lm.length < 21) return null;
  const bits = [isThumbOpen(lm), ...FINGERS.map(([pip, tip]) => isFingerOpen(lm, pip, tip))];
  return bits.map((open) => (open ? '1' : '0')).join('');
}

/**
 * 인식 결과가 한두 프레임 흔들려도 code 가 바로 바뀌지 않게 하는 안정화 장치.
 * 새 code 가 frames 번 연속으로 나와야 바꾼다. 손이 잠깐 안 보이는 것(null)도 같은 규칙을 따른다.
 *
 * update(rawCode, now) → { code, since }
 *   code:  안정화된 code (손이 없으면 null)
 *   since: 그 code 가 처음 나온 시각. stableMs = now - since
 */
export function createCodeStabilizer({ frames = 3 } = {}) {
  let code = null;
  let since = 0;
  let candidate; // 바뀔지도 모르는 새 code (undefined = 후보 없음)
  let candidateCount = 0;
  let candidateSince = 0;

  return {
    update(rawCode, now) {
      const raw = rawCode ?? null;
      if (raw === code) {
        candidate = undefined;
        candidateCount = 0;
      } else if (raw === candidate) {
        candidateCount += 1;
        if (candidateCount >= frames) {
          code = raw;
          since = candidateSince; // 새 모양을 처음 만든 시각부터 유지 시간을 센다
          candidate = undefined;
          candidateCount = 0;
        }
      } else {
        candidate = raw;
        candidateCount = 1;
        candidateSince = now;
        if (frames <= 1) {
          code = raw;
          since = now;
          candidate = undefined;
          candidateCount = 0;
        }
      }
      return { code, since };
    },
  };
}
