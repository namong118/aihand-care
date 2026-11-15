// STEP 3 화면 그리기. 판정은 하지 않고 보여주기만 한다.

import { h, button, message } from '../../ui/components.js';
import { speak } from './voice.js';

export function createScreen(container, colors) {
  container.innerHTML = '';
  const area = h('div', { class: 'program-body' });
  container.append(area);
  const find = (color) => colors.find((c) => c.color === color);

  let hintEl = null; // 답을 기다릴 때 붙는 안내 (한 번만)

  function set(...children) {
    area.innerHTML = '';
    hintEl = null;
    area.append(...children.flat().filter(Boolean));
  }

  return {
    intro(onStart) {
      set(
        message('글자를 읽지 말고, 글자의 "색깔"을 봐 주세요.', 'info'),
        h('p', {}, '글자 색과 같은 색깔 카드를 로봇 카메라(WonderCam)에 보여 주세요. 아래 버튼을 눌러도 돼요.'),
        h('p', {}, '색깔이 잘 구분되지 않으시면 이 활동은 건너뛰셔도 괜찮아요.'),
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
      // 글자 뜻은 읽지 않는다
      speak(`문제 ${index}번. 이 글자는 무슨 색깔인가요?`);
    },

    /** 답을 오래 기다릴 때 문제 아래에 안내를 붙인다 (문제 화면은 그대로) */
    hint(text) {
      if (hintEl) return;
      hintEl = message(text, 'info');
      area.append(hintEl);
      speak(text);
    },

    feedback({ correct, inkColor }) {
      const ink = find(inkColor);
      if (correct) {
        set(message(`잘하셨어요! 글자 색은 ${ink.label}이었어요.`, 'good'));
        speak(`잘하셨어요! 글자 색은 ${ink.label}이었어요.`);
      } else {
        set(message('다시 해 볼까요?', 'retry'), h('p', {}, `글자 색은 ${ink.label}이었어요.`));
        speak(`다시 해 볼까요? 글자 색은 ${ink.label}이었어요.`);
      }
    },

    /** 회차 끝: summary = { total, done } */
    end({ total, done }, onAgain) {
      set(
        message(`${total}문제를 모두 마쳤어요. 수고하셨어요!`, 'good'),
        h('p', {}, `글자 색과 같은 카드를 고른 문제: ${done}개`),
        h('p', {}, '이번 회차가 끝났어요. 한 번 더 해도 좋아요.'),
        h('div', { class: 'row' }, button('한 번 더 하기', onAgain)),
      );
      speak(done === total ? `${total}문제를 모두 맞히셨어요! 정말 잘하셨어요!` : `${total}문제를 모두 마쳤어요. 수고하셨어요!`);
    },
  };
}
