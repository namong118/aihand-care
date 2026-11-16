// 홈 화면 (디자인 시안 v11 "홈"): 날짜·인사말과 "오늘의 활동 시작하기", 코스 순서대로 활동 카드 4장,
// 아래 줄에 "하나만 해 보기"와 지금 설정(난이도·속도) + "바꾸기".
// 설정 영역 자체는 settings.js, 상단 바는 statusbar.js.
// 로그인은 코스를 시작할 때 하므로 홈에서는 호칭을 부르지 않는다.

import { h } from '../ui/components.js';
import { findProgramInfo } from './catalog.js';
import { TIME_ZONE } from './course-logic.js';
import { DIFFICULTIES, SPEEDS, labelOf } from './settings.js';
import { svgIcon } from './statusbar.js';

const NS = 'http://www.w3.org/2000/svg';
const svg = (inner) =>
  `<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" xmlns="${NS}">${inner}</svg>`;

/** 활동 그림 (이모지 대신 SVG). STEP 1 은 글자 "123" */
const ART = {
  1: null,
  // 가위 (검지·중지)
  2: svg('<path d="M9 12V4.5a1.5 1.5 0 0 1 3 0V12"/><path d="M12 12V5.5a1.5 1.5 0 0 1 3 0V13"/><path d="M9 12l-1.5-1a1.5 1.5 0 0 0-2 2.2L8 17a5 5 0 0 0 4 2h1a5 5 0 0 0 5-5v-2a1.5 1.5 0 0 0-3 0"/>'),
  // 팔레트
  3: svg('<path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8z"/><circle cx="7.5" cy="11" r="1.1"/><circle cx="10" cy="7.5" r="1.1"/><circle cx="14.5" cy="7.5" r="1.1"/>'),
  // 펼친 손
  4: svg('<path d="M7 11V6.5a1.5 1.5 0 0 1 3 0V11"/><path d="M10 10V4.5a1.5 1.5 0 0 1 3 0V10"/><path d="M13 10V5.5a1.5 1.5 0 0 1 3 0V12"/><path d="M16 12V8.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L4.5 14a1.5 1.5 0 0 1 2.5-1.6L8 14"/>'),
};

function art(step) {
  if (!ART[step]) return h('span', { class: 'home-art home-art-text', 'aria-hidden': 'true' }, '123');
  const el = svgIcon(ART[step]);
  el.classList.add('home-art');
  return el;
}

/** "11월 16일 월요일" (한국 시각) */
function todayText(now = new Date()) {
  return new Intl.DateTimeFormat('ko-KR', { timeZone: TIME_ZONE, month: 'long', day: 'numeric', weekday: 'long' }).format(now);
}

/** 코스 카드 하나 (눌러서 시작하지 않는다. 시작은 위쪽 버튼 하나) */
function courseCard(p, order) {
  return h(
    'li',
    { class: `home-course-card step${p.step}` },
    h('div', { class: 'home-course-head' }, art(p.step), h('span', { class: 'home-course-order' }, `${order}번째`)),
    h('div', { class: 'home-course-text' }, h('span', { class: 'home-course-name' }, p.name), h('span', { class: 'home-course-desc' }, p.short)),
  );
}

/**
 * @param container  그릴 자리
 * @param app        { settings, plan: [programId...], openSettings(), openResults(), startProgram(id), startCourse() }
 */
export function renderHome(container, app) {
  const { settings } = app;
  const plan = (app.plan ?? []).map(findProgramInfo).filter(Boolean);
  container.innerHTML = '';
  container.append(
    h(
      'div',
      { class: 'home' },
      h(
        'div',
        { class: 'home-hero' },
        h(
          'div',
          { class: 'home-greet' },
          h('p', { class: 'home-date' }, todayText()),
          h('h1', {}, '안녕하세요,', h('br'), '오늘도 손 인사 나눠요'),
        ),
        h(
          'div',
          { class: 'home-cta' },
          h(
            'button',
            { type: 'button', class: 'btn-main', onClick: app.startCourse },
            '오늘의 활동 시작하기',
            svgIcon(`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" xmlns="${NS}"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`),
          ),
          app.openResults ? h('button', { type: 'button', class: 'link-button', onClick: app.openResults }, '지난 기록 보기') : null,
        ),
      ),
      // 시연 코스 순서 (src/data/course.json, #59)
      h('ol', { class: 'home-course', 'aria-label': `오늘의 활동 ${plan.length}가지, 차례대로` }, plan.map((p, i) => courseCard(p, i + 1))),
      h(
        'div',
        { class: 'home-foot' },
        h('span', { class: 'home-foot-label' }, '하나만 해 보기'),
        h(
          'div',
          { class: 'home-singles' },
          // 하나씩 할 때는 로그인 없이 바로 (docs/decisions.md 4-1)
          plan.map((p) => h('button', { type: 'button', class: 'chip-button', onClick: () => app.startProgram(p.id) }, p.name)),
        ),
        h(
          'div',
          { class: 'home-current' },
          h('span', {}, `난이도 ${labelOf(DIFFICULTIES, settings.difficulty)} · 속도 ${labelOf(SPEEDS, settings.speed)}`),
          h('button', { type: 'button', class: 'link-button', onClick: app.openSettings }, '바꾸기'),
        ),
      ),
    ),
  );
}
