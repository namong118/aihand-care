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

// 파일마다 Audio 하나를 만들어 두고 다시 쓴다. 매번 새로 만들면 불러오기·풀기 시간만큼 소리가 늦게 난다
// ("가위, 바위, 보!"처럼 박자가 중요한 구호에서 어긋난다)
const audios = new Map();
function audioFor(file) {
  let audio = audios.get(file);
  if (!audio) {
    audio = new Audio(BASE + file);
    audio.preload = 'auto';
    audios.set(file, audio);
  }
  return audio;
}

function synth() {
  return typeof window !== 'undefined' && window.speechSynthesis ? window.speechSynthesis : null;
}

/**
 * 곧 읽을 문구의 음성 파일을 미리 불러 둔다 (박자가 중요한 구호 등).
 * 화면을 열 때 부르면 첫 재생부터 바로 소리가 난다. 파일이 없는 문장은 넘어간다.
 */
export function preloadVoice(...texts) {
  for (const text of texts) {
    for (const s of splitSentences(text)) {
      const file = manifest.files[s];
      if (file) audioFor(file);
    }
  }
}

// 지금 읽는 문구가 끝났다고 알리는 함수 (speak 가 돌려준 Promise 를 끝낸다). 멈추거나 새 문구를 말해도 끝낸다
let finishCurrent = null;

/** 파일들을 차례로 재생한다. 하나가 끝나거나 실패하면 다음 파일. 다 읽으면 done() */
function playFiles(files, done) {
  const my = token;
  let i = 0;
  const next = () => {
    if (my !== token) return;
    if (i >= files.length) {
      done();
      return;
    }
    const audio = audioFor(files[i++]);
    audio.currentTime = 0;
    current = audio;
    audio.onended = next;
    audio.onerror = next;
    // 화면을 한 번도 누르기 전이면 브라우저가 자동 재생을 막을 수 있다 (키오스크는 허용해 둠, scripts/kiosk.sh).
    // 막히면 소리 없이 다음으로 넘어가서, 기다리는 쪽이 멈춰 있지 않게 한다
    audio.play().catch(() => next());
  };
  next();
}

/** 브라우저 음성으로 읽기. 한국어 음성이 없으면 소리 없이 넘어간다. 다 읽으면 done() */
function speakSynth(text, done) {
  const s = synth();
  if (!s || typeof SpeechSynthesisUtterance === 'undefined') {
    done();
    return;
  }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ko-KR';
  u.rate = 0.95; // 어르신이 알아듣기 쉽게 조금 천천히
  const ko = s.getVoices().find((v) => (v.lang || '').toLowerCase().startsWith('ko'));
  if (ko) u.voice = ko;
  u.onend = done;
  u.onerror = done;
  s.speak(u);
}

/**
 * 문구 읽기. 말하던 것은 멈추고 새 문구를 읽는다.
 * 반환: 다 읽었거나, 멈췄거나, 읽을 수 없을 때 끝나는 Promise (실패하지 않는다).
 *   기다리지 않아도 된다. 다음 동작을 음성 뒤로 미루고 싶을 때만 await 한다 (STEP 1 안내 → 로봇)
 *   소리가 막혀 끝 소식이 오지 않을 수도 있으니, 기다릴 때는 최대 시간을 함께 둔다
 */
export function speak(text) {
  stopSpeaking();
  return new Promise((resolve) => {
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      if (finishCurrent === done) finishCurrent = null;
      resolve();
    };
    finishCurrent = done;
    const sentences = splitSentences(text);
    if (sentences.length === 0) {
      done();
      return;
    }
    const files = sentences.map((s) => manifest.files[s]);
    if (files.every(Boolean)) {
      playFiles(files, done);
      return;
    }
    if (import.meta.env.DEV) {
      console.warn('[음성] 음성 파일 없음 → npm run voice 로 다시 만들어 주세요:', sentences.filter((_, i) => !files[i]));
    }
    speakSynth(sentences.join(' '), done);
  });
}

/** 말하던 것 멈추기 (화면을 닫을 때 부른다). 읽던 문구를 기다리던 쪽도 끝난다 */
export function stopSpeaking() {
  token++;
  finishCurrent?.();
  if (current) {
    current.onended = null;
    current.onerror = null;
    current.pause();
    current = null;
  }
  synth()?.cancel();
}
