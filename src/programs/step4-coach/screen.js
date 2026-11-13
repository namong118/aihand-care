// STEP 4 화면 그리기. 판정은 하지 않고 보여주기만 한다.

import { h, button, message } from '../../ui/components.js';

const METHOD_TEXT = {
  detected: '손 인식으로 확인',
  manual: '"따라 했어요" 버튼',
  skipped: '건너뜀',
};

/** 동작이 시작되기 전부터 같은 손모양을 들고 있을 때 안내 (logic.js 의 'old' 상태) */
const OLD_HAND_TEXT = '손을 잠깐 내렸다가 다시 해 주세요. 새로 만든 손모양부터 세어요.';

/**
 * 루틴 카드 배치: 항상 2열 (루틴 4개면 2×2). 300px 보다 좁아지는 화면에서만 1열.
 * 홈 카드(home-grid)는 카드 최소 폭이 460px 라서, 로봇이 Mock 일 때 오른쪽에 가상 로봇손 칸이 붙으면
 * 활동 화면 폭이 좁아져 1열(1×4)이 된다. 카드 최소 폭을 "폭의 절반"으로 잡아 그때도 2열이 되게 한다.
 */
const CHOOSER_COLUMNS =
  'repeat(auto-fit, minmax(min(100%, max(300px, calc((100% - var(--gap-cards)) / 2))), 1fr))';

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
  const sayOf = (step) => step.say ?? labelOf(step.pose);
  let gaugeBar = null;
  let gaugeText = null;
  let countText = null;
  let oldNotice = null;

  function set(...children) {
    area.innerHTML = '';
    gaugeBar = null;
    gaugeText = null;
    countText = null;
    oldNotice = null;
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
      const card = ({ routine, stepCount }) =>
        h(
          'article',
          { class: 'home-card step4' },
          h(
            'div',
            { class: 'home-card-title' },
            h('span', { class: 'step-pill' }, `동작 ${stepCount}개`),
            h('h2', {}, routine.title),
          ),
          h('p', { class: 'home-card-desc' }, routine.description),
          h(
            'button',
            {
              type: 'button',
              class: 'home-start',
              onClick: () => {
                if (picked) return; // 두 번 눌러도 한 번만
                picked = true;
                onPick(routine);
              },
            },
            '이 손운동 하기',
          ),
        );
      set(
        h('h2', {}, '어떤 손운동을 해 볼까요?'),
        h('p', {}, '하고 싶은 손운동을 하나 골라 주세요.'),
        h('div', { class: 'home-grid', style: { 'grid-template-columns': CHOOSER_COLUMNS } }, items.map(card)),
      );
    },

    /** 루틴 소개. onBack 이 있으면 "다른 손운동 고르기" 버튼도 보여 준다 (루틴이 여러 개일 때) */
    intro(routine, onStart, onBack) {
      set(
        h('h2', {}, routine.title),
        message(routine.description, 'info'),
        h('p', {}, '로봇을 보면서 같은 손모양을 함께 만들어 주세요. 힘들면 건너뛰어도 괜찮아요.'),
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
      countText = h('p', { class: 'big-prompt', 'aria-live': 'polite' }, '');
      oldNotice = message(OLD_HAND_TEXT, 'info');
      oldNotice.hidden = true;
      gaugeBar = h('div', { class: 'gauge-fill' });
      gaugeText = h('span', {}, `유지: 0.0 / ${holdSec}초`);
      const gauge = h(
        'div',
        { class: 'gauge', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' },
        gaugeBar,
      );
      area.innerHTML = '';
      area.append(
        h('p', { class: 'mock-status' }, where),
        h('p', { class: 'big-prompt' }, sayOf(step)),
        h('p', {}, `손모양: ${labelOf(step.pose)} — 로봇처럼 ${holdSec}초 동안 해 주세요.`),
        countText,
        gauge,
        gaugeText,
        oldNotice,
        h(
          'div',
          { class: 'row' },
          button('따라 했어요', onDone),
          button('건너뛰기', onSkip, { variant: 'secondary' }),
        ),
      );
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
      oldNotice.hidden = !showOld;
    },

    /** 동작 사이 쉬는 시간: 어떻게 마쳤는지 + 다음 동작 안내. next 가 없으면 마지막 동작 */
    rest(method, next) {
      set(
        method === 'skipped'
          ? message('건너뛰었어요. 괜찮아요.', 'info')
          : message(`좋아요! (${METHOD_TEXT[method]})`, 'good'),
        next
          ? h('p', {}, `잠깐 쉬어요. 다음 동작: ${sayOf(next)}`)
          : h('p', {}, '마지막 동작이었어요.'),
      );
    },

    finish({ total, done, skipped, methods }) {
      set(
        message('오늘 손운동을 함께 마쳤어요. 수고하셨어요!', 'good'),
        h('p', {}, `동작 ${total}개 중 ${done}개를 함께 했어요${skipped ? ` (건너뜀 ${skipped}개)` : ''}.`),
        h('p', { class: 'mock-status' }, `손 인식 ${methods.detected} · 버튼 ${methods.manual} · 건너뜀 ${methods.skipped}`),
      );
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
