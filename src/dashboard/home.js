// 홈 화면: 제목, 지금 설정(난이도·속도) 알약과 "바꾸기", STEP 1~4 활동 카드.
// 설정 영역 자체는 settings.js, 상단 바는 statusbar.js.

import { h } from '../ui/components.js';
import { CATALOG } from './catalog.js';
import { DIFFICULTIES, SPEEDS, labelOf } from './settings.js';
import { svgIcon } from './statusbar.js';

const NS = 'http://www.w3.org/2000/svg';

/** 손 그림: code 는 [엄지,검지,중지,약지,새끼] 1=펴짐. 펴진 손가락은 길고 진하게 */
function handSvg(code, { up, down, palm, width = 84, height = 72 }) {
  const xs = [6, 20, 34, 48, 62];
  const openTop = [20, 6, 4, 6, 12]; // 시안의 손가락 길이 (엄지·새끼는 짧게)
  const fingers = [...code]
    .map((bit, i) => {
      const open = bit === '1';
      const top = open ? openTop[i] : 38;
      return `<rect x="${xs[i]}" y="${top}" width="11" height="${54 - top}" rx="5.5" fill="${open ? up : down}"/>`;
    })
    .join('');
  return `<svg width="${width}" height="${height}" viewBox="0 0 84 72" xmlns="${NS}">${fingers}<rect x="3" y="48" width="74" height="22" rx="8" fill="${palm}"/></svg>`;
}

/** 카드 오른쪽 위 그림. 이모지 대신 SVG·HTML 도형 */
function art(step) {
  if (step === 1) {
    // STEP 1: 로봇이 손가락으로 숫자를 차례로 보여준다 → 손모양 타일 3개 (숫자 2·1·5, 마지막이 지금 차례)
    const tile = (code, last) =>
      h(
        'span',
        { class: `art-tile${last ? ' art-tile-on' : ''}` },
        svgIcon(
          handSvg(code, {
            up: last ? '#FFFFFF' : 'var(--step1-fg)',
            down: last ? 'rgba(255,255,255,0.45)' : 'var(--step1-soft)',
            palm: last ? 'rgba(255,255,255,0.3)' : 'var(--step1-soft)',
            width: 40,
            height: 34,
          }),
        ),
      );
    return h('div', { class: 'art art-tiles', 'aria-hidden': 'true' }, tile('01100', false), tile('01000', false), tile('11111', true));
  }
  if (step === 2) {
    return svgIcon(handSvg('01100', { up: 'var(--step2-btn)', down: '#F3C9A6', palm: 'var(--step2-bg)' }));
  }
  if (step === 3) {
    return h(
      'div',
      { class: 'art art-stroop', 'aria-hidden': 'true' },
      h('span', { class: 'art-word' }, '빨강'),
      h(
        'div',
        { class: 'art-swatches' },
        ['#D64545', '#2F5BD3', '#E8A317', '#2B9466'].map((c) => h('span', { style: { background: c } })),
      ),
    );
  }
  return svgIcon(handSvg('11111', { up: 'var(--step4-btn)', down: 'var(--step4-btn)', palm: 'var(--step4-bg)' }));
}

function card(p, onStart) {
  return h(
    'article',
    { class: `home-card step${p.step}` },
    h(
      'div',
      { class: 'home-card-head' },
      h(
        'div',
        { class: 'home-card-title' },
        h('span', { class: 'step-pill' }, `STEP ${p.step} · ${p.tag}`),
        h('h2', {}, p.title),
      ),
      art(p.step),
    ),
    h('p', { class: 'home-card-desc' }, p.desc),
    h('button', { type: 'button', class: 'home-start', onClick: () => onStart(p.id) }, '시작하기'),
  );
}

/**
 * @param container  그릴 자리
 * @param app        { settings, openSettings(), startProgram(id), startCourse() }
 */
export function renderHome(container, app) {
  const { settings } = app;
  container.innerHTML = '';
  container.append(
    h(
      'div',
      { class: 'home' },
      h(
        'div',
        { class: 'home-hero' },
        h('h1', {}, '오늘은 어떤 놀이를 해 볼까요?'),
        h(
          'div',
          { class: 'home-current' },
          h('span', { class: 'pill pill-outline' }, `난이도 · ${labelOf(DIFFICULTIES, settings.difficulty)}`),
          h('span', { class: 'pill pill-outline' }, `속도 · ${labelOf(SPEEDS, settings.speed)}`),
          h('button', { type: 'button', class: 'link-button', onClick: app.openSettings }, '바꾸기'),
        ),
      ),
      // 시연 코스: 네 활동을 순서대로 이어서 (#59). 아래 카드는 하나씩 따로 할 때
      h(
        'section',
        { class: 'course-start' },
        h(
          'div',
          { class: 'course-start-text' },
          h('h2', {}, '활동 4가지 이어서 하기'),
          h('p', {}, '손운동부터 색깔손까지 차례대로 해요.'),
        ),
        h('button', { type: 'button', class: 'home-start course-start-btn', onClick: app.startCourse }, '코스 시작하기'),
      ),
      h('div', { class: 'home-grid' }, CATALOG.map((p) => card(p, app.startProgram))),
    ),
  );
}
