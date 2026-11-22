// 나의 시작 찾기 화면: 시작 안내, 짧은 판 위쪽 막대, 도전 활동 안내, 추천 화면.
// 진행(어느 활동인지, 기록을 받았는지)은 main.js 가 하고, 여기서는 그리기만 한다.
// 순서·추천은 find-start-logic.js. 화면에는 "묶음" 같은 말을 쓰지 않고 활동 이름만 쓴다.
// 추천은 "이 단계부터 시작해 보세요"로만 보여 준다. 점수·판정처럼 보이는 말은 쓰지 않는다.

import { h, button } from '../ui/components.js';
import { findProgramInfo } from './catalog.js';
import { DIFFICULTIES, labelOf } from './settings.js';
import { BASIC_LEVELS, CHALLENGE_LEVELS } from './find-start-logic.js';

const nameOf = (id) => findProgramInfo(id)?.name ?? id;
const stepOf = (id) => findProgramInfo(id)?.step ?? null;
const stepClass = (id) => (stepOf(id) ? ` step${stepOf(id)}` : '');

/** 단계 글자: 기본 활동 "보통", 도전 활동 "2단계" */
export function levelText(id, level) {
  return typeof level === 'number' ? `${level}단계` : labelOf(DIFFICULTIES, level);
}

/** 짝 제목 "숫자 기억 → 숫자 야구" */
function pairTitle(g) {
  return `${nameOf(g.basic)} → ${nameOf(g.challenge)}`;
}

/** 아직 준비 중인 짝 한 줄 (색 동그라미 + 활동 이름 + "준비 중") */
function laterRow(g) {
  return h(
    'li',
    { class: `find-later${stepClass(g.basic)}` },
    h('span', { class: 'find-dot', 'aria-hidden': 'true' }),
    h('span', { class: 'find-later-name' }, `${nameOf(g.basic)} · ${nameOf(g.challenge)}`),
    h('span', { class: 'find-later-note' }, '준비 중 · 지금 설정 그대로'),
  );
}

/**
 * 시작 안내.
 * @param o.groups  지금 해 볼 짝 (ready)
 * @param o.onStart "시작하기"
 * @param o.onHome  "홈으로"
 */
export function renderFindStartIntro(container, { groups, onStart, onHome }) {
  const minutes = groups.reduce((sum, g) => sum + (g.minutes ?? 0), 0);
  container.innerHTML = '';
  container.append(
    h(
      'div',
      { class: 'course find-start' },
      h('h1', {}, '나의 시작 찾기'),
      h('p', {}, '몇 가지를 짧게 해 보고, 어디서부터 시작하면 좋을지 알려 드릴게요.'),
      groups.map((g) =>
        h(
          'section',
          { class: `find-pair${stepClass(g.basic)}` },
          h('div', { class: 'find-pair-head' }, h('h2', {}, pairTitle(g)), g.minutes ? h('span', { class: 'find-minutes' }, `약 ${g.minutes}분`) : null),
          h(
            'div',
            { class: 'find-pair-flow' },
            h('div', { class: 'find-box' }, h('span', { class: 'find-box-tag' }, '기본 활동'), h('strong', {}, nameOf(g.basic)), h('span', {}, g.basicText ?? '')),
            h('span', { class: 'find-arrow' }, '해내시면 이어서 →'),
            h(
              'div',
              { class: 'find-box is-challenge' },
              h('span', { class: 'find-box-tag' }, '도전 활동'),
              h('strong', {}, `${nameOf(g.challenge)} 1단계`),
              h('span', {}, g.challengeText ?? ''),
            ),
          ),
        ),
      ),
      minutes > 0 && groups.length > 1 ? h('p', {}, `모두 약 ${minutes}분 걸려요.`) : null,
      h('p', { class: 'find-note' }, '중간에 그만두셔도 괜찮아요. 언제든 홈에서 다시 하실 수 있어요.'),
      h('div', { class: 'row' }, button('시작하기', onStart), button('홈으로', onHome, { variant: 'secondary' })),
    ),
  );
}

/**
 * 짧은 판 활동 화면 위쪽 막대 (기존 program-bar 대신).
 *   "나의 시작 찾기 · 숫자 기억 · 기본 활동 · 1 / 2"   [건너뛰기] [그만하기]
 * 건너뛰기·그만하기는 한 번 더 묻는다 (코스 막대와 같은 방식).
 * @param o.program  활동 id
 * @param o.role     'basic' | 'challenge'
 * @param o.no       지금 몇 번째 (1부터)
 * @param o.of       최대 몇 개
 */
