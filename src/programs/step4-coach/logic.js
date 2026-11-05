// STEP 4 손운동 코칭: 루틴 펼치기와 진행 기록 (순수 함수, DOM·ctx 사용 금지)
//
// 로봇이 시범을 보여주는 동안 사용자가 보면서 따라 한다.
// 맞고 틀림을 따지지 않고 "어떻게 마쳤는지"만 센다.
// routine 은 data/routines.json 모양:
//   { id, title, repeat, steps: [{ pose, holdMs, say }] }

/**
 * 동작 하나를 마친 방식
 *   detected: 손 인식으로 따라 한 것이 확인됨
 *   manual:   사용자가 "따라 했어요" 버튼을 누름
 *   skipped:  건너뜀
 */
export const METHODS = ['detected', 'manual', 'skipped'];

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
  const hold = step.holdMs ?? 1000;
  return Math.min(1, pose.stableMs / hold);
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
