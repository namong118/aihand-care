// STEP 2 화면 그리기. 판정은 하지 않고 보여주기만 한다.
// 고령자 UX: 큰 글씨, 손 이름은 그림과 글자를 함께, 결과는 색과 함께 기호·문구로 표시한다.
// 모양은 styles.css "활동 화면 공통"(act-*) 클래스 (시안 v11 "활동 화면", docs/ui-classes.md)
// 7인치(1280×720)에서 답 버튼과 건너뛰기가 스크롤 없이 보이게: 로봇 손과 조건을 한 카드에 나란히 (#100)

import { h, button, message } from '../../ui/components.js';
import { handIcon } from '../../ui/icons.js';
import { handText, timingText, seenText, HAND_LABELS } from './logic.js';

// 화면 버튼은 익숙한 "가위, 바위, 보" 순서로
const BUTTON_ORDER = ['V', 'ROCK', 'PAPER'];

// 요약 화면의 문제별 결과 문구 (점수처럼 보이지 않게, 기호 + 글자)
const STATUS_TEXT = {
  first: '○ 한 번에 해내셨어요',
  second: '○ 다시 생각해서 해내셨어요',
  shown: 'ℹ 함께 답을 확인했어요',
  skipped: '→ 건너뛰었어요',
};

// 동시에 가위바위보 요약 화면의 판별 결과 문구
const QUICK_TEXT = {
  win: '○ 이기셨어요',
  draw: '△ 비겼어요',
  lose: '◇ 로봇이 이겼어요',
  early: '→ 조금 빨랐어요',
  late: '→ 조금 늦었어요',
  unclear: '→ 손 모양을 알아보지 못했어요',
  none: '→ 손이 안 보였어요',
};

/**
 * hand: ctx.hand (캠 화면에 쓴다: preview, onPose). 없으면 캠 화면을 만들지 않는다
 */
