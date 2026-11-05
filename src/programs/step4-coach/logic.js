// STEP 4 손운동 코칭: 루틴 펼치기와 진행 판정 (순수 함수, DOM·ctx 사용 금지)
//
// 로봇이 시범을 보여주는 동안 사용자가 보면서 따라 한다.
// 맞고 틀림을 따지지 않고 "따라 했는지 / 건너뛰었는지"만 센다.
// routine 은 data/routines.json 모양:
//   { id, title, repeat, steps: [{ pose, holdMs, say }] }

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
 * 손 인식으로 이 동작을 "따라 했다"고 볼지 정한다.
 * - 시범과 같은 손모양을 holdMs 이상 유지했고
 * - 이 동작을 시작한 뒤(sinceMs 이후)에 만든 손모양이어야 한다
 */
export function isStepDone(pose, step, { now, sinceMs }) {
  if (!pose || pose.name !== step.pose) return false;
  if (pose.stableMs < (step.holdMs ?? 1000)) return false;
  return now - pose.stableMs >= sinceMs;
}

/**
 * 동작별 결과를 회차 기록용으로 모은다.
 * results: [{ status: 'done' | 'skipped', reactionMs }]
 * 반환: { total, done, skipped, avgReactionMs } (avgReactionMs 는 따라 한 동작만 평균)
 */
export function summarizeSteps(results) {
  const done = results.filter((r) => r.status === 'done');
  const times = done.map((r) => r.reactionMs).filter((n) => Number.isFinite(n));
  return {
    total: results.length,
    done: done.length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    avgReactionMs: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null,
  };
}
