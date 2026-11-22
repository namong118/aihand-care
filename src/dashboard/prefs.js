// 대시보드 설정 저장: 난이도·속도, 나의 시작 찾기로 정한 활동별 시작 단계(levels). 개인정보는 저장하지 않는다.

import { cleanLevels } from './find-start-logic.js';

// 예전 버전이 저장한 사용자 이름 목록. 이제 쓰지 않으므로 앱이 시작할 때 지운다.
const OLD_USERS_KEY = 'aihand-care.users.v1';
const SETTINGS_KEY = 'aihand-care.settings.v1';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장이 안 되는 브라우저 환경이면 이번 실행 동안만 유지된다.
  }
}

/** 저장된 설정 중 difficulty, speed, levels 만 꺼낸다. levels 는 활동에 맞는 값만 (cleanLevels) */
export function loadSavedSettings() {
  const s = read(SETTINGS_KEY, {});
  const out = {};
  if (['easy', 'normal', 'hard'].includes(s.difficulty)) out.difficulty = s.difficulty;
  if (['SLOW', 'NORMAL'].includes(s.speed)) out.speed = s.speed;
  out.levels = cleanLevels(s.levels);
  return out;
}

export function saveSettings(settings) {
  write(SETTINGS_KEY, {
    difficulty: settings.difficulty,
    speed: settings.speed,
    levels: cleanLevels(settings.levels),
  });
}

/** 예전 버전이 저장한 사용자 이름 목록을 지운다 (앱 시작 때 한 번). */
export function removeOldUsers() {
  try {
    localStorage.removeItem(OLD_USERS_KEY);
  } catch {
    // 저장소를 쓸 수 없는 환경이면 지울 것도 없다.
  }
}
