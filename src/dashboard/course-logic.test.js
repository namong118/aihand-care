import { describe, it, expect } from 'vitest';
import {
  loadCourse,
  newCourseId,
  tagRecord,
  stepInfo,
  courseProgress,
  localDate,
  weightedReaction,
  courseOf,
  courseUser,
  WHO,
  filterDaysByUser,
  GUEST,
  summarizeCourse,
  groupCourses,
  groupByDay,
  reactionTrend,
  SUMMARY_VERSION,
  challengeText,
} from './course-logic.js';
import course from '../data/course.json';
import { CATALOG } from './catalog.js';

const PLAN = course.map((s) => s.program); // ['step4-coach', 'step2-rps', 'step1-memory', 'step3-stroop']

/** 테스트용 기록 */
function rec(program, { course: c, total = 5, done = 4, skipped = 0, avg = 1000, start = '2026-11-13T05:00:00.000Z' } = {}) {
  return {
    program,
    startedAt: start,
    endedAt: start.replace('05:00', '05:05'),
    total,
    done,
    skipped,
    avgReactionMs: avg,
    detail: c ? { course: c } : {},
  };
}

describe('loadCourse', () => {
  it('지금 course.json 은 네 활동, 손 → 카드 순서', () => {
    const plan = loadCourse(course, CATALOG);
    expect(plan.map((s) => s.program)).toEqual(['step4-coach', 'step2-rps', 'step1-memory', 'step3-stroop']);
    expect(plan.map((s) => s.input)).toEqual(['hand', 'hand', 'card', 'card']);
  });
  it('없는 프로그램, 중복, 잘못된 입력 방법이면 오류', () => {
    expect(() => loadCourse([{ program: 'step9', input: 'hand' }], CATALOG)).toThrow();
    expect(() => loadCourse([course[0], course[0]], CATALOG)).toThrow();
    expect(() => loadCourse([{ program: 'step4-coach', input: 'voice' }], CATALOG)).toThrow();
    expect(() => loadCourse([], CATALOG)).toThrow();
  });
});

describe('newCourseId', () => {
  it('시작 시각의 ISO 문자열', () => {
    expect(newCourseId(new Date('2026-11-13T07:19:00.000Z'))).toBe('2026-11-13T07:19:00.000Z');
  });
});

describe('tagRecord', () => {
  it('detail.course 를 붙이고 원래 detail 은 남긴다', () => {
    const r = { program: 'step2-rps', total: 5, done: 4, detail: { difficulty: 'easy' } };
    const t = tagRecord(r, { id: 'C1', order: 2, of: 4 });
    expect(t.detail).toEqual({ difficulty: 'easy', course: { id: 'C1', order: 2, of: 4 } });
    expect(r.detail).toEqual({ difficulty: 'easy' }); // 원본은 그대로
  });
  it('userId 를 넘기면 detail.course 에 함께 붙인다 (손님은 null, #82)', () => {
    expect(tagRecord({ program: 'x' }, { id: 'C1', order: 1, of: 4, userId: 'u-1' }).detail.course).toEqual({ id: 'C1', order: 1, of: 4, userId: 'u-1' });
    expect(tagRecord({ program: 'x' }, { id: 'C1', order: 1, of: 4, userId: null }).detail.course.userId).toBeNull();
  });
  it('detail 이 없어도 된다', () => {
    expect(tagRecord({ program: 'x' }, { id: 'C1', order: 1, of: 4 }).detail).toEqual({ course: { id: 'C1', order: 1, of: 4 } });
  });
});

describe('stepInfo', () => {
  const plan = loadCourse(course, CATALOG);
  it('첫 활동: 입력 바뀜 아님, 마지막 아님', () => {
    expect(stepInfo(plan, 0)).toEqual({ order: 1, of: 4, program: 'step4-coach', input: 'hand', inputChanged: false, isLast: false });
  });
  it('손 → 카드로 바뀌는 3번째 활동', () => {
    expect(stepInfo(plan, 2)).toMatchObject({ order: 3, input: 'card', inputChanged: true });
    expect(stepInfo(plan, 1).inputChanged).toBe(false);
    expect(stepInfo(plan, 3).inputChanged).toBe(false);
  });
  it('마지막 활동', () => {
    expect(stepInfo(plan, 3).isLast).toBe(true);
  });
  it('없는 순서면 오류', () => {
    expect(() => stepInfo(plan, 4)).toThrow();
  });
});

