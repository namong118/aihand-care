// 음성 안내 (STEP 1~4 공통, #61). 프로그램은 speak(문구)·stopSpeaking() 만 쓴다.
//
// 1) 미리 만든 음성 파일(public/voice/*.wav)이 있으면 그것을 재생한다.
//    라즈베리파이 Chromium 에는 한국어 음성이 없어서 브라우저 음성(speechSynthesis)이 소리 없이 넘어간다 (docs/hardware-check.md 5번).
//    파일은 오프라인 한국어 음성 Supertonic(1번 목소리)으로 만든다: npm run voice (docs/voice.md)
// 2) 파일이 없는 문장:
//    - speak(문구, { live: true }) 이면 같은 기기의 읽기 서버(/tts → scripts/supertonic.py serve)가 바로 만든다.
//      AI 인사처럼 매번 다른 문장용. 손 인식을 쉬는 화면(예: 코스 끝)에서만 쓴다 (라즈베리파이 열)
//    - 아니면(활동 중 문장 등) 브라우저 음성으로 읽는다. 개발 중에는 콘솔에 "음성 파일 없음" → npm run voice
//
// 음성은 화면 글자를 대신하지 않는다. 같은 문구를 화면에도 보여 준다.

import manifest from '../data/voice.json';
import { splitSentences, toSpoken } from './voice-text.js';

const BASE = `${import.meta.env.BASE_URL}voice/`;
/** 실시간 읽기 서버 (vite.config.js 가 같은 기기 127.0.0.1:8090 으로 넘긴다) */
const TTS_URL = '/tts';

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

/** 읽기 서버에 한 문장을 맡긴다 → 재생할 주소 (실패하면 null) */
async function liveUrl(sentence) {
  try {
    const res = await fetch(TTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: toSpoken(sentence) }), // "1번" → "일 번" 처럼 읽을 글자로
    });
    if (!res.ok) return null;
    return URL.createObjectURL(await res.blob());
  } catch {
    return null;
  }
}

/**
 * 문장들을 차례로 재생한다. items: [{ sentence, file }] (file 이 없으면 읽기 서버로)
 * 한 문장을 재생하는 동안 다음 문장을 미리 만든다 (처음 소리까지 기다림을 줄인다).
 * 읽기 서버가 안 되면 남은 문장은 브라우저 음성으로.
 */
function playSequence(items) {
  const my = token;
  const pending = []; // 문장 번호 → 읽기 서버 결과(Promise)
  const load = (k) => {
    if (items[k] && !items[k].file && !pending[k]) pending[k] = liveUrl(items[k].sentence);
  };
  load(0);
  let i = 0;
  const next = async () => {
    if (my !== token || i >= items.length) return;
    const k = i++;
    let audio;
    if (items[k].file) {
      load(k + 1);
      audio = audioFor(items[k].file);
      audio.currentTime = 0;
    } else {
      // 읽기 서버는 한 번에 한 문장씩 만든다. 이 문장이 준비된 뒤에 다음 문장을 맡겨야 첫 소리가 늦어지지 않는다
      const url = await pending[k];
      load(k + 1);
      if (my !== token) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      if (!url) {
        speakSynth(items.slice(k).map((x) => x.sentence).join(' '));
        return;
      }
      audio = new Audio(url);
      const free = () => URL.revokeObjectURL(url);
      audio.addEventListener('ended', free, { once: true });
      audio.addEventListener('error', free, { once: true });
    }
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

/**
 * 문구 읽기. 말하던 것은 멈추고 새 문구를 읽는다.
 *   live: true 이면 음성 파일이 없는 문장을 읽기 서버로 바로 만든다 (손 인식을 쉬는 화면에서만, 예: 코스 끝 AI 인사)
 */
export function speak(text, { live = false } = {}) {
  stopSpeaking();
  const items = splitSentences(text).map((sentence) => ({ sentence, file: manifest.files[sentence] ?? null }));
  if (items.length === 0) return;
  if (live || items.every((x) => x.file)) {
    playSequence(items);
    return;
  }
  if (import.meta.env.DEV) {
    console.warn('[음성] 음성 파일 없음 → npm run voice 로 다시 만들어 주세요:', items.filter((x) => !x.file).map((x) => x.sentence));
  }
  speakSynth(items.map((x) => x.sentence).join(' '));
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
