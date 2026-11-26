import { describe, it, expect } from 'vitest';
import {
  LEVELS,
  levelSpec,
  gameSpec,
  FIND_START_GAME,
  defaultLevel,
  countPose,
  poseCount,
  posesFor,
  isLosingSpot,
  makeGame,
  allowedCounts,
  countFrom,
  goodSpots,
  josa,
  robotCount,
  summarizeGame,
} from './logic.js';

/** 차례대로 값을 돌려주는 rand */
const seq = (...values) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('단계', () => {
  it('1·2·3단계가 있고 그 밖의 값은 1단계', () => {
    expect(Object.keys(LEVELS)).toEqual(['1', '2', '3']);
    expect(defaultLevel(2)).toBe(2);
    expect(defaultLevel('2')).toBe(1);
    expect(defaultLevel(undefined)).toBe(1);
    expect(levelSpec(9)).toBe(LEVELS[1]);
  });

  it('단계가 오를수록 로봇이 이기는 수를 더 자주 고른다', () => {
    expect(LEVELS[1].smart).toBeLessThan(LEVELS[2].smart);
    expect(LEVELS[2].smart).toBeLessThan(LEVELS[3].smart);
  });

  it('한 번에 셀 수 있는 개수는 손가락 손모양이 있는 1~4 안', () => {
    for (const { steps } of Object.values(LEVELS)) {
      for (const s of steps) expect(posesFor(s).every(Boolean)).toBe(true);
    }
  });
});

describe('나의 시작 찾기 짧은 판 (gameSpec)', () => {
  it('평소에는 그 단계 값', () => {
    expect(gameSpec(2)).toEqual(levelSpec(2));
  });
  it('나의 시작 찾기면 1단계 규칙에 끝 숫자만 10~13', () => {
    const spec = gameSpec(3, true);
    expect(spec).toEqual({ ...LEVELS[1], ends: [10, 13] });
    expect(FIND_START_GAME.level).toBe(1);
  });
  it('짧은 판도 먼저 하는 사용자가 이길 수 있는 끝 숫자만', () => {
    for (let i = 0; i < 30; i++) {
      const { end, maxStep } = makeGame(1, Math.random, gameSpec(1, true));
      expect(end).toBeGreaterThanOrEqual(10);
      expect(end).toBeLessThanOrEqual(13);
      expect(isLosingSpot(0, end, maxStep)).toBe(false);
    }
  });
});

describe('손모양', () => {
  it('개수 ↔ 손모양', () => {
    expect([1, 2, 3, 4].map(countPose)).toEqual(['INDEX', 'V', 'THREE', 'FOUR']);
    expect(countPose(5)).toBeNull();
    expect(poseCount('V')).toBe(2);
    expect(poseCount('ROCK')).toBeNull();
    expect(posesFor(3)).toEqual(['INDEX', 'V', 'THREE']);
  });
});

describe('판 만들기', () => {
  it('처음 자리가 지는 자리인 판은 만들지 않는다 (먼저 하는 사용자가 이길 수 있게)', () => {
    for (const level of [1, 2, 3]) {
      for (let r = 0; r < 1; r += 0.01) {
        const { end, maxStep } = makeGame(level, () => r);
        const { ends, steps } = LEVELS[level];
        expect(end).toBeGreaterThanOrEqual(ends[0]);
        expect(end).toBeLessThanOrEqual(ends[1]);
        expect(steps).toContain(maxStep);
        expect(isLosingSpot(0, end, maxStep)).toBe(false);
      }
    }
  });

  it('지는 자리: 끝 21, 3개씩이면 20을 센 쪽 다음 차례 → 남은 수가 4의 배수', () => {
    expect(isLosingSpot(20, 21, 3)).toBe(true); // 21만 남음
    expect(isLosingSpot(16, 21, 3)).toBe(true);
    expect(isLosingSpot(17, 21, 3)).toBe(false);
    expect(isLosingSpot(0, 21, 3)).toBe(true);
  });
});

