// 설정 영역: 상단 바 "설정" 또는 홈 제목 아래 "바꾸기"를 누르면 상단 바 바로 아래에 열린다.
// 보호자·선생님이 활동 전에 난이도와 진행 속도를 맞춘다.

import { h } from '../ui/components.js';
import { outlineButton } from './statusbar.js';

export const DIFFICULTIES = [
  { value: 'easy', label: '쉬움' },
  { value: 'normal', label: '보통' },
  { value: 'hard', label: '어려움' },
];
export const SPEEDS = [
  { value: 'SLOW', label: '천천히' },
  { value: 'NORMAL', label: '보통' },
];

export function labelOf(list, value) {
  return list.find((x) => x.value === value)?.label ?? value;
}

/** 선택 버튼. 선택된 것은 파란 배경 + ✔ (색만으로 구분하지 않게) */
function choice(label, on, onClick) {
  return h(
    'button',
    { type: 'button', class: 'choice', 'aria-pressed': String(on), onClick },
    on ? `✔ ${label}` : label,
  );
}

function choiceRow(title, list, current, onPick) {
  return h(
    'div',
    { class: 'settings-row', role: 'group', 'aria-label': title },
    h('span', { class: 'settings-label' }, title),
    h(
      'div',
      { class: 'settings-choices' },
      list.map((x) => choice(x.label, current === x.value, () => onPick(x.value))),
    ),
  );
}

/**
 * @param el   설정 영역 자리. 닫혀 있으면 비워서 숨긴다
 * @param opts { open, settings, setSetting(key, value), close() }
 */
export function renderSettings(el, { open, settings, setSetting, close }) {
  el.innerHTML = '';
  el.hidden = !open;
  if (!open) return;
  el.append(
    h(
      'section',
      { class: 'settings-panel', 'aria-label': '설정' },
      h('div', { class: 'settings-head' }, h('h2', {}, '설정'), outlineButton('닫기', close)),
      choiceRow('난이도', DIFFICULTIES, settings.difficulty, (v) => setSetting('difficulty', v)),
      choiceRow('진행 속도', SPEEDS, settings.speed, (v) => setSetting('speed', v)),
      h(
        'p',
        { class: 'settings-note' },
        '보호자나 선생님이 활동 전에 맞춰 두는 항목입니다. 로봇 동작 속도도 함께 바뀝니다.',
      ),
    ),
  );
}
