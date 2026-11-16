// 활동 화면에서 같이 쓰는 그림 (이모지 대신 선 그림 SVG). 색은 글자색(currentColor)을 따른다.
// 프로그램은 ctx 만 쓰는 규칙이지만, 이 파일은 화면 부품이라 components.js 처럼 import 해도 된다.

const NS = 'http://www.w3.org/2000/svg';

/** 손모양 그림 (data/poses.json 이름). 없는 이름은 펼친 손 */
const HAND_PATHS = {
  PAPER:
    '<path d="M7 11V6.5a1.5 1.5 0 0 1 3 0V11"/><path d="M10 10V4.5a1.5 1.5 0 0 1 3 0V10"/><path d="M13 10V5.5a1.5 1.5 0 0 1 3 0V12"/><path d="M16 12V8.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L4.5 14a1.5 1.5 0 0 1 2.5-1.6L8 14"/>',
  ROCK: '<rect x="5" y="8" width="14" height="11" rx="4"/><path d="M9 8v3M12 8v3M15 8v3"/>',
  V: '<path d="M9 12V4.5a1.5 1.5 0 0 1 3 0V12"/><path d="M12 12V5.5a1.5 1.5 0 0 1 3 0V13"/><path d="M9 12l-1.5-1a1.5 1.5 0 0 0-2 2.2L8 17a5 5 0 0 0 4 2h1a5 5 0 0 0 5-5v-2a1.5 1.5 0 0 0-3 0"/>',
};

/**
 * 손모양 그림 요소. 화면 읽기 프로그램에는 숨긴다 (옆에 글자를 꼭 같이 쓴다)
 * @param name  'ROCK' | 'PAPER' | 'V' ...
 * @param size  px
 */
export function handIcon(name, size = 36) {
  const span = document.createElement('span');
  span.className = 'icon';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" xmlns="${NS}">${HAND_PATHS[name] ?? HAND_PATHS.PAPER}</svg>`;
  return span;
}
