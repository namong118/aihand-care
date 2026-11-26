// 시연 코스 화면: 코스 시작, 활동 사이 안내, 활동 화면 위쪽 막대, 코스 요약.
// 진행(어느 활동인지, 기록을 받았는지)은 main.js 가 하고, 여기서는 그리기만 한다.
// 활동 역할 설명(조건 판단, 주의 전환 등)은 화면에 넣지 않는다 (발표 자료에서만, docs/decisions.md 3번).
// 결과는 "활동 기록"으로만 보여 준다. 점수·비율처럼 평가로 보이는 말은 쓰지 않는다.

import { h, button, message } from '../ui/components.js';
import { pageHead, pageTile, pageActions, headButton } from '../ui/page.js';
import { findProgramInfo } from './catalog.js';
import { levelText } from './find-start.js';

const INPUT_TEXT = {
  hand: '손으로 해요 (카메라에 손을 보여 주세요)',
  card: '카드로 해요 (카메라에 카드를 보여 주세요)',
};

/** 진행 상태 글자 (색만으로 구분하지 않게 글자를 함께 쓴다) */
const STATE_TEXT = { done: '마침', skipped: '건너뜀', now: '지금', next: '' };

/** 입력 방법 그림: 손(펼친 손), 카드(네모 카드) */
const INPUT_ICON = {
  hand: '<path d="M7 11V6.5a1.5 1.5 0 0 1 3 0V11"/><path d="M10 10V4.5a1.5 1.5 0 0 1 3 0V10"/><path d="M13 10V5.5a1.5 1.5 0 0 1 3 0V12"/><path d="M16 12V8.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L4.5 14a1.5 1.5 0 0 1 2.5-1.6L8 14"/>',
  card: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>',
};

