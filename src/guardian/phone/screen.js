// 보호자 폰 앱 화면 그리기. 계산은 logic.js, 흐름은 main.js 가 맡는다.
// 표현 원칙(docs/guardian-app.md 6-12): "활동 기록"만, 점수·판정 없이, 안 한 날은 빈칸.

import {
  compareMonth,
  monthCells,
  daysInMonth,
  monthText,
  timeText,
  courseSummaryText,
  orderedActivities,
  barSegments,
  chartMax,
  activityView,
  radarData,
  monthlyDays,
  activityCounts,
  reactionByDate,
  reactionText,
  shortDate,
  REACTION_NOTE,
  SEGMENT_LABEL,
} from './logic.js';
import { CATALOG, findProgramInfo } from '../../dashboard/catalog.js';

/** 코스 순서 (손운동 → 가위바위보 → 숫자 기억 → 색깔손) */
const PROGRAMS = CATALOG.map((p) => p.id);

/** 작은 요소 만들기 도우미: h('p', { class: 'x', onClick }, '글자', 자식요소) */
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'class') el.className = value;
    else el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

function appName() {
  return h('p', { class: 'app-name' }, '손잇다 보호자');
}

// ---- 연결 화면 ----

/**
 * 코드를 직접 넣는 화면 (QR 없이 열었을 때, 연결을 지운 뒤)
 * onSubmit({ code, name }) → 문제가 있으면 안내 글자를 돌려준다
 */
export function renderConnect(root, { error = '', onSubmit, onDemo }) {
  const message = h('p', { class: 'form-msg', role: 'alert', id: 'connect-msg' }, error);
  const codeInput = h('input', {
    id: 'code',
    name: 'code',
    type: 'text',
    inputmode: 'text',
    autocomplete: 'off',
    autocapitalize: 'characters',
    spellcheck: 'false',
    maxlength: '16',
    placeholder: 'ABCD-EFGH-JKMN',
    'aria-describedby': 'connect-msg',
  });
  const nameInput = h('input', { id: 'name', name: 'name', type: 'text', autocomplete: 'off', maxlength: '12', placeholder: '예: 어머니' });

  const form = h(
    'form',
    { class: 'card form', novalidate: true },
    h('label', { for: 'code' }, '연결 코드 (12글자)'),
    codeInput,
    h('label', { for: 'name' }, '어르신 호칭 (선택)'),
    nameInput,
    message,
    h('button', { type: 'submit', class: 'btn primary' }, '연결하기'),
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const problem = onSubmit({ code: codeInput.value, name: nameInput.value });
    if (problem) {
      message.textContent = problem;
      codeInput.focus();
    }
  });

  root.replaceChildren(
    h(
      'main',
      { class: 'page' },
      h('header', { class: 'top' }, h('div', {}, appName(), h('h1', {}, '보호자 연결'))),
      h(
        'p',
        { class: 'lead' },
        '스테이션 화면의 QR을 폰 카메라로 찍으면 저절로 연결돼요. QR을 찍기 어려우면 화면에 보이는 연결 코드를 넣어 주세요.',
      ),
      form,
      h('button', { type: 'button', class: 'btn', onClick: onDemo }, '예시 화면 보기'),
    ),
  );
  codeInput.focus();
}

// ---- 첫 화면 (참여 달력) ----

function statusBlock({ status, onReload }) {
  if (status === 'ok') return null;
  const text = {
    loading: '기록을 불러오는 중이에요…',
    empty: '아직 받은 활동 기록이 없어요. 스테이션에서 연결을 준비하는 중이거나, 아직 코스를 하지 않으셨을 수 있어요. 코스를 마치면 여기에 보여요.',
    error: '기록을 가져오지 못했어요. 인터넷 연결을 확인한 뒤 다시 불러와 주세요.',
    nosetup: '이 주소에서는 기록을 불러올 수 없어요 (저장소 주소가 설정되지 않았어요). 예시 화면은 볼 수 있어요.',
  }[status];
  return h(
    'div',
    { class: `card status status-${status}`, role: 'status' },
    h('p', {}, text),
    status === 'error' ? h('button', { type: 'button', class: 'btn', onClick: onReload }, '다시 불러오기') : null,
  );
}

