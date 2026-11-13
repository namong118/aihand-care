import { describe, it, expect } from 'vitest';
import {
  expandRoutine,
  holdMsOf,
  holdProgress,
  holdCount,
  countWord,
  restMs,
  summarizeSteps,
  DEFAULT_HOLD_MS,
  REST_MS,
} from './logic.js';
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
  // 팀 결정 (2026-11-12): repeat 이 0 이하이거나 비어 있어도 멈추지 않고 1번 한다
  it.each([0, -1, null])('repeat 가 %s 이면 1번', (repeat) => {
    const list = expandRoutine({ repeat, steps: [{ pose: 'ROCK' }, { pose: 'PAPER' }] });
    expect(list.map((s) => s.pose)).toEqual(['ROCK', 'PAPER']);
    expect(list.map((s) => s.round)).toEqual([1, 1]);
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
    expect(holdProgress(null, step)).toBe(0);
  });
  it('holdMs 가 없으면 기본 1초 기준', () => {
    expect(holdProgress({ name: 'ROCK', stableMs: 500 }, { pose: 'ROCK' })).toBe(0.5);
  });
  it('holdMs 가 0 이면 NaN 이 아니라 1 (바로 다 참)', () => {
    expect(holdProgress({ name: 'ROCK', stableMs: 0 }, { pose: 'ROCK', holdMs: 0 })).toBe(1);
  });
});

describe('holdMsOf', () => {
  it('루틴 값이 있으면 그 값, 없으면 기본값', () => {
    expect(holdMsOf({ holdMs: 3000 })).toBe(3000);
    expect(holdMsOf({})).toBe(DEFAULT_HOLD_MS);
  });
});

describe('restMs', () => {
  it('보통 속도는 REST_MS, 느리게는 2배', () => {
    expect(restMs('NORMAL')).toBe(REST_MS);
    expect(restMs('SLOW')).toBe(REST_MS * 2);
  });
  it('속도 값이 없으면 보통 속도', () => {
    expect(restMs(undefined)).toBe(REST_MS);
  });
});

describe('holdCount (유지하는 동안 1초에 하나씩)', () => {
  const step3s = { pose: 'ROCK', holdMs: 3000 };
  it('3초 유지면 하나 → 둘 → 셋', () => {
    expect(holdCount({ name: 'ROCK', stableMs: 0 }, step3s)).toBe(1);
    expect(holdCount({ name: 'ROCK', stableMs: 999 }, step3s)).toBe(1);
    expect(holdCount({ name: 'ROCK', stableMs: 1000 }, step3s)).toBe(2);
    expect(holdCount({ name: 'ROCK', stableMs: 2500 }, step3s)).toBe(3);
  });
  it('유지 시간을 넘겨도 마지막 숫자에서 멈춘다', () => {
    expect(holdCount({ name: 'ROCK', stableMs: 9000 }, step3s)).toBe(3);
  });
  it('지금 값(1초)이면 하나까지만', () => {
    expect(holdCount({ name: 'ROCK', stableMs: 800 }, { pose: 'ROCK', holdMs: 1000 })).toBe(1);
    expect(holdCount({ name: 'ROCK', stableMs: 800 }, { pose: 'ROCK' })).toBe(1);
  });
  it('1.5초처럼 나누어떨어지지 않으면 올림 (둘까지)', () => {
    expect(holdCount({ name: 'ROCK', stableMs: 1400 }, { pose: 'ROCK', holdMs: 1500 })).toBe(2);
  });
  it('holdMs 가 0 이어도 하나', () => {
    expect(holdCount({ name: 'ROCK', stableMs: 0 }, { pose: 'ROCK', holdMs: 0 })).toBe(1);
  });
  it('다른 손모양이거나 손이 없으면 0', () => {
    expect(holdCount({ name: 'PAPER', stableMs: 2000 }, step3s)).toBe(0);
    expect(holdCount({ name: null, stableMs: 0 }, step3s)).toBe(0);
    expect(holdCount(null, step3s)).toBe(0);
  });
});

describe('countWord', () => {
  it('숫자를 우리말로', () => {
    expect([1, 2, 3].map(countWord)).toEqual(['하나', '둘', '셋']);
  });
  it('0 이면 빈 글자 (표시 안 함)', () => {
    expect(countWord(0)).toBe('');
  });
  it('준비한 말보다 크면 숫자 글자', () => {
    expect(countWord(11)).toBe('11');
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
  it('빈 결과면 모두 0, 평균은 null', () => {
    expect(summarizeSteps([])).toEqual({
      total: 0,
      done: 0,
      skipped: 0,
      avgReactionMs: null,
      methods: { detected: 0, manual: 0, skipped: 0 },
    });
  });
  it('모두 건너뛰면 평균은 null', () => {
    expect(summarizeSteps([{ method: 'skipped' }]).avgReactionMs).toBe(null);
  });
  it('모르는 방식이면 에러', () => {
    expect(() => summarizeSteps([{ method: 'done' }])).toThrow();
  });
});
