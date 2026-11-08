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
  renderStatusbar(statusEl, { devices: devices.status(), settings, actions: { connectRobot } });
}

// "AIHand 연결" 버튼. 포트 고르기 창은 클릭 안에서만 열리므로 await 앞에 다른 일을 하지 않는다.
function connectRobot() {
  devices.robot.connect({ speed: settings.speed });
}

// ---- Mock 패널: 가상 로봇손, 손모양 버튼, 색 카드 대신 입력 버튼 ----
// 장치마다 따로 붙인다. 가상 로봇손은 AIHand 가 연결되면 숨기고, 끊기면 다시 보여준다.
const robotBox = h('section', { class: 'mock-box' });

function mountMockPanel() {
  mockEl.append(robotBox);
  devices.robot.mountControls(robotBox);
  if (devices.hand.kind === 'mock') {
    const handBox = h('section', { class: 'mock-box' });
    mockEl.append(handBox);
    devices.hand.mountControls(handBox);
  }
  if (devices.card.kind === 'mock') {
    const cardBox = h('section', { class: 'mock-box' });
    mockEl.append(cardBox);
    devices.card.mountControls(cardBox);
  }
  updateRobotBox();
}

function updateRobotBox() {
  robotBox.hidden = devices.robot.kind !== 'mock';
}

// 로봇 연결 상태가 바뀌면 (연결됨·끊김·응답 없음) 상태 표시줄과 가상 로봇손을 갱신
devices.robot.onChange(() => {
  updateStatusbar();
  updateRobotBox();
});

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
      if (key === 'speed') devices.robot.setSpeed(value); // 실제 AIHand 에 연결되어 있으면 SPEED 전송
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
