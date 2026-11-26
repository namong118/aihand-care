// 설정 영역: 상단 바 "설정" 또는 홈 제목 아래 "바꾸기"를 누르면 상단 바 바로 아래에 열린다.
// 활동 전에 난이도와 진행 속도를 맞춘다.

import { h, button } from '../ui/components.js';
import { pageHead, pageTile, pageCard, headButton } from '../ui/page.js';
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
  if (users.length === 0) {
    return h('p', { class: 'settings-levels' }, '등록한 분이 없어요. 사용자를 등록하면 그분마다 시작 단계를 정할 수 있어요.');
  }
  const head = h('p', { class: 'settings-levels' }, '로그인한 분은 코스를 이 단계로 시작해요. 나의 시작 찾기를 다시 해도 바뀌어요.');
  return [
    head,
    users.map((u) => {
      const levels = levelsOf(u.userId);
      const open = editing === u.userId;
      // 한 분 = 회색 칸 하나. 머리 줄(호칭 + 지금 단계 + [바꾸기]), 펼치면 기본 활동·도전 활동 고르기
      const pick = (list) =>
        list.map((a) =>
          choiceRow(
            `${u.displayName} · ${a.name}`,
            a.challenge ? CHALLENGE_CHOICES : basicChoices,
            levels[a.id] ?? null,
            (v) => onSetLevel(u.userId, a.id, v),
            a.name,
          ),
        );
      return h(
        'div',
        { class: `settings-person${open ? ' is-open' : ''}` },
        h(
          'div',
          { class: 'settings-person-head' },
          h('strong', {}, u.displayName),
          h('span', { class: 'settings-levels' }, levelsText(levels)),
          headButton(open ? '닫기' : '바꾸기', () => onEdit(open ? null : u.userId)),
        ),
        open
          ? [
              h('p', { class: 'settings-group' }, '기본 활동'),
              pick(activities.filter((a) => !a.challenge)),
              h('p', { class: 'settings-group' }, '도전 활동'),
              pick(activities.filter((a) => a.challenge)),
            ]
          : null,
      );
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
  // 바로 가기 칸: 사용자 등록(#82, #84) · 사용자 지우기(동의서 "지우는 방법") · 지난 기록(홈에서 옮김, 2026-11-26)
  const tiles = [
    openRegister ? pageTile('사용자 등록하기', '호칭과 얼굴을 등록해요', openRegister) : null,
    openForget ? pageTile('사용자 지우기', '등록한 분과 그분의 기록을 지워요', openForget) : null,
    openResults ? pageTile('지난 기록 보기', '날짜별·활동별 기록', openResults) : null,
  ].filter(Boolean);
  el.append(
    h(
      'section',
      { class: 'page settings-page', 'aria-label': '설정' },
      pageHead('활동 전에 맞춰 두는 곳', '설정', headButton('닫기', close)),
      h(
        'div',
        { class: 'settings-grid' },
        pageCard(
          '활동 맞춤',
          choiceRow('난이도', DIFFICULTIES, settings.difficulty, (v) => setSetting('difficulty', v)),
          choiceRow('진행 속도', SPEEDS, settings.speed, (v) => setSetting('speed', v)),
          h('p', { class: 'settings-note' }, '로봇 동작 속도도 함께 바뀌어요. 손님과 하나만 해 보기는 이 난이도로 해요.'),
        ),
        tiles.length > 0 ? pageCard('사용자와 기록', h('div', { class: 'page-tiles' }, tiles)) : null,
      ),
      // 로그인한 분은 코스를 위 난이도 대신 그분의 시작 단계로 시작한다 (나의 시작 찾기 또는 여기서 정함)
      people ? pageCard('사람별 시작 단계', peopleSection(people)) : null,
    ),
  );
}
