// 내 손 캠 화면 (공통 부품): 거울처럼 보이는 웹캠 영상 + "지금 보이는 손" 글자.
// 손으로 하는 활동에서 손이 카메라에 잘 보이는지 사용자가 바로 알 수 있게 한다 (2026-11-27 실물 테스트).
// 모양은 STEP 2 동시에 가위바위보의 캠 칸과 같다 (step2-rps/screen.js camBox).
//
//   const cam = camBox(ctx.hand);          // ctx.hand 에 preview 가 없으면 null
//   set(withCam(내용, cam));               // 왼쪽 내용 + 오른쪽 캠 칸
//   ... 화면을 바꾸거나 끝낼 때 cam?.close()  // 웹캠 연결·구독 끊기
//
// 웹캠이 꺼져 있으면(화면 버튼 모드) 칸은 그대로 두고 "카메라가 꺼져 있어요"를 보여 준다 (숨기면 왜 안 나오는지 알 수 없다).

import { h } from './components.js';
import { poseSeenText } from './cam-text.js';

/**
 * hand: ctx.hand (preview, onPose). 반환: { el, close } 또는 null (preview 가 없을 때)
 * seenText: 글자 바꾸는 함수 (기본 poseSeenText)
 */
export function camBox(hand, { seenText = poseSeenText } = {}) {
  if (!hand?.preview) return null;
  const video = h('video', { class: 'webcam-video', 'aria-hidden': 'true', hidden: true });
  const off = h(
    'p',
    { class: 'act-text', style: { margin: '0', 'text-align': 'center', padding: '24px 0' } },
    '카메라가 꺼져 있어요. 위쪽 “웹캠 켜기”를 누르면 내 손이 보여요.',
  );
  const seen = h(
    'p',
    { class: 'act-label', 'aria-live': 'polite', hidden: true, style: { margin: '0', 'text-align': 'center', 'font-size': '24px' } },
    '손이 안 보여요',
  );
  const el = h(
    'div',
    { class: 'act-card', style: { width: '240px', flex: 'none', gap: '8px', padding: '12px', 'justify-content': 'center' } },
    video,
    off,
    seen,
  );
  const stops = [
    hand.preview(video, (on) => {
      video.hidden = !on;
      seen.hidden = !on;
      off.hidden = on;
    }),
  ];
  if (typeof hand.onPose === 'function') {
    stops.push(
      hand.onPose((pose) => {
        const text = seenText(pose);
        if (seen.textContent !== text) seen.textContent = text;
      }),
    );
  }
  let closed = false;
  return {
    el,
    close() {
      if (closed) return;
      closed = true;
      stops.forEach((stop) => stop?.());
    },
  };
}

/** 왼쪽 내용 + 오른쪽 캠 칸 한 줄. cam 이 null 이면 내용만 */
export function withCam(main, cam) {
  return h(
    'div',
    { style: { display: 'flex', gap: '16px', 'align-items': 'stretch' } },
    h('div', { style: { flex: '1', 'min-width': '0', display: 'flex', 'flex-direction': 'column' } }, main),
    cam?.el ?? null,
  );
}
