// STEP 4 화면 그리기. 판정은 하지 않고 보여주기만 한다.
// 모양은 styles.css "활동 화면 공통"(act-*) 클래스 (시안 v11, docs/ui-classes.md)

import { h, button, message } from '../../ui/components.js';
import { handIcon } from '../../ui/icons.js';
import { speak } from '../../ui/voice.js';
import { stepLine, OLD_HAND_TEXT, REST_DONE_TEXT, REST_SKIPPED_TEXT, REST_SKIPPED_VOICE, FINISH_TEXT } from './logic.js';

const METHOD_TEXT = {
  detected: '손 인식으로 확인',
  manual: '"따라 했어요" 버튼',
  skipped: '건너뜀',
};

/**
 * 게이지 카드와 미리 든 손 안내를 같은 칸에 겹쳐 두고 하나만 보이게 한다 (#101).
 * 안내가 따로 줄을 차지하면 뜰 때 "따라 했어요/건너뛰기" 버튼이 화면 밖으로 밀렸다.
 * 칸 높이는 둘 중 큰 쪽(게이지 카드)으로 정해지고, visibility 로만 바꾸므로 높이가 변하지 않는다.
 * 미리 든 손일 때는 게이지가 어차피 차지 않으니 그 자리에 안내를 보여 준다.
 */
const HOLD_PANEL_STYLE = { display: 'grid' };
const HOLD_LAYER_STYLE = { 'grid-area': '1 / 1' };

/**
 * 루틴 카드 배치: 항상 2열 (루틴 4개면 2×2). 300px 보다 좁아지는 화면에서만 1열.
 * 홈 카드(home-grid)는 카드 최소 폭이 460px 라서, 로봇이 Mock 일 때 오른쪽에 가상 로봇손 칸이 붙으면
 * 활동 화면 폭이 좁아져 1열(1×4)이 된다. 카드 최소 폭을 "폭의 절반"으로 잡아 그때도 2열이 되게 한다.
 * 카드 사이 간격은 16px (아래 grid 의 gap 과 같은 값). 홈(24px)보다 좁혀 세로 공간을 아낀다.
 */
const CHOOSER_COLUMNS =
  'repeat(auto-fit, minmax(min(100%, max(300px, calc((100% - 16px) / 2))), 1fr))';

/** 루틴 카드(버튼) 모양. 홈 코스 카드처럼 STEP 4 파스텔 면 (시안 v11). 테두리 없이 높이를 줄인다 */
const CHOOSER_CARD_STYLE = {
  'text-align': 'left',
  font: 'inherit',
  color: 'inherit',
  cursor: 'pointer',
  padding: '18px 24px',
  gap: '6px',
  'min-height': '64px',
  'justify-content': 'center', // 옆 카드 제목이 2줄이라 카드가 높아져도 내용은 세로 가운데
  border: '0',
  background: 'var(--step-bg)',
};

/** 카드 오른쪽 위 "고르기 ›" 표시 (시작하기 버튼과 같은 색) */
const CHOOSER_GO_STYLE = {
  flex: 'none',
  background: 'var(--step-btn)',
  color: '#FFFFFF',
  'font-size': '24px', // 고령자 UX 기본값: 글씨 24px 이상 (#101)
  'font-weight': '600',
  padding: '6px 16px',
  'border-radius': 'var(--r-start)',
  'white-space': 'nowrap',
};

/** 한 번만 눌리는 버튼. 누르면 바로 잠가서 두 번 눌러도 회차가 두 개 시작되지 않게 한다 */
function onceButton(label, onClick, opts) {
  const btn = button(
    label,
    () => {
      if (btn.disabled) return;
      btn.disabled = true;
      onClick();
    },
    opts,
  );
  return btn;
}

