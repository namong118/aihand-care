// STEP 4 화면 그리기. 판정은 하지 않고 보여주기만 한다.

import { h, button, message } from '../../ui/components.js';

export function createScreen(container, poses) {
  container.innerHTML = '';
  const area = h('div', { class: 'program-body' });
  container.append(area);
  const labelOf = (name) => poses.find((p) => p.name === name)?.label ?? name;

  function set(...children) {
    area.innerHTML = '';
    area.append(...children.flat().filter(Boolean));
  }

  return {
    intro(routine, onStart) {
      set(
        h('h2', {}, routine.title),
        message(routine.description, 'info'),
        h('p', {}, '로봇을 보면서 같은 손모양을 함께 만들어 주세요. 힘들면 건너뛰어도 괜찮아요.'),
        h('div', { class: 'row' }, button('시작하기', onStart)),
      );
    },

    waiting(text) {
      set(message(text, 'info'));
    },

    /** 동작 하나: 안내 문구와 대체 입력 버튼("따라 했어요"), 건너뛰기 */
    step({ index, count, step }, { onDone, onSkip }) {
      set(
        h('p', { class: 'mock-status' }, `동작 ${index} / ${count}`),
        h('p', { class: 'big-prompt' }, step.say ?? labelOf(step.pose)),
        h('p', {}, `손모양: ${labelOf(step.pose)} — 로봇처럼 ${((step.holdMs ?? 1000) / 1000).toFixed(0)}초 동안 해 주세요.`),
        h(
          'div',
          { class: 'row' },
          button('따라 했어요', onDone),
          button('건너뛰기', onSkip, { variant: 'secondary' }),
        ),
      );
    },

    stepDone() {
      set(message('좋아요!', 'good'));
    },

    finish({ total, done, skipped }) {
      set(
        message('오늘 손운동을 함께 마쳤어요. 수고하셨어요!', 'good'),
        h('p', {}, `동작 ${total}개 중 ${done}개를 함께 했어요${skipped ? ` (건너뜀 ${skipped}개)` : ''}.`),
      );
    },

    end(onAgain) {
      area.append(
        h('p', {}, '이번 회차가 끝났어요. 위의 "활동 기록 보기"에서 기록을 볼 수 있어요.'),
        h('div', { class: 'row' }, button('한 번 더 하기', onAgain)),
      );
    },
  };
}
