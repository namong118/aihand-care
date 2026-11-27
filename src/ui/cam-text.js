// 내 손 캠 화면 아래 "지금 보이는 손" 글자 (순수 함수, DOM 없음). 화면은 cam-box.js
// 손모양 이름은 data/poses.json 의 label 을 쓴다 (예: "손바닥(보)")

import poses from '../data/poses.json';

const LABELS = Object.fromEntries(poses.map((p) => [p.name, p.label]));

/**
 * pose: ctx.hand.onPose 의 { code, name } (손이 없으면 code 가 null)
 * 반환: "손이 안 보여요" / "지금 손: 손바닥(보)" / "손이 보여요 (모양을 알아보는 중)"
 */
export function poseSeenText(pose) {
  if (!pose || !pose.code) return '손이 안 보여요';
  const label = LABELS[pose.name];
  return label ? `지금 손: ${label}` : '손이 보여요 (모양을 알아보는 중)';
}
