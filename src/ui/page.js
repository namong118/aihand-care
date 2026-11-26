// 홈 밖 화면 공통 부품 (설정, 활동 기록, 코스 안내·요약, 나의 시작 찾기, 로그인·등록, 사용자 지우기).
// 홈 인사말처럼 "작은 안내 + 큰 제목", 내용은 테두리 없는 흰 카드, 바로 가기는 칸 버튼으로 맞춘다.
// 모양은 styles.css "홈 밖 화면 공통"(.page-*) 클래스.

import { h } from './components.js';

/**
 * 화면 머리: 작은 안내 한 줄 + 큰 제목 + 오른쪽 버튼
 * @param eyebrow 제목 위 작은 글자 (없으면 null). 요소를 넣어도 된다 (호칭 알약 등)
 * @param title   제목
 * @param side    오른쪽에 둘 요소 (닫기·홈으로 등, 없으면 null)
 */
export function pageHead(eyebrow, title, side = null) {
  return h(
    'div',
    { class: 'page-head' },
    h('div', { class: 'page-head-text' }, eyebrow ? h('p', { class: 'page-eyebrow' }, eyebrow) : null, h('h1', {}, title)),
    side,
  );
}

/** 오른쪽 위 작은 테두리 버튼 ("← 홈으로", "닫기"). 상단 바 버튼과 같은 모양 */
export function headButton(label, onClick) {
  return h('button', { type: 'button', class: 'btn-outline', onClick }, label);
}

/** 흰 카드. title 이 있으면 카드 제목(h2) */
export function pageCard(title, ...children) {
  return h('section', { class: 'page-card' }, title ? h('h2', {}, title) : null, ...children);
}

/**
 * 바로 가기 칸: 굵은 이름 + 설명 한 줄 + 화살표. 누르면 onClick
 * @param o.step 'step1'~'step4' 면 그 활동 색으로 (없으면 회색 칸)
 */
export function pageTile(title, desc, onClick, { step = null } = {}) {
  return h(
    'button',
    { type: 'button', class: `page-tile${step ? ` is-step ${step}` : ''}`, onClick },
    h('span', { class: 'page-tile-text' }, h('strong', {}, title), desc ? h('span', {}, desc) : null),
    h('span', { class: 'page-tile-go', 'aria-hidden': 'true' }, '›'),
  );
}

/** 점 목록 (안내 문구 여러 줄). 한 줄에 한 가지 */
export function pageList(lines) {
  return h('ul', { class: 'page-list' }, lines.map((l) => h('li', {}, l)));
}

/** 아래 버튼 줄 */
export function pageActions(...buttons) {
  return h('div', { class: 'page-actions' }, ...buttons);
}
