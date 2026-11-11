import { describe, it, expect } from 'vitest';
import { fingersUp, landmarksToCode, createCodeSmoother, flipHandedness, thumbOut, THRESHOLDS } from './fingers.js';
import poses from '../../data/poses.json';

// 시험용 손 만들기: 손바닥이 카메라를 보고 손가락이 위(+y)를 향한 오른손.
// 손바닥 길이(손목~중지 뿌리) = 1. 접은 손가락은 손바닥 쪽(-z)으로 말린다.
const P = (x, y, z = 0) => ({ x, y, z });
const add = (a, dx, dy, dz = 0) => P(a.x + dx, a.y + dy, a.z + dz);

const MCP = [P(-0.3, 0.95), P(0, 1), P(0.25, 0.95), P(0.45, 0.85)]; // 검지·중지·약지·새끼 뿌리

function finger(mcp, up) {
  if (up) return [mcp, add(mcp, 0, 0.45), add(mcp, 0, 0.73), add(mcp, 0, 0.95)];
  return [mcp, add(mcp, 0, 0.1, -0.4), add(mcp, 0, -0.15, -0.45), add(mcp, 0, -0.3, -0.3)];
}

function thumb(up) {
  const cmc = P(-0.25, 0.2);
  if (up) return [cmc, P(-0.5, 0.35), P(-0.75, 0.55), P(-0.95, 0.75)];
  return [cmc, P(-0.35, 0.35, -0.1), P(-0.2, 0.5, -0.25), P(0.05, 0.5, -0.3)];
}

/** code('01100') 모양의 랜드마크 21개 */
function makeHand(code) {
  const up = code.split('').map((c) => c === '1');
  return [P(0, 0), ...thumb(up[0]), ...MCP.flatMap((m, i) => finger(m, up[i + 1]))];
}

/** 모든 점을 z 축으로 돌린다 (손을 기울인 경우) */
function rotate(lm, deg) {
  const r = (deg * Math.PI) / 180;
  return lm.map(({ x, y, z }) => P(x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r), z));
}

describe('landmarksToCode', () => {
  it.each(poses.map((p) => [p.name, p.code]))('%s (%s) 를 맞게 판정한다', (_name, code) => {
    expect(landmarksToCode(makeHand(code))).toBe(code);
  });

  it('손을 옆으로 기울여도 같은 code', () => {
    for (const p of poses) {
      expect(landmarksToCode(rotate(makeHand(p.code), 60))).toBe(p.code);
      expect(landmarksToCode(rotate(makeHand(p.code), -45))).toBe(p.code);
    }
  });

  it('손 크기가 달라도 같은 code', () => {
    const small = makeHand('01100').map(({ x, y, z }) => P(x * 0.07, y * 0.07, z * 0.07));
    expect(landmarksToCode(small)).toBe('01100');
  });

  it('손이 없으면 null', () => {
    expect(landmarksToCode(null)).toBe(null);
    expect(landmarksToCode(undefined)).toBe(null);
  });

  it('랜드마크가 모자라면 오류', () => {
    expect(() => fingersUp([P(0, 0)])).toThrow();
  });
});

describe('thumbOut', () => {
  it('펴진 엄지는 기준보다 크고, 접은 엄지는 작다', () => {
    expect(thumbOut(makeHand('11111'))).toBeGreaterThan(THRESHOLDS.thumbOut);
    expect(thumbOut(makeHand('10000'))).toBeGreaterThan(THRESHOLDS.thumbOut);
    expect(thumbOut(makeHand('01111'))).toBeLessThan(THRESHOLDS.thumbOut);
    expect(thumbOut(makeHand('00000'))).toBeLessThan(THRESHOLDS.thumbOut);
  });

  it('실물 측정값으로 본 기준: 펴짐 1.15·1.29, 접힘 0.99·0.95 를 가른다', () => {
    for (const v of [1.15, 1.29]) expect(v).toBeGreaterThan(THRESHOLDS.thumbOut);
    for (const v of [0.99, 0.95]) expect(v).toBeLessThan(THRESHOLDS.thumbOut);
  });
});

describe('createCodeSmoother', () => {
  it('같은 code 가 2번 연속 나와야 바뀐다', () => {
    const push = createCodeSmoother(2);
    expect(push('00000')).toBe(null);
    expect(push('00000')).toBe('00000');
    expect(push('01100')).toBe('00000'); // 한 번 튄 것은 무시
    expect(push('00000')).toBe('00000');
    expect(push('01100')).toBe('00000');
    expect(push('01100')).toBe('01100');
  });

  it('손이 사라진 것(null)도 2번 연속이어야 반영', () => {
    const push = createCodeSmoother(2);
    push('11111');
    push('11111');
    expect(push(null)).toBe('11111');
    expect(push(null)).toBe(null);
  });

  it('frames = 1 이면 바로 바뀐다', () => {
    const push = createCodeSmoother(1);
    expect(push('10000')).toBe('10000');
    expect(push(null)).toBe(null);
  });
});

describe('flipHandedness', () => {
  it('왼손·오른손을 바꾼다', () => {
    expect(flipHandedness('Left')).toBe('Right');
    expect(flipHandedness('Right')).toBe('Left');
    expect(flipHandedness(undefined)).toBe(null);
  });
});