function inputIcon(input) {
  const span = h('span', { class: 'course-input-icon', 'aria-hidden': 'true' });
  span.innerHTML = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${INPUT_ICON[input] ?? ''}</svg>`;
  return span;
}

/** 진행 표시 앞 기호: 마침 ✔, 건너뜀 ↷, 그 밖은 순서 번호 */
function stateMark(item) {
  if (item.state === 'done') return '✔';
  if (item.state === 'skipped') return '↷';
  return String(item.order);
}

/** 알약 앞 기호 (지금·아직은 순서 번호만) */
const CHIP_MARK = { done: '✔ ', skipped: '↷ ', now: '', next: '' };

/** 입력 방법이 바뀔 때 안내 */
const INPUT_CHANGED_TEXT = {
  hand: '이번에는 카드 대신 손을 보여 주세요.',
  card: '이번에는 손 대신 카드를 보여 주세요. 로봇 앞, 같은 자리에 들어 주세요.',
};

/**
 * 지금 코스를 하는 분 알약 ("봄날 어르신" 또는 "손님"). who 가 없으면 그리지 않는다 (#82)
 * 호칭만 보여 준다. 실명은 받지 않는다
 */
export function whoPill(who) {
  if (!who) return null;
  return h('span', { class: 'pill course-who', 'aria-label': `지금 하시는 분: ${who}` }, who);
}

/** STEP 색 클래스 ("step1"~"step4"). styles.css 의 --stepN-* 색을 쓴다 */
function stepClass(id) {
  const step = findProgramInfo(id)?.step;
  return step ? ` step${step}` : '';
}

export function programTitle(id) {
  return findProgramInfo(id)?.title ?? id;
}

/** "1번째 활동 · 손운동 코칭 (4개 중 1)" */
export function stepLabel(info) {
  return `${info.order}번째 활동 · ${programTitle(info.program)} (${info.of}개 중 ${info.order})`;
}

/**
 * 코스 시작 화면.
 * @param o.plan        [{ program, input }]
 * @param o.deviceNote  장치 상태 한 줄 (main.js 가 만든다)
 * @param o.who         지금 하시는 분 호칭 또는 "손님" (로그인 결과, #82)
 * @param o.levels      그분의 시작 단계 { 활동 id: 단계 } (user-levels.js). 정해 둔 활동에 "보통부터" 알약. 손님은 {}
 * @param o.onStart     "시작하기"
 * @param o.onHome      "← 홈으로"
 */
export function renderCourseIntro(container, { plan, deviceNote, who, levels = {}, onStart, onHome }) {
  container.innerHTML = '';
  container.append(
    h(
      'div',
      { class: 'page' },
      pageHead(whoEyebrow(who), `오늘의 활동 ${plan.length}가지`, headButton('← 홈으로', onHome)),
      h('p', { class: 'page-text' }, '차례대로 이어서 해 볼까요? 하나가 끝나면 다음 활동으로 넘어가요.'),
      // 홈의 활동 카드처럼 STEP 색 칸 4개
      h(
        'ol',
        { class: 'course-plan' },
        plan.map((step, i) =>
          h(
            'li',
            { class: `course-plan-item${stepClass(step.program)}` },
            h('span', { class: 'course-plan-order' }, `${i + 1}번째`),
            h('strong', { class: 'course-plan-name' }, programTitle(step.program)),
            h(
              'span',
              { class: 'course-plan-tags' },
              h('span', { class: 'course-plan-tag' }, step.input === 'hand' ? '손으로' : '카드로'),
              levels[step.program] !== undefined
                ? h('span', { class: 'course-plan-tag' }, `${levelText(step.program, levels[step.program])}부터`)
                : null,
            ),
          ),
        ),
      ),
      deviceNote ? message(deviceNote, 'info') : null,
      pageActions(button('시작하기', onStart)),
    ),
  );
}

/** 머리 위 작은 글자: "봄날 어르신의 코스" / "손님" (#82). 호칭만 보여 준다 */
function whoEyebrow(who) {
  if (!who) return null;
  return h('span', { class: 'page-who', 'aria-label': `지금 하시는 분: ${who}` }, who);
}

/**
 * 활동 사이 안내. 버튼을 눌러야 넘어간다 (자동으로 넘어가지 않음).
 * 왼쪽: 몇 번째 활동인지, 활동 이름과 설명, 손·카드 안내. 오른쪽: 오늘의 활동 목록.
 * @param o.info     stepInfo() 결과
 * @param o.progress courseProgress() 결과
 * @param o.who      지금 하시는 분 (#82)
 * @param o.onStart  "시작하기"
 * @param o.onStop   "코스 그만하기"
 */
export function renderStepIntro(container, { info, progress, who, onStart, onStop }) {
  const desc = findProgramInfo(info.program)?.desc;
  container.innerHTML = '';
  container.append(
    h(
      'div',
      { class: `course course-step${stepClass(info.program)}` },
      h(
        'section',
        { class: 'course-step-main' },
        h('div', { class: 'course-step-head' }, h('p', { class: 'course-step-no' }, `${info.of}개 활동 중 ${info.order}번째`), whoPill(who)),
        h('h1', { class: 'course-step-title' }, programTitle(info.program)),
        desc ? h('p', { class: 'course-step-desc' }, desc) : null,
        h(
          'div',
          { class: `course-input-box is-${info.input}${info.inputChanged ? ' is-changed' : ''}`, role: 'status' },
          inputIcon(info.input),
          h('span', {}, info.inputChanged ? INPUT_CHANGED_TEXT[info.input] : INPUT_TEXT[info.input]),
        ),
        h('div', { class: 'row' }, button('시작하기', onStart), button('코스 그만하기', onStop, { variant: 'secondary' })),
      ),
      progress ? progressList(progress) : null,
    ),
  );
}

/** 오른쪽 "오늘의 활동" 목록 */
function progressList(progress) {
  return h(
    'aside',
    { class: 'course-progress', 'aria-label': '오늘의 활동' },
    h('h2', {}, '오늘의 활동'),
    h(
      'ol',
      {},
      progress.map((item) =>
        h(
          'li',
          { class: `course-progress-item is-${item.state}${stepClass(item.program)}`, 'aria-current': item.state === 'now' ? 'step' : null },
          h('span', { class: 'course-mark', 'aria-hidden': 'true' }, stateMark(item)),
          h('span', { class: 'course-progress-name' }, programTitle(item.program)),
          STATE_TEXT[item.state] ? h('span', { class: 'course-progress-state' }, STATE_TEXT[item.state]) : null,
        ),
      ),
    ),
  );
}

/**
 * 활동 화면 위쪽 막대 (코스 중에만, 기존 program-bar 대신). 진행 알약 줄 + 버튼 줄.
 *   기록을 받기 전: [이 활동 건너뛰기] [코스 그만하기]
 *   기록을 받은 뒤: [다음 활동으로 →] (마지막이면 [코스 마치기]) [코스 그만하기]
 * 건너뛰기·그만하기는 한 번 더 묻는다 (브라우저 확인 창 대신 막대 안에서).
 * @returns { el, setFinished() }
 */
export function createCourseBar({ info, progress, who, onNext, onSkip, onStop }) {
  // 제목은 화면 읽기 프로그램용으로 두고, 눈에는 진행 알약으로 보여 준다
  const label = h('h1', { class: 'sr-only' }, stepLabel(info));
  const chips = progress
    ? h(
        'ol',
        { class: 'course-chips', 'aria-label': '코스 진행' },
        progress.map((item) =>
          h(
            'li',
            { class: `course-chip is-${item.state}${stepClass(item.program)}`, 'aria-current': item.state === 'now' ? 'step' : null },
            `${CHIP_MARK[item.state]}${item.order} ${programTitle(item.program)}`,
            STATE_TEXT[item.state] ? ` · ${STATE_TEXT[item.state]}` : '',
          ),
        ),
      )
    : h('p', { class: 'course-bar-title', 'aria-hidden': 'true' }, stepLabel(info));
  const actions = h('div', { class: 'course-actions' });
  // 지금 하시는 분은 버튼 줄 오른쪽 끝에 (#82)
  const el = h('div', { class: 'program-bar course-bar' }, label, chips, actions, whoPill(who));
  let finished = false;

  function normal() {
    const next = button(info.isLast ? '코스 마치기' : '다음 활동으로 →', onNext);
    const skip = button('이 활동 건너뛰기', () => ask('이 활동을 건너뛸까요?', '건너뛰기', onSkip), { variant: 'secondary' });
    const stop = button('코스 그만하기', () => ask('코스를 그만할까요?', '그만하기', onStop), { variant: 'secondary' });
    actions.replaceChildren(...(finished ? [next, stop] : [skip, stop]));
  }

  function ask(question, yesLabel, onYes) {
    actions.replaceChildren(
      h('span', { class: 'course-ask', role: 'status' }, question),
      button(yesLabel, onYes),
      button('계속하기', normal, { variant: 'secondary' }),
    );
  }

  normal();
  return {
    el,
    /** 이 활동의 기록을 받았을 때: "다음 활동으로" 버튼을 보여준다 */
    setFinished() {
      if (finished) return;
      finished = true;
      normal();
    },
  };
}

/** 활동 하나의 결과 글자 */
export function activityText(a) {
  if (a.status === 'skipped') return '건너뜀';
  if (a.status === 'notPlayed') return '하지 않음';
  const parts = [`완료 ${a.done} / ${a.total}`];
  if (a.skipped > 0) parts.push(`건너뛴 문제 ${a.skipped}`);
  if (a.rounds > 1) parts.push(`${a.rounds}번 함`);
  return parts.join(' · ');
}

/** 'YYYY-MM-DD' → '11월 13일' */
function dateText(date) {
  if (!date) return '';
  const [, m, d] = date.split('-').map(Number);
  return `${m}월 ${d}일`;
}

/**
 * 코스 요약 화면.
 * @param o.summary    summarizeCourse() 결과
 * @param o.who        지금 하시는 분 (#82)
 * @param o.challenges 이어서 해 볼 도전 활동 [{ id, name, level }] (level: 그분의 도전 단계 1·2·3). 없으면 칸을 그리지 않는다
 * @param o.onChallenge (id) => 그 도전 활동 열기 (그분의 단계로, docs/decisions.md 3번)
 * @param o.onHome     "처음으로"
 * @param o.onResults  "활동 기록 보기"
 */
export function renderCourseSummary(container, { summary, who, challenges = [], onChallenge, onHome, onResults }) {
  const playedAll = summary.activities.every((a) => a.status === 'played');
  container.innerHTML = '';
  container.append(
    h(
      'div',
      { class: 'page' },
      pageHead(
        h('span', {}, whoEyebrow(who), who ? ' · ' : '', dateText(summary.date)),
        summary.finished && playedAll ? '모두 함께 해 주셨어요. 수고하셨어요!' : '오늘 함께한 활동이에요. 수고하셨어요!',
      ),
      // 코스 시작 화면과 같은 STEP 색 칸에 활동 기록 한 줄씩
      h(
        'ol',
        { class: 'course-plan', 'aria-label': '오늘의 활동 기록' },
        summary.activities.map((a) =>
          h(
            'li',
            { class: `course-plan-item is-${a.status}${stepClass(a.program)}` },
            h('span', { class: 'course-plan-order' }, `${a.order}번째`),
            h('strong', { class: 'course-plan-name' }, programTitle(a.program)),
            h('span', { class: 'course-plan-record' }, activityText(a)),
          ),
        ),
      ),
      // 도전 활동은 코스에 넣지 않는다. 코스를 마친 뒤 원하시면 그분의 단계로 이어서 해 본다
      challenges.length > 0 && onChallenge
        ? h(
            'section',
            { class: 'course-challenges', 'aria-label': '도전 활동 해 보기' },
            h('h2', {}, '도전 활동도 해 보시겠어요?'),
            h(
              'div',
              { class: 'page-tile-grid' },
              challenges.map((c) => pageTile(c.name, `${c.level}단계로 해 봐요`, () => onChallenge(c.id), { step: stepOfChallenge(c.id) })),
            ),
          )
        : null,
      pageActions(button('처음으로', onHome), button('활동 기록 보기', onResults, { variant: 'secondary' })),
    ),
  );
}

/** 도전 활동 칸 색: 짝인 기본 활동의 STEP 색 (catalog 의 step, 없으면 회색) */
function stepOfChallenge(id) {
  const step = findProgramInfo(id)?.step;
  return step ? `step${step}` : null;
}
