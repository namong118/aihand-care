// 숫자 야구 화면 그리기. 판정은 하지 않고 보여주기만 한다.
// 모양은 styles.css "활동 화면 공통"(act-*) 클래스와 단계 고르기(src/ui/level-picker.js).

import { h, button, message, firstOnly } from '../../ui/components.js';
import { levelPicker } from '../../ui/level-picker.js';
import { CARD_NUMBERS } from './logic.js';

/** 끝 화면 버튼 두 개. 두 번 빨리 눌러도 처음 누른 것 하나만 받는다 (firstOnly) */
function endButtons(onAgain, onLevels) {
  const [again, levels] = firstOnly(onAgain, onLevels);
  return [button('한 판 더 하기', again), button('단계 바꾸기', levels, { variant: 'secondary' })];
}

/** 단계 설명 (시작 화면) */
const LEVEL_DESC = {
  1: '숫자 3개, 없는 숫자를 알려 줘요',
  2: '숫자 3개, 혼자 찾아요',
  3: '숫자 4개',
};

const RESULT_TEXT = ({ strike, ball }) => `스트라이크 ${strike} · 볼 ${ball}`;
const LEGEND = '스트라이크: 숫자와 자리가 모두 맞아요 · 볼: 숫자는 있지만 자리가 달라요';
/** 스트라이크·볼 뜻 (세로 배치용 작은 글씨. act-foot-text 는 가로줄 안에서만 쓴다) */
const legend = () => h('p', { style: { margin: '0', 'font-size': '19px', color: 'var(--c-text-sub)' } }, LEGEND);

