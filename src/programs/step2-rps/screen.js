// STEP 2 화면 그리기. 판정은 하지 않고 보여주기만 한다.
// 고령자 UX: 큰 글씨, 손 이름은 그림과 글자를 함께, 결과는 색과 함께 기호·문구로 표시한다.
// 모양은 styles.css "활동 화면 공통"(act-*) 클래스 (시안 v11 "활동 화면", docs/ui-classes.md)
// 7인치(1280×720)에서 답 버튼과 건너뛰기가 스크롤 없이 보이게: 로봇 손과 조건을 한 카드에 나란히 (#100)

import { h, button, message } from '../../ui/components.js';
import { handIcon } from '../../ui/icons.js';
import { handText, HAND_LABELS } from './logic.js';

// 화면 버튼은 익숙한 "가위, 바위, 보" 순서로
const BUTTON_ORDER = ['V', 'ROCK', 'PAPER'];

// 요약 화면의 문제별 결과 문구 (점수처럼 보이지 않게, 기호 + 글자)
const STATUS_TEXT = {
  first: '○ 한 번에 해내셨어요',
  second: '○ 다시 생각해서 해내셨어요',
  shown: 'ℹ 함께 답을 확인했어요',
  skipped: '→ 건너뛰었어요',
};

export function createScreen(container) {
  container.innerHTML = '';
  const area = h('div', { class: 'program-body' });
  container.append(area);

  let robotArt = null; // 문제 화면의 "로봇이 낸 손" 그림 (어려움에서 숨길 때 바꾼다)
  let robotName = null; // 그 아래 손 이름
  let handNotice = null; // 문제 화면의 손 인식 안내. 이상이 있을 때만 보인다

  function handNoticeBox() {
    handNotice = h('p', { class: 'msg msg-retry', 'aria-live': 'polite', hidden: true }, '');
    return handNotice;
  }

  function set(...children) {
    area.innerHTML = '';
    area.append(...children.flat().filter(Boolean));
  }

  const card = (...children) => h('div', { class: 'act-card' }, ...children);

  function progress(index, total) {
    return h('span', { class: 'act-progress', 'aria-label': `${total}문제 중 ${index}번째` }, `문제 ${index} / ${total}`);
  }

  /** 로봇이 낸 손: 그림 + 이름 */
  function robotBox(robotHand) {
    robotArt = h('span', { class: 'act-art act-art-lg' }, handIcon(robotHand, 58));
    robotName = h('span', { style: { 'font-size': '28px', 'font-weight': '600' } }, HAND_LABELS[robotHand]);
    return h(
      'div',
      { style: { display: 'flex', 'flex-direction': 'column', 'align-items': 'center', gap: '6px', width: '150px', flex: 'none' } },
      h('span', { class: 'act-label' }, '로봇이 낸 손'),
      robotArt,
      robotName,
    );
  }

  return {
    intro({ total, revealSec }, onStart) {
      set(
        card(
          h('p', { class: 'act-question' }, '말에 맞게 손을 내 주세요'),
          h('p', { class: 'act-text' }, '로봇이 가위바위보를 내면, 화면의 말에 맞게 손을 내 주세요.'),
          h('p', { class: 'act-text' }, '예: 로봇이 바위를 내고 “이겨주세요”가 나오면 보를 내면 돼요.'),
          h('p', { class: 'act-text' }, `모두 ${total}문제예요. 서두르지 않아도 돼요. 천천히 생각해서 손을 내 주세요.`),
          revealSec ? h('p', { class: 'act-text' }, `어려움: 로봇 손은 ${revealSec}초만 보여 줘요. 잘 기억해 주세요.`) : null,
        ),
        h('div', { class: 'row' }, button('시작하기', onStart)),
      );
    },

    /** "가위" → "바위" → "보!" 큰 글자 */
    countdown(word, { index, total }) {
      set(
        h('div', { class: 'act-head' }, progress(index, total)),
        card(h('p', { class: 'act-prompt', 'aria-live': 'assertive', style: { 'font-size': '120px', padding: '40px 0' } }, word)),
      );
    },

    /** 문제: 로봇 손, 조건, 화면 버튼(손 인식 대체 입력), 건너뛰기 */
    question({ index, total, robotHand, conditionText, attempt, holdSec }, onAnswer, onSkip) {
      set(
        h('div', { class: 'act-head' }, progress(index, total), attempt > 1 ? h('span', { class: 'act-tag' }, '한 번 더 생각해 보는 중') : null),
        h(
          'div',
          { class: 'act-card act-card-row' },
          robotBox(robotHand),
          h(
            'div',
            { style: { display: 'flex', 'flex-direction': 'column', gap: '6px', flex: '1 1 300px', 'min-width': '0' } },
            h('span', { class: 'act-label' }, '이번 말'),
            h('p', { class: 'act-question' }, `“${conditionText}”`),
          ),
        ),
        handNoticeBox(),
        h(
          'div',
          { class: 'act-answers', role: 'group', 'aria-label': '내 손 고르기', style: { 'grid-template-columns': 'repeat(3, minmax(0, 1fr))' } },
          BUTTON_ORDER.map((hand) =>
            h(
              'button',
              { type: 'button', class: 'act-answer', onClick: () => onAnswer(hand) },
              h('span', { class: 'act-art' }, handIcon(hand)),
              HAND_LABELS[hand],
            ),
          ),
        ),
        h(
          'div',
          { class: 'act-foot' },
          h('p', { class: 'act-foot-text' }, `카메라 앞에 손을 ${holdSec}초 동안 보여 주세요. 버튼을 눌러도 돼요.`),
          button('건너뛰기', onSkip, { variant: 'secondary' }),
        ),
      );
    },

    /**
     * 손 인식 안내. fb: logic.handFeedback 결과, show: 띄울지 (logic.shouldShowNotice)
     * 잘 되고 있으면 숨긴다 → 화면에는 웹캠 미리 보기(손가락 선)만 남는다.
     * 손 인식이 꺼져 있으면(화면 버튼 모드) 불리지 않아 계속 숨어 있다.
     */
    showHand(fb, show) {
      if (!handNotice) return;
      const text = show
        ? {
            none: '👋 카메라에 손이 보이지 않아요',
            other: '👋 가위·바위·보 중 하나를 내 주세요',
            old: fb.hand ? `👋 ${handText(fb.hand)} — 손을 한 번 내렸다가 다시 내 주세요` : '',
          }[fb.kind]
        : '';
      handNotice.hidden = !text;
      if (text && handNotice.textContent !== text) handNotice.textContent = text;
    },

    /** 어려움: 정해진 시간이 지나면 로봇 손을 가린다 */
    hideRobot() {
      if (robotArt) robotArt.replaceChildren('?');
      if (robotName) robotName.textContent = '기억해 보세요';
    },

    good({ userHand, attempt }) {
      set(
        message(`잘하셨어요! ${handText(userHand)}를 내셨어요.`, 'good'),
        attempt > 1 ? card(h('p', { class: 'act-text' }, '다시 생각해서 해내셨어요.')) : null,
      );
    },

    /** 첫 번째 답이 조건에 맞지 않을 때 */
    retry({ userHand, hint }, onAgain) {
      set(
        message('다시 해 볼까요?', 'retry'),
        card(h('p', { class: 'act-text' }, `${handText(userHand)}를 내셨어요.`), h('p', { class: 'act-text' }, hint)),
        h('div', { class: 'row' }, button('다시 하기', onAgain)),
      );
    },

    /** 두 번째도 맞지 않을 때: 답을 함께 확인하고 로봇이 그 손을 보여 준다 */
    reveal({ text, answer, isLast }, onNext) {
      set(
        message('함께 알아볼까요?', 'info'),
        card(
          h('p', { class: 'act-text' }, text),
          h(
            'div',
            { style: { display: 'flex', 'align-items': 'center', gap: '16px' } },
            h('span', { class: 'act-art' }, handIcon(answer)),
            h('p', { class: 'act-text', style: { color: 'var(--c-text)' } }, `로봇이 ${handText(answer)}를 보여 드릴게요.`),
          ),
        ),
        h('div', { class: 'row' }, button(isLast ? '활동 기록 보기' : '다음 문제', onNext)),
      );
    },

    /**
     * 회차 요약: 문제별 한 줄 + 격려. 점수는 보여 주지 않는다.
     * rows: [{ robotHand, conditionText, status }]
     */
    summary({ rows }, onAgain) {
      set(
        message(`${rows.length}문제를 모두 함께 해 주셨어요. 수고하셨어요!`, 'good'),
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
                h('span', { class: 'act-list-main' }, `로봇 ${HAND_LABELS[r.robotHand]} · “${r.conditionText}”`),
                h('span', { class: 'act-list-state' }, STATUS_TEXT[r.status]),
              ),
            ),
          ),
        ),
        h('div', { class: 'row' }, button('한 번 더 하기', onAgain)),
      );
    },
  };
}
