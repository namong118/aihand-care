// 보호자 폰 앱: 연결(코드·호칭)을 폰 localStorage 에 저장한다.
// 저장할 수 없으면(사생활 보호 모드 등) 이번에 연 동안만 기억한다.

import { PHONE_KEY, parseConnection } from './logic.js';

let memory = null;

export function loadConnection() {
  try {
    return parseConnection(globalThis.localStorage.getItem(PHONE_KEY));
  } catch {
    return memory;
  }
}

export function saveConnection(conn) {
  memory = conn;
  try {
    globalThis.localStorage.setItem(PHONE_KEY, JSON.stringify(conn));
  } catch {
    console.warn('[보호자 앱] 폰에 저장할 수 없어 이번에 연 동안만 기억해요.');
  }
}

export function clearConnection() {
  memory = null;
  try {
    globalThis.localStorage.removeItem(PHONE_KEY);
  } catch {
    // 지울 것이 없다
  }
}
