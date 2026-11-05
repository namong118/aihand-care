// 대시보드 설정 저장: 사용자 이름 목록과 난이도·속도.
// 이름 말고 다른 개인정보는 저장하지 않는다.

const USERS_KEY = 'aihand-care.users.v1';
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

export function loadUsers() {
  const users = read(USERS_KEY, []);
  return Array.isArray(users) ? users.filter((u) => typeof u === 'string') : [];
}

export function saveUsers(users) {
  write(USERS_KEY, users);
}

/** 저장된 설정 중 user, difficulty, speed 만 꺼낸다. */
export function loadSavedSettings() {
  const s = read(SETTINGS_KEY, {});
  const out = {};
  if (typeof s.user === 'string') out.user = s.user;
  if (['easy', 'normal', 'hard'].includes(s.difficulty)) out.difficulty = s.difficulty;
  if (['SLOW', 'NORMAL'].includes(s.speed)) out.speed = s.speed;
  return out;
}

export function saveSettings(settings) {
  write(SETTINGS_KEY, {
    user: settings.user,
    difficulty: settings.difficulty,
    speed: settings.speed,
  });
}
