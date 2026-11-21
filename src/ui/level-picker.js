// 도전 활동 시작 화면의 단계 고르기 (공통 부품). 숫자 야구·이어 세기·카드 섞기가 같이 쓴다 (#132).
// 도전 활동은 모두 1·2·3단계를 쓴다. 기본 활동의 쉬움·보통·어려움과 섞이지 않게 숫자로 부른다.
// 모양은 styles.css "도전 활동 단계 고르기"(level-*) 클래스.
//
//   container.append(levelPicker({
//     title: '숫자 야구',
//     lead: '로봇이 몰래 정한 숫자를 숫자 카드로 맞혀 보세요.',
//     levels: [{ level: 1, desc: '숫자 3개, 없는 숫자를 알려 줘요' }, ...],
//     selected: 1,                       // 미리 고른 단계 (ctx.settings.challengeLevel, 없으면 1)
//     onStart: (level) => { ... },
//   }));

import { h, button } from './components.js';

export function levelPicker({ title, lead, levels, selected = 1, onStart, startLabel = '시작하기' }) {
  let current = levels.some((l) => l.level === selected) ? selected : levels[0].level;
  const buttons = new Map();

  function paint() {
    for (const [level, el] of buttons) {
      const on = level === current;
      el.setAttribute('aria-pressed', String(on));
      el.classList.toggle('is-selected', on);
      el.querySelector('.level-mark').textContent = on ? '✔ 고름' : '';
    }
  }

  const list = h(
    'div',
    { class: 'level-list', role: 'group', 'aria-label': '단계 고르기' },
    levels.map((l) => {
      const el = h(
        'button',
        { type: 'button', class: 'level-option', onClick: () => { current = l.level; paint(); } },
        h('span', { class: 'level-name' }, `${l.level}단계`),
        h('span', { class: 'level-desc' }, l.desc),
        h('span', { class: 'level-mark', 'aria-hidden': 'true' }),
      );
      buttons.set(l.level, el);
      return el;
    }),
  );
  paint();

  return h(
    'div',
    { class: 'level-picker' },
    h(
      'div',
      { class: 'act-card' },
      h('p', { class: 'act-question', style: { 'font-size': '40px' } }, title),
      lead ? h('p', { class: 'act-text' }, lead) : null,
    ),
    list,
    h('div', { class: 'row' }, button(startLabel, () => onStart(current))),
  );
}
