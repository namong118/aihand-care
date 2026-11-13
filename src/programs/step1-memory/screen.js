// STEP 1 화면 그리기. 판정은 하지 않고 보여주기만 한다.
// 정답 숫자는 입력이 끝나기 전에는 화면에 쓰지 않는다 (로봇 손을 보고 기억하는 활동).

import { h, button, message } from '../../ui/components.js';
import { CARD_NUMBERS } from './logic.js';

// 요약 화면의 문제별 결과 문구 (점수처럼 보이지 않게, 기호 + 글자)
const STATUS_TEXT = {
  first: '○ 한 번에 해내셨어요',
  second: '○ 다시 보고 해내셨어요',
  shown: 'ℹ 함께 순서를 확인했어요',
  skipped: '→ 건너뛰었어요',
};

const TEXT_28 = { 'font-size': '28px', 'line-height': '1.5' };

export function createScreen(container) {
  container.innerHTML = '';
  const area = h('div', { class: 'program-body' });
  container.append(area);

  function set(...children) {
    area.innerHTML = '';
    area.append(...children.flat().filter(Boolean));
  }

  const join = (numbers) => numbers.join(' → ');

  function progress(index, total) {
    return h(
      'p',
      { 'aria-label': `${total}문제 중 ${index}번째`, style: { 'font-size': '28px', 'font-weight': '700', margin: '0' } },
      `문제 ${index} / ${total}`,
    );
  }

  return {
    intro({ total, count }, onStart) {
      set(
        message(
          `로봇이 손가락으로 숫자를 차례로 보여줘요. 잘 보고 기억했다가, 같은 순서로 숫자 카드를 하나씩 카메라 가까이(약 10~15cm) 보여 주세요.`,
          'info',
        ),
        h('p', { style: TEXT_28 }, `모두 ${total}문제예요. 처음에는 숫자 ${count}개로 시작하고, 해내면 하나씩 늘어나요.`),
        h('div', { class: 'row' }, button('시작하기', onStart)),
      );
    },

    /** 카메라를 숫자 모드로 바꾸는 동안 (보통 바로 끝난다) */
    preparing() {
      set(h('p', { class: 'big-prompt' }, '숫자 카드를 읽을 준비를 하고 있어요'));
    },

    /** 로봇이 보여주는 동안. 정답 숫자는 화면에 쓰지 않는다 */
    watching({ index, total, step, count }) {
      set(
        progress(index, total),
        h('p', { class: 'big-prompt' }, `로봇을 잘 보세요 (${step} / ${count})`),
      );
    },

    /**
     * 입력 단계: 지금까지 입력한 숫자, 숫자 버튼(카드 대신 입력), "처음부터 다시", "건너뛰기".
     * 정답은 보여주지 않는다.
     */
    recall({ index, total, attempt, count, given }, onPick, onRestart, onSkip) {
      // 숫자 카드는 카메라에서 10~15cm일 때만 읽힌다 (docs/hardware-check.md 부록 8)
      set(
        progress(index, total),
        h('p', { class: 'big-prompt' }, `기억한 숫자 카드를 순서대로 보여 주세요 (${given.length + 1} / ${count})`),
        attempt > 1 ? h('p', { style: TEXT_28 }, '한 번 더 해 보는 중이에요.') : null,
        given.length > 0 ? h('p', { style: TEXT_28 }, `지금까지: ${join(given)}`) : null,
        message('카드는 카메라 가까이(약 10~15cm) 보여 주세요. 하나 보여 준 뒤에는 내려 주세요. 카드 대신 아래 숫자 버튼을 눌러도 돼요.', 'info'),
        h(
          'div',
          { class: 'row', role: 'group', 'aria-label': '숫자 고르기' },
          CARD_NUMBERS.map((n) => {
            const b = button(String(n), () => onPick(n));
            b.setAttribute('aria-label', `숫자 ${n}`);
            return b;
          }),
        ),
        h(
          'div',
          { class: 'row' },
          given.length > 0 ? button('처음부터 다시', onRestart, { variant: 'secondary' }) : null,
          button('이 문제 건너뛰기', onSkip, { variant: 'secondary' }),
        ),
      );
    },

    /** 해냈을 때. 잠시 뒤 다음 문제로 넘어간다 */
    good({ given, attempt }) {
      set(
        message(attempt > 1 ? '잘하셨어요! 다시 보고 해내셨어요.' : '잘하셨어요! 순서까지 똑같아요.', 'good'),
        h('p', { style: TEXT_28 }, `보여 주신 순서: ${join(given)}`),
      );
    },

    /** 처음 해내지 못했을 때. 정답은 아직 보여 주지 않고, 로봇이 한 번 더 보여 준다 */
    retry({ given }, onAgain) {
      set(
        message('다시 해 볼까요? 로봇이 같은 순서를 한 번 더 보여 줄게요.', 'retry'),
        h('p', { style: TEXT_28 }, `보여 주신 순서: ${join(given)}`),
        h('div', { class: 'row' }, button('다시 보기', onAgain)),
      );
    },

    /** 두 번째도 해내지 못했을 때: 순서를 함께 확인한다 */
    reveal({ expected, given, isLast }, onNext) {
      set(
        message('함께 순서를 확인해 볼까요?', 'info'),
        h('p', { style: TEXT_28 }, `로봇이 보여준 순서: ${join(expected)}`),
        h('p', { style: TEXT_28 }, `보여 주신 순서: ${join(given)}`),
        h('div', { class: 'row' }, button(isLast ? '끝내기' : '다음 문제', onNext)),
      );
    },

    /**
     * 회차 요약: 문제별 한 줄 + 격려. 점수는 보여 주지 않는다.
     * rows: [{ count, status }]
     */
    summary({ rows }, onAgain) {
      set(
        h('h2', { style: { 'font-size': '36px', margin: '0' } }, '오늘의 활동 기록'),
        h(
          'ol',
          { style: { 'font-size': '26px', 'line-height': '1.8', margin: '0', 'padding-left': '1.5em' } },
          rows.map((r) => h('li', {}, `숫자 ${r.count}개 — ${STATUS_TEXT[r.status]}`)),
        ),
        message(`${rows.length}문제를 모두 함께 해 주셨어요. 수고하셨어요!`, 'good'),
        h('div', { class: 'row' }, button('한 번 더 하기', onAgain)),
      );
    },
  };
}
