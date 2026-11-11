import { describe, it, expect } from 'vitest';
import { landmarksToCode, createCodeStabilizer } from './fingers.js';

// 테스트용 가짜 손: 손목이 원점, 손가락은 +y 방향 (단위 m, worldLandmarks 와 비슷한 크기)
// open: [엄지, 검지, 중지, 약지, 새끼] 펴짐 여부
function makeHand(open) {
  const lm = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
  lm[0] = { x: 0, y: 0, z: 0 }; // 손목

  // 엄지 1~4
  lm[1] = { x: -0.03, y: 0.02, z: 0 };
  lm[2] = { x: -0.05, y: 0.04, z: 0 };
  if (open[0]) {
    lm[3] = { x: -0.07, y: 0.06, z: 0 };
    lm[4] = { x: -0.09, y: 0.08, z: 0 };
  } else {
    // 손바닥을 가로질러 새끼 쪽으로 접힘
    lm[3] = { x: -0.03, y: 0.05, z: 0.02 };
    lm[4] = { x: 0.0, y: 0.07, z: 0.03 };
  }

  // 검지~새끼: 뿌리(MCP), 가운데 마디(PIP), DIP, 끝(TIP)
  const xs = [-0.025, 0, 0.025, 0.045];
  const bases = [5, 9, 13, 17];
  bases.forEach((b, i) => {
    const x = xs[i];
    lm[b] = { x, y: 0.085, z: 0 };
    if (open[i + 1]) {
      lm[b + 1] = { x, y: 0.115, z: 0 };
      lm[b + 2] = { x, y: 0.135, z: 0 };
      lm[b + 3] = { x, y: 0.155, z: 0 };
    } else {
      // 손바닥 쪽으로 말려 들어감: 끝이 가운데 마디보다 손목에 가깝다
      lm[b + 1] = { x, y: 0.1, z: 0.025 };
      lm[b + 2] = { x, y: 0.08, z: 0.04 };
      lm[b + 3] = { x, y: 0.065, z: 0.03 };
    }
  });
  return lm;
}

const bits = (code) => code.split('').map((c) => c === '1');

describe('landmarksToCode', () => {
  it.each([
    ['ROCK', '00000'],
    ['PAPER', '11111'],
    ['V', '01100'],
    ['INDEX', '01000'],
    ['THREE', '01110'],
    ['FOUR', '01111'],
    ['THUMB', '10000'],
  ])('%s 손모양을 %s 로 바꾼다', (_name, code) => {
    expect(landmarksToCode(makeHand(bits(code)))).toBe(code);
  });

  it('손이 기울어져도 같은 code (y·z 축 회전)', () => {
    const tilt = (p) => ({ x: p.x, y: p.y * Math.cos(1) - p.z * Math.sin(1), z: p.y * Math.sin(1) + p.z * Math.cos(1) });
    expect(landmarksToCode(makeHand(bits('01100')).map(tilt))).toBe('01100');
  });

  it('랜드마크가 21개보다 적거나 없으면 null', () => {
    expect(landmarksToCode([])).toBeNull();
    expect(landmarksToCode(undefined)).toBeNull();
  });
});

describe('createCodeStabilizer', () => {
  it('새 code 가 3번 연속 나와야 바뀌고, 처음 나온 시각부터 센다', () => {
    const s = createCodeStabilizer({ frames: 3 });
    expect(s.update('00000', 0)).toEqual({ code: null, since: 0 });
    s.update('00000', 33);
    expect(s.update('00000', 66)).toEqual({ code: '00000', since: 0 });
  });

  it('한 프레임만 튄 값은 무시한다', () => {
    const s = createCodeStabilizer({ frames: 3 });
    [0, 33, 66].forEach((t) => s.update('01100', t));
    s.update('01000', 100); // 튐
    expect(s.update('01100', 133)).toEqual({ code: '01100', since: 0 });
  });

  it('손이 잠깐(1~2 프레임) 안 보여도 유지, 계속 안 보이면 null', () => {
    const s = createCodeStabilizer({ frames: 3 });
    [0, 33, 66].forEach((t) => s.update('11111', t));
    s.update(null, 100);
    expect(s.update('11111', 133).code).toBe('11111');
    s.update(null, 166);
    s.update(null, 200);
    expect(s.update(null, 233)).toEqual({ code: null, since: 166 });
  });

  it('frames 1 이면 바로 바뀐다', () => {
    const s = createCodeStabilizer({ frames: 1 });
    expect(s.update('10000', 5)).toEqual({ code: '10000', since: 5 });
  });
});