describe('courseProgress', () => {
  const plan = loadCourse(course, CATALOG);
  const states = (index, skipped) => courseProgress(plan, index, skipped).map((s) => s.state);
  it('첫 활동: 지금 1개, 나머지 아직', () => {
    expect(states(0)).toEqual(['now', 'next', 'next', 'next']);
  });
  it('앞 활동은 마침, 건너뛴 활동은 건너뜀', () => {
    expect(states(2, [2])).toEqual(['done', 'skipped', 'now', 'next']);
  });
  it('순서·프로그램·입력 방법을 같이 돌려준다', () => {
    expect(courseProgress(plan, 0)[2]).toEqual({ order: 3, program: 'step1-memory', input: 'card', state: 'next' });
  });
});

describe('localDate (스테이션 현지 시간 Asia/Seoul)', () => {
  it('한국 자정~오전 9시는 UTC 로는 전날이지만, 한국 날짜로 센다', () => {
    expect(localDate('2026-11-13T15:00:00.000Z')).toBe('2026-11-14'); // 한국 11/14 00:00
    expect(localDate('2026-11-13T15:30:00.000Z')).toBe('2026-11-14'); // 한국 11/14 00:30
    expect(localDate('2026-11-13T23:59:00.000Z')).toBe('2026-11-14'); // 한국 11/14 08:59
  });
  it('경계: 한국 오전 9시(UTC 0시)와 한국 23:59', () => {
    expect(localDate('2026-11-14T00:00:00.000Z')).toBe('2026-11-14'); // 한국 11/14 09:00
    expect(localDate('2026-11-13T14:59:59.000Z')).toBe('2026-11-13'); // 한국 11/13 23:59:59
  });
  it('잘못된 시각이면 null', () => {
    expect(localDate('nope')).toBe(null);
  });
});

describe('weightedReaction (문제 수로 가중한 평균)', () => {
  it('문제가 많은 회차에 더 무게를 둔다', () => {
    // (1000×5 + 4000×1) / 6 = 1500
    expect(weightedReaction([{ total: 5, avgReactionMs: 1000 }, { total: 1, avgReactionMs: 4000 }])).toBe(1500);
  });
  it('반응 시간이 없거나 문제 수가 0인 회차는 뺀다', () => {
    expect(weightedReaction([{ total: 5, avgReactionMs: 1000 }, { total: 3, avgReactionMs: null }, { total: 0, avgReactionMs: 9000 }])).toBe(1000);
  });
  it('남는 회차가 없으면 null', () => {
    expect(weightedReaction([])).toBe(null);
    expect(weightedReaction([{ total: 4, avgReactionMs: null }])).toBe(null);
  });
});