function calendar({ month, range, counts, today, onPrev, onNext, onOpenDay }) {
  const cells = monthCells(month).map((cell) => {
    if (!cell) return h('div', { class: 'day blank', 'aria-hidden': 'true' });
    const n = counts.get(cell.date) ?? 0;
    const isToday = cell.date === today;
    const label = `${month.month}월 ${cell.day}일${isToday ? ' 오늘' : ''}${n ? `, ${n}번 함께함, 기록 보기` : ''}`;
    const cls = ['day', n ? 'has' : '', isToday ? 'today' : ''].join(' ').trim();
    const inner = [
      h('span', { class: 'dn', 'aria-hidden': 'true' }, cell.day),
      n ? h('span', { class: 'sp', 'aria-hidden': 'true' }, '🌱', n > 1 ? h('small', {}, n) : null) : null,
    ];
    // 함께한 날만 누를 수 있다 → 회차 화면 (6-5 B)
    if (n) return h('div', { role: 'listitem' }, h('button', { type: 'button', class: cls, 'aria-label': label, onClick: () => onOpenDay(cell.date) }, inner));
    return h('div', { class: cls, role: 'listitem', 'aria-label': label }, inner);
  });

  return h(
    'section',
    { class: 'card', 'aria-labelledby': 'cal-title' },
    h(
      'div',
      { class: 'cal-head' },
      h('button', { type: 'button', class: 'navbtn', 'aria-label': '이전 달', disabled: compareMonth(month, range.min) <= 0, onClick: onPrev }, '‹'),
      h('h2', { id: 'cal-title', 'aria-live': 'polite' }, `${month.year}년 ${month.month}월`),
      h('button', { type: 'button', class: 'navbtn', 'aria-label': '다음 달', disabled: compareMonth(month, range.max) >= 0, onClick: onNext }, '›'),
    ),
    h('div', { class: 'cal', 'aria-hidden': 'true' }, DOW.map((d, i) => h('div', { class: `dow${i === 0 ? ' sun' : ''}` }, d))),
    h('div', { class: 'cal', role: 'list', 'aria-label': `${month.month}월 달력` }, cells),
    h(
      'div',
      { class: 'cal-foot' },
      h('span', {}, '🌱 = 함께한 날'),
      h('b', {}, monthText(daysInMonth(counts, month), month, today)),
    ),
  );
}

/**
 * 첫 화면: 제목, 상태 안내, 참여 달력
 * props: { title, demo, notice, status, loadedAt, month, range, counts, today, onPrev, onNext, onReload, onSettings, onExitDemo }
 */
export function renderHome(root, props) {
  const { title, demo, notice, status, loadedAt, onReload, onSettings, onExitDemo } = props;
  const actions = h(
    'div',
    { class: 'top-actions' },
    demo
      ? h('button', { type: 'button', class: 'btn small', onClick: onExitDemo }, '예시 나가기')
      : [
          h('button', { type: 'button', class: 'btn small', onClick: onReload, disabled: status === 'loading' }, '새로 불러오기'),
          h('button', { type: 'button', class: 'btn small', onClick: onSettings }, '설정'),
        ],
  );

  root.replaceChildren(
    h(
      'main',
      { class: 'page' },
      h('header', { class: 'top' }, h('div', {}, appName(), h('h1', {}, title)), actions),
      demo ? h('p', { class: 'banner', role: 'note' }, '예시 화면이에요. 가상 인물 순자 님의 기록이에요.') : null,
      notice ? h('p', { class: 'banner ok', role: 'status' }, notice) : null,
      statusBlock({ status, onReload }),
      calendar(props),
      demo || status === 'ok' ? moreSection(props) : null,
      loadedAt && !demo ? h('p', { class: 'loaded-at' }, `${timeText(loadedAt)}에 불러왔어요`) : null,
    ),
  );
}

// ---- 모아 보기 (6-11 A·B, 6-3 A: 달력 아래로 이어서) ----

