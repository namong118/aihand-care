// STEP 1 기억손: 문제 생성과 판정 (순수 함수, DOM·ctx 사용 금지)
//
// 로봇이 손모양 몇 개를 차례로 보여준 뒤 손을 내린다.
// 사용자는 보지 않은 상태에서 기억해서 같은 순서로 만든다.

/** 난이도별로 기억할 손모양 개수 */
export const LENGTH_BY_DIFFICULTY = { easy: 1, normal: 2, hard: 3 };

export function sequenceLength(difficulty) {
  return LENGTH_BY_DIFFICULTY[difficulty] ?? LENGTH_BY_DIFFICULTY.easy;
}

/**
 * 기억할 손모양 순서 만들기. 바로 앞과 같은 손모양은 연달아 나오지 않는다
 * (같은 손을 두 번 연달아 들기는 화면만 보고 구분하기 어렵기 때문).
 * @param names  고를 수 있는 손모양 이름 목록 (2개 이상)
 * @param length 몇 개
 * @param rand   0 이상 1 미만을 돌려주는 함수 (테스트에서 고정값 사용)
 */
export function makeSequence(names, length, rand = Math.random) {
  if (names.length < 2) throw new Error('손모양이 2개 이상 있어야 합니다.');
  const seq = [];
  for (let i = 0; i < length; i++) {
    const choices = names.filter((n) => n !== seq[i - 1]);
    seq.push(choices[Math.floor(rand() * choices.length)]);
  }
  return seq;
}

/**
 * 판정. 순서와 손모양이 모두 같아야 정답.
 * 반환: { correct, matched } matched = 자리까지 맞은 개수
 */
export function judgeSequence(expected, given) {
  let matched = 0;
  for (let i = 0; i < expected.length; i++) {
    if (given[i] === expected[i]) matched += 1;
  }
  return {
    correct: matched === expected.length && given.length === expected.length,
    matched,
  };
}

/**
 * 손 인식 입력을 확정할지 정한다.
 * - 이름 있는 손모양을 minStableMs 이상 유지했고
 * - sinceMs(문제 제시 또는 바로 앞 입력 확정) 이후에 만든 손모양이어야 한다
 */
export function shouldAcceptPose(pose, { now, sinceMs, minStableMs }) {
  if (!pose || !pose.name) return false;
  if (pose.stableMs < minStableMs) return false;
  return now - pose.stableMs >= sinceMs;
}