export function createFindStartBar({ program, role, no, of, onSkip, onStop }) {
  const roleText = role === 'basic' ? '기본 활동' : '도전 활동 · 1단계';
  const actions = h('div', { class: 'course-actions' });
  const el = h(
    'div',
    { class: `program-bar course-bar find-bar${stepClass(program)}` },
    h(
      'h1',
      { class: 'find-bar-title' },
      h('span', { class: 'step-pill' }, '나의 시작 찾기'),
      ` ${nameOf(program)} `,
      h('span', { class: 'find-bar-sub' }, `${roleText} · ${no} / ${of}`),
    ),
    actions,
  );

  function normal() {
    actions.replaceChildren(
      button('건너뛰기', () => ask('이 활동은 다음에 할까요?', '건너뛰기', onSkip), { variant: 'secondary' }),
      button('그만하기', () => ask('나의 시작 찾기를 그만할까요?', '그만하기', onStop), { variant: 'secondary' }),
    );
  }

  function ask(question, yesLabel, onYes) {
    actions.replaceChildren(
      h('span', { class: 'course-ask', role: 'status' }, question),
      button(yesLabel, onYes),
      button('계속하기', normal, { variant: 'secondary' }),
    );
  }

  normal();
  return { el };
}

/**
 * 기본 활동을 해낸 뒤, 도전 활동으로 넘어가기 전 안내.
 * @param o.group   짝
 * @param o.onGo    "해 볼게요"
 * @param o.onPass  "이번엔 넘어가기"
 * @param o.onStop  "그만하기"
 */
export function renderFindStartBetween(container, { group, onGo, onPass, onStop }) {
  const c = findProgramInfo(group.challenge);
  container.innerHTML = '';
  container.append(
    h(
      'div',
      { class: `course find-start find-between${stepClass(group.basic)}` },
      h('p', { class: 'find-done', role: 'status' }, `✔ ${nameOf(group.basic)} · 해내셨어요`),
      h('h1', {}, `이번에는 ${nameOf(group.challenge)}를 1단계로 해 볼게요`),
      c?.desc ? h('p', {}, c.desc) : null,
      group.challengeText ? h('p', { class: 'find-note' }, group.challengeText) : null,
      h(
        'div',
        { class: 'row' },
        button('해 볼게요', onGo),
        button('이번엔 넘어가기', onPass, { variant: 'secondary' }),
        button('그만하기', onStop, { variant: 'secondary' }),
      ),
    ),
  );
}

/** 단계 고르기 한 줄. 선택된 것은 ✔ (색만으로 구분하지 않게) */
function levelRow(id, levels, selected, onPick) {
  return h(
    'div',
    { class: 'find-level-row', role: 'group', 'aria-label': `${nameOf(id)} 시작 단계` },
    h('span', { class: 'find-level-name' }, nameOf(id)),
    h(
      'div',
      { class: 'row' },
      levels.map((lv) => button(levelText(id, lv), () => onPick(lv), { variant: 'choice', pressed: selected === lv })),
    ),
    h('span', { class: 'find-level-tail' }, '부터 시작'),
  );
}

/**
 * 추천 화면. 추천 단계가 골라진 채로 나오고, 눌러서 바꿀 수 있다.
 * @param o.rows    [{ group, pick: { basic, challenge }, recommended: boolean }]
 *                  recommended 가 false 면(기본 활동을 건너뜀) 지금 설정이 골라져 있고, 바꾸지 않으면 저장하지 않는다
 * @param o.later   준비 중인 짝
 * @param o.onSave  (levels) => 저장하고 홈으로. levels = { 활동 id: 단계 }
 * @param o.onHome  "저장하지 않고 홈으로"
 */
export function renderFindStartRecommend(container, { rows, later, onSave, onHome }) {
  const state = rows.map((r) => ({ ...r, pick: { ...r.pick }, touched: false }));

  function levelsToSave() {
    const out = {};
    for (const r of state) {
      if (!r.recommended && !r.touched) continue;
      out[r.group.basic] = r.pick.basic;
      out[r.group.challenge] = r.pick.challenge;
    }
    return out;
  }

  function draw() {
    container.innerHTML = '';
    container.append(
      h(
        'div',
        { class: 'course find-start find-recommend' },
        h('h1', {}, '이 단계부터 시작해 보세요'),
        h('p', {}, '마음에 들지 않으면 눌러서 바꾸실 수 있어요.'),
        state.map((r) =>
          h(
            'section',
            { class: `find-pair${stepClass(r.group.basic)}` },
            h('h2', {}, pairTitle(r.group)),
            r.recommended ? null : h('p', { class: 'find-note' }, '이번에 하지 않으셔서 지금 설정이 골라져 있어요.'),
            levelRow(r.group.basic, BASIC_LEVELS, r.pick.basic, (lv) => {
              r.pick.basic = lv;
              r.touched = true;
              draw();
            }),
            levelRow(r.group.challenge, CHALLENGE_LEVELS, r.pick.challenge, (lv) => {
              r.pick.challenge = lv;
              r.touched = true;
              draw();
            }),
          ),
        ),
        later.length > 0 ? h('ul', { class: 'find-later-list' }, later.map(laterRow)) : null,
        h('p', { class: 'find-note' }, '설정에서 언제든 지우실 수 있어요.'),
        h(
          'div',
          { class: 'row' },
          button('이대로 시작하기', () => onSave(levelsToSave())),
          button('저장하지 않고 홈으로', onHome, { variant: 'secondary' }),
        ),
      ),
    );
  }

  draw();
}
