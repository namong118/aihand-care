// 음성 파일이 문구와 맞는지 확인한다 (#61).
// 이 테스트가 실패하면: 프로그램 문구를 고친 뒤 음성 파일을 다시 만들지 않은 것이다 → npm run voice (Windows)
import { existsSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import manifest from '../data/voice.json';
import { allVoiceLines } from '../programs/voice-lines.js';
import { splitSentences, uniqueSentences } from './voice-text.js';

const byProgram = allVoiceLines();

describe('음성 파일', () => {
  for (const [id, lines] of Object.entries(byProgram)) {
    it(`${id}: 읽을 문장마다 음성 파일이 있다 (없으면 npm run voice)`, () => {
      const missing = lines.flatMap(splitSentences).filter((s) => !manifest.files[s]);
      expect(missing).toEqual([]);
    });
  }

  it('표에 적힌 파일이 public/voice 에 있다', () => {
    const missing = Object.values(manifest.files).filter((f) => !existsSync(new URL(`../../public/voice/${f}`, import.meta.url)));
    expect(missing).toEqual([]);
  });

  it('표에 쓰지 않는 문장이 남아 있지 않다 (npm run voice 가 정리한다)', () => {
    const used = new Set(uniqueSentences(Object.values(byProgram).flat()));
    expect(Object.keys(manifest.files).filter((s) => !used.has(s))).toEqual([]);
  });
});