describe('summarizeCourse', () => {
  const id = '2026-11-13T05:00:00.000Z';
  const c = (order) => ({ id, order, of: 4 });

  it('네 활동을 모두 한 코스', () => {
    const records = PLAN.map((p, i) => rec(p, { course: c(i + 1), avg: p === 'step4-coach' ? null : 2000 }));
    const s = summarizeCourse({ id, plan: PLAN, skipped: [], finished: true, endedAt: '2026-11-13T05:30:00.000Z' }, records);
    expect(s).toMatchObject({ version: SUMMARY_VERSION, courseId: id, date: '2026-11-13', startedAt: id, endedAt: '2026-11-13T05:30:00.000Z', finished: true });
    expect(s.activities.map((a) => a.status)).toEqual(['played', 'played', 'played', 'played']);
    expect(s.activities[0]).toEqual({ order: 1, program: 'step4-coach', status: 'played', rounds: 1, total: 5, done: 4, skipped: 0, avgReactionMs: null, outcomes: null, routines: null });
  });

  it('"한 번 더 하기"로 두 번 한 활동은 합치고, 반응 시간은 문제 수로 가중', () => {
    const records = [
      rec('step1-memory', { course: c(3), total: 5, done: 5, avg: 1000 }),
      rec('step1-memory', { course: c(3), total: 1, done: 0, skipped: 1, avg: 4000 }),
    ];
    const a = summarizeCourse({ id, plan: PLAN, skipped: [], finished: false }, records).activities[2];
    expect(a).toMatchObject({ status: 'played', rounds: 2, total: 6, done: 5, skipped: 1, avgReactionMs: 1500 });
  });

  it('건너뛴 활동과 하지 않은 활동을 구분한다 (중간에 그만둔 코스)', () => {
    const records = [rec('step4-coach', { course: c(1) })];
    const s = summarizeCourse({ id, plan: PLAN, skipped: [2], finished: false }, records);
    expect(s.activities.map((a) => a.status)).toEqual(['played', 'skipped', 'notPlayed', 'notPlayed']);
    expect(s.activities[1]).toMatchObject({ rounds: 0, total: 0, done: 0, avgReactionMs: null });
    expect(s.finished).toBe(false);
    expect(s.endedAt).toBe('2026-11-13T05:05:00.000Z'); // 진행 정보에 끝난 시각이 없으면 마지막 기록
  });

  it('보호자 앱용: 문제 결과 개수(outcomes)와 손운동 루틴(routines)을 회차끼리 합친다 (#62)', () => {
    const withDetail = (r, detail) => ({ ...r, detail: { ...r.detail, ...detail } });
    const q = (...statuses) => statuses.map((status) => ({ status }));
    const records = [
      withDetail(rec('step4-coach', { course: c(1) }), { routine: 'basic-grip' }),
      withDetail(rec('step4-coach', { course: c(1) }), { routine: 'day-closing' }),
      withDetail(rec('step4-coach', { course: c(1) }), { routine: 'basic-grip' }),
      withDetail(rec('step2-rps', { course: c(2) }), { questions: q('first', 'first', 'second', 'shown', 'skipped') }),
      withDetail(rec('step1-memory', { course: c(3) }), { questions: q('first', 'skipped') }),
      withDetail(rec('step1-memory', { course: c(3) }), { questions: q('second', 'odd') }),
      rec('step3-stroop', { course: c(4) }),
    ];
    const a = summarizeCourse({ id, plan: PLAN, skipped: [], finished: true }, records).activities;
    expect(a[0]).toMatchObject({ outcomes: null, routines: ['basic-grip', 'day-closing'] }); // 같은 루틴은 한 번만, 처음 한 순서
    expect(a[1]).toMatchObject({ outcomes: { first: 2, second: 1, shown: 1, skipped: 1 }, routines: null });
    expect(a[2].outcomes).toEqual({ first: 1, second: 1, shown: 0, skipped: 1 }); // 모르는 status 는 세지 않음
    expect(a[3]).toMatchObject({ outcomes: null, routines: null });
  });

  it('하지 않은 활동은 outcomes·routines 가 null', () => {
    const a = summarizeCourse({ id, plan: PLAN, skipped: [1] }, []).activities;
    expect(a.every((x) => x.outcomes === null && x.routines === null)).toBe(true);
  });

  it('다른 코스와 코스 밖 기록은 섞지 않는다', () => {
    const records = [rec('step4-coach', { course: { id: 'OTHER', order: 1, of: 4 } }), rec('step4-coach')];
    expect(summarizeCourse({ id, plan: PLAN, skipped: [] }, records).activities[0].status).toBe('notPlayed');
  });

  it('코스 날짜는 한국 시간 기준 (한국 새벽 0시 30분에 시작한 코스)', () => {
    const night = '2026-11-13T15:30:00.000Z';
    expect(summarizeCourse({ id: night, plan: PLAN, skipped: [] }, []).date).toBe('2026-11-14');
  });
});

describe('courseOf', () => {
  it('코스 기록이면 코스 정보, 아니면 null', () => {
    expect(courseOf(rec('x', { course: { id: 'C', order: 1, of: 4 } }))).toEqual({ id: 'C', order: 1, of: 4 });
    expect(courseOf(rec('x'))).toBe(null);
    expect(courseOf(null)).toBe(null);
  });
});