/** 가로 막대 (목업 hbars): rows = [{ label, value, color }] */
function hbars(rows, unit, title) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const W = 340;
  const rowH = 34;
  const L = 92;
  const R = 52;
  const H = rows.length * rowH + 4;
  const marks = rows.map((r, i) => {
    const y = i * rowH + 4;
    const w = ((W - L - R) * r.value) / max;
    return [
      svg('text', { x: 0, y: y + 19, class: 't-lab' }, r.label),
      svg('rect', { x: L, y: y + 5, width: Math.max(w, 2), height: 20, rx: 4, style: `fill:${r.color}` }),
      svg('text', { x: L + w + 8, y: y + 21, class: 't-val' }, `${r.value}${unit}`),
    ];
  });
  return svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': `${title}: ${rows.map((r) => `${r.label} ${r.value}${unit}`).join(', ')}` }, marks);
}

/** 꺾은선 (목업 lineSVG, 목표선·정상선 없음): points = [{ date, ms }] */
function lineChart(points, title) {
  const W = 340;
  const H = 200;
  const m = { l: 44, r: 16, t: 24, b: 32 };
  const secs = points.map((p) => p.ms / 1000);
  const min = Math.max(0, Math.floor(Math.min(...secs) * 2) / 2 - 0.5);
  const max = Math.ceil(Math.max(...secs) * 2) / 2 + 0.5;
  const y = (v) => m.t + (H - m.t - m.b) * (1 - (v - min) / (max - min));
  const x = (i) => m.l + ((W - m.l - m.r) * i) / Math.max(points.length - 1, 1);
  const grid = [min, (min + max) / 2, max].map((t) => [
    svg('line', { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), class: 'grid-line' }),
    svg('text', { x: m.l - 6, y: y(t) + 5, 'text-anchor': 'end', class: 't-axis' }, `${t.toFixed(1)}`),
  ]);
  const line = svg('polyline', { points: secs.map((v, i) => `${x(i)},${y(v)}`).join(' '), class: 'trend-line' });
  const last = points.length - 1;
  const dots = secs.map((v, i) => svg('circle', { cx: x(i), cy: y(v), r: i === last ? 5 : 3.5, class: i === last ? 'trend-dot last' : 'trend-dot' }));
  // 날짜 글자는 처음과 마지막만 (폰 폭에 다 들어가지 않는다. 전체는 aria-label 에)
  const dates = [0, last].filter((i, k, arr) => arr.indexOf(i) === k).map((i) =>
    svg('text', { x: x(i), y: H - m.b + 22, 'text-anchor': i === 0 && last > 0 ? 'start' : 'end', class: 't-axis' }, shortDate(points[i].date)),
  );
  const lastText = svg('text', { x: x(last) - 8, y: y(secs[last]) - 12, 'text-anchor': 'end', class: 't-val' }, reactionText(points[last].ms));
  const label = points.map((p) => `${shortDate(p.date)} ${reactionText(p.ms)}`).join(', ');
  return svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': `${title}: ${label}` }, grid, line, dots, dates, lastText);
}

