// 시연 코스 화면: 코스 시작, 활동 사이 안내, 활동 화면 위쪽 막대, 코스 요약.
// 진행(어느 활동인지, 기록을 받았는지)은 main.js 가 하고, 여기서는 그리기만 한다.
// 활동 역할 설명(조건 판단, 주의 전환 등)은 화면에 넣지 않는다 (발표 자료에서만, docs/decisions.md 3번).
// 결과는 "활동 기록"으로만 보여 준다. 점수·비율처럼 평가로 보이는 말은 쓰지 않는다.

import { h, button, message } from '../ui/components.js';
import { findProgramInfo } from './catalog.js';

const INPUT_TEXT = {
  hand: '손으로 해요 (카메라에 손을 보여 주세요)',
  card: '카드로 해요 (카메라에 카드를 보여 주세요)',
};

/** 입력 방법이 바뀔 때 안내 */
const INPUT_CHANGED_TEXT = {
  hand: '이번에는 카드 대신 손을 보여 주세요.',
  card: '이번에는 손 대신 카드를 보여 주세요. 로봇 앞, 같은 자리에 들어 주세요.',
};

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
 * @param o.onStart     "시작하기"
 * @param o.onHome      "← 홈으로"
 */
export function renderCourseIntro(container, { plan, deviceNote, onStart, onHome }) {
  container.innerHTML = '';
  container.append(
    h(
      'div',
      { class: 'course' },
      h('h1', {}, `오늘의 활동 ${plan.length}가지`),
      h('p', {}, '차례대로 이어서 해 볼까요? 하나가 끝나면 다음 활동으로 넘어가요.'),
      h(
        'ol',
        { class: 'course-list' },
        plan.map((step, i) =>
          h(
            'li',
            { class: 'course-item' },
            h('span', { class: 'course-order' }, `${i + 1}번째`),
            h('span', { class: 'course-name' }, programTitle(step.program)),
            h('span', { class: 'course-input' }, step.input === 'hand' ? '손' : '카드'),
          ),
        ),
      ),
      deviceNote ? message(deviceNote, 'info') : null,
      h('div', { class: 'row' }, button('시작하기', onStart), button('← 홈으로', onHome, { variant: 'secondary' })),
    ),
  );
}

/**
 * 활동 사이 안내. 버튼을 눌러야 넘어간다 (자동으로 넘어가지 않음).
 * @param o.info    stepInfo() 결과
 * @param o.onStart "시작하기"
 * @param o.onStop  "코스 그만하기"
 */
export function renderStepIntro(container, { info, onStart, onStop }) {
  container.innerHTML = '';
  container.append(
    h(
      'div',
      { class: 'course' },
      h('p', { class: 'course-step-no' }, `${info.order}번째 활동 (${info.of}개 중 ${info.order})`),
      h('h1', { class: 'course-step-title' }, programTitle(info.program)),
      h('p', { class: 'course-input-line' }, INPUT_TEXT[info.input]),
      info.inputChanged ? message(INPUT_CHANGED_TEXT[info.input], 'info') : null,
      h('div', { class: 'row' }, button('시작하기', onStart), button('코스 그만하기', onStop, { variant: 'secondary' })),
    ),
  );
}

/**
 * 활동 화면 위쪽 막대 (코스 중에만, 기존 program-bar 대신).
 *   기록을 받기 전: [이 활동 건너뛰기] [코스 그만하기]
 *   기록을 받은 뒤: [다음 활동으로 →] (마지막이면 [코스 마치기]) [코스 그만하기]
 * 건너뛰기·그만하기는 한 번 더 묻는다 (브라우저 확인 창 대신 막대 안에서).
 * @returns { el, setFinished() }
 */
export function createCourseBar({ info, onNext, onSkip, onStop }) {
  const label = h('h1', {}, stepLabel(info));
  const actions = h('div', { class: 'course-actions' });
  const el = h('div', { class: 'program-bar course-bar' }, label, actions);
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
 * @param o.onHome     "처음으로"
 * @param o.onResults  "활동 기록 보기"
 */
export function renderCourseSummary(container, { summary, onHome, onResults }) {
  const playedAll = summary.activities.every((a) => a.status === 'played');
  container.innerHTML = '';
  container.append(
    h(
      'div',
      { class: 'course' },
      h('h1', {}, '오늘의 활동 기록'),
      h('p', {}, dateText(summary.date)),
      message(
        summary.finished && playedAll ? '네 가지 활동을 모두 함께 해 주셨어요. 수고하셨어요!' : '오늘 함께한 활동이에요. 수고하셨어요!',
        'good',
      ),
      h(
        'div',
        { class: 'table-wrap' },
        h(
          'table',
          { class: 'course-table' },
          h('thead', {}, h('tr', {}, ['순서', '활동', '기록'].map((t) => h('th', { scope: 'col' }, t)))),
          h(
            'tbody',
            {},
            summary.activities.map((a) =>
              h(
                'tr',
                { class: `course-row is-${a.status}` },
                h('td', {}, `${a.order}번째`),
                h('td', {}, programTitle(a.program)),
                h('td', {}, activityText(a)),
              ),
            ),
          ),
        ),
      ),
      h('div', { class: 'row' }, button('처음으로', onHome), button('활동 기록 보기', onResults, { variant: 'secondary' })),
    ),
  );
}
