import { describe, it, expect } from 'vitest';
import { cleanAll, levelsOf, withLevels, pruneUsers, createLevelStore, LEVELS_KEY } from './user-levels.js';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
  };
}

describe('사람별 시작 단계 (logic)', () => {
  it('cleanAll: 활동에 맞지 않는 단계와 빈 사람은 뺀다', () => {
    expect(
      cleanAll({
        a: { 'step1-memory': 'normal', 'challenge-baseball': 7 },
        b: { 'step2-rps': 1 },
        '': { 'step1-memory': 'hard' },
      }),
    ).toEqual({ a: { 'step1-memory': 'normal' } });
    expect(cleanAll(null)).toEqual({});
    expect(cleanAll([1, 2])).toEqual({});
  });

  it('levelsOf: 손님(null)이나 정한 것이 없으면 빈 값', () => {
    const all = { a: { 'step1-memory': 'hard' } };
    expect(levelsOf(all, 'a')).toEqual({ 'step1-memory': 'hard' });
    expect(levelsOf(all, 'b')).toEqual({});
    expect(levelsOf(all, null)).toEqual({});
  });

  it('withLevels: 한 분만 바꾸고, null 은 정하지 않음으로, 원래 값은 그대로', () => {
    const all = { a: { 'step1-memory': 'easy', 'challenge-baseball': 1 }, b: { 'step1-memory': 'hard' } };
    const next = withLevels(all, 'a', { 'step1-memory': 'normal', 'challenge-baseball': null, 'step3-stroop': 'hard' });
    expect(next).toEqual({ a: { 'step1-memory': 'normal', 'step3-stroop': 'hard' }, b: { 'step1-memory': 'hard' } });
    expect(all.a).toEqual({ 'step1-memory': 'easy', 'challenge-baseball': 1 });
  });

  it('withLevels: 손님(null)은 저장하지 않는다', () => {
    expect(withLevels({}, null, { 'step1-memory': 'hard' })).toEqual({});
  });

  it('pruneUsers: 등록된 분만 남긴다', () => {
    expect(pruneUsers({ a: { 'step1-memory': 'easy' }, gone: { 'step1-memory': 'hard' } }, ['a', 'c'])).toEqual({
      a: { 'step1-memory': 'easy' },
    });
  });
});

describe('사람별 시작 단계 저장소', () => {
  it('저장하고 다시 읽는다 (사람마다 따로)', () => {
    const storage = memoryStorage();
    const store = createLevelStore({ storage });
    store.set('a', { 'step1-memory': 'normal', 'challenge-baseball': 1 });
    store.set('b', { 'step1-memory': 'hard' });
    const again = createLevelStore({ storage });
    expect(again.get('a')).toEqual({ 'step1-memory': 'normal', 'challenge-baseball': 1 });
    expect(again.get('b')).toEqual({ 'step1-memory': 'hard' });
    expect(again.get(null)).toEqual({});
  });

  it('prune 으로 지워진 분의 단계를 지운다', () => {
    const storage = memoryStorage();
    const store = createLevelStore({ storage });
    store.set('a', { 'step1-memory': 'easy' });
    store.set('gone', { 'step1-memory': 'hard' });
    store.prune(['a']);
    expect(JSON.parse(storage.getItem(LEVELS_KEY))).toEqual({ a: { 'step1-memory': 'easy' } });
  });

  it('저장소를 쓸 수 없으면 이번 실행 동안만 기억한다', () => {
    const broken = {
      getItem: () => {
        throw new Error('막힘');
      },
      setItem: () => {
        throw new Error('막힘');
      },
    };
    const store = createLevelStore({ storage: broken });
    store.set('a', { 'step1-memory': 'hard' });
    expect(store.get('a')).toEqual({ 'step1-memory': 'hard' });
  });
});
