// STEP 2 화면 그리기. 판정은 하지 않고 보여주기만 한다.
// 고령자 UX: 큰 글씨, 손 이름은 그림(✊ ✋ ✌️)과 글자를 함께, 결과는 색과 함께 기호·문구로 표시한다.

import { h, button, message } from '../../ui/components.js';
import { handText } from './logic.js';

// 화면 버튼은 익숙한 "가위, 바위, 보" 순서로
const BUTTON_ORDER = ['V', 'ROCK', 'PAPER'];

// 요약 화면의 문제별 결과 문구 (점수처럼 보이지 않게, 기호 + 글자)
const STATUS_TEXT = {
  first: '○ 한 번에 해내셨어요',
  second: '○ 다시 생각해서 해내셨어요',
  shown: 'ℹ 함께 답을 확인했어요',
  skipped: '→ 건너뛰었어요',
};

const TEXT_28 = { 'font-size': '28px', 'line-height': '1.5' };

export function createScreen(container) {
  container.innerHTML = '';
  const area = h('div', { class: 'program-body' });
  container.append(area);

  let robotBig = null; // 문제 화면의 "로봇이 낸 손" 큰 글자 (어려움에서 숨길 때 바꾼다)
  let handNotice = null; // 문제 화면의 손 인식 안내. 이상이 있을 때만 보인다

  function handNoticeBox() {
    handNotice = h('p', { class: 'msg msg-retry', 'aria-live': 'polite', hidden: true }, '');
    return handNotice;
  }

  function set(...children) {
    area.innerHTML = '';
    area.append(...children.flat().filter(Boolean));
  }

  function progress(index, total) {
    return h(
      'p',
      { 'aria-label': `${total}문제 중 ${index}번째`, style: { 'font-size': '28px', 'font-weight': '700', margin: '0' } },
      `문제 ${index} / ${total}`,
    );
  }

  function robotBox(robotHand) {
    robotBig = h('p', { style: { 'font-size': '64px', 'font-weight': '900', margin: '0' } }, handText(robotHand));
    return h(
      'div',
      {
        style: {
          border: '3px solid var(--line)',
          'border-radius': '16px',
          padding: '16px',
          'text-align': 'center',
          background: 'var(--card)',
        },
      },
      h('p', { style: { 'font-size': '26px', margin: '0 0 4px' } }, '로봇이 낸 손'),
      robotBig,
    );
  }

  return {
    intro({ total, revealSec }, onStart) {
      set(
        message('로봇이 가위바위보를 내면, 화면의 말에 맞게 손을 내 주세요.', 'info'),
        h('p', { style: TEXT_28 }, '예: 로봇이 ✊ 바위를 내고 “이겨주세요”가 나오면 ✋ 보를 내면 돼요.'),
        h('p', { style: TEXT_28 }, `모두 ${total}문제예요. 서두르지 않아도 돼요. 천천히 생각해서 손을 내 주세요.`),
        revealSec
          ? h('p', { style: TEXT_28 }, `어려움: 로봇 손은 ${revealSec}초만 보여 줘요. 잘 기억해 주세요.`)
          : null,
        h('div', { class: 'row' }, button('시작하기', onStart)),
      );
    },

    /** "가위" → "바위" → "보!" 큰 글자 */
    countdown(word, { index, total }) {
      set(
        progress(index, total),
        h(
          'p',
          { class: 'big-prompt', 'aria-live': 'assertive', style: { 'font-size': '120px', margin: '40px 0' } },
          word,
        ),
      );
    },

    /** 문제: 로봇 손, 조건, 화면 버튼(손 인식 대체 입력), 건너뛰기 */
    question({ index, total, robotHand, conditionText, attempt, holdSec }, onAnswer, onSkip) {
      set(
        progress(index, total),
        robotBox(robotHand),
        h('p', { class: 'big-prompt', style: { 'font-size': '48px' } }, `“${conditionText}”`),
        attempt > 1 ? message('한 번 더 생각해 볼까요?', 'retry') : null,
        message(`노트북 카메라에 손을 ${holdSec}초 동안 보여 주세요. 어려우면 아래 버튼을 눌러도 돼요.`, 'info'),
        handNoticeBox(),
        h(
          'div',
          { class: 'row', role: 'group', 'aria-label': '내 손 고르기' },
          BUTTON_ORDER.map((hand) => button(handText(hand), () => onAnswer(hand))),
        ),
        h('div', { class: 'row' }, button('건너뛰기', onSkip, { variant: 'secondary' })),
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
      if (robotBig) robotBig.textContent = '❓ 기억해 보세요';
    },

    good({ userHand, attempt }) {
      set(
        message(`잘하셨어요! ${handText(userHand)}를 내셨어요.`, 'good'),
        attempt > 1 ? h('p', { style: TEXT_28 }, '다시 생각해서 해내셨어요.') : null,
      );
    },

    /** 첫 번째 답이 조건에 맞지 않을 때 */
    retry({ userHand, hint }, onAgain) {
      set(
        message('다시 해 볼까요?', 'retry'),
        h('p', { style: TEXT_28 }, `${handText(userHand)}를 내셨어요.`),
        h('p', { style: TEXT_28 }, hint),
        h('div', { class: 'row' }, button('다시 하기', onAgain)),
      );
    },

    /** 두 번째도 맞지 않을 때: 답을 함께 확인하고 로봇이 그 손을 보여 준다 */
    reveal({ text, answer, isLast }, onNext) {
      set(
        message('함께 알아볼까요?', 'info'),
        h('p', { style: TEXT_28 }, text),
        h('p', { style: TEXT_28 }, `로봇이 ${handText(answer)}를 보여 드릴게요.`),
        h('div', { class: 'row' }, button(isLast ? '활동 기록 보기' : '다음 문제', onNext)),
      );
    },

    /**
     * 회차 요약: 문제별 한 줄 + 격려. 점수는 보여 주지 않는다.
     * rows: [{ robotHand, conditionText, status }]
     */
    summary({ rows }, onAgain) {
      set(
        h('h2', { style: { 'font-size': '36px', margin: '0' } }, '오늘의 활동 기록'),
        h(
          'ol',
          { style: { 'font-size': '26px', 'line-height': '1.8', margin: '0', 'padding-left': '1.5em' } },
          rows.map((r) =>
            h('li', {}, `로봇 ${handText(r.robotHand)} · “${r.conditionText}” — ${STATUS_TEXT[r.status]}`),
          ),
        ),
        message(`${rows.length}문제를 모두 함께 해 주셨어요. 수고하셨어요!`, 'good'),
        h('p', { style: TEXT_28 }, '위의 "활동 기록 보기"에서 지난 기록도 볼 수 있어요.'),
        h('div', { class: 'row' }, button('한 번 더 하기', onAgain)),
      );
    },
  };
}
