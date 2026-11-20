import { describe, expect, it } from 'vitest';
import { CATALOG, CHALLENGES, challengeFor, findProgramInfo } from './catalog.js';

describe('도전 활동 짝', () => {
  it('기본 활동마다 짝 도전 활동이 하나씩 있다', () => {
    for (const p of CATALOG) {
      const c = challengeFor(p.id);
      expect(c, p.id).not.toBeNull();
      expect(c.step).toBe(p.step); // 짝 기본 활동과 같은 색
    }
    expect(CHALLENGES).toHaveLength(CATALOG.length);
  });

  it('도전 활동의 짝은 모두 기본 활동이고 서로 겹치지 않는다', () => {
    const pairs = CHALLENGES.map((c) => c.pair);
    expect(new Set(pairs).size).toBe(pairs.length);
    for (const pair of pairs) expect(CATALOG.some((p) => p.id === pair)).toBe(true);
  });

  it('id 가 기본 활동과 겹치지 않고 challenge- 로 시작한다', () => {
    const ids = [...CATALOG, ...CHALLENGES].map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CHALLENGES) expect(c.id.startsWith('challenge-')).toBe(true);
  });

  it('findProgramInfo 는 도전 활동도 찾는다', () => {
    expect(findProgramInfo('challenge-shuffle')?.title).toBe('카드 섞기');
    expect(findProgramInfo('step3-stroop')?.title).toBe('색깔손');
    expect(findProgramInfo('없는-id')).toBeNull();
  });

  it('짝이 없는 id 면 null', () => {
    expect(challengeFor('challenge-shuffle')).toBeNull();
    expect(challengeFor(undefined)).toBeNull();
  });
});
