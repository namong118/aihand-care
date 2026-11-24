// STEP 1 화면 그리기. 판정은 하지 않고 보여주기만 한다.
// 정답 숫자는 입력이 끝나기 전에는 화면에 쓰지 않는다 (로봇 손을 보고 기억하는 활동).
// 모양은 styles.css "활동 화면 공통"(act-*) 클래스 (시안 v11, docs/ui-classes.md)

import { h, button, message } from '../../ui/components.js';
import { handIcon } from '../../ui/icons.js';
import { speak } from '../../ui/voice.js';
import {
  CARD_NUMBERS,
  INTRO_VOICE,
  announceLine,
  recallLine,
  goodLine,
  RETRY_TEXT,
  REVEAL_TEXT,
  summaryLine,
} from './logic.js';

// 요약 화면의 문제별 결과 문구 (점수처럼 보이지 않게, 기호 + 글자)
const STATUS_TEXT = {
  first: '○ 한 번에 해내셨어요',
  second: '○ 다시 보고 해내셨어요',
  shown: 'ℹ 함께 순서를 확인했어요',
  skipped: '→ 건너뛰었어요',
};

export function createScreen(container) {
  container.innerHTML = '';
  const area = h('div', { class: 'program-body' });
  container.append(area);

  function set(...children) {
    area.innerHTML = '';
    area.append(...children.flat().filter(Boolean));
  }

  const join = (numbers) => numbers.join(' → ');
  const card = (...children) => h('div', { class: 'act-card' }, ...children);

  function progress(index, total) {
    return h('span', { class: 'act-progress', 'aria-label': `${total}문제 중 ${index}번째` }, `문제 ${index} / ${total}`);
  }

  return {
    intro({ total, count }, onStart) {
      set(
        card(
          h('p', { class: 'act-question' }, '보고, 기억하고, 카드로'),
          h(
            'p',
            { class: 'act-text' },
            '로봇이 손가락으로 숫자를 차례로 보여줘요. 잘 보고 기억했다가, 같은 순서로 숫자 카드를 하나씩 카메라 가까이(약 10~15cm) 보여 주세요.',
          ),
          h('p', { class: 'act-text' }, `모두 ${total}문제예요. 처음에는 숫자 ${count}개로 시작하고, 해내면 하나씩 늘어나요.`),
        ),
        h('div', { class: 'row' }, button('시작하기', onStart)),
      );
      speak(INTRO_VOICE);
    },

    /** 카메라를 숫자 모드로 바꾸는 동안 (보통 바로 끝난다) */
    preparing() {
      set(card(h('p', { class: 'act-prompt' }, '숫자 카드를 읽을 준비를 하고 있어요')));
    },

    /**
     * 로봇이 보여 주기 전에 이번에 몇 개를 기억할지 먼저 알려 준다.
     * attempt 2 = 같은 숫자를 한 번 더 보여 줄 때
     */
    announce({ index, total, count, attempt = 1 }) {
      set(
        h('div', { class: 'act-head' }, progress(index, total)),
        card(
          h('p', { class: 'act-text', style: { 'text-align': 'center' } }, attempt > 1 ? '같은 숫자를 한 번 더 보여 드릴게요' : '이번에는'),
          h('p', { class: 'act-question', style: { 'text-align': 'center', 'font-size': '64px' } }, `숫자 ${count}개`),
          h('p', { class: 'act-text', style: { 'text-align': 'center' } }, '로봇을 잘 보고 기억해 주세요'),
        ),
      );
      speak(announceLine(count, attempt));
    },

    /** 로봇이 보여주는 동안. 정답 숫자는 화면에 쓰지 않는다 */
    watching({ index, total, step, count }) {
      set(
        h('div', { class: 'act-head' }, progress(index, total)),
        card(
          h(
            'div',
            { class: 'act-card-row', style: { display: 'flex', 'justify-content': 'center' } },
            h('span', { class: 'act-art act-art-lg' }, handIcon('PAPER', 58)),
            h('p', { class: 'act-question' }, '로봇을 잘 보세요'),
          ),
          h('p', { class: 'act-text', style: { 'text-align': 'center' } }, `${count}개 중 ${step}번째 숫자`),
        ),
      );
    },

    /**
     * 입력 단계: 지금까지 입력한 숫자, 숫자 버튼(카드 대신 입력), "처음부터 다시", "건너뛰기".
     * 정답은 보여주지 않는다.
     */
    recall({ index, total, attempt, count, given }, onPick, onRestart, onSkip) {
      // 숫자 카드는 카메라에서 10~15cm일 때만 읽힌다 (docs/hardware-check.md 부록 8)
      // 7인치(1280×720)에서 숫자 버튼과 건너뛰기가 스크롤 없이 보이도록 줄 수를 줄였다 (#102)
      set(
        h(
          'div',
          { class: 'act-head' },
          progress(index, total),
          h('span', { class: 'act-tag' }, `카드 ${given.length + 1} / ${count}`),
          attempt > 1 ? h('span', { class: 'act-tag' }, '한 번 더 해 보는 중') : null,
          given.length > 0 ? h('span', { class: 'act-tag' }, `지금까지: ${join(given)}`) : null,
        ),
        card(
          h('p', { class: 'act-question', style: { 'font-size': '44px' } }, recallLine(count)),
          h('p', { class: 'act-text' }, '카드는 카메라 가까이(10~15cm) 하나씩 보여 주세요. 아래 숫자를 눌러도 돼요.'),
        ),
        h(
          'div',
          { class: 'act-answers', role: 'group', 'aria-label': '숫자 고르기', style: { 'grid-template-columns': `repeat(${CARD_NUMBERS.length}, minmax(0, 1fr))` } },
          CARD_NUMBERS.map((n) =>
            h('button', { type: 'button', class: 'act-answer', 'aria-label': `숫자 ${n}`, style: { 'font-size': '40px', 'min-height': '96px' }, onClick: () => onPick(n) }, String(n)),
          ),
        ),
        h(
          'div',
          { class: 'act-foot' },
          h('p', { class: 'act-foot-text' }, '카드를 하나 보여 준 뒤에는 잠깐 내려 주세요.'),
          given.length > 0 ? button('처음부터 다시', onRestart, { variant: 'secondary' }) : null,
          button('이 문제 건너뛰기', onSkip, { variant: 'secondary' }),
        ),
      );
      // 카드를 하나씩 넣을 때마다 화면을 다시 그리므로, 첫 카드를 기다릴 때만 읽는다
      if (given.length === 0) speak(recallLine(count));
    },

    /** 해냈을 때. 잠시 뒤 다음 문제로 넘어간다 */
    good({ given, attempt }) {
      set(
        message(goodLine(attempt), 'good'),
        card(h('p', { class: 'act-label' }, '보여 주신 순서'), h('p', { class: 'act-question' }, join(given))),
      );
      speak(goodLine(attempt));
    },

    /** 처음 해내지 못했을 때. 정답은 아직 보여 주지 않고, 로봇이 한 번 더 보여 준다 */
    retry({ given }, onAgain) {
      set(
        message(RETRY_TEXT, 'retry'),
        card(h('p', { class: 'act-label' }, '보여 주신 순서'), h('p', { class: 'act-question' }, join(given))),
        h('div', { class: 'row' }, button('다시 보기', onAgain)),
      );
      speak(RETRY_TEXT);
    },

    /** 두 번째도 해내지 못했을 때: 순서를 함께 확인한다 */
    reveal({ expected, given, isLast }, onNext) {
      set(
        message(REVEAL_TEXT, 'info'),
        card(
          h('p', { class: 'act-label' }, '로봇이 보여준 순서'),
          h('p', { class: 'act-question' }, join(expected)),
          h('p', { class: 'act-label' }, '보여 주신 순서'),
          h('p', { class: 'act-text', style: { 'font-size': '32px' } }, join(given)),
        ),
        h('div', { class: 'row' }, button(isLast ? '끝내기' : '다음 문제', onNext)),
      );
      speak(REVEAL_TEXT);
    },

    /**
     * 회차 요약: 문제별 한 줄 + 격려. 점수는 보여 주지 않는다.
     * rows: [{ count, status }]
     */
    summary({ rows }, onAgain) {
      set(
        message(summaryLine(rows.length), 'good'),
        card(
          h('h2', { style: { 'font-size': '30px', margin: '0' } }, '오늘의 활동 기록'),
          h(
            'ol',
            { class: 'act-list' },
            rows.map((r, i) =>
              h(
                'li',
                {},
                h('span', { class: 'act-list-no' }, `${i + 1}번째`),
                h('span', { class: 'act-list-main' }, `숫자 ${r.count}개`),
                h('span', { class: 'act-list-state' }, STATUS_TEXT[r.status]),
              ),
            ),
          ),
        ),
        h('div', { class: 'row' }, button('한 번 더 하기', onAgain)),
      );
      speak(summaryLine(rows.length));
    },
  };
}
