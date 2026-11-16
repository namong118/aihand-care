// 결과 화면 (#8): 날짜별 코스 기록, 활동별 모아 보기, 반응 시간 변화, 회차별 기록·CSV 내보내기.
// ctx.log 에 쌓인 기록과 코스 진행 정보(course-store)만 읽는다. 프로그램 내부 상태는 읽지 않는다.
// 수치는 "활동 기록"으로만 표시한다. 점수·비율·판정처럼 보이는 표현과 손 유지 시간은 넣지 않는다.
// 묶기·계산은 course-logic.js (테스트 있음), 여기서는 그리기만 한다.

import { h, button, seconds } from '../ui/components.js';
import { summarize, downloadCSV } from '../core/log.js';
import { CATALOG, findProgramInfo } from './catalog.js';
import { groupByDay, reactionTrend, TIME_ZONE } from './course-logic.js';
import { activityText } from './course.js';

/** 위쪽 탭: 보는 방법 */
const VIEWS = [
  { id: 'days', label: '날짜별 기록' },
  { id: 'programs', label: '활동별 모아 보기' },
  { id: 'reaction', label: '반응 시간 변화' },
  { id: 'rounds', label: '회차별 기록' },
];

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 'YYYY-MM-DD' → '11월 13일 (목)'. 날짜가 없으면 '날짜 모름' */
function dateText(date) {
  if (!date) return '날짜 모름';
  const [y, m, d] = date.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}월 ${d}일 (${weekday})`;
}

/** ISO 시각 → '오후 2:05' (스테이션 현지 시간) */
function timeText(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('ko-KR', { timeZone: TIME_ZONE, hour: 'numeric', minute: '2-digit' }).format(d);
}

/** ISO 시각 → '11/13 14:05' (회차별 기록 표) */
function shortTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('month')}/${get('day')} ${get('hour')}:${get('minute')}`;
}

function programName(id) {
  const info = findProgramInfo(id);
  return info ? `STEP ${info.step} ${info.title}` : (id ?? '-');
}

function programTitle(id) {
  return findProgramInfo(id)?.title ?? id ?? '-';
}

/** 기록 한 건의 "완료 4 / 5 · 건너뛴 문제 1" */
function recordText(r) {
  const parts = [`완료 ${r.done} / ${r.total}`];
  if ((r.skipped ?? 0) > 0) parts.push(`건너뛴 문제 ${r.skipped}`);
  return parts.join(' · ');
}

/**
 * 회차 기록의 "자세히" 칸. 기록(detail)에 남은 값만 읽는다.
 * STEP 4: 동작을 마친 방식 (손 인식 / 버튼 / 건너뜀)
 */
function detailText(r) {
  if (r.program === 'step4-coach') {
    const m = r.detail?.methods;
    if (!m) return '-';
    return `손 인식 ${m.detected ?? 0} · 버튼 ${m.manual ?? 0} · 건너뜀 ${m.skipped ?? 0}`;
  }
  return '-';
}

function table(headers, rows, props = {}) {
  return h(
    'div',
    { class: 'table-wrap' },
    h(
      'table',
      props,
      h('thead', {}, h('tr', {}, headers.map((t) => h('th', { scope: 'col' }, t)))),
      h('tbody', {}, rows),
    ),
  );
}

function empty() {
  return h('p', {}, '아직 기록이 없어요. 홈에서 활동을 해 보세요.');
}

// ---- 날짜별 기록 ----

