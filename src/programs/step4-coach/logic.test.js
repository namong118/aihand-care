import { describe, it, expect } from 'vitest';
import { expandRoutine, holdProgress, summarizeSteps } from './logic.js';
import routines from '../../data/routines.json';
import poses from '../../data/poses.json';

describe('routines.json', () => {
  it('기본 루틴이 있고, 손모양은 poses.json 에 있는 이름', () => {
    expect(routines.length).toBeGreaterThanOrEqual(1);
    const names = poses.map((p) => p.name);
    for (const r of routines) {
      for (const s of r.steps) expect(names).toContain(s.pose);
    }
  });
});

describe('expandRoutine', () => {
  it('repeat 만큼 반복해서 펼친다', () => {
    const list = expandRoutine({
      repeat: 2,
      steps: [{ pose: 'ROCK' }, { pose: 'PAPER' }],
    });
    expect(list.map((s) => s.pose)).toEqual(['ROCK', 'PAPER', 'ROCK', 'PAPER']);
    expect(list.map((s) => s.round)).toEqual([1, 1, 2, 2]);
  });
  it('repeat 가 없으면 1번', () => {
    expect(expandRoutine({ steps: [{ pose: 'ROCK' }] })).toHaveLength(1);
  });
});

describe('holdProgress', () => {
  const step = { pose: 'ROCK', holdMs: 1000 };
  it('같은 손모양이면 유지 비율', () => {
    expect(holdProgress({ name: 'ROCK', stableMs: 500 }, step)).toBe(0.5);
    expect(holdProgress({ name: 'ROCK', stableMs: 3000 }, step)).toBe(1);
  });
  it('다른 손모양이거나 손이 없으면 0', () => {
    expect(holdProgress({ name: 'PAPER', stableMs: 900 }, step)).toBe(0);
    expect(holdProgress({ name: null, stableMs: 0 }, step)).toBe(0);
  });
});

describe('summarizeSteps', () => {
  it('완료 방식별로 세고, 따라 한 동작만 평균', () => {
    expect(
      summarizeSteps([
        { method: 'detected', reactionMs: 1000 },
        { method: 'skipped', reactionMs: null },
        { method: 'manual', reactionMs: 2000 },
        { method: 'detected', reactionMs: 3000 },
      ]),
    ).toEqual({
      total: 4,
      done: 3,
      skipped: 1,
      avgReactionMs: 2000,
      methods: { detected: 2, manual: 1, skipped: 1 },
    });
  });
  it('모두 건너뛰면 평균은 null', () => {
    expect(summarizeSteps([{ method: 'skipped' }]).avgReactionMs).toBe(null);
  });
  it('모르는 방식이면 에러', () => {
    expect(() => summarizeSteps([{ method: 'done' }])).toThrow();
  });
});