export function createScreen(container, hand = null) {
  container.innerHTML = '';
  const area = h('div', { class: 'program-body' });
  container.append(area);

  // 캠 화면 연결 끊기 함수들. 화면을 그릴 때 인자를 먼저 만들므로(camBox 가 먼저 불림)
  // 새 화면 것(camNext)과 지금 화면 것(camNow)을 나눠 두고, set 에서 지금 것만 끊는다
  let camNow = [];
  let camNext = [];
  function closeCam() {
    camNow.forEach((off) => off());
    camNow = [];
  }

  /**
   * 내 손 캠 화면: 거울처럼 보이는 웹캠 영상 + "지금 보이는 손" 글자.
   * 사용자가 손이 카메라에 잘 보이는지, 어떤 모양으로 인식되는지 바로 알 수 있게 한다.
   * 웹캠이 꺼져 있으면(화면 버튼 모드) 칸은 그대로 두고 "카메라가 꺼져 있어요"를 보여 준다.
   * (칸을 숨기면 왜 안 나오는지 알 수 없다. 페이지를 다시 불러오면 웹캠이 꺼진다)
   */
  function camBox() {
    if (!hand?.preview) return null;
    const video = h('video', { class: 'webcam-video', 'aria-hidden': 'true', hidden: true });
    const off = h(
      'p',
      { class: 'act-text', style: { margin: '0', 'text-align': 'center', padding: '24px 0' } },
      '카메라가 꺼져 있어요. 위쪽 “웹캠 켜기”를 누르면 내 손이 보여요.',
    );
    const seen = h('p', { class: 'act-label', 'aria-live': 'polite', hidden: true, style: { margin: '0', 'text-align': 'center', 'font-size': '24px' } }, '손이 안 보여요');
    const box = h(
      'div',
      { class: 'act-card', style: { width: '240px', flex: 'none', gap: '8px', padding: '12px', 'justify-content': 'center' } },
      video,
      off,
      seen,
    );
    camNext.push(
      hand.preview(video, (on) => {
        video.hidden = !on;
        seen.hidden = !on;
        off.hidden = on;
      }),
      hand.onPose((pose) => {
        const text = seenText(pose);
        if (seen.textContent !== text) seen.textContent = text;
      }),
    );
    return box;
  }

  /** 왼쪽 내용 + 오른쪽 캠 화면 한 줄 */
  const withCam = (main) =>
    h('div', { style: { display: 'flex', gap: '16px', 'align-items': 'stretch' } }, h('div', { style: { flex: '1', 'min-width': '0', display: 'flex', 'flex-direction': 'column' } }, main), camBox());

  let robotArt = null; // 문제 화면의 "로봇이 낸 손" 그림 (어려움에서 숨길 때 바꾼다)
  let robotName = null; // 그 아래 손 이름
  let handNotice = null; // 문제 화면의 손 인식 안내. 이상이 있을 때만 보인다

  function handNoticeBox() {
    handNotice = h('p', { class: 'msg msg-retry', 'aria-live': 'polite', hidden: true }, '');
    return handNotice;
  }

  function set(...children) {
    closeCam();
    camNow = camNext;
    camNext = [];
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

  let quickWordEl = null; // 동시에 가위바위보 판 화면의 "가위/바위/보!" 큰 글자

  return {
    /** 활동을 나갈 때 (unmount): 캠 화면 연결을 끊는다 */
    close() {
      closeCam();
      camNext.forEach((off) => off());
      camNext = [];
    },

    /** "하나만 해 보기"로 들어왔을 때 첫 화면: 어떤 가위바위보를 할지 고르기 */
    modeChoice(onQuick, onThink) {
      set(
        card(
          h('p', { class: 'act-question' }, '어떤 가위바위보를 해 볼까요?'),
          h('p', { class: 'act-text' }, '동시에 가위바위보: 로봇과 진짜처럼 “보!”에 맞춰 함께 손을 내요.'),
          h('p', { class: 'act-text' }, '생각하는 가위바위보: 화면의 말에 맞게 손을 생각해서 내요.'),
        ),
        h('div', { class: 'row' }, button('동시에 가위바위보', onQuick), button('생각하는 가위바위보', onThink, { variant: 'secondary' })),
      );
    },

    /** 동시에 가위바위보 안내 */
    quickIntro({ total, lateSec }, onStart) {
      set(
        withCam(
          card(
            h('p', { class: 'act-question' }, '“보!”에 맞춰 함께 내요'),
            // 캠 화면은 웹캠이 켜져 있을 때만 보인다. 시작 전에 손이 잘 보이는지 확인할 수 있게
            hand?.preview ? h('p', { class: 'act-text' }, '먼저 손을 들어 카메라 화면에 손이 잘 보이는지 확인해 보세요.') : null,
            h('p', { class: 'act-text' }, '시작하면 손을 카메라 밖으로 내리고 기다려 주세요.'),
            h('p', { class: 'act-text' }, '“가위, 바위, 보!”의 “보!” 소리에 맞춰 가위·바위·보 중 하나를 내 주세요. 로봇도 같이 내요.'),
            h('p', { class: 'act-text' }, `“보!” 뒤 ${lateSec}초 안에 내면 돼요. 모두 ${total}판이에요.`),
          ),
        ),
        h('div', { class: 'row' }, button('시작하기', onStart)),
      );
    },

    /** 동시에 가위바위보 한 판: 큰 구호 글자 + 화면 버튼 (손 인식 대체 입력, 구호 내내 보인다) */
    quickPlay({ index, total, holdSec }, onAnswer) {
      quickWordEl = h('p', { class: 'act-prompt', 'aria-live': 'assertive', style: { 'font-size': '110px', padding: '24px 0' } }, '');
      set(
        h('div', { class: 'act-head' }, h('span', { class: 'act-progress', 'aria-label': `${total}판 중 ${index}번째` }, `${index}판 / ${total}`)),
        withCam(h('div', { class: 'act-card', style: { flex: '1', 'justify-content': 'center' } }, quickWordEl)),
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
        h('div', { class: 'act-foot' }, h('p', { class: 'act-foot-text' }, `“보!”에 맞춰 손을 내 주세요 (${holdSec}초 보여 주기). 버튼을 눌러도 돼요.`)),
      );
    },

    /** 동시에 가위바위보 구호 글자 바꾸기 (버튼은 그대로 두고 글자만) */
    quickWord(word) {
      if (quickWordEl) quickWordEl.textContent = word;
    },

    /** 동시에 가위바위보 한 판 결과: 로봇 손 · 내 손 · 결과 문구 */
    quickResult({ robotHand, userHand, msg, timingMs }) {
      const side = (label, hand) =>
        h(
          'div',
          { style: { display: 'flex', 'flex-direction': 'column', 'align-items': 'center', gap: '6px', flex: '1 1 150px' } },
          h('span', { class: 'act-label' }, label),
          h('span', { class: 'act-art act-art-lg' }, hand ? handIcon(hand, 58) : '?'),
          h('span', { style: { 'font-size': '28px', 'font-weight': '600' } }, hand ? HAND_LABELS[hand] : '—'),
        );
      set(
        message(msg.text, msg.tone),
        h('div', { class: 'act-card act-card-row' }, side('로봇', robotHand), side('나', userHand)),
        timingText(timingMs) ? card(h('p', { class: 'act-text' }, timingText(timingMs))) : null,
      );
    },

    /**
     * 동시에 가위바위보 요약: 판별 한 줄 + 이김·비김 수. 점수나 능력 평가처럼 보이지 않게 활동 기록으로만.
     * games: [{ robotHand, hand, timing, timingMs, outcome }], sum: summarizeQuick 결과
     */
    quickSummary({ games, sum }, onAgain) {
      set(
        message(`${games.length}판을 모두 함께 해 주셨어요. 수고하셨어요!`, 'good'),
        card(
          h('h2', { style: { 'font-size': '30px', margin: '0' } }, '오늘의 활동 기록'),
          h('p', { class: 'act-text' }, `“보!”에 맞춰 낸 판 ${sum.done}번 · 이김 ${sum.wins} · 비김 ${sum.draws} · 로봇이 이김 ${sum.losses}`),
          h(
            'ol',
            { class: 'act-list' },
            games.map((g, i) =>
              h(
                'li',
                {},
                h('span', { class: 'act-list-no' }, `${i + 1}판`),
                h(
                  'span',
                  { class: 'act-list-main' },
                  `로봇 ${HAND_LABELS[g.robotHand]} · 나 ${g.hand ? HAND_LABELS[g.hand] : '—'}${g.timing === 'ontime' ? ` · ${timingText(g.timingMs)}` : ''}`,
                ),
                h('span', { class: 'act-list-state' }, QUICK_TEXT[g.outcome ?? g.timing]),
              ),
            ),
          ),
        ),
        h('div', { class: 'row' }, button('한 번 더 하기', onAgain)),
      );
    },

    intro({ total, revealSec, hello = null }, onStart) {
      set(
        card(
          hello ? h('p', { class: 'act-text' }, hello) : null,
          h('p', { class: 'act-question' }, '말에 맞게 손을 내 주세요'),
          h('p', { class: 'act-text' }, '로봇이 가위바위보를 내면, 화면의 말에 맞게 손을 내 주세요.'),
          h('p', { class: 'act-text' }, '예: 로봇이 바위를 내고 “이겨주세요”가 나오면 보를 내면 돼요.'),
          h('p', { class: 'act-text' }, `모두 ${total}문제예요. 서두르지 않아도 돼요. 천천히 생각해서 손을 내 주세요.`),
          // revealSec 은 어려움일 때만 있다. 어려움에는 낼 수 있는 손이 둘인 조건도 나온다 (#18)
          revealSec
            ? h(
                'p',
                { class: 'act-text' },
                `어려움: 로봇 손은 ${revealSec}초만 보여 줘요. 잘 기억해 주세요. “이기지 마세요”처럼 낼 수 있는 손이 둘인 문제도 나와요.`,
              )
            : null,
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

    /** 맞게 냈을 때. line = goodLine() 으로 고른 칭찬 (다시 해서 해냈으면 그 말도 들어 있다) */
    good({ userHand, line }) {
      set(message(line, 'good'), card(h('p', { class: 'act-text' }, `${handText(userHand)}를 내셨어요.`)));
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
    reveal({ text, answers, isLast }, onNext) {
      // 정답이 둘이면 두 손을 나란히 보여 주고, 로봇도 차례로 보여 준다 (#18)
      const robotText =
        answers.length > 1
          ? `로봇이 ${answers.map(handText).join('와 ')}를 차례로 보여 드릴게요.`
          : `로봇이 ${handText(answers[0])}를 보여 드릴게요.`;
      set(
        message('함께 알아볼까요?', 'info'),
        card(
          h('p', { class: 'act-text' }, text),
          h(
            'div',
            { style: { display: 'flex', 'align-items': 'center', gap: '16px', 'flex-wrap': 'wrap' } },
            answers.map((a) => h('span', { class: 'act-art' }, handIcon(a))),
            h('p', { class: 'act-text', style: { color: 'var(--c-text)' } }, robotText),
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