export function createScreen(container) {
  container.innerHTML = '';
  const area = h('div', { class: 'program-body' });
  container.append(area);

  function set(...children) {
    area.innerHTML = '';
    area.append(...children.flat().filter(Boolean));
  }

  const card = (...children) => h('div', { class: 'act-card' }, ...children);
  const join = (numbers) => numbers.join(' · ');

  function head({ level, tryNo, maxTries, count }) {
    return h(
      'div',
      { class: 'act-head' },
      h('span', { class: 'act-progress', 'aria-label': `${maxTries}번 중 ${tryNo}번째` }, `${tryNo}번째 / ${maxTries}번`),
      h('span', { class: 'act-tag' }, `${level}단계`),
      h('span', { class: 'act-tag' }, `숫자 ${count}개`),
    );
  }

  /**
   * 지금까지 낸 것 (최근 것이 아래). 8번까지 쌓여도 7인치에 들어가게 한 줄에 한 번씩.
   * 아래에 스트라이크·볼 뜻을 작게 둔다.
   */
  function historyCard(history) {
    const row = (r, i) =>
      h(
        'li',
        {
          style: {
            display: 'grid',
            'grid-template-columns': '18px auto 1fr',
            'align-items': 'baseline',
            gap: '8px',
            padding: '3px 8px',
            'border-radius': '12px',
            background: i === history.length - 1 ? 'var(--step-bg)' : 'transparent',
          },
        },
        h('span', { style: { 'font-size': '16px', color: 'var(--c-text-muted)' } }, `${i + 1}`),
        h('span', { style: { 'font-size': '24px', 'font-weight': '600', 'letter-spacing': '0.12em', 'white-space': 'nowrap' } }, r.guess.join('')),
        h('span', { style: { 'font-size': '18px', 'text-align': 'right', 'white-space': 'nowrap' } }, RESULT_TEXT(r)),
      );
    return h(
      'div',
      { class: 'act-card', style: { gap: '6px' } },
      h('p', { class: 'act-label', style: { margin: '0' } }, '지금까지 낸 숫자'),
      history.length === 0
        ? h('p', { class: 'act-text', style: { margin: '0' } }, '아직 없어요. 처음에는 아무 숫자나 내 보세요.')
        : h('ol', { style: { 'list-style': 'none', margin: '0', padding: '0', display: 'flex', 'flex-direction': 'column', gap: '2px' } }, history.map(row)),
      h('p', { style: { margin: '4px 0 0', 'font-size': '16px', 'line-height': '1.4', color: 'var(--c-text-muted)' } }, '스트라이크: 숫자·자리 모두 맞음', h('br'), '볼: 숫자는 있지만 자리가 다름'),
    );
  }

  /** 이번에 내는 숫자 칸: [2] [ ] [ ]. 4개면 칸을 조금 작게 (오른쪽 카드 안에 들어가게) */
  function slots(guess, count) {
    const size = count >= 4 ? 68 : 84;
    return h(
      'div',
      { style: { display: 'flex', gap: '10px', 'justify-content': 'center' }, 'aria-label': `이번에 낸 숫자 ${guess.length}개` },
      Array.from({ length: count }, (_, i) =>
        h(
          'span',
          {
            class: 'act-art',
            style: { 'font-size': `${Math.round(size * 0.55)}px`, 'font-weight': '700', width: `${size}px`, height: `${size}px`, 'border-radius': '20px' },
          },
          guess[i] === undefined ? '' : String(guess[i]),
        ),
      ),
    );
  }

  return {
    /** 시작 화면: 규칙 한 줄 + 1·2·3단계 고르기 */
    levels({ selected }, onStart) {
      set(
        levelPicker({
          title: '숫자 야구',
          lead: '로봇이 1~5 중 숫자 몇 개를 몰래 정해요. 숫자 카드로 순서를 맞혀 보세요. 낼 때마다 로봇이 손가락으로 힌트를 줘요.',
          levels: [1, 2, 3].map((level) => ({ level, desc: LEVEL_DESC[level] })),
          selected,
          onStart,
        }),
        legend(),
      );
    },

    /** 카메라를 숫자 모드로 바꾸는 동안 */
    preparing() {
      set(card(h('p', { class: 'act-prompt' }, '숫자 카드를 읽을 준비를 하고 있어요')));
    },

    /** 로봇이 숫자를 정하는 동안 */
    thinking({ count }) {
      set(card(h('p', { class: 'act-prompt' }, `로봇이 숫자 ${count}개를 몰래 정하고 있어요`)));
    },

    /**
     * 내는 중: 왼쪽 지금까지 낸 숫자, 오른쪽 이번 칸과 숫자 버튼.
     * excluded: 1단계 도움 (확실히 없는 숫자). notice: "같은 숫자는 한 번만" 같은 짧은 안내
     */
    guessing({ level, tryNo, maxTries, count, guess, history, excluded = [], notice }, onPick, onRestart, onStop) {
      set(
        head({ level, tryNo, maxTries, count }),
        h(
          'div',
          { style: { display: 'grid', 'grid-template-columns': 'minmax(0, 1fr) minmax(0, 1.1fr)', gap: '16px', 'align-items': 'start' } },
          historyCard(history),
          h(
            'div',
            { style: { display: 'flex', 'flex-direction': 'column', gap: '12px' } },
            card(
              h('p', { class: 'act-text', style: { 'text-align': 'center', margin: '0' } }, `숫자 카드를 하나씩 보여 주세요 (${guess.length} / ${count})`),
              slots(guess, count),
              h(
                'p',
                { class: 'act-label', style: { 'text-align': 'center', margin: '0' } },
                notice ?? '카드를 하나 보여 준 뒤에는 잠깐 내려 주세요',
              ),
            ),
            h(
              'div',
              { class: 'act-answers', role: 'group', 'aria-label': '숫자 고르기', style: { 'grid-template-columns': `repeat(${CARD_NUMBERS.length}, minmax(0, 1fr))` } },
              CARD_NUMBERS.map((n) => {
                const no = excluded.includes(n);
                return h(
                  'button',
                  {
                    type: 'button',
                    class: 'act-answer',
                    'aria-label': no ? `숫자 ${n}, 없는 숫자` : `숫자 ${n}`,
                    style: { 'font-size': '36px', 'min-height': '84px', 'flex-direction': 'column', gap: '0', opacity: no ? '0.5' : null },
                    disabled: guess.includes(n) ? true : null,
                    onClick: () => onPick(n),
                  },
                  String(n),
                  no ? h('span', { style: { 'font-size': '15px', 'font-weight': '500' } }, '없어요') : null,
                );
              }),
            ),
            // 버튼은 오른쪽 칸 안에 둔다: 왼쪽 기록이 8줄까지 길어져도 화면 밖으로 밀리지 않게
            h(
              'div',
              { class: 'act-foot', style: { 'justify-content': 'flex-end' } },
              onRestart && guess.length > 0 ? button('처음부터 다시', onRestart, { variant: 'secondary' }) : null,
              button('정답 보기', onStop, { variant: 'secondary' }),
            ),
          ),
        ),
      );
    },

    /** 낸 숫자 판정 결과. 로봇이 손가락으로 스트라이크 → 볼 순서로 보여 주는 동안 */
    judged({ level, tryNo, maxTries, count, guess, result, showing }) {
      set(
        head({ level, tryNo, maxTries, count }),
        card(
          h('p', { class: 'act-label', style: { 'text-align': 'center' } }, '내신 숫자'),
          h('p', { class: 'act-question', style: { 'text-align': 'center', 'letter-spacing': '0.08em' } }, join(guess)),
          h('p', { class: 'act-question', style: { 'text-align': 'center', 'font-size': '52px' } }, RESULT_TEXT(result)),
          h(
            'p',
            { class: 'act-text', style: { 'text-align': 'center' } },
            showing === 'strike'
              ? `로봇 손: 스트라이크 ${result.strike}개${result.strike === 0 ? ' (주먹)' : ''}`
              : showing === 'ball'
                ? `로봇 손: 볼 ${result.ball}개${result.ball === 0 ? ' (주먹)' : ''}`
                : '',
          ),
        ),
        legend(),
      );
    },

    /** 다 맞혔을 때 */
    solved({ secret, tries }, onAgain, onLevels) {
      set(
        message(`찾으셨어요! ${tries}번 만에 로봇의 숫자를 맞히셨어요.`, 'good'),
        card(h('p', { class: 'act-label' }, '로봇이 정한 숫자'), h('p', { class: 'act-question', style: { 'letter-spacing': '0.08em' } }, join(secret))),
        h('div', { class: 'row' }, ...endButtons(onAgain, onLevels)),
      );
    },

    /** 기회를 다 썼거나 그만했을 때: 정답을 함께 확인 */
    revealed({ secret, history }, onAgain, onLevels) {
      set(
        message('함께 정답을 확인해 볼까요? 로봇이 손가락으로 보여 줘요.', 'info'),
        card(
          h('p', { class: 'act-label' }, '로봇이 정한 숫자'),
          h('p', { class: 'act-question', style: { 'letter-spacing': '0.08em' } }, join(secret)),
          history.length ? h('p', { class: 'act-text' }, `${history.length}번 내 보셨어요. 다음 판에서 또 찾아봐요.`) : null,
        ),
        h('div', { class: 'row' }, ...endButtons(onAgain, onLevels)),
      );
    },
  };
}
