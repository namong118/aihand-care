// STEP 3 화면 그리기. 판정은 하지 않고 보여주기만 한다.

import { h, button, message } from '../../ui/components.js';

export function createScreen(container, colors) {
  container.innerHTML = '';
  const area = h('div', { class: 'program-body' });
  container.append(area);
  const find = (color) => colors.find((c) => c.color === color);

  function set(...children) {
    area.innerHTML = '';
    area.append(...children.flat().filter(Boolean));
  }

  return {
    intro(onStart) {
      set(
        message('글자를 읽지 말고, 글자의 "색깔"을 봐 주세요.', 'info'),
        h('p', {}, '글자 색과 같은 색깔 카드를 로봇 카메라(WonderCam)에 보여 주세요. 아래 버튼을 눌러도 돼요.'),
        h('div', { class: 'row' }, button('시작하기', onStart)),
      );
    },

    waiting(text) {
      set(message(text, 'info'));
    },

    /**
     * 문제: 글자 뜻(word)을 글자 색(ink)으로 보여주고, 색 버튼(카드 대체 입력)을 둔다
     * progress: { index, count } → "2 / 5" 진행 표시
     */
    question({ wordColor, inkColor }, { index, count }, onPick) {
      const word = find(wordColor);
      const ink = find(inkColor);
      set(
        h(
          'p',
          { 'aria-label': `${count}문제 중 ${index}번째`, style: { 'font-size': '30px', 'font-weight': '700' } },
          `문제 ${index} / ${count}`,
        ),
        h('p', { class: 'big-prompt' }, '이 글자는 무슨 색깔인가요?'),
        h(
          'div',
          { class: 'stroop-stage', style: { color: ink.hex }, 'aria-label': `글자 "${word.label}"` },
          word.label,
        ),
        h(
          'div',
          { class: 'row', role: 'group', 'aria-label': '색 고르기' },
          colors.map((c) =>
            h(
              'button',
              {
                type: 'button',
                class: 'btn btn-secondary color-btn',
                style: { '--card-color': c.hex },
                onClick: () => onPick(c.color),
              },
              c.label,
            ),
          ),
        ),
      );
    },

    feedback({ correct, inkColor }) {
      const ink = find(inkColor);
      if (correct) {
        set(message(`잘하셨어요! 글자 색은 ${ink.label}이었어요.`, 'good'));
      } else {
        set(message('다시 해 볼까요?', 'retry'), h('p', {}, `글자 색은 ${ink.label}이었어요.`));
      }
    },

    /** 회차 끝: summary = { total, done } */
    end({ total, done }, onAgain) {
      set(
        message(`${total}문제를 모두 마쳤어요. 수고하셨어요!`, 'good'),
        h('p', {}, `글자 색과 같은 카드를 고른 문제: ${done}개`),
        h('p', {}, '위의 "활동 기록 보기"에서 기록을 볼 수 있어요.'),
        h('div', { class: 'row' }, button('한 번 더 하기', onAgain)),
      );
    },
  };
}
