// 손모양 "입력 확정" 공통 기능: ctx.hand.waitForPose
// 프로그램마다 따로 만들던 확정 규칙을 여기 한 곳에 둔다.
//
// 확정 규칙
//  1) 이름 있는 손모양이고 (names 를 주면 그 안에 있는 것만)
//  2) holdMs 이상 같은 모양을 유지했고
//  3) since 시각 이후에 만든 손모양이어야 한다
//     (문제가 나오기 전부터 들고 있던 손이 바로 답이 되는 것을 막는다)

/** 확정 규칙 검사 (순수 함수) */
export function isConfirmedPose(pose, { now, since, holdMs, names = null }) {
  if (!pose || !pose.name) return false;
  if (names && !names.includes(pose.name)) return false;
  if (pose.stableMs < holdMs) return false;
  return now - pose.stableMs >= since;
}

/**
 * onPose 구독 함수를 받아 waitForPose 함수를 만든다.
 *
 * waitForPose({ holdMs, since, names, signal }) → Promise
 *   - 확정되면 그 pose 로 resolve
 *   - signal(AbortController 의 signal)이 abort 되면 null 로 resolve (에러를 던지지 않는다)
 */
export function makeWaitForPose(onPose, now = () => Date.now()) {
  return function waitForPose({ holdMs = 1000, since = now(), names = null, signal } = {}) {
    return new Promise((resolve) => {
      if (signal?.aborted) {
        resolve(null);
        return;
      }
      let finished = false;
      let off = null;

      const finish = (value) => {
        if (finished) return;
        finished = true;
        if (off) off();
        signal?.removeEventListener('abort', onAbort);
        resolve(value);
      };
      const onAbort = () => finish(null);
      signal?.addEventListener('abort', onAbort);

      off = onPose((pose) => {
        if (isConfirmedPose(pose, { now: now(), since, holdMs, names })) finish(pose);
      });
      if (finished) off(); // 구독하자마자 확정된 경우
    });
  };
}
