// 보호자 폰 앱(#62) 순수 함수: 주소 읽기, 연결 코드 입력, 요약 고르기, 달력 계산.
// DOM·localStorage·네트워크를 쓰지 않는다 (logic.test.js 로 시험).
// 설계: docs/guardian-app.md 6번 (6-0 앱 기본, 6-2 참여 달력)

import { isValidCode } from '../logic.js';
import { cleanName, NAME_MAX } from '../../login/users.js';

/** 폰 localStorage 키: { code, name } */
export const PHONE_KEY = 'aihand-care.phone.v1';

// ---- 주소(# 뒤) 읽기 ----

/**
 * 연결 코드 입력값 다듬기: 빈칸·'-'를 빼고 대문자로. 맞는 모양이 아니면 null
 * 'abcd-efgh-jkmn' → 'ABCDEFGHJKMN'
 */
export function normalizeCode(text) {
  const code = String(text ?? '').replace(/[\s-]/g, '').toUpperCase();
  return isValidCode(code) ? code : null;
}

/** 호칭 다듬기 (스테이션 등록 화면과 같은 규칙, 12글자까지) */
export function cleanDisplayName(name) {
  return cleanName(name).slice(0, NAME_MAX);
}

/**
 * QR 주소의 # 뒤를 읽는다.
 *   '#c=ABCDEFGHJKMN&n=봄날' → { kind: 'pair', code, name }
 *   '#demo'                  → { kind: 'demo' }
 *   코드가 틀린 모양이면       → { kind: 'bad' }
 *   아무것도 없으면            → { kind: 'none' }
 */
export function parseHash(hash) {
  const text = String(hash ?? '').replace(/^#/, '');
  if (!text) return { kind: 'none' };
  if (text === 'demo') return { kind: 'demo' };
  const params = new URLSearchParams(text);
  if (!params.has('c')) return { kind: 'none' };
  const code = normalizeCode(params.get('c'));
  if (!code) return { kind: 'bad' };
  return { kind: 'pair', code, name: cleanDisplayName(params.get('n')) };
}

/** 저장된 연결 읽기. 모양이 틀리면 null */
export function parseConnection(raw) {
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!data || typeof data !== 'object') return null;
    const code = normalizeCode(data.code);
    if (!code) return null;
    return { code, name: cleanDisplayName(data.name) };
  } catch {
    return null;
  }
}

/**
 * 화면 제목: "봄날 어르신 활동 기록". 호칭은 적은 그대로 쓴다
 * ('님'을 붙이면 "어머니 님"처럼 어색해진다). 호칭이 없으면 "활동 기록"
 */
export function pageTitle(name) {
  const n = cleanDisplayName(name);
  return n ? `${n} 활동 기록` : '활동 기록';
}

/** 연결했을 때 안내: "연결했어요: 봄날 어르신" */
export function pairedText(name) {
  const n = cleanDisplayName(name);
  return n ? `연결했어요: ${n}` : '연결했어요';
}

// ---- Supabase ----

/**
 * RPC 주소: https://xxx.supabase.co + get_summaries → https://xxx.supabase.co/rest/v1/rpc/get_summaries
 * Supabase 화면에서 주소를 '…/rest/v1/'까지 복사해 넣어도 맞게, 끝의 /rest/v1 은 뗀다.
 */
