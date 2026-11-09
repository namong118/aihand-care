// 홈 화면: STEP 1~4 카드, 난이도·속도 설정.

import { h, button } from '../ui/components.js';
import { CATALOG } from './catalog.js';

const DIFFICULTIES = [
  { value: 'easy', label: '쉬움' },
  { value: 'normal', label: '보통' },
  { value: 'hard', label: '어려움' },
];
const SPEEDS = [
  { value: 'SLOW', label: '천천히' },
  { value: 'NORMAL', label: '보통' },
];

/**
 * @param container  그릴 자리
 * @param app        { settings, setSetting(key, value), startProgram(id), showResults() }
 */
export function renderHome(container, app) {
  const { settings } = app;
  container.innerHTML = '';

  // ---- 설정 ----
  const settingSection = h(
    'section',
    { class: 'section card' },
    h('h2', {}, '1. 설정'),
    h(
      'div',
      { class: 'row', role: 'group', 'aria-label': '난이도' },
      h('strong', {}, '난이도'),
      DIFFICULTIES.map((d) =>
        button(d.label, () => app.setSetting('difficulty', d.value), {
          variant: 'choice',
          pressed: settings.difficulty === d.value,
        }),
      ),
    ),
    h(
      'div',
      { class: 'row', role: 'group', 'aria-label': '진행 속도' },
      h('strong', {}, '진행 속도'),
      SPEEDS.map((s) =>
        button(s.label, () => app.setSetting('speed', s.value), {
          variant: 'choice',
          pressed: settings.speed === s.value,
        }),
      ),
    ),
  );

  // ---- 프로그램 카드 ----
  const programSection = h(
    'section',
    { class: 'section' },
    h('h2', {}, '2. 활동 고르기'),
    h(
      'div',
      { class: 'cards' },
      CATALOG.map((p) =>
        h(
          'article',
          { class: 'card step-card' },
          h('span', { class: 'step-no' }, `STEP ${p.step}`),
          h('h3', {}, p.title),
          h('p', {}, p.desc),
          button('시작하기', () => app.startProgram(p.id)),
        ),
      ),
    ),
  );

  container.append(
    h(
      'div',
      { class: 'program-bar' },
      h('h1', {}, 'AIHand 손활동'),
      button('활동 기록 보기', () => app.showResults(), { variant: 'secondary' }),
    ),
    settingSection,
    programSection,
  );
}
