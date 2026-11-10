// STEP 1 화면 그리기. 판정은 하지 않고 보여주기만 한다.

import { h, button, message } from '../../ui/components.js';
import { CARD_NUMBERS } from './logic.js';

export function createScreen(container) {
  container.innerHTML = '';
  const area = h('div', { class: 'program-body' });
  container.append(area);

  function set(...children) {
    area.innerHTML = '';
    area.append(...children.flat().filter(Boolean));
  }

  const join = (numbers) => numbers.join(' → ');

  return {
    intro(count, onStart) {
      set(
        message(
          `로봇이 손가락으로 숫자 ${count}개를 차례로 보여줘요. 잘 보고 기억했다가, 같은 순서로 숫자 카드를 하나씩 보여 주세요.`,
          'info',
        ),
        h('div', { class: 'row' }, button('시작하기', onStart)),
      );
    },

    /** 카메라를 숫자 모드로 바꾸는 동안 (보통 바로 끝난다) */
    preparing() {
      set(h('p', { class: 'big-prompt' }, '숫자 카드를 읽을 준비를 하고 있어요'));
    },

    /** 로봇이 보여주는 동안. 정답 숫자는 화면에 쓰지 않는다 (로봇 손을 보고 기억하는 활동) */
    watching(index, count) {
      set(h('p', { class: 'big-prompt' }, `로봇을 잘 보세요 (${index} / ${count})`));
    },

    /**
     * 입력 단계: 지금까지 입력한 숫자, 숫자 버튼(카드 대신 입력), "처음부터 다시".
     * 정답은 보여주지 않는다.
     */
    recall({ count, given }, onPick, onRestart) {
      set(
        h('p', { class: 'big-prompt' }, `기억한 숫자 카드를 순서대로 보여 주세요 (${given.length + 1} / ${count})`),
        given.length > 0 ? h('p', {}, `지금까지: ${join(given)}`) : null,
        message('카드를 하나 보여 준 뒤에는 내려 주세요. 카드 대신 아래 숫자 버튼을 눌러도 돼요.', 'info'),
        h(
          'div',
          { class: 'row', role: 'group', 'aria-label': '숫자 고르기' },
          CARD_NUMBERS.map((n) => {
            const b = button(String(n), () => onPick(n));
            b.setAttribute('aria-label', `숫자 ${n}`);
            return b;
          }),
        ),
        given.length > 0
          ? h('div', { class: 'row' }, button('처음부터 다시', onRestart, { variant: 'secondary' }))
          : null,
      );
    },

    feedback({ correct, expected, given }) {
      if (correct) {
        set(message('잘하셨어요! 순서까지 똑같아요.', 'good'));
      } else {
        set(
          message('다시 해 볼까요?', 'retry'),
          h('p', {}, `로봇이 보여준 순서: ${join(expected)}`),
          h('p', {}, `보여 주신 순서: ${join(given)}`),
        );
      }
    },

    end(onAgain) {
      area.append(
        h('p', {}, '이번 회차가 끝났어요. 위의 "활동 기록 보기"에서 기록을 볼 수 있어요.'),
        h('div', { class: 'row' }, button('한 번 더 하기', onAgain)),
      );
    },
  };
}
