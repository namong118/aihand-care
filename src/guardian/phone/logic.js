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
