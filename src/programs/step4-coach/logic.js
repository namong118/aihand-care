// STEP 4 손운동 코칭: 루틴 펼치기와 진행 기록 (순수 함수, DOM·ctx 사용 금지)
//
// 로봇이 시범을 보여주는 동안 사용자가 보면서 따라 한다.
// 맞고 틀림을 따지지 않고 "어떻게 마쳤는지"만 센다.
// routine 은 data/routines.json 모양:
//   { id, title, repeat, steps: [{ pose, holdMs, say }] }
//   repeat 이 0 이하이거나 없으면 1번 (팀 결정 2026-11-12)

/**
 * 동작 하나를 마친 방식
 *   detected: 손 인식으로 따라 한 것이 확인됨
 *   manual:   사용자가 "따라 했어요" 버튼을 누름
 *   skipped:  건너뜀
 */
export const METHODS = ['detected', 'manual', 'skipped'];

/** 루틴에 holdMs 가 없을 때 쓰는 유지 시간 (ms) */
export const DEFAULT_HOLD_MS = 1000;

/** 동작 사이 쉬는 시간 (ms, 보통 속도). 느리게(SLOW)면 2배 */
export const REST_MS = 1000;

/** 숫자 세기에 쓰는 말. 1초에 하나씩 센다 */
export const COUNT_WORDS = ['하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉', '열'];

/** 동작 하나의 유지 시간 (ms). 루틴에 없으면 DEFAULT_HOLD_MS */
export function holdMsOf(step) {
  return step.holdMs ?? DEFAULT_HOLD_MS;
}

/** 동작 사이 쉬는 시간 (ms). speed: 'SLOW' | 'NORMAL' (홈의 진행 속도) */
export function restMs(speed) {
  return speed === 'SLOW' ? REST_MS * 2 : REST_MS;
}

/** 루틴을 실제로 할 동작 목록으로 펼친다 (repeat 번 반복). */
export function expandRoutine(routine) {
  const repeat = Math.max(1, routine.repeat ?? 1);
  const list = [];
  for (let r = 0; r < repeat; r++) {
    for (const step of routine.steps) {
      list.push({ ...step, round: r + 1 });
    }
  }
  return list;
}

/**
 * 유지 게이지 값 (0 ~ 1). 시범과 같은 손모양을 얼마나 유지했는지.
 * 다른 손모양이거나 손이 없으면 0.
 */
export function holdProgress(pose, step) {
  if (!pose || pose.name !== step.pose) return 0;
  const hold = holdMsOf(step);
  if (hold <= 0) return 1; // 유지 시간이 0 이면 손모양을 만들자마자 다 찬 것 (0 으로 나누지 않기)
  return Math.min(1, pose.stableMs / hold);
}

/**
 * 숫자 세기 (유지하는 동안 1초에 하나씩). 몇 번째 숫자인지 1, 2, 3… 을 돌려준다.
 * 다른 손모양이거나 손이 없으면 0. holdMs 가 1초면 1까지, 3초면 3까지 센다.
 *   예) holdMs 3000: stableMs 0~999 → 1(하나), 1000~1999 → 2(둘), 2000 이상 → 3(셋)
 */
export function holdCount(pose, step) {
  if (!pose || pose.name !== step.pose) return 0;
  const max = Math.max(1, Math.ceil(holdMsOf(step) / 1000));
  return Math.min(max, Math.floor(Math.max(0, pose.stableMs) / 1000) + 1);
}

/** holdCount 의 숫자를 말로 바꾼다. 1 → '하나'. 0 이면 '' (표시 안 함) */
export function countWord(n) {
  if (!n || n < 1) return '';
  return COUNT_WORDS[n - 1] ?? String(n);
}

/**
 * 동작별 결과를 회차 기록용으로 모은다.
 * results: [{ method: 'detected' | 'manual' | 'skipped', reactionMs }]
 * 반환: { total, done, skipped, avgReactionMs, methods: { detected, manual, skipped } }
 *   done = detected + manual (따라 한 동작)
 *   avgReactionMs 는 따라 한 동작만 평균
 */
export function summarizeSteps(results) {
  const methods = { detected: 0, manual: 0, skipped: 0 };
  for (const r of results) {
    if (!METHODS.includes(r.method)) throw new Error(`알 수 없는 완료 방식: ${r.method}`);
    methods[r.method] += 1;
  }
  const times = results
    .filter((r) => r.method !== 'skipped')
    .map((r) => r.reactionMs)
    .filter((n) => Number.isFinite(n));
  return {
    total: results.length,
    done: methods.detected + methods.manual,
    skipped: methods.skipped,
    avgReactionMs: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null,
    methods,
  };
}