export function rpcUrl(baseUrl, name) {
  const root = String(baseUrl).replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
  return `${root}/rest/v1/rpc/${name}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * get_summaries 가 돌려준 값 → 코스 요약 목록 (최근 것부터).
 * 모양이 틀린 것은 버리고, 같은 courseId 는 하나만 남긴다.
 */
export function parseSummaries(data) {
  if (!Array.isArray(data)) return [];
  const seen = new Set();
  const list = [];
  for (const s of data) {
    if (!s || typeof s !== 'object') continue;
    if (typeof s.courseId !== 'string' || !DATE_RE.test(s.date ?? '')) continue;
    if (seen.has(s.courseId)) continue;
    seen.add(s.courseId);
    list.push(s);
  }
  return list.sort((a, b) => String(b.startedAt ?? b.courseId).localeCompare(String(a.startedAt ?? a.courseId)));
}

// ---- 달력 ----

/** 날짜별 코스 수: Map('2026-11-13' → 2) */
export function countByDate(summaries) {
  const map = new Map();
  for (const s of summaries) map.set(s.date, (map.get(s.date) ?? 0) + 1);
  return map;
}

const pad = (n) => String(n).padStart(2, '0');

/** '2026-11-18' → { year: 2026, month: 11 } */
export function monthOf(date) {
  const [year, month] = String(date).split('-').map(Number);
  return { year, month };
}

/** 달 옮기기: { year, month } 에 delta 달을 더한다 */
export function shiftMonth({ year, month }, delta) {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** 두 달 비교: a 가 앞이면 음수 */
export function compareMonth(a, b) {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}

/** 볼 수 있는 달 범위: 이번 달부터 11달 전까지 (요약은 1년 보관) */
export function monthRange(today) {
  const max = monthOf(today);
  return { min: shiftMonth(max, -11), max };
}

/**
 * 한 달 달력 칸 (일요일부터). 앞쪽 빈칸은 null.
 * 반환: [null, null, { day: 1, date: '2026-11-01' }, ...]
 */
export function monthCells({ year, month }) {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0 = 일요일
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells = Array.from({ length: first }, () => null);
  for (let day = 1; day <= days; day++) cells.push({ day, date: `${year}-${pad(month)}-${pad(day)}` });
  return cells;
}

/** 그 달에 함께한 날 수 (하루에 여러 번 해도 하루) */
export function daysInMonth(counts, { year, month }) {
  const prefix = `${year}-${pad(month)}-`;
  let n = 0;
  for (const date of counts.keys()) if (date.startsWith(prefix)) n += 1;
  return n;
}

/** 달력 아래 글: "이번 달 6일 함께했어요" / "10월에 5일 함께했어요" / 기록이 없으면 안내 */
export function monthText(days, shown, today) {
  const isThis = compareMonth(shown, monthOf(today)) === 0;
  const when = isThis ? '이번 달' : `${shown.month}월에`;
  if (days === 0) return isThis ? '이번 달 기록은 아직 없어요' : `${shown.month}월 기록은 없어요`;
  return `${when} ${days}일 함께했어요`;
}

/** 시각 글자: ISO → '오후 2:30' (한국 시간) */
export function timeText(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === 'hour').value) % 24;
  const minute = parts.find((p) => p.type === 'minute').value;
  return `${hour < 12 ? '오전' : '오후'} ${hour % 12 === 0 ? 12 : hour % 12}:${minute}`;
}

// ---- 회차 화면 (6-4 ~ 6-10) ----
// 표현 원칙(6-12): 센 개수만, 비율·점수·판정 없이. 화면 글자는 "완료"(맞은 개수 아님).

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

/** 날짜 제목: '2026-11-13' → '11월 13일 (금)' */
export function dayTitle(date) {
  const [y, m, d] = String(date).split('-').map(Number);
  return `${m}월 ${d}일 (${DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`;
}

/** 그날의 회차, 먼저 한 것부터 (회차 탭 순서) */
export function coursesOn(summaries, date) {
  return summaries
    .filter((s) => s.date === date)
    .sort((a, b) => String(a.startedAt ?? a.courseId).localeCompare(String(b.startedAt ?? b.courseId)));
}

/** 걸린 분 (1분보다 짧으면 1). 시각이 없으면 null */
export function durationMinutes(summary) {
  const ms = Date.parse(summary.endedAt) - Date.parse(summary.startedAt);
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.max(1, Math.round(ms / 60000));
}

/** 활동 목록을 코스 순서로 (order). 없으면 빈 목록 */
export function orderedActivities(summary) {
  return [...(summary.activities ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/**
 * ① 코스 전체 요약 (6-7 A): 시간 + 활동 수. 끝까지 했는지는 글자로만 구분한다.
 * 반환: { time: '오전 10:05 시작 · 22분', main: '활동 4개 모두 함께하셨어요' }
 */
export function courseSummaryText(summary) {
  const acts = orderedActivities(summary);
  const played = acts.filter((a) => a.status === 'played').length;
  const minutes = durationMinutes(summary);
  const start = timeText(summary.startedAt);
  const time = [start && `${start} 시작`, minutes && `${minutes}분`].filter(Boolean).join(' · ');
  let main;
  if (played === 0) main = '이번 코스에는 활동 기록이 없어요';
  else if (summary.finished && played === acts.length) main = `활동 ${played}개 모두 함께하셨어요`;
  else main = `활동 ${played}개 함께하고 마쳤어요`;
  return { time, main };
}

/** 반응 시간 글자: 1400 → '1.4초'. 없으면 '' */
export function reactionText(ms) {
  return Number.isFinite(ms) && ms > 0 ? `${(ms / 1000).toFixed(1)}초` : '';
}

/** 쌓은 막대 칸 이름 (범례·글자). 모양(무늬)은 화면이 정한다 */
export const SEGMENT_LABEL = {
  done: '완료·따라 함',
  shown: '함께 확인',
  rest: '완료 외',
  skipped: '건너뜀',
};

/**
 * ② 쌓은 세로 막대 (6-8 C, 목업 모양) 한 활동의 칸들, 아래부터 쌓는 순서. 0인 칸은 뺀다.
 *   완료(손운동은 따라 함) / 함께 확인 (숫자 기억·가위바위보) / 건너뜀 / 완료 외 (그 밖, 색깔손)
 *   "다시 해서 함"은 완료에 들어 있다. "한 번에"는 ③ 숫자 카드에서 보여 준다.
 * 하지 않았거나 건너뛴 활동은 빈 목록
 */
export function barSegments(activity) {
  if (activity?.status !== 'played') return [];
  const total = activity.total ?? 0;
  const done = activity.done ?? 0;
  const skipped = activity.skipped ?? 0;
  const shown = activity.outcomes?.shown ?? 0;
  const parts = [
    ['done', done],
    ['shown', shown],
    ['skipped', skipped],
    ['rest', total - done - shown - skipped],
  ];
  return parts.filter(([, v]) => Number.isFinite(v) && v > 0).map(([key, value]) => ({ key, label: SEGMENT_LABEL[key], value }));
}

/** 막대 세로축 끝: 가장 큰 전체 수를 짝수로 올림 (눈금 0·가운데·끝이 정수가 되게). 최소 2 */
export function chartMax(activities) {
  const top = Math.max(2, ...activities.map((a) => (a.status === 'played' ? a.total ?? 0 : 0)));
  return top % 2 ? top + 1 : top;
}

/** 루틴 id → 이름 (src/data/routines.json 의 title). 모르는 id 는 '손운동' (6-13) */
export function routineNames(ids, routines) {
  const byId = new Map(routines.map((r) => [r.id, r.title]));
  return (ids ?? []).map((id) => byId.get(id) ?? '손운동');
}

/**
 * ③ 스텝별 요약 (6-10 B, 목업 모양) 한 활동.
 *   tiles: 숫자 카드 4칸. 자리는 모든 활동에서 같게 둔다
 *          전체 문제(손운동은 전체 동작) / 완료(따라 함) / 건너뜀(색깔손은 건너뛰기가 없어 '–') / 한 번에(숫자 기억·가위바위보만, 나머지 '–')
 *   facts: 이름 / 값 줄. 평균 반응(없으면 '–'), 함께 확인 N문제(있을 때), 루틴(손운동), 한 활동 횟수(한 번 더 했을 때)
 *   off:   건너뛴 활동 '건너뛰었어요', 하지 않은 활동 '하지 않았어요' (빈칸으로 두지 않는다)
 */
export function activityView(activity, routines = []) {
  if (activity.status === 'skipped') return { played: false, off: '건너뛰었어요', tiles: [], facts: [] };
  if (activity.status !== 'played') return { played: false, off: '하지 않았어요', tiles: [], facts: [] };
  const coach = activity.program === 'step4-coach';
  const stroop = activity.program === 'step3-stroop';
  const o = activity.outcomes;
  const tiles = [
    { label: coach ? '전체 동작' : '전체 문제', value: String(activity.total), unit: coach ? '동작' : '문제' },
    { label: coach ? '따라 함' : '완료', value: String(activity.done), unit: '' },
    { label: '건너뜀', value: stroop ? '–' : String(activity.skipped ?? 0), unit: '' },
    { label: '한 번에', value: o ? String(o.first) : '–', unit: '' },
  ];
  const facts = [{ label: '평균 반응', value: reactionText(activity.avgReactionMs) || '–' }];
  if (o?.shown > 0) facts.push({ label: '함께 확인', value: `${o.shown}문제` });
  if (activity.routines?.length) facts.push({ label: '루틴', value: routineNames(activity.routines, routines).join(', ') });
  if (activity.rounds > 1) facts.push({ label: '한 횟수', value: `${activity.rounds}번` });
  return { played: true, off: '', tiles, facts };
}

/**
 * 방사형 (6-9 B, 2026-11-23 경민 선택 · 팀 확인 필요): 축 = 활동, 값 = 완료 수.
 * 하지 않은 활동은 0. 끝값은 그 회차에서 가장 큰 전체 수 (최소 1)
 */
export function radarData(activities) {
  const values = activities.map((a) => (a.status === 'played' ? a.done ?? 0 : 0));
  const max = Math.max(1, ...activities.map((a) => (a.status === 'played' ? a.total ?? 0 : 0)));
  return { values, max };
}

// ---- 모아 보기 (6-11 A·B) ----

/** A. 달마다 함께한 날: 보고 있는 달까지 n달 [{ label: '9월', days }] (오래된 달부터) */
export function monthlyDays(counts, endMonth, n = 3) {
  return Array.from({ length: n }, (_, i) => {
    const m = shiftMonth(endMonth, i - n + 1);
    return { label: `${m.month}월`, days: daysInMonth(counts, m) };
  });
}

/** A. 그 달 활동별 함께한 횟수 (활동을 한 코스 수). programs 순서대로 [{ program, count }] */
export function activityCounts(summaries, { year, month }, programs) {
  const prefix = `${year}-${pad(month)}-`;
  const inMonth = summaries.filter((s) => s.date.startsWith(prefix));
  return programs.map((program) => ({
    program,
    count: inMonth.filter((s) => (s.activities ?? []).some((a) => a.program === program && a.status === 'played')).length,
  }));
}

/**
 * B. 반응 시간 변화: 한 활동의 날짜별 평균 반응 시간 (ms), 날짜 오름차순, 최근 limit 날만.
 * 하루에 여러 번 했으면 문제 수(total)로 가중 평균한다 (스테이션 결과 화면과 같은 계산, docs/course.md 5번).
 * 반응 시간이 없는 날은 뺀다. 목표선·정상선·"빨라졌어요" 같은 판정은 두지 않는다 (6-11).
 */
export function reactionByDate(summaries, program, limit = 8) {
  const byDate = new Map();
  for (const s of summaries) {
    for (const a of s.activities ?? []) {
      if (a.program !== program || a.status !== 'played' || !(a.avgReactionMs > 0) || !(a.total > 0)) continue;
      const cur = byDate.get(s.date) ?? { sum: 0, n: 0 };
      cur.sum += a.avgReactionMs * a.total;
      cur.n += a.total;
      byDate.set(s.date, cur);
    }
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-limit)
    .map(([date, { sum, n }]) => ({ date, ms: Math.round(sum / n) }));
}

/** 반응 시간을 재는 방법 (활동마다 달라 활동끼리 견주지 않는다) */
export const REACTION_NOTE = {
  'step4-coach': '손운동은 동작이 시작된 뒤 손모양을 유지해 마칠 때까지예요 (유지 1초 포함).',
  'step2-rps': '가위바위보는 문제가 나온 뒤 첫 답까지예요.',
  'step1-memory': '숫자 기억은 첫 도전에서 숫자 하나를 입력하는 데 걸린 평균이에요.',
  'step3-stroop': '색깔손은 문제가 나온 뒤 답까지예요.',
};

/** 날짜 짧은 글자: '2026-11-13' → '11/13' */
export function shortDate(date) {
  const [, m, d] = String(date).split('-').map(Number);
  return `${m}/${d}`;
}
