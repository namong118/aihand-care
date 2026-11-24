// 음성 문장 다루기 (순수 함수). 화면·브라우저 없이 동작해서 앱(voice.js)과 음성 파일 만들기(scripts/make-voice.js)가 같이 쓴다.
//
// 음성 파일은 "문장" 하나에 파일 하나다. 프로그램이 speak('잘하셨어요! 글자 색은 빨강이었어요.')를 부르면
// 문장 두 개로 나눠 파일 두 개를 이어서 재생한다. 그래서 "OO이었어요" 같은 조합마다 파일을 따로 만들지 않아도 된다.

// 그림 글자(✊ ✋ ✌️)는 읽지 않는다 (읽으면 "주먹 쥔 손" 같은 설명이 나올 수 있다)
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu;

/** 그림 글자를 빼고 띄어쓰기를 하나로 줄인다 */
export function cleanText(text) {
  return String(text ?? '')
    .replace(EMOJI, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 문장으로 나누기: 마침표·느낌표·물음표 뒤에 띄어쓰기가 오면 끊는다.
 * "1.5초"처럼 뒤에 띄어쓰기가 없는 점에서는 끊지 않는다.
 *   '잘하셨어요! 글자 색은 빨강이었어요.' → ['잘하셨어요!', '글자 색은 빨강이었어요.']
 */
export function splitSentences(text) {
  const clean = cleanText(text);
  if (!clean) return [];
  return clean
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// 개수를 세는 말 앞의 숫자는 우리말 수로 읽어야 자연스럽다 ("5문제" → "다섯 문제", "3개" → "세 개")
const NATIVE = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열'];
const COUNTERS = ['개', '문제', '판'];

/**
 * 음성으로 읽을 글자로 바꾸기 (화면 글자는 그대로 두고, 음성 파일을 만들 때만 쓴다).
 *   '5문제를 모두 마쳤어요.' → '다섯 문제를 모두 마쳤어요.'
 *   '문제 3번.' → 그대로 ("삼 번"이 맞다)
 */
export function toSpoken(sentence) {
  const counters = COUNTERS.join('|');
  const sinoCounters = SINO_COUNTERS.join('|');
  return sentence
    .replace(new RegExp(`(\\d+)\\s*(${counters})`, 'g'), (whole, num, counter) => {
      const n = Number(num);
      return NATIVE[n] ? `${NATIVE[n]} ${counter}` : whole;
    })
    .replace(new RegExp(`(\\d+)\\s*(${sinoCounters})`, 'g'), (whole, num, counter) => {
      const word = sinoNumber(Number(num));
      return word ? `${word} ${counter}` : whole;
    });
}

// 번호·시간을 세는 말 앞의 숫자는 한자어 수로 읽는다 ("1번" → "일 번", "3초" → "삼 초").
// 숫자 그대로 두면 Supertonic 이 "1번"을 "한 번"으로 읽는다 (2026-11-25 들어 보고 확인)
const SINO_COUNTERS = ['번', '초', '분'];
const SINO_DIGITS = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];

/** 1~99 를 한자어 수로: 1 → 일, 10 → 십, 12 → 십이, 25 → 이십오. 범위 밖이면 null */
export function sinoNumber(n) {
  if (!Number.isInteger(n) || n < 1 || n > 99) return null;
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  const tenWord = tens === 0 ? '' : `${tens === 1 ? '' : SINO_DIGITS[tens]}십`;
  return `${tenWord}${SINO_DIGITS[ones]}`;
}

/**
 * 문장 → 음성 파일 이름 (FNV-1a 해시 8자리 + .wav).
 * 한글 파일 이름은 주소·배포에서 문제가 생길 수 있어서 해시로 짓고, 문장↔파일 표는 src/data/voice.json 에 둔다.
 */
export function fileNameFor(sentence) {
  let hash = 0x811c9dc5;
  for (const ch of sentence) {
    hash ^= ch.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${hash.toString(16).padStart(8, '0')}.wav`;
}

/** 여러 문구 → 겹치지 않는 문장 목록 (가나다순) */
export function uniqueSentences(texts) {
  const set = new Set();
  for (const text of texts) for (const s of splitSentences(text)) set.add(s);
  return [...set].sort((a, b) => a.localeCompare(b, 'ko'));
}