/** 코스 한 번: 접힌 줄(시각·마침 여부·한 활동 수) → 펼치면 활동별 기록 */
function courseBlock(summary, open) {
  const played = summary.activities.filter((a) => a.status === 'played').length;
  const end = summary.finished ? '끝까지 함' : '중간에 마침';
  return h(
    'details',
    { class: 'result-course', open },
    h(
      'summary',
      {},
      h('span', { class: 'result-course-title' }, `코스 · ${timeText(summary.startedAt)} 시작`),
      h('span', { class: 'result-course-meta' }, `활동 ${summary.activities.length}개 중 ${played}개 함 · ${end}`),
    ),
    table(
      ['순서', '활동', '기록', '평균 반응 시간'],
      summary.activities.map((a) =>
        h(
          'tr',
          { class: `course-row is-${a.status}` },
          h('td', {}, `${a.order}번째`),
          h('td', {}, programTitle(a.program)),
          h('td', {}, activityText(a)),
          h('td', {}, a.status === 'played' ? seconds(a.avgReactionMs) : '-'),
        ),
      ),
      { class: 'course-table' },
    ),
  );
}

function singlesBlock(records) {
  return h(
    'div',
    { class: 'result-singles' },
    h('h4', {}, '코스 밖에서 한 활동'),
    table(
      ['시각', '활동', '기록', '평균 반응 시간'],
      records.map((r) =>
        h(
          'tr',
          {},
          h('td', {}, timeText(r.startedAt)),
          h('td', {}, programName(r.program)),
          h('td', {}, recordText(r)),
          h('td', {}, seconds(r.avgReactionMs)),
        ),
      ),
    ),
  );
}

function daysView(records, courses) {
  const days = groupByDay(records, courses);
  if (days.length === 0) return [empty()];
  return days.map((day, i) =>
    h(
      'section',
      { class: 'result-day' },
      h('h3', {}, dateText(day.date)),
      // 가장 최근 코스 하나만 펼쳐 둔다 (7인치 화면에서 한눈에)
      day.courses.map((c, j) => courseBlock(c, i === 0 && j === 0)),
      day.singles.length > 0 ? singlesBlock(day.singles) : null,
    ),
  );
}

// ---- 활동별 모아 보기 ----

function programsView(records) {
  if (records.length === 0) return [empty()];
  const summary = summarize(records);
  return [
    table(
      ['활동', '한 횟수', '완료 수 / 전체', '건너뛴 문제', '평균 반응 시간'],
      CATALOG.map((p) => {
        const s = summary[p.id];
        return h(
          'tr',
          {},
          h('th', { scope: 'row' }, `STEP ${p.step} ${p.title}`),
          h('td', {}, s ? `${s.count}회` : '0회'),
          h('td', {}, s ? `${s.done} / ${s.total}` : '-'),
          h('td', {}, s ? s.skipped : '-'),
          h('td', {}, s ? seconds(s.avgReactionMs) : '-'),
        );
      }),
    ),
  ];
}

// ---- 반응 시간 변화 ----

/** 막대 눈금: 0 ~ 이 값(ms). 더 긴 기록이 있으면 그 값까지 (활동끼리 같은 눈금) */
const TREND_SCALE_MS = 5000;

/** 활동 하나의 날짜별 평균 반응 시간. 막대는 길이만 보여 주고, 값은 글자로 함께 쓴다 */
function trendBlock(program, trend, max) {
  return h(
    'section',
    { class: 'result-trend' },
    h('h3', {}, programName(program)),
    table(
      ['날짜', '평균 반응 시간', '', '한 횟수'],
      trend.map((d) =>
        h(
          'tr',
          {},
          h('td', {}, dateText(d.date)),
          h('td', {}, seconds(d.avgReactionMs)),
          h(
            'td',
            { class: 'trend-cell', 'aria-hidden': 'true' },
            h('span', { class: 'trend-bar', style: { width: `${Math.max(4, Math.round((d.avgReactionMs / max) * 100))}%` } }),
          ),
          h('td', {}, `${d.rounds}회`),
        ),
      ),
      { class: 'trend-table' },
    ),
  );
}

