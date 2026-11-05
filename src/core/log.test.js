import { describe, it, expect } from 'vitest';
import {
  normalizeRecord,
  summarize,
  toCSV,
  average,
  createLog,
  createMemoryStorage,
  STORAGE_KEY,
} from './log.js';

const base = {
  program: 'step2-rps',
  user: '홍길동',
  startedAt: '2026-11-05T10:00:00.000Z',
  endedAt: '2026-11-05T10:01:00.000Z',
  total: 1,
  done: 1,
};

describe('normalizeRecord', () => {
  it('선택 필드를 기본값으로 채운다', () => {
    expect(normalizeRecord(base)).toEqual({
      ...base,
      skipped: 0,
      avgReactionMs: null,
      detail: {},
    });
  });
  it('필수 필드가 없으면 에러', () => {
    const { user, ...noUser } = base;
    expect(() => normalizeRecord(noUser)).toThrow(/user/);
    expect(() => normalizeRecord({ ...base, total: '1' })).toThrow();
  });
  it('공통 필드 외의 값은 저장하지 않는다', () => {
    expect(normalizeRecord({ ...base, phone: '010' })).not.toHaveProperty('phone');
  });
});

describe('summarize', () => {
  it('프로그램별로 합치고 비율·평균을 계산한다', () => {
    const records = [
      { ...base, total: 1, done: 1, avgReactionMs: 1000 },
      { ...base, total: 1, done: 0, avgReactionMs: 2000 },
      { ...base, program: 'step4-coach', total: 4, done: 3, skipped: 1, avgReactionMs: null },
    ];
    const s = summarize(records);
    expect(s['step2-rps']).toEqual({
      count: 2,
      total: 2,
      done: 1,
      skipped: 0,
      doneRate: 0.5,
      avgReactionMs: 1500,
    });
    expect(s['step4-coach']).toMatchObject({ count: 1, doneRate: 0.75, skipped: 1, avgReactionMs: null });
  });
  it('total 이 0이면 doneRate 는 null', () => {
    expect(summarize([{ ...base, total: 0, done: 0 }])['step2-rps'].doneRate).toBe(null);
  });
  it('average', () => {
    expect(average([])).toBe(null);
    expect(average([1, 2, null])).toBe(2);
  });
});

describe('toCSV', () => {
  it('머리줄과 값, 따옴표·쉼표 처리', () => {
    const csv = toCSV([normalizeRecord({ ...base, user: '김, "철수"', detail: { a: 1 } })]);
    const [head, row] = csv.split('\r\n');
    expect(head).toBe('program,user,startedAt,endedAt,total,done,skipped,avgReactionMs,detail');
    expect(row).toBe(
      'step2-rps,"김, ""철수""",2026-11-05T10:00:00.000Z,2026-11-05T10:01:00.000Z,1,1,0,,"{""a"":1}"',
    );
  });
});

describe('createLog', () => {
  it('저장하고 다시 읽는다', () => {
    const storage = createMemoryStorage();
    const log = createLog({ storage });
    log.record(base);
    log.record({ ...base, program: 'step1-memory', user: '이영희' });
    expect(log.list()).toHaveLength(2);
    expect(log.list({ program: 'step1-memory' })).toHaveLength(1);
    expect(log.list({ user: '홍길동' })).toHaveLength(1);
    // 새로 만들어도 같은 저장소면 기록이 남아 있다
    expect(createLog({ storage }).list()).toHaveLength(2);
  });
  it('저장소 값이 망가져 있으면 빈 목록', () => {
    const storage = createMemoryStorage();
    storage.setItem(STORAGE_KEY, '{망가짐');
    expect(createLog({ storage }).list()).toEqual([]);
  });
  it('onRecord 로 새 기록을 알린다', () => {
    const log = createLog({ storage: createMemoryStorage() });
    const got = [];
    log.onRecord((r) => got.push(r.program));
    log.record(base);
    expect(got).toEqual(['step2-rps']);
  });
});
