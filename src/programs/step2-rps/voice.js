// STEP 2 말소리: 브라우저 음성 합성(speechSynthesis)으로 "가위, 바위, 보!"와 안내 문구를 읽어 준다.
// 지원하지 않는 브라우저에서는 아무것도 하지 않는다. 화면 글자는 그대로 보여 주므로 소리는 보조 수단이다.
// (STEP 3 voice.js 와 같은 방식. 다른 프로그램 폴더를 import 하지 않으려고 따로 둔다)

function synth() {
  return typeof window !== 'undefined' && window.speechSynthesis ? window.speechSynthesis : null;
}

// 그림 글자(✊ ✋ ✌️)는 읽으면 "주먹 쥔 손" 같은 영어·설명이 나올 수 있어서 빼고 읽는다
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu;

export function speak(text) {
  const s = synth();
  if (!s || !text || typeof SpeechSynthesisUtterance === 'undefined') return;
  s.cancel();
  const u = new SpeechSynthesisUtterance(String(text).replace(EMOJI, '').replace(/\s+/g, ' ').trim());
  u.lang = 'ko-KR';
  u.rate = 0.95; // 어르신이 알아듣기 쉽게 조금 천천히
  const ko = s.getVoices().find((v) => (v.lang || '').toLowerCase().startsWith('ko'));
  if (ko) u.voice = ko;
  s.speak(u);
}

export function stopSpeaking() {
  const s = synth();
  if (s) s.cancel();
}
