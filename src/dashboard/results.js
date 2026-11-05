// 결과 화면: 프로그램별 요약과 회차별 기록 표, CSV 내보내기.
// ctx.log 에 쌓인 기록만 읽는다. 프로그램 내부 상태는 읽지 않는다.
// 수치는 "활동 기록"으로만 표시한다 (점수·상태 판정처럼 보이는 표현 금지).

import { h, button, seconds } from '../ui/components.js';
import { summarize, downloadCSV } from '../core/log.js';
import { CATALOG, findProgramInfo } from './catalog.js';

function percent(rate) {
  return rate === null || rate === undefined ? '-' : `${Math.round(rate * 100)}%`;
}

function formatTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

function programName(id) {
  const info = findProgramInfo(id);
  return info ? `STEP ${info.step} ${info.title}` : id;
}

/**
 * @param container
 * @param opts { log, filter: { program, user }, onFilter(filter), onHome() }
 */
export function renderResults(container, { log, filter = {}, onFilter, onHome }) {
  container.innerHTML = '';
  const all = log.list({ user: filter.user });
  const records = filter.program ? all.filter((r) => r.program === filter.program) : all;
  const summary = summarize(all);

  // ---- 위쪽 ----
  const bar = h(
    'div',
    { class: 'program-bar' },
    h('h1', {}, '활동 기록'),
    button('← 홈으로', onHome, { variant: 'secondary' }),
  );

  const userNote = h(
    'div',
    { class: 'row' },
    h('span', {}, filter.user ? `${filter.user} 님의 기록` : '모든 사용자의 기록'),
    filter.user
      ? button('모든 사용자 보기', () => onFilter({ ...filter, user: null }), { variant: 'secondary' })
      : null,
  );

  // ---- 프로그램별 요약 ----
  const summaryTable = h(
    'table',
    {},
    h(
      'thead',
      {},
      h('tr', {}, ['프로그램', '활동 횟수', '해낸 비율', '평균 반응 시간'].map((t) => h('th', { scope: 'col' }, t))),
    ),
    h(
      'tbody',
      {},
      CATALOG.map((p) => {
        const s = summary[p.id];
        return h(
          'tr',
          {},
          h('th', { scope: 'row' }, `STEP ${p.step} ${p.title}`),
          h('td', {}, s ? `${s.count}회` : '0회'),
          h('td', {}, s ? `${percent(s.doneRate)} (${s.done}/${s.total})` : '-'),
          h('td', {}, s ? seconds(s.avgReactionMs) : '-'),
        );
      }),
    ),
  );

  // ---- 프로그램 고르기 ----
  const filterRow = h(
    'div',
    { class: 'row', role: 'group', 'aria-label': '프로그램 고르기' },
    button('전체', () => onFilter({ ...filter, program: null }), {
      variant: 'choice',
      pressed: !filter.program,
    }),
    CATALOG.map((p) =>
      button(`STEP ${p.step}`, () => onFilter({ ...filter, program: p.id }), {
        variant: 'choice',
        pressed: filter.program === p.id,
      }),
    ),
  );

  // ---- 회차별 기록 (최근 것이 위) ----
  const rows = [...records].reverse();
  const detailTable =
    rows.length === 0
      ? h('p', {}, '아직 기록이 없어요. 홈에서 활동을 해 보세요.')
      : h(
          'div',
          { class: 'table-wrap' },
          h(
            'table',
            {},
            h(
              'thead',
              {},
              h(
                'tr',
                {},
                ['회차', '날짜', '사용자', '프로그램', '해낸 수 / 전체', '건너뜀', '평균 반응 시간', '자세히'].map((t) =>
                  h('th', { scope: 'col' }, t),
                ),
              ),
            ),
            h(
              'tbody',
              {},
              rows.map((r, i) =>
                h(
                  'tr',
                  {},
                  h('td', {}, rows.length - i),
                  h('td', {}, formatTime(r.startedAt)),
                  h('td', {}, r.user),
                  h('td', {}, programName(r.program)),
                  h('td', {}, `${r.done} / ${r.total}`),
                  h('td', {}, r.skipped ?? 0),
                  h('td', {}, seconds(r.avgReactionMs)),
                  h('td', {}, detailText(r)),
                ),
              ),
            ),
          ),
        );

  const csvName = `aihand-${filter.program ?? 'all'}-${new Date().toISOString().slice(0, 10)}.csv`;

  container.append(
    bar,
    userNote,
    h('section', { class: 'section' }, h('h2', {}, '프로그램별 모아 보기'), h('div', { class: 'table-wrap' }, summaryTable)),
    h(
      'section',
      { class: 'section' },
      h('h2', {}, '회차별 기록'),
      filterRow,
      detailTable,
      h(
        'div',
        { class: 'row' },
        button('CSV 파일로 내보내기', () => downloadCSV(records, csvName), {
          variant: 'secondary',
          disabled: records.length === 0,
        }),
      ),
    ),
  );
}
