import { describe, it, expect } from 'vitest';
import {
  normalizeRecord,
  summarize,
  toCSV,
  average,
  createLog,
  createMemoryStorage,
  fromStored,
  sortByDate,
  STORAGE_KEY,
} from './log.js';

const base = {
  program: 'step2-rps',
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
    const { startedAt, ...noStart } = base;
    expect(() => normalizeRecord(noStart)).toThrow(/startedAt/);
    expect(() => normalizeRecord({ ...base, total: '1' })).toThrow();
  });
  it('공통 필드 외의 값은 저장하지 않는다', () => {
    expect(normalizeRecord({ ...base, phone: '010' })).not.toHaveProperty('phone');
  });
  it('user 는 필요 없고, 넘겨도 저장하지 않는다', () => {
    expect(normalizeRecord({ ...base, user: '홍길동' })).not.toHaveProperty('user');
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
  it('머리줄에 user 열이 없다', () => {
    const [head, row] = toCSV([normalizeRecord(base)]).split('\r\n');
    expect(head).toBe('program,startedAt,endedAt,total,done,skipped,avgReactionMs,detail');
    expect(row).toBe('step2-rps,2026-11-05T10:00:00.000Z,2026-11-05T10:01:00.000Z,1,1,0,,{}');
  });
  it('쉼표·따옴표가 있는 값은 따옴표로 감싸고 안의 따옴표는 두 번 쓴다', () => {
    const [, row] = toCSV([normalizeRecord({ ...base, detail: { a: 1, b: 2 } })]).split('\r\n');
    expect(row.endsWith(',"{""a"":1,""b"":2}"')).toBe(true);
  });
});

describe('createLog', () => {
  it('저장하고 다시 읽는다', () => {
    const storage = createMemoryStorage();
    const log = createLog({ storage });
    log.record(base);
    log.record({ ...base, program: 'step1-memory' });
    expect(log.list()).toHaveLength(2);
    expect(log.list({ program: 'step1-memory' })).toHaveLength(1);
    // 새로 만들어도 같은 저장소면 기록이 남아 있다
    expect(createLog({ storage }).list()).toHaveLength(2);
  });
  it('날짜순(오래된 것부터)으로 돌려준다', () => {
    const log = createLog({ storage: createMemoryStorage() });
    log.record({ ...base, startedAt: '2026-11-07T09:00:00.000Z', endedAt: '2026-11-07T09:01:00.000Z' });
    log.record({ ...base, startedAt: '2026-11-05T09:00:00.000Z', endedAt: '2026-11-05T09:01:00.000Z' });
    expect(log.list().map((r) => r.startedAt.slice(0, 10))).toEqual(['2026-11-05', '2026-11-07']);
  });
  it('예전 버전 기록(user 포함)도 깨지지 않게 읽고 user 는 버린다', () => {
    const storage = createMemoryStorage();
    const old = { ...base, user: '홍길동', skipped: 0, avgReactionMs: 1200, detail: { a: 1 } };
    storage.setItem(STORAGE_KEY, JSON.stringify([old, null, { program: 'x', total: 'abc', done: 1 }]));
    const log = createLog({ storage });
    const list = log.list();
    expect(list).toHaveLength(1); // 읽을 수 없는 기록은 건너뛴다
    expect(list[0]).not.toHaveProperty('user');
    expect(list[0]).toMatchObject({ program: 'step2-rps', avgReactionMs: 1200, detail: { a: 1 } });
    // 새 기록을 저장하면 예전 기록도 이름이 빠진 채로 다시 저장된다
    log.record(base);
    expect(storage.getItem(STORAGE_KEY)).not.toContain('홍길동');
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

describe('fromStored · sortByDate', () => {
  it('빠진 선택 필드는 기본값으로 채운다', () => {
    expect(fromStored({ program: 'step1-memory', startedAt: 's', endedAt: 'e', total: 1, done: 0 })).toEqual({
      program: 'step1-memory',
      startedAt: 's',
      endedAt: 'e',
      total: 1,
      done: 0,
      skipped: 0,
      avgReactionMs: null,
      detail: {},
    });
  });
  it('시각을 읽을 수 없는 기록은 뒤로, 같은 시각은 저장 순서대로', () => {
    const a = { startedAt: '2026-11-05T10:00:00.000Z', id: 'a' };
    const b = { startedAt: '2026-11-05T10:00:00.000Z', id: 'b' };
    const c = { startedAt: '', id: 'c' };
    const d = { startedAt: '2026-11-01T10:00:00.000Z', id: 'd' };
    expect(sortByDate([c, a, b, d]).map((r) => r.id)).toEqual(['d', 'a', 'b', 'c']);
  });
});
