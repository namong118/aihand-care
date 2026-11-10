// STEP 3 말소리: 브라우저 음성 합성(speechSynthesis)으로 문제·결과 문구를 읽어 준다.
// 지원하지 않는 브라우저에서는 아무것도 하지 않는다. 화면 글자는 그대로 보여 주므로 소리는 보조 수단이다.
// 문제의 글자 뜻(예: "파랑")은 읽지 않는다. 읽어 주면 글자 색을 고르는 과제가 달라진다.

function synth() {
  return typeof window !== 'undefined' && window.speechSynthesis ? window.speechSynthesis : null;
}

export function speak(text) {
  const s = synth();
  if (!s || !text || typeof SpeechSynthesisUtterance === 'undefined') return;
  s.cancel();
  const u = new SpeechSynthesisUtterance(text);
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