describe('groupCourses', () => {
  it('최근 코스부터, 코스 밖 기록은 빼고, 진행 정보가 없어도 기록으로 요약한다', () => {
    const A = '2026-11-12T05:00:00.000Z';
    const B = '2026-11-13T05:00:00.000Z';
    const records = [
      rec('step4-coach', { course: { id: A, order: 1, of: 4 } }),
      rec('step2-rps', { course: { id: A, order: 2, of: 4 } }),
      rec('step4-coach', { course: { id: B, order: 1, of: 4 } }),
      rec('step3-stroop'), // 코스 밖
    ];
    const metas = [{ id: B, plan: PLAN, skipped: [2], finished: false }];
    const list = groupCourses(records, metas);
    expect(list.map((s) => s.courseId)).toEqual([B, A]);
    expect(list[0].activities.map((a) => a.status)).toEqual(['played', 'skipped', 'notPlayed', 'notPlayed']);
    // A 는 진행 정보가 없어 기록의 순서로 만든다
    expect(list[1].activities.map((a) => a.program)).toEqual(['step4-coach', 'step2-rps']);
  });
  it('기록이 없어도 진행 정보만 있는 코스(바로 그만둠)는 보인다', () => {
    const list = groupCourses([], [{ id: 'C', plan: PLAN, skipped: [], finished: false }]);
    expect(list).toHaveLength(1);
    expect(list[0].activities.every((a) => a.status === 'notPlayed')).toBe(true);
  });
});

describe('reactionTrend', () => {
  it('한 활동의 날짜별 가중 평균, 날짜 오름차순, 코스 밖 기록 포함', () => {
    const records = [
      rec('step2-rps', { start: '2026-11-13T05:00:00.000Z', total: 5, avg: 1000 }),
      rec('step2-rps', { start: '2026-11-13T06:00:00.000Z', total: 1, avg: 4000, course: { id: 'C', order: 2, of: 4 } }),
      rec('step2-rps', { start: '2026-11-12T05:00:00.000Z', total: 5, avg: 3000 }),
      rec('step1-memory', { start: '2026-11-13T05:00:00.000Z', avg: 9999 }), // 다른 활동
    ];
    expect(reactionTrend(records, 'step2-rps')).toEqual([
      { date: '2026-11-12', avgReactionMs: 3000, rounds: 1 },
      { date: '2026-11-13', avgReactionMs: 1500, rounds: 2 },
    ]);
  });
  it('한국 새벽 기록은 한국 날짜로 묶는다', () => {
    const records = [rec('step2-rps', { start: '2026-11-13T16:00:00.000Z', avg: 2000 })]; // 한국 11/14 01:00
    expect(reactionTrend(records, 'step2-rps')[0].date).toBe('2026-11-14');
  });
  it('반응 시간이 없는 활동은 빈 목록', () => {
    expect(reactionTrend([rec('step4-coach', { avg: null })], 'step4-coach')).toEqual([]);
  });
  it('동시에 가위바위보(detail.mode quick)는 빼고 사고력 가위바위보만 (#116)', () => {
    const quick = { ...rec('step2-rps', { start: '2026-11-13T05:00:00.000Z', total: 5, avg: 300 }) };
    quick.detail = { ...quick.detail, mode: 'quick' };
    const records = [quick, rec('step2-rps', { start: '2026-11-13T06:00:00.000Z', total: 5, avg: 2000 })];
    expect(reactionTrend(records, 'step2-rps')).toEqual([{ date: '2026-11-13', avgReactionMs: 2000, rounds: 1 }]);
    expect(reactionTrend([quick], 'step2-rps')).toEqual([]);
  });

  it('나의 시작 찾기 짧은 판(detail.findStart)은 뺀다', () => {
    const short = { ...rec('step1-memory', { start: '2026-11-22T05:00:00.000Z', total: 1, avg: 900 }) };
    short.detail = { ...short.detail, findStart: { id: 'find-1', group: 'memory', role: 'basic' } };
    const records = [short, rec('step1-memory', { start: '2026-11-22T06:00:00.000Z', total: 5, avg: 2000 })];
    expect(reactionTrend(records, 'step1-memory')).toEqual([{ date: '2026-11-22', avgReactionMs: 2000, rounds: 1 }]);
  });
});