describe('세기', () => {
  it('끝 숫자를 넘지 않는 개수만', () => {
    expect(allowedCounts(0, 21, 3)).toEqual([1, 2, 3]);
    expect(allowedCounts(19, 21, 3)).toEqual([1, 2]);
    expect(allowedCounts(20, 21, 3)).toEqual([1]);
  });

  it('now 다음부터 센다', () => {
    expect(countFrom(7, 3)).toEqual([8, 9, 10]);
  });
});

describe('도움말', () => {
  it('끝 숫자 바로 앞부터 (maxStep + 1)씩 거꾸로', () => {
    expect(goodSpots(20, 3)).toEqual([3, 7, 11, 15, 19]);
    expect(goodSpots(23, 4)).toEqual([2, 7, 12, 17, 22]);
    for (const n of goodSpots(25, 2)) expect(isLosingSpot(n, 25, 2)).toBe(true);
  });
});

describe('로봇', () => {
  it('smart 1 이면 상대를 지는 자리에 둔다', () => {
    for (let now = 0; now < 20; now++) {
      const n = robotCount(now, 21, 3, 1, () => 0.5);
      if (!isLosingSpot(now, 21, 3)) expect(isLosingSpot(now + n, 21, 3)).toBe(true);
    }
  });

  it('지는 자리에서도 끝 숫자는 피할 수 있으면 피한다', () => {
    // now 16, 끝 21, 3개씩: 이기는 수 없음. 17~19 중 아무거나
    for (const r of [0, 0.5, 0.99]) {
      const n = robotCount(16, 21, 3, 1, () => r);
      expect(16 + n).toBeLessThan(21);
    }
  });

  it('20까지 왔으면 21을 셀 수밖에 없다', () => {
    expect(robotCount(20, 21, 3, 1, () => 0)).toBe(1);
  });

  it('smart 0 이면 아무 수나 (끝 숫자는 피함)', () => {
    expect(robotCount(1, 21, 3, 0, seq(0.5, 0))).toBe(1);
    expect(robotCount(18, 21, 3, 0, seq(0.5, 0.99))).toBe(2); // 19, 20 까지만
  });

  it('smart 확률보다 rand 가 크면 이기는 수를 고르지 않을 수 있다', () => {
    // now 1, 끝 21, 3개씩: 이기는 수 = 3. rand 0.9 > smart 0.3 → 아무 수 (두 번째 rand 0 → 1개)
    expect(robotCount(1, 21, 3, 0.3, seq(0.9, 0))).toBe(1);
    expect(robotCount(1, 21, 3, 0.3, seq(0.1))).toBe(3);
  });
});

describe('조사', () => {
  it('끝 받침에 맞춰 을/를, 은/는', () => {
    expect([20, 21, 22, 23, 24, 25, 16, 17, 18, 19].map((n) => josa(n, '을', '를'))).toEqual(['을', '을', '를', '을', '를', '를', '을', '을', '을', '를']);
    expect(josa(15, '은', '는')).toBe('는');
  });
});

describe('기록 요약', () => {
  it('사용자가 끝 숫자를 피하면 done 1', () => {
    const turns = [
      { who: 'me', count: 2, reactionMs: 2000 },
      { who: 'robot', count: 3 },
      { who: 'me', count: 1, reactionMs: 4000 },
    ];
    expect(summarizeGame({ winner: 'me', stopped: false, turns })).toEqual({ total: 1, done: 1, skipped: 0, avgReactionMs: 3000 });
    expect(summarizeGame({ winner: 'robot', stopped: false, turns }).done).toBe(0);
  });

  it('그만하면 skipped 1, 낸 것이 없으면 반응 시간 null', () => {
    expect(summarizeGame({ winner: null, stopped: true, turns: [] })).toEqual({ total: 1, done: 0, skipped: 1, avgReactionMs: null });
  });
});
