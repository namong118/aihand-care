// 앱 진입점: ctx 를 만들고 홈 → 프로그램 → 결과 화면을 전환한다.

import './ui/styles.css';
import { createContext, DEFAULT_SETTINGS } from './core/context.js';
import { renderStatusbar } from './dashboard/statusbar.js';
import { renderHome } from './dashboard/home.js';
import { renderSettings } from './dashboard/settings.js';
import { createDevPanel } from './dashboard/devpanel.js';
import { renderResults } from './dashboard/results.js';
import { findProgramInfo } from './dashboard/catalog.js';
import { loadSavedSettings, saveSettings, removeOldUsers } from './dashboard/prefs.js';
import { h, button, message } from './ui/components.js';
import { PROGRAMS } from './programs/index.js';

const appEl = document.querySelector('#app');
const statusEl = document.querySelector('#statusbar');
const mockEl = document.querySelector('#mock-panel');
const layoutEl = document.querySelector('.layout');

// 설정 영역(상단 바 바로 아래)과 개발자 입력 영역(맨 아래)은 여기서 만들어 붙인다
const settingsEl = h('div', { class: 'settings-wrap', hidden: true });
statusEl.after(settingsEl);

// ---- 설정과 ctx ----
removeOldUsers(); // 사용자 이름 기능 제거: 예전에 저장한 이름 목록 지우기
const settings = { ...DEFAULT_SETTINGS, ...loadSavedSettings() };

const { ctx, devices } = createContext(settings);

let screen = 'home'; // 'home' | 'program' | 'results'
let settingsOpen = false;

function updateStatusbar() {
  const list = devices.status();
  renderStatusbar(statusEl, {
    devices: list,
    actions: {
      connectRobot,
      startCamera: () => devices.hand.startCamera(),
      stopCamera: () => devices.hand.stopCamera(),
      showResults: () => showResults(),
      toggleSettings,
    },
    settingsOpen,
  });
  devPanel.renderStatus(list);
}

// ---- 설정 영역 ----
function setSetting(key, value) {
  settings[key] = value;
  saveSettings(settings);
  if (key === 'speed') devices.robot.setSpeed(value); // 실제 AIHand 에 연결되어 있으면 SPEED 전송
  updateSettings();
  if (screen === 'home') showHome(); // 제목 아래 "난이도 · 속도" 알약 갱신
}

function updateSettings() {
  renderSettings(settingsEl, { open: settingsOpen, settings, setSetting, close: () => toggleSettings(false) });
}

function toggleSettings(open = !settingsOpen) {
  settingsOpen = open;
  updateSettings();
  updateStatusbar();
  if (open) settingsEl.scrollIntoView?.({ block: 'nearest' });
}

// "AIHand 연결" 버튼. 포트 고르기 창은 클릭 안에서만 열리므로 await 앞에 다른 일을 하지 않는다.
function connectRobot() {
  devices.robot.connect({ speed: settings.speed });
}

// ---- 웹캠 미리 보기: 웹캠 손 인식이 켜져 있을 때만 화면 오른쪽 아래에 작게 보인다 ----
const camEl = h('aside', { class: 'cam-preview', 'aria-label': '웹캠 화면', hidden: true });
document.body.append(camEl);

function updateCamView() {
  const view = devices.hand.cameraView;
  camEl.hidden = !view;
  if (view && view.parentNode !== camEl) camEl.replaceChildren(view);
  if (!view) camEl.replaceChildren();
}

// 손 인식 상태가 바뀌면 (켜는 중·켜짐·꺼짐·끊김) 상태 표시줄과 미리 보기를 갱신
devices.hand.onChange(() => {
  updateStatusbar();
  updateCamView();
});

// ---- 개발자 입력 (Mock): 손모양·색 카드 입력 패널, 웹캠·WonderCam 상태. 맨 아래, 기본 접힘 ----
const devPanel = createDevPanel(devices);
layoutEl.after(h('footer', { class: 'dev-wrap' }, devPanel.el));

// ---- 가상 로봇손: 활동 화면에서 로봇이 Mock 일 때만 오른쪽에 보인다 (홈·결과 화면에서는 숨김) ----
const robotBox = h('section', { class: 'mock-box' });

function mountMockPanel() {
  mockEl.append(robotBox);
  devices.robot.mountControls(robotBox);
  updateRobotBox();
}

function updateRobotBox() {
  const show = screen === 'program' && devices.robot.kind === 'mock';
  mockEl.hidden = !show;
  layoutEl.classList.toggle('with-side', show);
}

function setScreen(name) {
  screen = name;
  document.body.dataset.screen = name;
  updateRobotBox();
}

// 로봇 연결 상태가 바뀌면 (연결됨·끊김·응답 없음) 상태 표시줄과 가상 로봇손을 갱신
devices.robot.onChange(() => {
  updateStatusbar();
  updateRobotBox();
});

// WonderCam 상태(확인 중·연결됨·찾지 못함)와 지금 보이는 카드가 바뀌면 개발자 입력 영역의 상태 갱신
devices.card.onChange(updateStatusbar);

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
  setScreen('home');
  renderHome(appEl, {
    settings,
    openSettings: () => toggleSettings(true),
    startProgram: showProgram,
  });
}

function showProgram(id) {
  leaveProgram();
  setScreen('program');
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
  setScreen('results');
  const state = { program: null, ...filter };
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
