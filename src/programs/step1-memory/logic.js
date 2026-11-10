// STEP 1 기억손 (숫자 순서 기억): 문제 생성과 판정 (순수 함수, DOM·ctx 사용 금지)
//
// 로봇이 손가락으로 숫자 몇 개를 차례로 보여준 뒤 손을 내린다.
// 사용자는 기억해서 같은 순서로 숫자 카드(1~5, AIHand 교구 카드)를 하나씩 WonderCam에 보여준다.

/** 숫자 카드 */
export const CARD_NUMBERS = [1, 2, 3, 4, 5];

/** 숫자 → 로봇 손모양 (data/poses.json 에 있는 이름만) */
export const POSE_BY_NUMBER = { 1: 'INDEX', 2: 'V', 3: 'THREE', 4: 'FOUR', 5: 'PAPER' };

export function poseForNumber(n) {
  const name = POSE_BY_NUMBER[n];
  if (!name) throw new Error(`숫자 카드는 1~5 입니다: ${n}`);
  return name;
}

/** 난이도별로 기억할 숫자 개수 (바꿀지는 따로 정한다) */
export const LENGTH_BY_DIFFICULTY = { easy: 1, normal: 2, hard: 3 };

export function sequenceLength(difficulty) {
  return LENGTH_BY_DIFFICULTY[difficulty] ?? LENGTH_BY_DIFFICULTY.easy;
}

/**
 * 기억할 숫자 순서 만들기. 한 문제 안에서 같은 숫자는 두 번 나오지 않는다
 * (숫자 카드가 숫자마다 한 장뿐이라서).
 * @param items  고를 수 있는 숫자 목록
 * @param length 몇 개 (items 개수 이하)
 * @param rand   0 이상 1 미만을 돌려주는 함수 (테스트에서 고정값 사용)
 */
export function makeSequence(items, length, rand = Math.random) {
  if (length > items.length) throw new Error(`숫자 ${items.length}개로 겹치지 않게 ${length}개를 만들 수 없습니다.`);
  const left = [...items];
  const seq = [];
  for (let i = 0; i < length; i++) {
    const k = Math.floor(rand() * left.length);
    seq.push(left[k]);
    left.splice(k, 1); // 고른 숫자는 다시 고르지 않는다
  }
  return seq;
}

/**
 * 판정. 순서와 숫자가 모두 같아야 정답.
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
