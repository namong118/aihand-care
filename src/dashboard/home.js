// 홈 화면: 사용자 선택·추가, STEP 1~4 카드, 난이도·속도 설정.

import { h, button, message } from '../ui/components.js';
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
 * @param app        { settings, users, selectUser(name), addUser(name), setSetting(key, value),
 *                     startProgram(id), showResults() }
 */
export function renderHome(container, app) {
  const { settings, users } = app;
  container.innerHTML = '';

  // ---- 사용자 ----
  const nameInput = h('input', {
    type: 'text',
    id: 'new-user',
    maxlength: '20',
    placeholder: '이름 (예: 김영희)',
    autocomplete: 'off',
  });
  const addUser = () => {
    const name = nameInput.value.trim();
    if (name) app.addUser(name);
  };
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addUser();
  });

  const userSection = h(
    'section',
    { class: 'section card' },
    h('h2', {}, '1. 누가 하시나요?'),
    users.length === 0
      ? h('p', {}, '아직 등록된 이름이 없어요. 아래에 이름을 넣고 "추가"를 눌러 주세요.')
      : h(
          'div',
          { class: 'row', role: 'group', 'aria-label': '사용자 선택' },
          users.map((u) =>
            button(u, () => app.selectUser(u), { variant: 'choice', pressed: settings.user === u }),
          ),
        ),
    h(
      'div',
      { class: 'row' },
      h('label', { for: 'new-user' }, '새 이름'),
      nameInput,
      button('추가', addUser, { variant: 'secondary' }),
    ),
    h('p', { class: 'mock-status' }, '이름만 저장해요. 다른 개인정보는 넣지 마세요.'),
  );

  // ---- 설정 ----
  const settingSection = h(
    'section',
    { class: 'section card' },
    h('h2', {}, '2. 설정'),
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
  const noUser = !settings.user;
  const programSection = h(
    'section',
    { class: 'section' },
    h('h2', {}, '3. 활동 고르기'),
    noUser ? message('먼저 위에서 이름을 골라 주세요.', 'info') : null,
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
          button('시작하기', () => app.startProgram(p.id), { disabled: noUser }),
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
    userSection,
    settingSection,
    programSection,
  );
}
