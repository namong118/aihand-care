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
  dayTitle,
  coursesOn,
  durationMinutes,
  orderedActivities,
  courseSummaryText,
  reactionText,
  barSegments,
  chartMax,
  routineNames,
  activityView,
  radarData,
  radarValue,
  toFive,
  recordText,
  RADAR_MAX,
  monthlyDays,
  activityCounts,
  reactionByDate,
  shortDate,
  REACTION_NOTE,
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

  it('실제 앱 숫자와 같다: 손운동 = 루틴 동작 수 × 반복의 합, 나머지 = 한 회차 5문제 (PR #152 리뷰)', async () => {
    const routines = (await import('../../data/routines.json')).default;
    const motions = (id) => {
      const r = routines.find((x) => x.id === id);
      return r.steps.length * Math.max(1, r.repeat ?? 1);
    };
    expect(motions('basic-grip')).toBe(6); // 2동작 × 3번
    for (const s of list) {
      for (const a of s.activities) {
        if (a.status !== 'played') continue;
        if (a.program === 'step4-coach') expect(a.total).toBe(a.routines.reduce((n, id) => n + motions(id), 0));
        else expect(a.total).toBe(5 * a.rounds);
      }
    }
    expect(list.some((s) => s.activities.some((a) => a.rounds > 1))).toBe(true); // "한 번 더" 회차도 있다
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

// ---- 회차 화면 ----

const ROUTINES = [
  { id: 'basic-grip', title: '손 깨우기' },
  { id: 'day-closing', title: '하루 마무리' },
];
const played = (o) => ({ status: 'played', rounds: 1, skipped: 0, avgReactionMs: null, outcomes: null, routines: null, ...o });

describe('회차 고르기', () => {
  it('날짜 제목', () => {
    expect(dayTitle('2026-11-13')).toBe('11월 13일 (금)');
    expect(dayTitle('2026-11-01')).toBe('11월 1일 (일)');
  });

  it('그날 회차를 먼저 한 것부터 (회차 탭 순서)', () => {
    const list = demoSummaries('2026-11-18'); // 최근 것부터
    const day = coursesOn(list, '2026-11-13');
    expect(day.map((s) => timeText(s.startedAt))).toEqual(['오전 10:05', '오후 2:30']);
    expect(coursesOn(list, '2026-11-02')).toEqual([]);
  });

  it('걸린 분 (짧아도 1분, 시각이 없으면 null)', () => {
    expect(durationMinutes({ startedAt: '2026-11-13T01:05:00Z', endedAt: '2026-11-13T01:27:10Z' })).toBe(22);
    expect(durationMinutes({ startedAt: '2026-11-13T01:05:00Z', endedAt: '2026-11-13T01:05:10Z' })).toBe(1);
    expect(durationMinutes({ startedAt: '2026-11-13T01:05:00Z' })).toBeNull();
  });

  it('활동은 코스 순서(order)대로', () => {
    expect(orderedActivities({ activities: [{ order: 2 }, { order: 1 }] }).map((a) => a.order)).toEqual([1, 2]);
    expect(orderedActivities({})).toEqual([]);
  });
});

describe('① 코스 전체 요약 (6-7 A)', () => {
  const base = { startedAt: '2026-11-13T01:05:00Z', endedAt: '2026-11-13T01:27:00Z' };
  const four = [played({}), played({}), played({}), played({})];

  it('끝까지 다 하면 "모두 함께하셨어요"', () => {
    expect(courseSummaryText({ ...base, finished: true, activities: four })).toEqual({
      time: '오전 10:05 시작 · 22분',
      main: '활동 4개 모두 함께하셨어요',
    });
  });

  it('중간에 마쳤거나 건너뛴 활동이 있으면 한 개수만 (판정 없이)', () => {
    const acts = [played({}), played({}), { status: 'skipped' }, { status: 'notPlayed' }];
    expect(courseSummaryText({ ...base, finished: false, activities: acts }).main).toBe('활동 2개 함께하고 마쳤어요');
    expect(courseSummaryText({ ...base, finished: true, activities: [played({}), { status: 'skipped' }] }).main).toBe(
      '활동 1개 함께하고 마쳤어요',
    );
  });

  it('한 활동이 없으면 그렇게 적는다', () => {
    expect(courseSummaryText({ ...base, finished: false, activities: [{ status: 'notPlayed' }] }).main).toBe(
      '이번 코스에는 활동 기록이 없어요',
    );
  });
});

describe('② 쌓은 세로 막대 (6-8 C, 목업 모양)', () => {
  it('숫자 기억·가위바위보: 완료(다시 해서 함 포함) / 함께 확인 / 건너뜀, 0인 칸은 뺀다', () => {
    const a = played({ total: 5, done: 3, skipped: 1, outcomes: { first: 2, second: 1, shown: 1, skipped: 1 } });
    expect(barSegments(a).map((x) => [x.key, x.value])).toEqual([
      ['done', 3],
      ['shown', 1],
      ['skipped', 1],
    ]);
    expect(barSegments(a).reduce((n, x) => n + x.value, 0)).toBe(a.total);
  });

  it('손운동: 따라 함 / 건너뜀, 색깔손: 완료 / 완료 외', () => {
    expect(barSegments(played({ total: 10, done: 9, skipped: 1 })).map((x) => [x.key, x.value])).toEqual([
      ['done', 9],
      ['skipped', 1],
    ]);
    expect(barSegments(played({ total: 6, done: 5 })).map((x) => [x.label, x.value])).toEqual([
      ['완료·따라 함', 5],
      ['완료 외', 1],
    ]);
  });

  it('예시 데이터에서 칸을 더하면 언제나 전체 수', () => {
    for (const s of demoSummaries('2026-11-18'))
      for (const a of s.activities) if (a.status === 'played') expect(barSegments(a).reduce((n, x) => n + x.value, 0)).toBe(a.total);
  });

  it('하지 않았거나 건너뛴 활동은 막대가 없다', () => {
    expect(barSegments({ status: 'skipped', total: 0 })).toEqual([]);
    expect(barSegments({ status: 'notPlayed' })).toEqual([]);
  });

  it('세로축 끝은 가장 큰 전체 수를 짝수로', () => {
    expect(chartMax([played({ total: 5 }), played({ total: 6 })])).toBe(6);
    expect(chartMax([played({ total: 5 }), { status: 'skipped', total: 99 }])).toBe(6);
    expect(chartMax([{ status: 'notPlayed' }])).toBe(2);
  });
});

describe('방사형 (6-9 B, PR #152 리뷰: 끝값 5 고정)', () => {
  it('toFive: 안 했으면 0, 다 했으면 5, 그 사이는 1~4', () => {
    expect(toFive(0, 6)).toBe(0);
    expect(toFive(3, 0)).toBe(0); // 전체가 없으면 0
    expect(toFive(6, 6)).toBe(5);
    expect(toFive(7, 6)).toBe(5); // 넘쳐도 5
    expect(toFive(1, 6)).toBe(1); // 내림이면 0 이 되는 경우 → 1
    expect(toFive(1, 16)).toBe(1); // 반올림이면 0 → 1
    expect(toFive(3, 6)).toBe(3);
    expect(toFive(5, 6)).toBe(4);
  });

  it('toFive: 루틴 여러 개를 해서 동작이 많아도 다 하지 않았으면 4까지', () => {
    expect(toFive(15, 16)).toBe(4); // 반올림이면 5 → 4
    expect(toFive(8, 9)).toBe(4); // 손 깨우기 6 + 하루 마무리 3
    expect(toFive(9, 9)).toBe(5);
  });

  it('모든 활동을 toFive(완료 수, 전체 수)로: 다 했을 때만 5', () => {
    expect(radarValue(played({ program: 'step4-coach', total: 6, done: 5 }))).toBe(4);
    expect(radarValue(played({ program: 'step2-rps', total: 5, done: 4 }))).toBe(4);
    expect(radarValue(played({ program: 'step1-memory', total: 10, done: 7, rounds: 2 }))).toBe(4);
    expect(radarValue(played({ program: 'step1-memory', total: 10, done: 9, rounds: 2 }))).toBe(4); // 평균 4.5 를 반올림하면 5 가 되던 경우
    expect(radarValue(played({ program: 'step1-memory', total: 10, done: 10, rounds: 2 }))).toBe(5);
    expect(radarValue(played({ program: 'step3-stroop', total: 5, done: 5 }))).toBe(5);
    expect(radarValue({ status: 'skipped', program: 'step1-memory' })).toBe(0);
    expect(radarValue({ status: 'notPlayed', program: 'step4-coach' })).toBe(0);
  });

  it('radarData: 끝값은 늘 5, 활동 순서대로', () => {
    const acts = [
      played({ program: 'step4-coach', total: 16, done: 15 }),
      played({ program: 'step2-rps', total: 5, done: 4 }),
      { status: 'skipped', program: 'step1-memory' },
      { status: 'notPlayed', program: 'step3-stroop' },
    ];
    expect(radarData(acts)).toEqual({ values: [4, 4, 0, 0], max: RADAR_MAX });
    expect(RADAR_MAX).toBe(5);
  });

  it('예시 데이터의 칸 값은 모두 0~5', () => {
    for (const s of demoSummaries('2026-11-18')) for (const v of radarData(orderedActivities(s)).values) expect(v >= 0 && v <= 5).toBe(true);
  });

  it('글자는 실제 기록 (환산 숫자를 쓰지 않음, 분수 모양도 아님)', () => {
    expect(recordText(played({ program: 'step4-coach', total: 6, done: 5 }))).toEqual({
      short: '5동작 따라 함',
      long: '6동작 중 5동작 따라 하셨어요',
    });
    expect(recordText(played({ program: 'step2-rps', total: 5, done: 4 }))).toEqual({ short: '4문제 완료', long: '5문제 중 4문제 완료' });
    expect(recordText({ status: 'skipped' }).short).toBe('건너뜀');
    expect(recordText({ status: 'notPlayed' }).short).toBe('하지 않음');
    expect(recordText(played({ program: 'step2-rps', total: 5, done: 4 })).short).not.toMatch(/\//);
  });
});

describe('③ 스텝별 요약 (6-10 B, 목업 모양)', () => {
  it('숫자 카드 4칸: 전체 / 완료 / 건너뜀 / 한 번에', () => {
    const a = played({ program: 'step2-rps', total: 5, done: 4, skipped: 1, avgReactionMs: 1400, outcomes: { first: 3, second: 1, shown: 0, skipped: 1 } });
    const v = activityView(a, ROUTINES);
    expect(v.tiles.map((t) => [t.label, t.value])).toEqual([
      ['전체 문제', '5'],
      ['완료', '4'],
      ['건너뜀', '1'],
      ['한 번에', '3'],
    ]);
    expect(v.facts).toEqual([{ label: '평균 반응', value: '1.4초' }]);
  });

  it('손운동: 전체 동작 / 따라 함, 한 번에는 "–", 루틴 이름 (모르는 id 는 "손운동")', () => {
    const v = activityView(played({ program: 'step4-coach', total: 16, done: 15, skipped: 1, routines: ['basic-grip', 'day-closing'] }), ROUTINES);
    expect(v.tiles.map((t) => [t.label, t.value, t.unit])).toEqual([
      ['전체 동작', '16', '동작'],
      ['따라 함', '15', ''],
      ['건너뜀', '1', ''],
      ['한 번에', '–', ''],
    ]);
    expect(v.facts).toEqual([
      { label: '평균 반응', value: '–' },
      { label: '루틴', value: '손 깨우기, 하루 마무리' },
    ]);
    expect(routineNames(['nope'], ROUTINES)).toEqual(['손운동']);
  });

  it('색깔손: 건너뛰기가 없어 건너뜀은 "–"', () => {
    expect(activityView(played({ program: 'step3-stroop', total: 6, done: 6 })).tiles[2]).toMatchObject({ label: '건너뜀', value: '–' });
  });

  it('함께 확인이 있으면 줄을 더하고, 한 번 더 하기를 했으면 횟수', () => {
    const v = activityView(played({ program: 'step1-memory', total: 10, done: 8, rounds: 2, outcomes: { first: 6, second: 2, shown: 2, skipped: 0 } }));
    expect(v.facts.map((f) => f.label)).toEqual(['평균 반응', '함께 확인', '한 횟수']);
    expect(v.facts[1].value).toBe('2문제');
    expect(v.facts[2].value).toBe('2번');
  });

  it('실제 routines.json 으로 예시 데이터의 루틴 이름을 모두 찾는다', async () => {
    const real = (await import('../../data/routines.json')).default;
    const ids = demoSummaries('2026-11-18').flatMap((s) => s.activities[0].routines ?? []);
    expect(routineNames(ids, real)).not.toContain('손운동');
  });

  it('건너뛴 활동·하지 않은 활동은 빈칸 대신 글자로', () => {
    expect(activityView({ status: 'skipped' })).toMatchObject({ played: false, off: '건너뛰었어요' });
    expect(activityView({ status: 'notPlayed' })).toMatchObject({ played: false, off: '하지 않았어요' });
  });

  it('반응 시간 글자', () => {
    expect(reactionText(1400)).toBe('1.4초');
    expect(reactionText(null)).toBe('');
  });

  it('점수처럼 보이는 글자를 쓰지 않는다', () => {
    const all = demoSummaries('2026-11-18').flatMap((s) => [
      ...Object.values(courseSummaryText(s)),
      ...orderedActivities(s).flatMap((a) => {
        const v = activityView(a, ROUTINES);
        return [v.off, ...v.tiles.flatMap((t) => [t.label, t.value]), ...v.facts.flatMap((f) => [f.label, f.value])];
      }),
    ]);
    for (const text of all) expect(text).not.toMatch(/%|점수|정답|등급|틀/);
  });
});

describe('모아 보기 (6-11)', () => {
  const list = demoSummaries('2026-11-18');
  const PROGRAMS = ['step4-coach', 'step2-rps', 'step1-memory', 'step3-stroop'];

  it('A. 달마다 함께한 날: 보고 있는 달까지 3달', () => {
    expect(monthlyDays(countByDate(list), { year: 2026, month: 11 })).toEqual([
      { label: '9월', days: 1 }, // 52일 전 = 9/27
      { label: '10월', days: 4 }, // 45·38·31·24일 전
      { label: '11월', days: 6 },
    ]);
    expect(monthlyDays(countByDate(list), { year: 2026, month: 1 }, 2).map((m) => m.label)).toEqual(['12월', '1월']);
  });

  it('A. 그 달 활동별 함께한 횟수 (건너뛰거나 하지 않은 활동은 세지 않음)', () => {
    expect(activityCounts(list, { year: 2026, month: 11 }, PROGRAMS)).toEqual([
      { program: 'step4-coach', count: 7 },
      { program: 'step2-rps', count: 7 },
      { program: 'step1-memory', count: 6 },
      { program: 'step3-stroop', count: 6 },
    ]);
  });

  it('B. 날짜별 평균 반응 시간: 하루 여러 번이면 문제 수로 가중 평균, 날짜 오름차순, 최근 limit 날', () => {
    const two = [
      { date: '2026-11-13', activities: [{ program: 'step2-rps', status: 'played', total: 5, avgReactionMs: 1000 }] },
      { date: '2026-11-13', activities: [{ program: 'step2-rps', status: 'played', total: 15, avgReactionMs: 2000 }] },
      { date: '2026-11-10', activities: [{ program: 'step2-rps', status: 'played', total: 5, avgReactionMs: 1500 }] },
      { date: '2026-11-12', activities: [{ program: 'step2-rps', status: 'skipped', total: 0, avgReactionMs: null }] },
    ];
    expect(reactionByDate(two, 'step2-rps')).toEqual([
      { date: '2026-11-10', ms: 1500 },
      { date: '2026-11-13', ms: 1750 },
    ]);
    expect(reactionByDate(list, 'step2-rps', 4)).toHaveLength(4);
    expect(reactionByDate(list, 'step2-rps', 4).at(-1).date).toBe('2026-11-17');
  });

  it('반응 시간 재는 방법은 활동마다 있고, 날짜 짧은 글자', () => {
    for (const p of PROGRAMS) expect(REACTION_NOTE[p]).toBeTruthy();
    expect(shortDate('2026-11-03')).toBe('11/3');
  });
});