describe('groupByDay (결과 화면 날짜별 기록)', () => {
  const A = '2026-11-13T05:00:00.000Z'; // 한국 11/13 14시
  const B = '2026-11-14T01:00:00.000Z'; // 한국 11/14 10시
  const C = '2026-11-13T16:30:00.000Z'; // UTC 로는 11/13, 한국은 11/14 01:30

  it('날짜마다 코스와 코스 밖 활동을 나누고, 최근 날짜부터', () => {
    const records = [
      rec('step4-coach', { course: { id: A, order: 1, of: 4 }, start: A }),
      rec('step2-rps', { start: '2026-11-13T06:00:00.000Z' }),
      rec('step1-memory', { start: B }),
    ];
    const metas = [{ id: A, plan: PLAN, skipped: [], finished: false, endedAt: null }];
    const days = groupByDay(records, metas);
    expect(days.map((d) => d.date)).toEqual(['2026-11-14', '2026-11-13']);
    expect(days[0].courses).toEqual([]);
    expect(days[0].singles.map((r) => r.program)).toEqual(['step1-memory']);
    expect(days[1].courses.map((c) => c.courseId)).toEqual([A]);
    expect(days[1].singles.map((r) => r.program)).toEqual(['step2-rps']);
  });

  it('하루 안에서도 최근 것부터 (코스, 코스 밖 활동 모두)', () => {
    const A2 = '2026-11-13T07:00:00.000Z';
    const records = [
      rec('step4-coach', { course: { id: A, order: 1, of: 4 }, start: A }),
      rec('step4-coach', { course: { id: A2, order: 1, of: 4 }, start: A2 }),
      rec('step2-rps', { start: '2026-11-13T03:00:00.000Z' }),
      rec('step3-stroop', { start: '2026-11-13T08:00:00.000Z' }),
    ];
    const [day] = groupByDay(records, []);
    expect(day.courses.map((c) => c.courseId)).toEqual([A2, A]);
    expect(day.singles.map((r) => r.program)).toEqual(['step3-stroop', 'step2-rps']);
  });

  it('날짜는 한국 시간으로 센다', () => {
    const [day] = groupByDay([rec('step2-rps', { start: C })], []);
    expect(day.date).toBe('2026-11-14');
  });

  it('진행 정보만 있고 기록이 없는 코스(바로 그만둠)도 그날에 보인다', () => {
    const metas = [{ id: A, plan: PLAN, skipped: [1], finished: false, endedAt: A }];
    const [day] = groupByDay([], metas);
    expect(day.date).toBe('2026-11-13');
    expect(day.courses[0].activities.map((a) => a.status)).toEqual(['skipped', 'notPlayed', 'notPlayed', 'notPlayed']);
  });

  it('시작 시각을 읽을 수 없는 기록은 날짜 없음(null)으로 맨 뒤', () => {
    const days = groupByDay([rec('step2-rps', { start: '' }), rec('step1-memory', { start: A })], []);
    expect(days.map((d) => d.date)).toEqual(['2026-11-13', null]);
  });

  it('기록이 없으면 빈 목록', () => {
    expect(groupByDay([], [])).toEqual([]);
  });
});

