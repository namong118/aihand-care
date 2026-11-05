import { describe, it, expect } from 'vitest';
import { expandRoutine, isStepDone, summarizeSteps } from './logic.js';
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

describe('isStepDone', () => {
  const step = { pose: 'ROCK', holdMs: 1000 };
  const opts = { now: 10_000, sinceMs: 8_000 };
  it('같은 손모양을 holdMs 이상 유지하면 완료', () => {
    expect(isStepDone({ name: 'ROCK', stableMs: 1_200 }, step, opts)).toBe(true);
  });
  it('다른 손모양이거나 짧으면 아직', () => {
    expect(isStepDone({ name: 'PAPER', stableMs: 1_500 }, step, opts)).toBe(false);
    expect(isStepDone({ name: 'ROCK', stableMs: 500 }, step, opts)).toBe(false);
    expect(isStepDone({ name: null, stableMs: 0 }, step, opts)).toBe(false);
  });
  it('동작 시작 전부터 들고 있던 손은 인정하지 않는다', () => {
    expect(isStepDone({ name: 'ROCK', stableMs: 3_000 }, step, opts)).toBe(false);
  });
});

describe('summarizeSteps', () => {
  it('완료·건너뜀을 세고 완료한 동작만 평균', () => {
    expect(
      summarizeSteps([
        { status: 'done', reactionMs: 1000 },
        { status: 'skipped', reactionMs: null },
        { status: 'done', reactionMs: 2000 },
      ]),
    ).toEqual({ total: 3, done: 2, skipped: 1, avgReactionMs: 1500 });
  });
  it('모두 건너뛰면 평균은 null', () => {
    expect(summarizeSteps([{ status: 'skipped' }]).avgReactionMs).toBe(null);
  });
});
