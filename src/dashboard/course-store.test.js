import { describe, it, expect } from 'vitest';
import { createCourseStore, COURSE_STORAGE_KEY } from './course-store.js';
import { createMemoryStorage } from '../core/log.js';

const PLAN = ['step4-coach', 'step2-rps', 'step1-memory', 'step3-stroop'];

describe('createCourseStore', () => {
  it('시작 → 건너뛰기 → 마치기', () => {
    const store = createCourseStore({ storage: createMemoryStorage() });
    store.start({ id: 'C1', plan: PLAN });
    store.skip('C1', 2);
    store.skip('C1', 2); // 두 번 눌러도 한 번
    store.end('C1', { finished: true, endedAt: '2026-11-13T05:30:00.000Z' });
    expect(store.get('C1')).toEqual({ id: 'C1', userId: null, plan: PLAN, skipped: [2], finished: true, endedAt: '2026-11-13T05:30:00.000Z' });
  });

  it('removeUser: 그분의 코스만 지운다 (사용자 지우기). 손님(null)은 지우지 않는다', () => {
    const storage = createMemoryStorage();
    const store = createCourseStore({ storage });
    store.start({ id: 'C1', plan: PLAN, userId: 'u1' });
    store.start({ id: 'C2', plan: PLAN, userId: 'u2' });
    store.start({ id: 'C3', plan: PLAN, userId: 'u1' });
    store.start({ id: 'C4', plan: PLAN });
    expect(store.removeUser('u1')).toBe(2);
    expect(createCourseStore({ storage }).list().map((m) => m.id)).toEqual(['C2', 'C4']);
    expect(store.removeUser(null)).toBe(0);
    expect(store.list()).toHaveLength(2);
  });

  it('로그인한 분의 userId 를 저장한다 (손님은 null, #82)', () => {
    const store = createCourseStore({ storage: createMemoryStorage() });
    store.start({ id: 'C1', plan: PLAN, userId: 'u-2026-11-13T10:00:00.000Z' });
    expect(store.get('C1').userId).toBe('u-2026-11-13T10:00:00.000Z');
  });

  it('그만하기는 finished false', () => {
    const store = createCourseStore({ storage: createMemoryStorage() });
    store.start({ id: 'C1', plan: PLAN });
    store.end('C1', { finished: false, endedAt: 'T' });
    expect(store.get('C1')).toMatchObject({ finished: false, endedAt: 'T' });
  });

  it('없는 코스는 null, 목록은 저장된 순서', () => {
    const store = createCourseStore({ storage: createMemoryStorage() });
    expect(store.skip('없음', 1)).toBe(null);
    store.start({ id: 'A', plan: PLAN });
    store.start({ id: 'B', plan: PLAN });
    expect(store.list().map((m) => m.id)).toEqual(['A', 'B']);
  });

  it('저장된 값이 깨져 있으면 빈 목록', () => {
    const storage = createMemoryStorage();
    storage.setItem(COURSE_STORAGE_KEY, '{망가짐');
    expect(createCourseStore({ storage }).list()).toEqual([]);
  });

  it('plan 원본을 바꿔도 저장된 값은 그대로', () => {
    const store = createCourseStore({ storage: createMemoryStorage() });
    const plan = [...PLAN];
    store.start({ id: 'C1', plan });
    plan.pop();
    expect(store.get('C1').plan).toHaveLength(4);
  });
});