export function createScreen(container, poses) {
  container.innerHTML = '';
  const area = h('div', { class: 'program-body' });
  container.append(area);
  const labelOf = (name) => poses.find((p) => p.name === name)?.label ?? name;
  const sayOf = (step) => stepLine(step, labelOf);
  let gaugeBar = null;
  let gaugeText = null;
  let countText = null;
  let oldNotice = null;
  let gaugeCard = null;
  let oldSpoken = false; // 이번 동작에서 미리 든 손 안내를 읽었는지 (동작마다 한 번만 읽는다)

  function set(...children) {
    area.innerHTML = '';
    gaugeBar = null;
    gaugeText = null;
    countText = null;
    oldNotice = null;
    gaugeCard = null;
    area.append(...children.flat().filter(Boolean));
  }

  return {
    /**
     * 루틴 고르기: 루틴 카드를 나란히 보여 준다 (넓은 화면에서 2열 → 루틴 4개면 2×2).
     * 홈 화면 활동 카드와 같은 클래스(home-grid, home-card step4)를 써서 모양을 맞춘다.
     *   items: [{ routine, stepCount }], onPick(routine)
     */
    chooser(items, onPick) {
      let picked = false;
      // 카드 전체가 버튼 하나다. 시연 화면(1280×720)에 카드 4개가 스크롤 없이 다 보이게
      // 카드 아래 따로 두던 64px 버튼을 없애고, 카드 위쪽 "고르기 ›" 표시로 누를 수 있음을 알린다.
      // 누르는 곳이 카드 전체라서 버튼보다 더 크다.
      // 카드에는 제목과 "고르기 ›"만 둔다 (#101). "동작 N개"(15px)와 설명(20px)은 글씨 24px 기준에 못 미치고
      // 가상 로봇손 칸이 붙으면 카드가 높아져서 일단 뺐다. 설명은 다음 화면(루틴 소개)에 나온다.
      // items 의 stepCount 는 다시 넣을 때를 위해 그대로 받는다
      const card = ({ routine }) =>
        h(
          'button',
          {
            type: 'button',
            class: 'home-card step4',
            style: CHOOSER_CARD_STYLE,
            onClick: () => {
              if (picked) return; // 두 번 눌러도 한 번만
              picked = true;
              onPick(routine);
            },
          },
          // 한 줄: 왼쪽 제목, 오른쪽 "고르기 ›". 카드가 좁으면 제목만 줄을 바꾼다
          h(
            'span',
            { style: { display: 'flex', 'align-items': 'center', gap: '12px' } },
            h(
              'span',
              { style: { flex: '1', 'min-width': '0', 'font-size': '28px', 'font-weight': '600', 'line-height': '1.3' } },
              routine.title,
            ),
            h('span', { style: CHOOSER_GO_STYLE }, '고르기 ›'),
          ),
        );
      set(
        h('h2', { style: { margin: '0', 'font-size': '28px' } }, '어떤 손운동을 해 볼까요? 카드를 눌러 골라 주세요.'),
        h(
          'div',
          // grid-auto-rows: 1fr → 모든 줄 높이를 가장 높은 줄에 맞춘다 (제목이 2줄인 카드가 있어도 카드 크기가 모두 같게)
          { class: 'home-grid', style: { 'grid-template-columns': CHOOSER_COLUMNS, 'grid-auto-rows': '1fr', gap: '16px' } },
          items.map(card),
        ),
      );
    },

    /** 루틴 소개. onBack 이 있으면 "다른 손운동 고르기" 버튼도 보여 준다 (루틴이 여러 개일 때) */
    intro(routine, onStart, onBack) {
      set(
        h(
          'div',
          { class: 'act-card' },
          h('p', { class: 'act-question', style: { 'font-size': '40px' } }, routine.title),
          h('p', { class: 'act-text' }, routine.description),
          h('p', { class: 'act-text' }, '로봇을 보면서 같은 손모양을 함께 만들어 주세요. 힘들면 건너뛰어도 괜찮아요.'),
        ),
        h(
          'div',
          { class: 'row' },
          onceButton('시작하기', onStart),
          onBack ? onceButton('다른 손운동 고르기', onBack, { variant: 'secondary' }) : null,
        ),
      );
    },

    waiting(text) {
      set(message(text, 'info'));
    },

    /**
     * 동작 하나: 진행 위치, 안내 문구, 숫자 세기, 유지 게이지, 대체 입력 버튼("따라 했어요"), 건너뛰기
     * info: { index, count, step, rounds, holdMs }
     */
    step({ index, count, step, rounds, holdMs }, { onDone, onSkip }) {
      const holdSec = (holdMs / 1000).toFixed(1);
      const where = rounds > 1 ? `동작 ${index} / ${count} · 반복 ${step.round} / ${rounds}` : `동작 ${index} / ${count}`;
      countText = h('p', { class: 'act-prompt', 'aria-live': 'polite', style: { padding: '0', color: 'var(--step-fg)', 'min-width': '2.5em' } }, '');
      oldSpoken = false;
      oldNotice = message(OLD_HAND_TEXT, 'info');
      Object.assign(oldNotice.style, {
        ...HOLD_LAYER_STYLE,
        margin: '0',
        display: 'flex',
        'align-items': 'center',
        visibility: 'hidden',
      });
      gaugeBar = h('div', { class: 'gauge-fill' });
      gaugeText = h('span', { class: 'act-label' }, `유지: 0.0 / ${holdSec}초`);
      const gauge = h(
        'div',
        { class: 'gauge', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' },
        gaugeBar,
      );
      area.innerHTML = '';
      area.append(
        h('div', { class: 'act-head' }, h('span', { class: 'act-progress' }, where)),
        h(
          'div',
          { class: 'act-card act-card-row' },
          h('span', { class: 'act-art act-art-lg' }, handIcon(step.pose, 58)),
          h(
            'div',
            { style: { display: 'flex', 'flex-direction': 'column', gap: '6px', flex: '1 1 300px', 'min-width': '0' } },
            h('p', { class: 'act-question', style: { 'font-size': '36px', 'line-height': '1.3' } }, sayOf(step)),
            h('p', { class: 'act-text' }, `손모양: ${labelOf(step.pose)} — 로봇처럼 ${holdSec}초 동안 해 주세요.`),
          ),
          countText,
        ),
        h(
          'div',
          { style: HOLD_PANEL_STYLE },
          (gaugeCard = h('div', { class: 'act-card', style: { ...HOLD_LAYER_STYLE, gap: '10px', padding: '20px 32px' } }, gauge, gaugeText)),
          oldNotice,
        ),
        h(
          'div',
          { class: 'act-foot' },
          button('따라 했어요', onDone),
          button('건너뛰기', onSkip, { variant: 'secondary' }),
        ),
      );
      speak(sayOf(step));
    },

    /**
     * 유지 상태 갱신 (0.1초마다).
     *   ratio 0~1 게이지, count 숫자 세기 말('하나' 등, 없으면 ''), showOld 미리 든 손 안내 표시 여부
     */
    hold({ ratio, stableMs, holdMs, count, showOld }) {
      if (!gaugeBar) return;
      const pct = Math.round(ratio * 100);
      gaugeBar.style.width = `${pct}%`;
      gaugeBar.parentElement.setAttribute('aria-valuenow', String(pct));
      const shown = ratio > 0 ? Math.min(stableMs, holdMs) : 0;
      gaugeText.textContent = `유지: ${(shown / 1000).toFixed(1)} / ${(holdMs / 1000).toFixed(1)}초`;
      if (countText.textContent !== count) countText.textContent = count;
      // 게이지 카드와 안내는 같은 칸에 겹쳐 있다. visibility 로 바꿔서 칸 높이가 변하지 않게 한다
      gaugeCard.style.visibility = showOld ? 'hidden' : 'visible';
      oldNotice.style.visibility = showOld ? 'visible' : 'hidden';
      if (showOld && !oldSpoken) {
        oldSpoken = true;
        speak(OLD_HAND_TEXT);
      }
    },

    /** 동작 사이 쉬는 시간: 어떻게 마쳤는지 + 다음 동작 안내. next 가 없으면 마지막 동작 */
    rest(method, next) {
      set(
        method === 'skipped'
          ? message(REST_SKIPPED_TEXT, 'info')
          : message(`${REST_DONE_TEXT} (${METHOD_TEXT[method]})`, 'good'),
        next
          ? h('p', {}, `잠깐 쉬어요. 다음 동작: ${sayOf(next)}`)
          : h('p', {}, '마지막 동작이었어요.'),
      );
      // 다음 동작 문구는 다음 동작 화면에서 읽으므로 여기서는 짧게만 읽는다 (쉬는 시간 2초)
      speak(method === 'skipped' ? REST_SKIPPED_VOICE : REST_DONE_TEXT);
    },

    finish({ total, done, skipped, methods }) {
      set(
        message(FINISH_TEXT, 'good'),
        h('p', {}, `동작 ${total}개 중 ${done}개를 함께 했어요${skipped ? ` (건너뜀 ${skipped}개)` : ''}.`),
        h('p', { class: 'mock-status' }, `손 인식 ${methods.detected} · 버튼 ${methods.manual} · 건너뜀 ${methods.skipped}`),
      );
      speak(FINISH_TEXT);
    },

    /**
     * 회차 끝. onChoose 가 있으면 "다른 손운동 고르기" 버튼도 보여 준다 (루틴이 여러 개일 때).
     * 문구는 바로 아래 버튼만 말한다. 위쪽 막대의 버튼은 시연 코스 안팎에서 달라서
     * ("활동 기록 보기" / "다음 활동으로") 이름을 적지 않는다. STEP 4는 코스인지 모른다 (#59)
     */
    end(onAgain, onChoose) {
      // 두 버튼 중 먼저 누른 것 하나만 동작한다 (회차가 두 개 시작되지 않게)
      let chosen = false;
      const first = (fn) => () => {
        if (chosen) return;
        chosen = true;
        fn();
      };
      area.append(
        h(
          'p',
          {},
          onChoose
            ? '이번 회차가 끝났어요. 한 번 더 하거나 다른 손운동을 골라도 좋아요.'
            : '이번 회차가 끝났어요. 한 번 더 해도 좋아요.',
        ),
        h(
          'div',
          { class: 'row' },
          onceButton('한 번 더 하기', first(onAgain)),
          onChoose ? onceButton('다른 손운동 고르기', first(onChoose), { variant: 'secondary' }) : null,
        ),
      );
    },
  };
}