/** 모아 보기 카드 2개: A 참여(달마다 함께한 날, 활동별 함께한 횟수), B 반응 시간 변화 */
function moreSection({ summaries, counts, month, trendProgram, onTrend }) {
  if (!summaries.length) return null;
  const months = monthlyDays(counts, month);
  const acts = activityCounts(summaries, month, PROGRAMS);
  const partCard = h(
    'section',
    { class: 'card' },
    h('h2', {}, '달마다 함께한 날'),
    hbars(months.map((r) => ({ label: r.label, value: r.days, color: 'var(--s1-fg)' })), '일', '달마다 함께한 날'),
    h('h2', {}, `${month.month}월 활동별 함께한 횟수`),
    hbars(acts.map((r) => ({ label: programInfo(r.program).name, value: r.count, color: `var(--${programInfo(r.program).color}-fg)` })), '번', '활동별 함께한 횟수'),
  );

  const points = reactionByDate(summaries, trendProgram);
  const trendCard = h(
    'section',
    { class: 'card' },
    h('h2', {}, '반응 시간 변화'),
    h(
      'div',
      { class: 'chips', role: 'group', 'aria-label': '활동 고르기' },
      PROGRAMS.map((id) =>
        h('button', { type: 'button', class: 'chip', 'aria-pressed': String(id === trendProgram), onClick: () => onTrend(id) }, programInfo(id).name),
      ),
    ),
    h('p', { class: 'chart-cap' }, '세로: 평균 반응 시간 (초)'),
    points.length ? lineChart(points, `${programInfo(trendProgram).name} 반응 시간 변화`) : h('p', { class: 'sub' }, '이 활동의 반응 시간 기록이 아직 없어요.'),
    h('p', { class: 'sub' }, `날마다 평균이에요 (최근 ${points.length || 0}일). ${REACTION_NOTE[trendProgram] ?? ''} 활동마다 재는 방법이 달라 활동끼리 견주지 않아요.`),
  );
  return [h('h2', { class: 'section-title' }, '모아 보기'), partCard, trendCard];
}

// ---- 설정 ----

/** 설정: 호칭 바꾸기, 연결 해제 */
export function renderSettings(root, { conn, codeText, saved, onSaveName, onDisconnect, onBack }) {
  const nameInput = h('input', { id: 'name', type: 'text', autocomplete: 'off', maxlength: '12', value: conn.name, placeholder: '예: 어머니' });
  const nameForm = h(
    'form',
    { class: 'card form' },
    h('h2', {}, '호칭'),
    h('label', { for: 'name' }, '화면 제목에 보일 어르신 호칭 (이 폰에만 저장돼요)'),
    nameInput,
    saved ? h('p', { class: 'form-msg ok', role: 'status' }, '저장했어요') : null,
    h('button', { type: 'submit', class: 'btn primary' }, '호칭 저장'),
  );
  nameForm.addEventListener('submit', (e) => {
    e.preventDefault();
    onSaveName(nameInput.value);
  });

  root.replaceChildren(
    h(
      'main',
      { class: 'page' },
      h('header', { class: 'top' }, h('div', {}, appName(), h('h1', {}, '설정')), h('button', { type: 'button', class: 'btn small', onClick: onBack }, '← 기록으로')),
      nameForm,
      h(
        'section',
        { class: 'card' },
        h('h2', {}, '연결'),
        h('p', {}, '연결 코드 ', h('b', { class: 'code' }, codeText)),
        h('p', { class: 'sub' }, '연결을 해제하면 이 폰에서 코드가 지워져요. 다시 보려면 QR을 다시 찍거나 코드를 넣어 주세요. 스테이션 쪽 연결까지 끊으려면 담당 선생님께 말씀해 주세요.'),
        h('button', { type: 'button', class: 'btn danger', onClick: onDisconnect }, '연결 해제'),
      ),
    ),
  );
}

// ---- 회차 화면 (6-4 ~ 6-10) ----

const SVG_NS = 'http://www.w3.org/2000/svg';

/** SVG 요소 만들기 */
function svg(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) el.setAttribute(k, v);
  // 목록 안의 목록도 끝까지 펼친다 (막대 하나 = 칸 여러 개 + 글자)
  for (const c of children.flat(Infinity)) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}

/** 활동 정보: 이름·소개·알약 글자(catalog.js)와 색(STEP 번호) */
function programInfo(id) {
  const info = findProgramInfo(id);
  return { name: info?.name ?? '활동', desc: info?.desc ?? '', tag: info?.tag ?? '', color: info ? `s${info.step}` : 's1' };
}

let patternSeq = 0;

/**
 * 칸 모양: 색만으로 나누지 않게 무늬를 다르게 한다 (6-8, 6-12, 목업과 같음)
 *   완료·따라 함 = 꽉 찬 색 / 함께 확인·완료 외 = 옅은 색 + 테두리 / 건너뜀 = 회색 점
 */
