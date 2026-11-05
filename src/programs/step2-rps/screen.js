// STEP 2 화면 그리기. 판정은 하지 않고 보여주기만 한다.

import { h, button, message } from '../../ui/components.js';
import { HANDS, HAND_LABELS } from './logic.js';

export function createScreen(container) {
  container.innerHTML = '';
  const area = h('div', { class: 'program-body' });
  container.append(area);

  function set(...children) {
    area.innerHTML = '';
    area.append(...children.flat().filter(Boolean));
  }

  return {
    intro(onStart) {
      set(
        message('로봇이 가위바위보를 내면, 화면의 말에 맞게 손을 내 주세요.', 'info'),
        h('div', { class: 'row' }, button('시작하기', onStart)),
      );
    },

    waiting(text) {
      set(message(text, 'info'));
    },

    /** 문제: 로봇 손과 조건, 그리고 화면 버튼(손 인식 대체 입력) */
    question({ robotHand, conditionText }, onAnswer) {
      set(
        h('p', { class: 'big-prompt' }, `로봇: ${HAND_LABELS[robotHand]}`),
        h('p', { class: 'big-prompt' }, `“${conditionText}”`),
        message('손을 1초 동안 보여 주세요. 손 인식이 어려우면 아래 버튼을 눌러도 돼요.', 'info'),
        h(
          'div',
          { class: 'row', role: 'group', 'aria-label': '내 손 고르기' },
          HANDS.map((hand) => button(HAND_LABELS[hand], () => onAnswer(hand))),
        ),
      );
    },

    feedback({ correct, userHand, answer, robotHand, conditionText }) {
      if (correct) {
        set(message(`잘하셨어요! ${HAND_LABELS[userHand]}를 내셨어요.`, 'good'));
      } else {
        set(
          message('다시 해 볼까요?', 'retry'),
          h(
            'p',
            {},
            `로봇이 ${HAND_LABELS[robotHand]}일 때 “${conditionText}”는 ${HAND_LABELS[answer]}를 내면 돼요.`,
          ),
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
