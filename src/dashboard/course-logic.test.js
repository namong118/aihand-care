import { describe, it, expect } from 'vitest';
import {
  loadCourse,
  newCourseId,
  tagRecord,
  stepInfo,
  localDate,
  weightedReaction,
  courseOf,
  summarizeCourse,
  groupCourses,
  reactionTrend,
  SUMMARY_VERSION,
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
    expect(s.activities[0]).toEqual({ order: 1, program: 'step4-coach', status: 'played', rounds: 1, total: 5, done: 4, skipped: 0, avgReactionMs: null });
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
});
