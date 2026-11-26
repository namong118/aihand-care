import { describe, it, expect } from 'vitest';
import {
  normalizeCode,
  cleanDisplayName,
  parseHash,
  parseConnection,
  pageTitle,
  pairedText,
  rpcUrl,
  parseSummaries,
  countByDate,
  monthOf,
  shiftMonth,
  compareMonth,
  monthRange,
  monthCells,
  daysInMonth,
  monthText,
  timeText,
} from './logic.js';
import { pairingUrl } from '../logic.js';
import { demoSummaries } from './demo.js';

const CODE = 'ABCDEFGHJKMN';

describe('연결 코드 입력', () => {
  it('빈칸·- 를 빼고 대문자로 바꾼다', () => {
    expect(normalizeCode('abcd-efgh-jkmn')).toBe(CODE);
    expect(normalizeCode(' ABCD EFGH JKMN ')).toBe(CODE);
  });

  it('모양이 틀리면 null', () => {
    expect(normalizeCode('ABCD-EFGH')).toBeNull(); // 짧음
    expect(normalizeCode('ABCD-EFGH-JKM0')).toBeNull(); // 0 은 쓰지 않는 글자
    expect(normalizeCode('')).toBeNull();
    expect(normalizeCode(null)).toBeNull();
  });
});

describe('parseHash', () => {
  it('스테이션이 만든 QR 주소를 그대로 읽는다', () => {
    const hash = new URL(pairingUrl(CODE, '봄날 어르신')).hash;
    expect(parseHash(hash)).toEqual({ kind: 'pair', code: CODE, name: '봄날 어르신' });
  });

  it('호칭이 없어도 연결한다', () => {
    expect(parseHash(`#c=${CODE}`)).toEqual({ kind: 'pair', code: CODE, name: '' });
  });

  it('호칭은 다듬고 12글자까지', () => {
    expect(parseHash(`#c=${CODE}&n=${encodeURIComponent('  봄날   어르신 ')}`).name).toBe('봄날 어르신');
    expect(parseHash(`#c=${CODE}&n=${'가'.repeat(20)}`).name).toHaveLength(12);
  });

  it('#demo 는 예시 화면', () => {
    expect(parseHash('#demo')).toEqual({ kind: 'demo' });
  });

  it('코드 모양이 틀리면 bad, 아무것도 없으면 none', () => {
    expect(parseHash('#c=ABC')).toEqual({ kind: 'bad' });
    expect(parseHash('')).toEqual({ kind: 'none' });
    expect(parseHash('#')).toEqual({ kind: 'none' });
    expect(parseHash('#other=1')).toEqual({ kind: 'none' });
  });
});

describe('저장된 연결', () => {
  it('맞는 모양이면 읽는다', () => {
    expect(parseConnection(JSON.stringify({ code: CODE, name: '해님' }))).toEqual({ code: CODE, name: '해님' });
  });

  it('깨졌거나 코드가 틀리면 null', () => {
    expect(parseConnection('{깨짐')).toBeNull();
    expect(parseConnection(null)).toBeNull();
    expect(parseConnection(JSON.stringify({ code: 'short' }))).toBeNull();
  });
});

describe('제목·안내 글', () => {
  it('호칭은 적은 그대로 쓴다 (님을 붙이지 않음)', () => {
    expect(pageTitle('봄날 어르신')).toBe('봄날 어르신 활동 기록');
    expect(pageTitle('어머니')).toBe('어머니 활동 기록');
    expect(pageTitle('')).toBe('활동 기록');
    expect(pairedText('해바라기님')).toBe('연결했어요: 해바라기님');
    expect(pairedText(undefined)).toBe('연결했어요');
    expect(cleanDisplayName(undefined)).toBe('');
  });
});

describe('Supabase', () => {
  it('RPC 주소 (끝의 / 는 하나만)', () => {
    expect(rpcUrl('https://x.supabase.co/', 'get_summaries')).toBe('https://x.supabase.co/rest/v1/rpc/get_summaries');
    expect(rpcUrl('https://x.supabase.co', 'get_summaries')).toBe('https://x.supabase.co/rest/v1/rpc/get_summaries');
  });

  it('주소를 /rest/v1/ 까지 복사해 넣어도 겹치지 않는다', () => {
    expect(rpcUrl('https://x.supabase.co/rest/v1/', 'get_summaries')).toBe('https://x.supabase.co/rest/v1/rpc/get_summaries');
    expect(rpcUrl('https://x.supabase.co/rest/v1', 'get_summaries')).toBe('https://x.supabase.co/rest/v1/rpc/get_summaries');
  });

  it('요약 목록: 모양이 틀린 것은 버리고, 같은 코스는 하나만, 최근 것부터', () => {
    const a = { courseId: '2026-11-13T01:05:00.000Z', date: '2026-11-13', startedAt: '2026-11-13T01:05:00.000Z' };
    const b = { courseId: '2026-11-17T01:15:00.000Z', date: '2026-11-17', startedAt: '2026-11-17T01:15:00.000Z' };
    expect(parseSummaries([a, b, a, null, { courseId: 'x' }, { date: '2026-11-01' }])).toEqual([b, a]);
    expect(parseSummaries({ not: 'list' })).toEqual([]);
  });
});