function segmentShape(key, color, ids, box) {
  const fg = `var(--${color}-fg)`;
  const bg = `var(--${color}-bg)`;
  const { x, y, w, hgt } = box;
  if (key === 'first' || key === 'done') return [svg('rect', { x, y, width: w, height: hgt, style: `fill:${fg}` })];
  if (key === 'second')
    return [
      svg('rect', { x, y, width: w, height: hgt, style: `fill:${fg}` }),
      svg('rect', { x, y, width: w, height: hgt, fill: `url(#${ids.stripe})` }),
    ];
  if (key === 'shown' || key === 'rest')
    return [svg('rect', { x: x + 1, y: y + 1, width: w - 2, height: Math.max(0, hgt - 2), style: `fill:${bg};stroke:${fg};stroke-width:2` })];
  return [
    svg('rect', { x, y, width: w, height: hgt, style: 'fill:var(--chip)' }),
    svg('rect', { x, y, width: w, height: hgt, fill: `url(#${ids.dots})` }),
  ];
}

function patternDefs(ids) {
  return svg(
    'defs',
    {},
    svg(
      'pattern',
      { id: ids.stripe, width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
      svg('line', { x1: 0, y1: 0, x2: 0, y2: 7, style: 'stroke:var(--surface);stroke-width:3' }),
    ),
    svg('pattern', { id: ids.dots, width: 7, height: 7, patternUnits: 'userSpaceOnUse' }, svg('circle', { cx: 3.5, cy: 3.5, r: 1.5, style: 'fill:var(--muted)' })),
  );
}

/** 범례 칸 그림 (작은 네모) */
function swatch(key, ids) {
  return svg('svg', { width: 20, height: 20, viewBox: '0 0 20 20', 'aria-hidden': 'true' }, patternDefs(ids), segmentShape(key, 'legend', ids, { x: 0, y: 0, w: 20, hgt: 20 }));
}

/** ② 활동별 쌓은 세로 막대. 가로 = 활동(코스 순서), 세로 = 문제·동작 수 */
function stackedChart(acts) {
  patternSeq += 1;
  const ids = { stripe: `pat-stripe-${patternSeq}`, dots: `pat-dots-${patternSeq}` };
  const W = 340;
  const H = 220;
  const m = { l: 26, r: 2, t: 28, b: 10 }; // 바꾸면 phone.css .chart-names 여백도 같이
  const max = chartMax(acts);
  const y = (v) => m.t + (H - m.t - m.b) * (1 - v / max);
  const col = (W - m.l - m.r) / Math.max(1, acts.length);
  const bw = 40;

  const grid = [0, max / 2, max].map((t) => [
    svg('line', { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), class: 'grid-line' }),
    svg('text', { x: m.l - 8, y: y(t) + 5, 'text-anchor': 'end', class: 't-axis' }, t),
  ]);

  const marks = acts.map((a, i) => {
    const color = programInfo(a.program).color;
    const cx = m.l + col * i + col / 2;
    const segs = barSegments(a);
    if (!segs.length) return svg('text', { x: cx, y: y(0) - 8, 'text-anchor': 'middle', class: 't-axis' }, '–');
    let acc = 0;
    const parts = segs.map((sgm) => {
      const top = y(acc + sgm.value);
      const hgt = y(acc) - top;
      acc += sgm.value;
      return [
        ...segmentShape(sgm.key, color, ids, { x: cx - bw / 2, y: top, w: bw, hgt }),
        hgt >= 18 ? svg('text', { x: cx + bw / 2 + 4, y: top + hgt / 2 + 5, class: 't-seg' }, sgm.value) : null,
      ];
    });
    return [...parts, svg('text', { x: cx, y: y(a.total) - 8, 'text-anchor': 'middle', class: 't-val' }, `${a.done} / ${a.total}`)];
  });

  const label = acts
    .map((a) => `${programInfo(a.program).name} ${barSegments(a).map((x) => `${x.label} ${x.value}`).join(', ') || '없음'}`)
    .join('; ');
  const chart = svg(
    'svg',
    { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': `활동별 기록 막대: ${label}` },
    patternDefs(ids),
    grid,
    marks,
  );

  // 활동 이름은 SVG 밖 글자로 (16px, 길면 줄바꿈)
  const names = h(
    'div',
    { class: 'chart-names', style: `grid-template-columns: repeat(${acts.length}, minmax(0, 1fr))`, 'aria-hidden': 'true' },
    acts.map((a) =>
      h('span', {}, programInfo(a.program).name, a.status === 'played' ? null : h('small', {}, a.status === 'skipped' ? '건너뜀' : '하지 않음')),
    ),
  );

  // 범례: 같은 모양은 한 칸으로 ("한 번에 함 / 완료"처럼). 이 회차에 나온 칸만
  const used = new Set(acts.flatMap((a) => barSegments(a).map((x) => x.key)));
  const shapes = [['done'], ['shown', 'rest'], ['skipped']];
  const legend = h(
    'ul',
    { class: 'legend', 'aria-label': '막대 칸 뜻' },
    shapes
      .map((keys) => keys.filter((k) => used.has(k)))
      .filter((keys) => keys.length)
      .map((keys) => h('li', {}, swatch(keys[0], ids), keys.map((k) => SEGMENT_LABEL[k]).join(' / '))),
  );

  // 축 이름은 그래프 위 글자로 (꼭대기 막대의 숫자와 겹치지 않게)
  return [h('p', { class: 'chart-cap' }, '세로: 문제·동작 수 (개)'), h('div', { class: 'chart' }, chart, names), legend];
}

/** 방사형 (6-9 B, 경민 선택 · 팀 확인 필요): 축 = 활동, 값 = 완료 수. 목업 radarSVG 와 같은 모양 */
function radarChart(acts) {
  const { values, max } = radarData(acts);
  // 가로를 넓게: 왼쪽·오른쪽 활동 이름(가위바위보 등)이 잘리지 않게
  const W = 340;
  const H = 300;
  const cx = W / 2;
  const cy = H / 2 + 4;
  const R = 74;
  const n = acts.length;
  const ang = acts.map((_, i) => ((-90 + (360 / n) * i) * Math.PI) / 180);
  const pt = (r, i) => [cx + r * Math.cos(ang[i]), cy + r * Math.sin(ang[i])];
  const rings = [0.25, 0.5, 0.75, 1].map((f) =>
    svg('polygon', { points: ang.map((_, i) => pt(R * f, i).join(',')).join(' '), class: 'radar-ring' }),
  );
  const spokes = ang.map((_, i) => {
    const [x, y] = pt(R, i);
    return svg('line', { x1: cx, y1: cy, x2: x, y2: y, class: 'radar-ring' });
  });
  const shape = svg('polygon', { points: values.map((v, i) => pt(R * Math.min(v / max, 1), i).join(',')).join(' '), class: 'radar-shape' });
  const dots = values.map((v, i) => {
    const [x, y] = pt(R * Math.min(v / max, 1), i);
    return svg('circle', { cx: x, cy: y, r: 4, class: 'radar-dot' });
  });
  // 글자 자리: 위·오른쪽·아래·왼쪽 (활동 4개 기준. 다른 수면 바깥쪽 같은 방향)
  const labels = acts.map((a, i) => {
    const [x, y] = pt(R + 14, i);
    const c = Math.cos(ang[i]);
    const anchor = Math.abs(c) < 0.3 ? 'middle' : c > 0 ? 'start' : 'end';
    const top = Math.sin(ang[i]) < -0.7;
    const bottom = Math.sin(ang[i]) > 0.7;
    const y0 = top ? y - 26 : bottom ? y + 12 : y - 6;
    return [
      svg('text', { x, y: y0, 'text-anchor': anchor, class: 't-lab' }, programInfo(a.program).name),
      svg('text', { x, y: y0 + 19, 'text-anchor': anchor, class: 't-val' }, a.status === 'played' ? `${values[i]}개` : '–'),
    ];
  });
  const label = acts.map((a, i) => `${programInfo(a.program).name} ${a.status === 'played' ? `완료 ${values[i]}개` : '하지 않음'}`).join(', ');
  return h(
    'div',
    { class: 'radar' },
    svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': `활동별 완료 수 방사형: ${label}` }, rings, spokes, shape, dots, labels),
  );
}

/** ③ 활동마다 (목업 모양): 알약 + 이름, 소개, 숫자 카드 4칸, 이름 / 값 줄 */
function activityList(acts, routines) {
  return acts.map((a) => {
    const info = programInfo(a.program);
    const view = activityView(a, routines);
    const body = view.played
      ? [
          h(
            'div',
            { class: 'stats' },
            view.tiles.map((t) => h('div', { class: 'stat' }, h('span', { class: 'stat-k' }, t.label), h('span', { class: 'stat-v' }, t.value, t.unit ? h('small', {}, t.unit) : null))),
          ),
          h('dl', { class: 'facts' }, view.facts.map((f) => [h('dt', {}, f.label), h('dd', {}, f.value)])),
        ]
      : h('p', { class: 'act-off' }, view.off);
    return h(
      'section',
      { class: `act ${info.color}` },
      h('h3', {}, info.tag ? h('span', { class: 'pill' }, info.tag) : null, info.name),
      info.desc ? h('p', { class: 'act-desc' }, info.desc) : null,
      body,
    );
  });
}

/**
 * 회차 화면: 날짜를 누르면 열린다 (6-5 B 새 화면)
 * props: { title, courses(먼저 한 것부터), index, routines, demo, onTab(i), onBack }
 */
export function renderDay(root, { title, courses, index, routines, demo, onTab, onBack }) {
  const i = Math.min(index, courses.length - 1);
  const course = courses[i];
  const panelId = 'course-panel';

  // 회차 탭 (6-4 A): 하루 2번 이상일 때만. 고른 탭은 바탕·굵기·이어짐으로 구분 (색만으로 아님)
  const tabs =
    courses.length > 1
      ? h(
          'div',
          { class: 'tabs', role: 'tablist', 'aria-label': '이날의 회차' },
          courses.map((c, j) =>
            h(
              'button',
              {
                type: 'button',
                role: 'tab',
                class: 'tab',
                id: `tab-${j}`,
                'aria-selected': String(j === i),
                'aria-controls': panelId,
                tabindex: j === i ? '0' : '-1',
                onClick: () => onTab(j),
                onKeydown: (e) => {
                  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                    e.preventDefault();
                    onTab((j + (e.key === 'ArrowRight' ? 1 : -1) + courses.length) % courses.length, true);
                  }
                },
              },
              timeText(c.startedAt) || `${j + 1}번째`,
            ),
          ),
        )
      : null;

  let panel = null;
  if (course) {
    const acts = orderedActivities(course);
    const sum = courseSummaryText(course);
    panel = h(
      'div',
      { class: `panel${tabs ? ' with-tabs' : ''}`, id: panelId, role: tabs ? 'tabpanel' : null, 'aria-labelledby': tabs ? `tab-${i}` : null },
      h('section', { class: 'card' }, h('p', { class: 'sum-time' }, sum.time), h('p', { class: 'sum-main' }, sum.main)),
      h('section', { class: 'card chart-card' }, h('h2', {}, '활동별 기록'), stackedChart(acts)),
      h('section', { class: 'card' }, h('h2', {}, '활동별 완료 수 (방사형)'), radarChart(acts)),
      h('section', { class: 'card acts' }, h('h2', {}, '활동마다'), activityList(acts, routines)),
    );
  }

  root.replaceChildren(
    h(
      'main',
      { class: 'page' },
      h('header', { class: 'top' }, h('div', {}, appName(), h('h1', {}, title)), h('button', { type: 'button', class: 'btn small', onClick: onBack }, '← 달력')),
      demo ? h('p', { class: 'banner', role: 'note' }, '예시 화면이에요. 가상 인물 순자 님의 기록이에요.') : null,
      tabs,
      panel ?? h('section', { class: 'card' }, h('p', {}, '이날의 기록을 찾지 못했어요.')),
    ),
  );
}
