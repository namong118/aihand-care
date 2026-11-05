// 앱 진입점: ctx 를 만들고 홈 → 프로그램 → 결과 화면을 전환한다.

import './ui/styles.css';
import { createContext, DEFAULT_SETTINGS } from './core/context.js';
import { renderStatusbar } from './dashboard/statusbar.js';
import { renderHome } from './dashboard/home.js';
import { renderResults } from './dashboard/results.js';
import { findProgramInfo } from './dashboard/catalog.js';
import { loadUsers, saveUsers, loadSavedSettings, saveSettings } from './dashboard/prefs.js';
import { h, button, message } from './ui/components.js';
import { PROGRAMS } from './programs/index.js';

const appEl = document.querySelector('#app');
const statusEl = document.querySelector('#statusbar');
const mockEl = document.querySelector('#mock-panel');

// ---- 설정과 ctx ----
const settings = { ...DEFAULT_SETTINGS, ...loadSavedSettings() };
let users = loadUsers();
if (settings.user && !users.includes(settings.user)) settings.user = null;

const { ctx, devices } = createContext(settings);

function updateStatusbar() {
  renderStatusbar(statusEl, { devices: devices.status(), settings });
}

// ---- Mock 패널: 가상 로봇손, 손모양 버튼, 색 태그 버튼 ----
function mountMockPanel() {
  if (!settings.mock) return;
  const robotBox = h('section', { class: 'mock-box' });
  const handBox = h('section', { class: 'mock-box' });
  const tagBox = h('section', { class: 'mock-box' });
  mockEl.append(robotBox, handBox, tagBox);
  devices.robot.mountControls(robotBox);
  devices.hand.mountControls(handBox);
  devices.tag.mountControls(tagBox);
}

// ---- 화면 전환 ----
let current = null; // 지금 실행 중인 프로그램 모듈

function leaveProgram() {
  if (current) {
    try {
      current.unmount();
    } catch (err) {
      console.error('프로그램 정리 중 오류', err);
    }
    current = null;
  }
  devices.hand.lower?.(); // 다음 화면에 이전 손모양이 남지 않게
}

function showHome() {
  leaveProgram();
  renderHome(appEl, {
    settings,
    users,
    selectUser(name) {
      settings.user = name;
      saveSettings(settings);
      updateStatusbar();
      showHome();
    },
    addUser(name) {
      if (!users.includes(name)) {
        users = [...users, name];
        saveUsers(users);
      }
      settings.user = name;
      saveSettings(settings);
      updateStatusbar();
      showHome();
    },
    setSetting(key, value) {
      settings[key] = value;
      saveSettings(settings);
      showHome();
    },
    startProgram: showProgram,
    showResults: () => showResults(),
  });
}

function showProgram(id) {
  leaveProgram();
  const info = findProgramInfo(id);
  const program = PROGRAMS[id];
  const body = h('div', { class: 'program-body' });
  appEl.innerHTML = '';
  appEl.append(
    h(
      'div',
      { class: 'program-bar' },
      h('h1', {}, info ? `STEP ${info.step} ${info.title}` : id),
      button('← 홈으로', showHome, { variant: 'secondary' }),
      button('활동 기록 보기', () => showResults({ program: id }), { variant: 'secondary' }),
    ),
    body,
  );

  if (!program) {
    body.append(message('이 프로그램은 아직 준비 중이에요.', 'info'));
    return;
  }
  current = program;
  try {
    program.mount(body, ctx);
  } catch (err) {
    console.error(err);
    body.append(message('화면을 여는 중에 문제가 생겼어요. 홈으로 돌아가 다시 해 볼까요?', 'retry'));
  }
}

function showResults(filter = {}) {
  leaveProgram();
  const state = { user: settings.user, program: null, ...filter };
  renderResults(appEl, {
    log: devices.log,
    filter: state,
    onFilter: (next) => showResults(next),
    onHome: showHome,
  });
}

// ---- 시작 ----
updateStatusbar();
mountMockPanel();
showHome();
