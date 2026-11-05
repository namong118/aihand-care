// STEP 1 화면 그리기. 판정은 하지 않고 보여주기만 한다.

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
    intro(count, onStart) {
      set(
        message(`로봇이 손모양 ${count}개를 차례로 보여줘요. 잘 보고 기억해 주세요.`, 'info'),
        h('div', { class: 'row' }, button('시작하기', onStart)),
      );
    },

    watching(index, count) {
      set(h('p', { class: 'big-prompt' }, `로봇을 잘 보세요 (${index} / ${count})`));
    },

    /** 입력 단계: 지금까지 입력한 것과 화면 버튼(손 인식 대체 입력) */
    recall({ count, given }, onPick) {
      set(
        h('p', { class: 'big-prompt' }, `기억한 손모양을 순서대로 만들어 주세요 (${given.length + 1} / ${count})`),
        given.length > 0
          ? h('p', {}, `지금까지: ${given.map(labelOf).join(' → ')}`)
          : null,
        message('손모양을 1초 동안 보여 주세요. 손 인식이 어려우면 아래 버튼을 눌러도 돼요.', 'info'),
        h(
          'div',
          { class: 'row', role: 'group', 'aria-label': '손모양 고르기' },
          poses.map((p) => button(p.label, () => onPick(p.name))),
        ),
      );
    },

    feedback({ correct, expected, given }) {
      if (correct) {
        set(message('잘하셨어요! 순서까지 똑같아요.', 'good'));
      } else {
        set(
          message('다시 해 볼까요?', 'retry'),
          h('p', {}, `로봇이 보여준 순서: ${expected.map(labelOf).join(' → ')}`),
          h('p', {}, `만들어 주신 순서: ${given.map(labelOf).join(' → ')}`),
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
