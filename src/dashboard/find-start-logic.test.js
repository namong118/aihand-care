import { describe, it, expect } from 'vitest';
import json from '../data/find-start.json';
import { CATALOG, CHALLENGES } from './catalog.js';
import {
  loadFindStart,
  readyGroups,
  outcomeOf,
  nextPosition,
  recommendFor,
  tagFindStart,
  findStartOf,
  cleanLevels,
  settingsFor,
  isLevelFor,
} from './find-start-logic.js';

const KNOWN = [...CATALOG, ...CHALLENGES].map((p) => p.id);
const groups = loadFindStart(json, KNOWN);
const memory = groups.find((g) => g.id === 'memory');

describe('loadFindStart', () => {
  it('find-start.json 을 읽는다 (지금은 숫자 기억 짝만 ready)', () => {
    expect(groups.map((g) => g.id)).toEqual(['memory', 'rps', 'color']);
    expect(readyGroups(groups).map((g) => g.id)).toEqual(['memory']);
  });

  it('모르는 활동 id 면 오류', () => {
    expect(() => loadFindStart({ groups: [{ id: 'x', basic: 'step9', challenge: 'challenge-baseball' }] }, KNOWN)).toThrow();
  });

  it('ready 짝의 추천 값이 틀리면 오류', () => {
    const bad = { ...json.groups[0], recommend: { ...json.groups[0].recommend, both: { basic: 'hard', challenge: 9 } } };
    expect(() => loadFindStart({ groups: [bad] }, KNOWN)).toThrow();
  });

  it('ready 가 아닌 짝은 추천 값이 없어도 된다', () => {
    expect(loadFindStart({ groups: [{ id: 'rps', basic: 'step2-rps', challenge: 'challenge-count' }] }, KNOWN)[0].ready).toBe(false);
  });
});

describe('outcomeOf', () => {
  it('하나라도 해냈으면 done, 아니면 tried', () => {
    expect(outcomeOf({ done: 1, total: 1 })).toBe('done');
    expect(outcomeOf({ done: 0, total: 1 })).toBe('tried');
  });
});

describe('nextPosition', () => {
  it('기본 활동을 해내면 같은 짝의 도전 활동', () => {
    expect(nextPosition(2, { index: 0, role: 'basic' }, 'done')).toEqual({ index: 0, role: 'challenge' });
  });
  it('기본 활동을 해내지 못하거나 건너뛰면 다음 짝', () => {
    expect(nextPosition(2, { index: 0, role: 'basic' }, 'tried')).toEqual({ index: 1, role: 'basic' });
    expect(nextPosition(2, { index: 0, role: 'basic' }, 'skipped')).toEqual({ index: 1, role: 'basic' });
  });
  it('도전 활동이 끝나면 다음 짝, 더 없으면 null', () => {
    expect(nextPosition(2, { index: 0, role: 'challenge' }, 'tried')).toEqual({ index: 1, role: 'basic' });
    expect(nextPosition(1, { index: 0, role: 'challenge' }, 'done')).toBeNull();
    expect(nextPosition(1, { index: 0, role: 'basic' }, 'tried')).toBeNull();
  });
});

describe('recommendFor (숫자 기억 짝)', () => {
  it('기본·도전 모두 해냄 → 어려움, 2단계', () => {
    expect(recommendFor(memory, { basic: 'done', challenge: 'done' })).toEqual({ basic: 'hard', challenge: 2 });
  });
  it('기본만 해냄 (도전은 해내지 못함·넘어감) → 보통, 1단계', () => {
    expect(recommendFor(memory, { basic: 'done', challenge: 'tried' })).toEqual({ basic: 'normal', challenge: 1 });
    expect(recommendFor(memory, { basic: 'done', challenge: 'skipped' })).toEqual({ basic: 'normal', challenge: 1 });
  });
  it('기본을 해내지 못함 → 쉬움, 1단계', () => {
    expect(recommendFor(memory, { basic: 'tried' })).toEqual({ basic: 'easy', challenge: 1 });
  });
  it('기본을 건너뛰었거나 하지 않았으면 null (지금 설정 그대로)', () => {
    expect(recommendFor(memory, { basic: 'skipped' })).toBeNull();
    expect(recommendFor(memory, undefined)).toBeNull();
  });
});

describe('기록 표시', () => {
  it('tagFindStart 는 detail 을 지키고 findStart 를 붙인다', () => {
    const rec = tagFindStart({ program: 'step1-memory', detail: { difficulty: 'easy' } }, { id: 'find-1', group: 'memory', role: 'basic' });
    expect(rec.detail).toEqual({ difficulty: 'easy', findStart: { id: 'find-1', group: 'memory', role: 'basic' } });
    expect(findStartOf(rec)).toEqual({ id: 'find-1', group: 'memory', role: 'basic' });
  });
  it('보통 기록은 findStartOf 가 null', () => {
    expect(findStartOf({ program: 'step1-memory', detail: {} })).toBeNull();
    expect(findStartOf(null)).toBeNull();
  });
});

describe('시작 단계 저장·적용', () => {
  it('isLevelFor: 도전 활동은 1·2·3, 기본 활동은 easy·normal·hard', () => {
    expect(isLevelFor('challenge-baseball', 2)).toBe(true);
    expect(isLevelFor('challenge-baseball', 'hard')).toBe(false);
    expect(isLevelFor('step1-memory', 'normal')).toBe(true);
    expect(isLevelFor('step1-memory', 1)).toBe(false);
  });

  it('cleanLevels 는 맞지 않는 값을 버린다', () => {
    expect(cleanLevels({ 'step1-memory': 'normal', 'challenge-baseball': 1, 'step2-rps': 7, 'challenge-count': 'easy' })).toEqual({
      'step1-memory': 'normal',
      'challenge-baseball': 1,
    });
    expect(cleanLevels(null)).toEqual({});
    expect(cleanLevels('x')).toEqual({});
  });

  it('settingsFor: 그분이 정해 둔 활동만 단계를 바꾸고 원래 설정은 그대로', () => {
    const settings = { difficulty: 'easy', speed: 'NORMAL' };
    const levels = { 'step1-memory': 'normal', 'challenge-baseball': 2 };
    expect(settingsFor('step1-memory', settings, levels).difficulty).toBe('normal');
    expect(settingsFor('challenge-baseball', settings, levels).challengeLevel).toBe(2);
    expect(settingsFor('step2-rps', settings, levels).difficulty).toBe('easy');
    expect(settings.difficulty).toBe('easy');
  });

  it('settingsFor: 손님·하나만 해 보기(단계 없음)는 홈 설정 그대로', () => {
    expect(settingsFor('step1-memory', { difficulty: 'hard' }).difficulty).toBe('hard');
    expect(settingsFor('challenge-baseball', { difficulty: 'hard' }, {}).challengeLevel).toBeUndefined();
  });
});
