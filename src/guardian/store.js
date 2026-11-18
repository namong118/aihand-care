// 보호자 앱(#62) 스테이션 저장소: 대기열과 연결 목록을 localStorage 에 읽고 쓴다.
// 깨진 값이면 빈 목록으로 읽는다 (logic.js parseOutbox·parsePairings).
// localStorage 를 쓸 수 없으면 메모리에만 둔다 (새로고침하면 사라짐).

import { OUTBOX_KEY, PAIRINGS_KEY, parseOutbox, parsePairings } from './logic.js';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
  };
}

function defaultStorage() {
  try {
    const s = globalThis.localStorage;
    const probe = '__aihand_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    console.warn('[보호자 앱] localStorage 를 쓸 수 없어 대기열을 메모리에만 저장합니다 (새로고침하면 사라짐).');
    return memoryStorage();
  }
}

export function createGuardianStore(storage = defaultStorage()) {
  function read(key, parse) {
    try {
      return parse(storage.getItem(key));
    } catch {
      return [];
    }
  }
  function write(key, value) {
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.error('[보호자 앱] 저장하지 못했어요', err);
    }
  }
  return {
    loadOutbox: () => read(OUTBOX_KEY, parseOutbox),
    saveOutbox: (outbox) => write(OUTBOX_KEY, outbox),
    loadPairings: () => read(PAIRINGS_KEY, parsePairings),
    savePairings: (pairings) => write(PAIRINGS_KEY, pairings),
  };
}
