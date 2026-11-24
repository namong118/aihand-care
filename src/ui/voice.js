// 음성 안내 (STEP 1~4 공통, #61). 프로그램은 speak(문구)·stopSpeaking() 만 쓴다.
//
// 1) 미리 만든 음성 파일(public/voice/*.wav)이 있으면 그것을 재생한다.
//    라즈베리파이 Chromium 에는 한국어 음성이 없어서 브라우저 음성(speechSynthesis)이 소리 없이 넘어간다 (docs/hardware-check.md 5번).
//    파일은 Windows 한국어 음성(Heami)으로 만든다: npm run voice (docs/voice.md)
// 2) 문구의 문장 중 하나라도 파일이 없으면 브라우저 음성으로 읽는다 (Windows Chrome 은 Heami 로 들린다).
//    개발 중에는 콘솔에 "음성 파일 없음"을 알린다 → npm run voice 를 다시 실행하면 된다.
//
// 음성은 화면 글자를 대신하지 않는다. 같은 문구를 화면에도 보여 준다.

import manifest from '../data/voice.json';
import { splitSentences } from './voice-text.js';

const BASE = `${import.meta.env.BASE_URL}voice/`;

let token = 0; // 새 문구를 말하거나 멈추면 하나 늘린다. 이전 문구의 남은 문장은 이어서 재생하지 않는다
let current = null; // 지금 재생 중인 Audio

function synth() {
  return typeof window !== 'undefined' && window.speechSynthesis ? window.speechSynthesis : null;
}

/** 파일들을 차례로 재생한다. 하나가 끝나거나 실패하면 다음 파일 */
function playFiles(files) {
  const my = token;
  let i = 0;
  const next = () => {
    if (my !== token || i >= files.length) return;
    const audio = new Audio(BASE + files[i++]);
    current = audio;
    audio.onended = next;
    audio.onerror = next;
    // 화면을 한 번도 누르기 전이면 브라우저가 자동 재생을 막을 수 있다 (키오스크는 허용해 둠, scripts/kiosk.sh)
    audio.play().catch(() => {});
  };
  next();
}

/** 브라우저 음성으로 읽기. 한국어 음성이 없으면 소리 없이 넘어간다 */
function speakSynth(text) {
  const s = synth();
  if (!s || typeof SpeechSynthesisUtterance === 'undefined') return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ko-KR';
  u.rate = 0.95; // 어르신이 알아듣기 쉽게 조금 천천히
  const ko = s.getVoices().find((v) => (v.lang || '').toLowerCase().startsWith('ko'));
  if (ko) u.voice = ko;
  s.speak(u);
}

/** 문구 읽기. 말하던 것은 멈추고 새 문구를 읽는다 */
export function speak(text) {
  stopSpeaking();
  const sentences = splitSentences(text);
  if (sentences.length === 0) return;
  const files = sentences.map((s) => manifest.files[s]);
  if (files.every(Boolean)) {
    playFiles(files);
    return;
  }
  if (import.meta.env.DEV) {
    console.warn('[음성] 음성 파일 없음 → npm run voice 로 다시 만들어 주세요:', sentences.filter((_, i) => !files[i]));
  }
  speakSynth(sentences.join(' '));
}

/** 말하던 것 멈추기 (화면을 닫을 때 부른다) */
export function stopSpeaking() {
  token++;
  if (current) {
    current.onended = null;
    current.onerror = null;
    current.pause();
    current = null;
  }
  synth()?.cancel();
}
