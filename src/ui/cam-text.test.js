import { describe, it, expect } from 'vitest';
import { poseSeenText } from './cam-text.js';

describe('poseSeenText (내 손 캠 화면 글자)', () => {
  it('손이 없으면 "손이 안 보여요"', () => {
    expect(poseSeenText(null)).toBe('손이 안 보여요');
    expect(poseSeenText({ code: null, name: null })).toBe('손이 안 보여요');
  });
  it('아는 손모양이면 poses.json 이름', () => {
    expect(poseSeenText({ code: '11111', name: 'PAPER' })).toBe('지금 손: 손바닥(보)');
    expect(poseSeenText({ code: '00000', name: 'ROCK' })).toBe('지금 손: 주먹(바위)');
  });
  it('모르는 모양이면 손은 보인다고만', () => {
    expect(poseSeenText({ code: '10101', name: null })).toBe('손이 보여요 (모양을 알아보는 중)');
  });
});