describe('코스 사용자 (#82)', () => {
  const id = '2026-11-16T05:00:00.000Z';
  it('요약에 진행 정보의 userId 를 먼저, 없으면 기록의 userId', () => {
    const tagged = [rec('step4-coach', { course: { id, order: 1, of: 4, userId: 'u-b' } })];
    expect(summarizeCourse({ id, userId: 'u-a', plan: PLAN, skipped: [] }, tagged)).toMatchObject({ userId: 'u-a', who: WHO.user });
    expect(summarizeCourse({ id, plan: PLAN, skipped: [] }, tagged)).toMatchObject({ userId: 'u-b', who: WHO.user });
  });

  it('손님(userId 키가 있고 null)과 로그인 기능 전 코스(키 없음)를 나눈다', () => {
    expect(courseUser({ id, userId: null })).toEqual({ userId: null, who: WHO.guest });
    expect(courseUser({ id })).toEqual({ userId: null, who: WHO.unknown });
    // 진행 정보에 키가 없어도 기록에 userId: null 이 있으면 손님
    const guestRec = [rec('step4-coach', { course: { id, order: 1, of: 4, userId: null } })];
    expect(courseUser({ id }, guestRec)).toEqual({ userId: null, who: WHO.guest });
    // 예전 기록 (키 없음)
    const oldRec = [rec('step4-coach', { course: { id, order: 1, of: 4 } })];
    expect(courseUser({ id }, oldRec)).toEqual({ userId: null, who: WHO.unknown });
  });

  it('진행 정보가 지워진 코스도 기록으로 누가 했는지 찾는다', () => {
    const records = [
      rec('step4-coach', { course: { id, order: 1, of: 4, userId: 'u-a' } }),
      rec('step4-coach', { course: { id: 'G', order: 1, of: 4, userId: null } }),
      rec('step4-coach', { course: { id: 'OLD', order: 1, of: 4 } }),
    ];
    const who = Object.fromEntries(groupCourses(records, []).map((c) => [c.courseId, c.who]));
    expect(who).toEqual({ [id]: WHO.user, G: WHO.guest, OLD: WHO.unknown });
  });

  it('날짜별 기록을 한 분의 코스만 남긴다. 코스 밖 활동은 사용자를 고르면 빠진다', () => {
    const days = [
      {
        date: '2026-11-16',
        courses: [
          { courseId: 'A', userId: 'u-a', who: 'user' },
          { courseId: 'B', userId: null, who: 'guest' },
          { courseId: 'OLD', userId: null, who: 'unknown' },
        ],
        singles: [{ program: 'x' }],
      },
      { date: '2026-11-15', courses: [{ courseId: 'C', userId: 'u-b', who: 'user' }], singles: [] },
    ];
    expect(filterDaysByUser(days, null)).toBe(days);
    expect(filterDaysByUser(days, 'u-a')).toEqual([{ date: '2026-11-16', courses: [{ courseId: 'A', userId: 'u-a', who: 'user' }], singles: [] }]);
    // 손님을 고르면 진짜 손님 코스(B)만. 로그인 기능 전 코스(OLD)는 "모든 분"에서만
    expect(filterDaysByUser(days, GUEST).map((d) => d.courses.map((c) => c.courseId))).toEqual([['B']]);
    expect(filterDaysByUser(days, 'u-zz')).toEqual([]);
  });
});

describe('challengeText (도전 활동 한 판 기록 글)', () => {
  const r = (program, detail) => ({ program, total: 1, done: 0, skipped: 0, detail });
  it('숫자 야구', () => {
    expect(challengeText(r('challenge-baseball', { level: 2, solved: true, tries: 3 }))).toBe('2단계 · 3번 만에 찾음');
    expect(challengeText(r('challenge-baseball', { level: 1, solved: false, stopped: true, tries: 2 }))).toBe('1단계 · 2번 내고 정답 함께 확인');
  });
  it('이어 세기', () => {
    expect(challengeText(r('challenge-count', { level: 3, end: 23, winner: 'me' }))).toBe('3단계 · 끝 숫자 23 · 로봇이 끝 숫자를 부름');
    expect(challengeText(r('challenge-count', { level: 1, end: 20, winner: 'robot' }))).toBe('1단계 · 끝 숫자 20 · 끝 숫자를 부르심');
    expect(challengeText(r('challenge-count', { level: 1, end: 20, winner: null, stopped: true }))).toBe('1단계 · 끝 숫자 20 · 중간에 그만함');
  });
  it('공 주고받기: 단계는 쓰지 않는다 (한 가지로만), 예전 기록은 고른 손도', () => {
    const ball = (detail, done) => ({ program: 'challenge-ball', total: 4, done, skipped: 0, detail });
    expect(challengeText(ball({ level: 1, hand: null, exchanges: [] }, 4))).toBe('공을 4번 주고받음');
    expect(challengeText(ball({ level: 1, hand: 'left', exchanges: [] }, 4))).toBe('왼손 · 공을 4번 주고받음');
    expect(challengeText(ball({ level: 3, hand: null, exchanges: [] }, 3))).toBe('공을 3번 주고받음');
  });
  it('모르는 활동·detail 없음은 null', () => {
    expect(challengeText(r('challenge-shuffle', { level: 1 }))).toBeNull();
    expect(challengeText(r('step1-memory', {}))).toBeNull();
    expect(challengeText({ program: 'challenge-count' })).toBeNull();
  });
  it('점수·판정처럼 보이는 말을 쓰지 않는다', () => {
    const texts = [
      challengeText(r('challenge-baseball', { level: 1, solved: false, tries: 8 })),
      challengeText(r('challenge-count', { level: 1, end: 20, winner: 'robot' })),
    ];
    for (const t of texts) for (const w of ['점수', '정답률', '실패', '틀렸', '졌']) expect(t).not.toContain(w);
  });
});