describe('달력', () => {
  it('날짜별 코스 수', () => {
    const counts = countByDate([{ date: '2026-11-13' }, { date: '2026-11-13' }, { date: '2026-11-17' }]);
    expect(counts.get('2026-11-13')).toBe(2);
    expect(counts.get('2026-11-17')).toBe(1);
  });

  it('달 옮기기는 해를 넘는다', () => {
    expect(shiftMonth({ year: 2026, month: 11 }, 2)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(monthOf('2026-11-18')).toEqual({ year: 2026, month: 11 });
    expect(compareMonth({ year: 2026, month: 1 }, { year: 2025, month: 12 })).toBeGreaterThan(0);
  });

  it('볼 수 있는 달은 이번 달부터 11달 전까지 (1년 보관)', () => {
    expect(monthRange('2026-11-18')).toEqual({ min: { year: 2025, month: 12 }, max: { year: 2026, month: 11 } });
  });

  it('2026년 11월은 일요일에 시작하고 30일까지', () => {
    const cells = monthCells({ year: 2026, month: 11 });
    expect(cells[0]).toEqual({ day: 1, date: '2026-11-01' });
    expect(cells.at(-1)).toEqual({ day: 30, date: '2026-11-30' });
  });

  it('2026년 12월은 화요일에 시작해서 앞에 빈칸 2개', () => {
    const cells = monthCells({ year: 2026, month: 12 });
    expect(cells.slice(0, 3)).toEqual([null, null, { day: 1, date: '2026-12-01' }]);
    expect(cells.filter(Boolean)).toHaveLength(31);
  });

  it('윤년 2월', () => {
    expect(monthCells({ year: 2028, month: 2 }).filter(Boolean)).toHaveLength(29);
  });

  it('그 달에 함께한 날 수 (하루 여러 번은 하루)', () => {
    const counts = countByDate([{ date: '2026-11-13' }, { date: '2026-11-13' }, { date: '2026-11-17' }, { date: '2026-10-30' }]);
    expect(daysInMonth(counts, { year: 2026, month: 11 })).toBe(2);
    expect(daysInMonth(counts, { year: 2026, month: 10 })).toBe(1);
  });

  it('달력 아래 글: 센 것만, 판정 없이', () => {
    const today = '2026-11-18';
    expect(monthText(6, { year: 2026, month: 11 }, today)).toBe('이번 달 6일 함께했어요');
    expect(monthText(5, { year: 2026, month: 10 }, today)).toBe('10월에 5일 함께했어요');
    expect(monthText(0, { year: 2026, month: 11 }, today)).toBe('이번 달 기록은 아직 없어요');
    expect(monthText(0, { year: 2026, month: 9 }, today)).toBe('9월 기록은 없어요');
  });

  it('시각 글자는 한국 시간', () => {
    expect(timeText('2026-11-13T01:05:00.000Z')).toBe('오전 10:05');
    expect(timeText('2026-11-13T05:30:00.000Z')).toBe('오후 2:30');
    expect(timeText('2026-11-13T03:00:00.000Z')).toBe('오후 12:00');
    expect(timeText('2026-11-12T15:00:00.000Z')).toBe('오전 12:00');
    expect(timeText('엉뚱')).toBe('');
  });
});

describe('예시 데이터 (#demo)', () => {
  const today = '2026-11-18';
  const list = demoSummaries(today);

  it('모두 요약 모양이고 최근 것부터, 오늘을 넘지 않는다', () => {
    expect(parseSummaries(list)).toEqual(list);
    expect(list[0].date).toBe('2026-11-17');
    expect(list.every((s) => s.date <= today)).toBe(true);
  });

  it('하루에 두 번 한 날이 있다 (회차 탭 확인용)', () => {
    expect([...countByDate(list).values()]).toContain(2);
  });

  it('지난달 기록도 있다 (달 넘기기 확인용)', () => {
    expect(list.some((s) => s.date.startsWith('2026-10-'))).toBe(true);
  });

  it('활동 수가 맞는다: outcomes 합 = total, first+second = done, 건너뛴 활동은 0', () => {
    for (const s of list) {
      expect(s.activities.map((a) => a.order)).toEqual([1, 2, 3, 4]);
      for (const a of s.activities) {
        if (a.status !== 'played') {
          expect([a.total, a.done, a.rounds]).toEqual([0, 0, 0]);
          continue;
        }
        expect(a.done + a.skipped).toBeLessThanOrEqual(a.total);
        if (a.outcomes) {
          const o = a.outcomes;
          expect(o.first + o.second + o.shown + o.skipped).toBe(a.total);
          expect(o.first + o.second).toBe(a.done);
          expect(o.skipped).toBe(a.skipped);
        }
      }
    }
  });

  it('손운동 루틴은 routines.json 에 있는 id', async () => {
    const routines = (await import('../../data/routines.json')).default;
    const ids = new Set(routines.map((r) => r.id));
    for (const s of list) for (const id of s.activities[0].routines ?? []) expect(ids.has(id)).toBe(true);
  });

  it('시작 시각은 한국 시간 그대로', () => {
    const twice = list.filter((s) => s.date === '2026-11-13');
    expect(twice.map((s) => timeText(s.startedAt))).toEqual(['오후 2:30', '오전 10:05']);
  });
});
