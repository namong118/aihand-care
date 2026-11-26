// 설정 영역: 상단 바 "설정" 또는 홈 제목 아래 "바꾸기"를 누르면 상단 바 바로 아래에 열린다.
// 활동 전에 난이도와 진행 속도를 맞춘다.

import { h, button } from '../ui/components.js';
import { outlineButton } from './statusbar.js';
import { findProgramInfo } from './catalog.js';

/** 시작 단계 글자 "숫자 기억 보통 · 숫자 야구 1단계". 정한 것이 없으면 "홈 설정대로" */
function levelsText(levels) {
  const parts = Object.entries(levels).map(
    ([id, lv]) => `${findProgramInfo(id)?.name ?? id} ${typeof lv === 'number' ? `${lv}단계` : labelOf(DIFFICULTIES, lv)}`,
  );
  return parts.length > 0 ? parts.join(' · ') : '홈 설정대로';
}

// 사람별 시작 단계 고르기 (도전 활동). null = 정하지 않음 → 1단계
const CHALLENGE_CHOICES = [
  { value: null, label: '정하지 않음' },
  { value: 1, label: '1단계' },
  { value: 2, label: '2단계' },
  { value: 3, label: '3단계' },
];

/**
 * 사람별 시작 단계 (docs/decisions.md 3번). 설정에서 그분의 단계를 바꾼다. 자동으로 올리지 않는다.
 * 사람마다 한 줄(호칭 + 지금 단계 + [바꾸기]), [바꾸기]를 누른 분만 활동별 고르기가 열린다.
 */
function peopleSection(people) {
  const { users, levelsOf, activities, editing, onEdit, onSetLevel } = people;
  // 기본 활동. null = 정하지 않음 → 위 난이도
  const basicChoices = [{ value: null, label: '홈 설정대로' }, ...DIFFICULTIES];
  const head = h('div', { class: 'settings-row' }, h('span', { class: 'settings-label' }, '시작 단계'));
  if (users.length === 0) {
    head.append(h('span', { class: 'settings-levels' }, '등록한 분이 없어요. 사용자를 등록하면 그분마다 시작 단계를 정할 수 있어요.'));
    return head;
  }
  head.append(h('span', { class: 'settings-levels' }, '로그인한 분은 코스를 이 단계로 시작해요. 손님은 위 난이도대로예요.'));
  return [
    head,
    users.map((u) => {
      const levels = levelsOf(u.userId);
      const open = editing === u.userId;
      return [
        h(
          'div',
          { class: 'settings-row' },
          h('span', { class: 'settings-label' }, u.displayName),
          h(
            'div',
            { class: 'settings-choices' },
            h('span', { class: 'settings-levels' }, levelsText(levels)),
            button(open ? '닫기' : '바꾸기', () => onEdit(open ? null : u.userId), { variant: 'secondary' }),
          ),
        ),
        open
          ? activities.map((a) =>
              choiceRow(
                `${u.displayName} · ${a.name}`,
                a.challenge ? CHALLENGE_CHOICES : basicChoices,
                levels[a.id] ?? null,
                (v) => onSetLevel(u.userId, a.id, v),
                a.name,
              ),
            )
          : null,
      ];
    }),
  ];
}

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

/** label: 화면에 보이는 짧은 이름 (없으면 title). title 은 화면 읽기용 이름 */
function choiceRow(title, list, current, onPick, label = title) {
  return h(
    'div',
    { class: 'settings-row', role: 'group', 'aria-label': title },
    h('span', { class: 'settings-label' }, label),
    h(
      'div',
      { class: 'settings-choices' },
      list.map((x) => choice(x.label, current === x.value, () => onPick(x.value))),
    ),
  );
}

/**
 * @param el   설정 영역 자리. 닫혀 있으면 비워서 숨긴다
 * @param opts { open, settings, setSetting(key, value), close(), openRegister() }
 *   openRegister: 사용자 등록 화면(#84)으로. 없으면 버튼을 그리지 않는다
 *   openResults: 결과 화면("지난 기록 보기")으로. 없으면 버튼을 그리지 않는다
 *   openForget: 사용자 지우기 화면(forget.js)으로. 없으면 버튼을 그리지 않는다
 *   people: 사람별 시작 단계 (없으면 그리지 않는다)
 *     { users: [{ userId, displayName }], levelsOf(userId), activities: [{ id, name, challenge }],
 *       editing: 바꾸는 중인 userId | null, onEdit(userId | null), onSetLevel(userId, 활동 id, 단계 | null) }
 */
export function renderSettings(el, { open, settings, setSetting, close, openRegister, openForget = null, openResults = null, people = null }) {
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
        '활동 전에 맞춰 두는 항목입니다. 로봇 동작 속도도 함께 바뀝니다.',
      ),
      // 로그인한 분은 코스를 위 난이도 대신 그분의 시작 단계로 시작한다 (나의 시작 찾기 또는 여기서 정함)
      people ? peopleSection(people) : null,
      // 지난 기록 보기: 어르신 화면(홈)에서 이리로 옮김 (2026-11-26)
      openResults
        ? h(
            'div',
            { class: 'settings-row' },
            h('span', { class: 'settings-label' }, '활동 기록'),
            h('div', { class: 'settings-choices' }, button('지난 기록 보기', openResults, { variant: 'secondary' })),
          )
        : null,
      // 사용자 등록은 설정에서 한다 (#82, 등록 화면 #84). 어르신 화면(홈)에는 두지 않는다
      openRegister
        ? h(
            'div',
            { class: 'settings-row' },
            h('span', { class: 'settings-label' }, '사용자'),
            h(
              'div',
              { class: 'settings-choices' },
              button('사용자 등록하기', openRegister, { variant: 'secondary' }),
              // 동의서 "지우는 방법": 화면에서 직접 지운다 (얼굴은 카메라에서 따로)
              openForget ? button('사용자 지우기', openForget, { variant: 'secondary' }) : null,
            ),
          )
        : null,
    ),
  );
}
