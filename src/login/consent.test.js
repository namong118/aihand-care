import { describe, it, expect } from 'vitest';
import { FACE_CONSENT, RECORD_NOTICE } from './consent.js';

const allText = (o) => Object.values(o).flat().join(' ');

// docs/research/evidence.md 6번 "쓰면 안 되는 표현"
const FORBIDDEN = ['예방', '치료', '향상', '효과', '개선', '진단'];
// 팀 원칙: 맞고 틀림·점수 대신 "완료 수" (CLAUDE.md 웹 대시보드, #88 리뷰)
const SCORE_WORDS = ['맞힌', '정답', '점수'];

describe('동의 화면 문구', () => {
  it('쓰면 안 되는 표현이 없다', () => {
    for (const o of [FACE_CONSENT, RECORD_NOTICE]) {
      for (const word of FORBIDDEN) expect(allText(o)).not.toContain(word);
      for (const word of SCORE_WORDS) expect(allText(o)).not.toContain(word);
    }
  });

  it('활동 기록 안내에서 등록하지 않을 수 있다', () => {
    expect(RECORD_NOTICE.decline).toBeTruthy();
  });

  it('동의하지 않아도 버튼으로 이용할 수 있다고 알린다', () => {
    expect(FACE_CONSENT.lines.some((l) => l.includes('버튼'))).toBe(true);
    expect(FACE_CONSENT.disagree).toContain('버튼');
  });

  it('얼굴은 카메라 안에만, 사진은 남기지 않는다고 알린다', () => {
    const text = allText(FACE_CONSENT);
    expect(text).toContain('카메라');
    expect(text).toContain('사진은 남기지 않아요');
  });

  it('지우는 방법을 알린다 (설정의 사용자 지우기, 얼굴은 카메라에서 따로)', () => {
    const text = allText(FACE_CONSENT);
    expect(text).toContain('사용자 지우기');
    expect(text).toContain('얼굴은 이용하시는 곳에서');
  });

  it('실명을 묻지 않는다', () => {
    expect(allText(FACE_CONSENT)).not.toMatch(/실명|성함|이름을/);
  });
});
