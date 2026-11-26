// 홈 화면 (디자인 시안 v11 "홈"): 날짜·인사말과 "오늘의 활동 시작하기", 코스 순서대로 활동 카드 4장,
// 주 버튼 아래에 지금 설정(난이도·속도) + "바꾸기". "지난 기록 보기"는 설정 영역에 있다 (어르신이 보는 홈에는 두지 않음).
// 활동 카드를 누르면 그 활동 하나만 바로 시작한다 (예전 "하나만 해 보기" 작은 버튼 줄을 대신함, 11/18 Pi 시연 의견).
// 카드 아래 칸은 짝 도전 활동 (11/20, #132). 코스에는 들어가지 않는다.
// 설정 영역 자체는 settings.js, 상단 바는 statusbar.js.
// 로그인은 코스를 시작할 때 하므로 홈에서는 호칭을 부르지 않는다.
// "나의 시작 찾기" 입구는 주 버튼 아래. 시작 단계는 로그인한 분마다 저장하므로(user-levels.js) 홈 카드에는 표시하지 않는다.

import { h } from '../ui/components.js';
import { challengeFor, findProgramInfo } from './catalog.js';
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

/**
 * 짝 도전 활동 칸 (기본 활동 카드 아래). 프로그램이 아직 없으면 "준비 중"으로 누를 수 없다.
 * 기본 활동 카드와 누르는 영역을 따로 두어, 기본 활동을 누르려다 도전을 누르지 않게 한다.
 */
function challengeSlot(c, ready, onPick) {
  const head = h('span', { class: 'home-challenge-tag' }, '도전');
  if (!ready) {
    return h(
      'div',
      { class: 'home-challenge is-waiting', 'aria-label': `도전 ${c.name}, 준비 중` },
      head,
      h('span', { class: 'home-challenge-name' }, c.name),
      h('span', { class: 'home-challenge-go' }, '준비 중'),
    );
  }
  return h(
    'button',
    { type: 'button', class: 'home-challenge', onClick: onPick, 'aria-label': `도전 ${c.name}, ${c.short}` },
    head,
    h('span', { class: 'home-challenge-name' }, c.name),
    h('span', { class: 'home-challenge-go', 'aria-hidden': 'true' }, '›'),
  );
}

/**
 * 코스 카드 하나. 누르면 그 활동 하나만 시작한다 (로그인 없이, docs/decisions.md 4-1).
 * 코스 전체는 위쪽 "오늘의 활동 시작하기" 버튼으로 시작한다.
 * 아래 칸에는 같은 도구로 하는 짝 도전 활동이 붙는다 (catalog.js CHALLENGES).
 */
function courseCard(p, order, app) {
  const c = challengeFor(p.id);
  const ready = Boolean(c && app.hasProgram?.(c.id));
  return h(
    'li',
    { class: `home-course-item step${p.step}` },
    h(
      'button',
      { type: 'button', class: `home-course-card step${p.step}`, onClick: () => app.startProgram(p.id), 'aria-label': `${order}번째 ${p.name}, 하나만 해 보기` },
      h('span', { class: 'home-course-head' }, art(p.step), h('span', { class: 'home-course-order' }, `${order}번째`)),
      h(
        'span',
        { class: 'home-course-text' },
        h('span', { class: 'home-course-name' }, p.name),
        h('span', { class: 'home-course-desc' }, p.short),
      ),
      h('span', { class: 'home-course-go', 'aria-hidden': 'true' }, '하나만 해 보기 ›'),
    ),
    c ? challengeSlot(c, ready, () => app.startProgram(c.id)) : null,
  );
}

/** 나의 시작 찾기 입구. 누르면 먼저 로그인한다 (코스처럼, 손님도 할 수 있음) */
function findStartEntry(app) {
  if (!app.openFindStart) return null;
  return h(
    'div',
    { class: 'home-find' },
    h('span', {}, '어디서부터 할지 모르겠다면'),
    h('button', { type: 'button', class: 'home-find-btn', onClick: app.openFindStart }, '나의 시작 찾기'),
  );
}

/**
 * @param container  그릴 자리
 * @param app        { settings, plan: [programId...], openSettings(), startProgram(id), startCourse(), hasProgram(id),
 *                     openFindStart() (없으면 입구를 그리지 않음) }
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
          findStartEntry(app),
          // "지난 기록 보기"는 어르신이 보는 홈에서 설정 영역으로 옮김 (2026-11-26). 상단 바 결과 버튼은 그대로
          // 기본 활동의 난이도·속도. 도전 칸이 붙으면서 1280×720에 들어가게 아래 줄에서 이리로 옮김 (11/20)
          h(
            'div',
            { class: 'home-current' },
            h('span', {}, `난이도 ${labelOf(DIFFICULTIES, settings.difficulty)} · 속도 ${labelOf(SPEEDS, settings.speed)}`),
            h('button', { type: 'button', class: 'link-button', onClick: app.openSettings }, '바꾸기'),
          ),
        ),
      ),
      // 시연 코스 순서 (src/data/course.json, #59)
      h('ol', { class: 'home-course', 'aria-label': `오늘의 활동 ${plan.length}가지, 차례대로` }, plan.map((p, i) => courseCard(p, i + 1, app))),
    ),
  );
}