function reactionView(records) {
  const trends = CATALOG.map((p) => [p.id, reactionTrend(records, p.id)]).filter(([, trend]) => trend.length > 0);
  const max = Math.max(TREND_SCALE_MS, ...trends.flatMap(([, trend]) => trend.map((d) => d.avgReactionMs)));
  const blocks = trends.map(([id, trend]) => trendBlock(id, trend, max));
  if (blocks.length === 0) return [h('p', {}, '아직 반응 시간 기록이 없어요.')];
  return [
    h('p', { class: 'result-note' }, '화면에 문제가 나온 뒤 답할 때까지 걸린 시간의 평균이에요. 반응 시간을 재지 않는 활동(손운동)은 없어요.'),
    ...blocks,
  ];
}

// ---- 회차별 기록 ----

function roundsView(all, filter, onFilter) {
  const records = filter.program ? all.filter((r) => r.program === filter.program) : all;
  const rows = [...records].reverse(); // 최근 것이 위
  const filterRow = h(
    'div',
    { class: 'row', role: 'group', 'aria-label': '활동 고르기' },
    button('전체', () => onFilter({ ...filter, program: null }), { variant: 'choice', pressed: !filter.program }),
    CATALOG.map((p) =>
      button(`STEP ${p.step}`, () => onFilter({ ...filter, program: p.id }), {
        variant: 'choice',
        pressed: filter.program === p.id,
      }),
    ),
  );
  const csvName = `aihand-${filter.program ?? 'all'}-${new Date().toISOString().slice(0, 10)}.csv`;
  return [
    filterRow,
    rows.length === 0
      ? empty()
      : table(
          ['회차', '날짜', '활동', '완료 수 / 전체', '건너뜀', '평균 반응 시간', '자세히'],
          rows.map((r, i) =>
            h(
              'tr',
              {},
              h('td', {}, rows.length - i),
              h('td', {}, shortTime(r.startedAt)),
              h('td', {}, programName(r.program)),
              h('td', {}, `${r.done} / ${r.total}`),
              h('td', {}, r.skipped ?? 0),
              h('td', {}, seconds(r.avgReactionMs)),
              h('td', {}, detailText(r)),
            ),
          ),
        ),
    h(
      'div',
      { class: 'row' },
      button('CSV 파일로 내보내기', () => downloadCSV(records, csvName), {
        variant: 'secondary',
        disabled: records.length === 0,
      }),
    ),
  ];
}

/**
 * @param container
 * @param opts.log       core/log (list)
 * @param opts.courses   코스 진행 정보 목록 (course-store list()). 없으면 기록만으로 코스를 묶는다
 * @param opts.filter    { view: 'days' | 'programs' | 'reaction' | 'rounds', program }
 *                       program 만 주면(활동 화면의 "기록 보기") 회차별 기록을 그 활동으로 연다
 * @param opts.onFilter  (filter) => 다시 그리기
 * @param opts.onHome
 */
export function renderResults(container, { log, courses = [], filter = {}, onFilter, onHome }) {
  container.innerHTML = '';
  const all = log.list(); // 날짜순 (오래된 것부터)
  const view = VIEWS.some((v) => v.id === filter.view) ? filter.view : filter.program ? 'rounds' : 'days';
  const current = { ...filter, view };

  const bar = h('div', { class: 'program-bar' }, h('h1', {}, '활동 기록'), button('← 홈으로', onHome, { variant: 'secondary' }));

  const tabs = h(
    'div',
    { class: 'row result-tabs', role: 'group', 'aria-label': '보는 방법' },
    VIEWS.map((v) => button(v.label, () => onFilter({ ...current, view: v.id }), { variant: 'choice', pressed: view === v.id })),
  );

  let body;
  if (view === 'programs') body = programsView(all);
  else if (view === 'reaction') body = reactionView(all);
  else if (view === 'rounds') body = roundsView(all, current, onFilter);
  else body = daysView(all, courses);

  container.append(bar, tabs, h('section', { class: 'section results', 'aria-label': VIEWS.find((v) => v.id === view).label }, body));
}
