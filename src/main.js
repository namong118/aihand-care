// 앱 진입점: ctx 를 만들고 홈 → 프로그램 → 결과 화면을 전환한다.

import './ui/styles.css';
import { createContext, DEFAULT_SETTINGS } from './core/context.js';
import { renderStatusbar } from './dashboard/statusbar.js';
import { renderHome } from './dashboard/home.js';
import { renderSettings } from './dashboard/settings.js';
import { createDevPanel } from './dashboard/devpanel.js';
import { renderResults } from './dashboard/results.js';
import { CATALOG, findProgramInfo } from './dashboard/catalog.js';
import { loadCourse, newCourseId, tagRecord, stepInfo, courseOf, summarizeCourse } from './dashboard/course-logic.js';
import { createCourseStore } from './dashboard/course-store.js';
import { renderCourseIntro, renderStepIntro, createCourseBar, renderCourseSummary } from './dashboard/course.js';
import courseJson from './data/course.json';
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

let screen = 'home'; // 'home' | 'program' | 'results' | 'course'
let settingsOpen = false;

function updateStatusbar() {
  const list = devices.status();
  renderStatusbar(statusEl, {
    devices: list,
    actions: { connectRobot, connectWebcam, showResults: () => showResults(), toggleSettings },
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

// "웹캠 켜기" 버튼. 카메라·해상도는 개발자 입력 영역에서 고른 값 (기본: 첫 카메라, 640×480)
function connectWebcam() {
  devices.hand.startWebcam(devPanel.webcamOptions());
}

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

// 손 인식 상태(웹캠 켜는 중·켜짐·끊김)가 바뀌면 상태 표시줄과 개발자 입력 영역 갱신
devices.hand.onChange(updateStatusbar);

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
  course = null; // 코스 중에 홈으로 오면 코스는 끝 (그만하기·마치기에서 이미 저장)
  setScreen('home');
  renderHome(appEl, {
    settings,
    openSettings: () => toggleSettings(true),
    startProgram: (id) => showProgram(id),
    startCourse: showCourseIntro,
  });
}

/**
 * 프로그램 화면.
 * @param id     프로그램 id
 * @param step   코스 중이면 stepInfo() 결과. 위쪽 막대를 코스 막대로 바꾸고, 기록에 detail.course 를 붙인다
 */
function showProgram(id, step = null) {
  leaveProgram();
  setScreen('program');
  const info = findProgramInfo(id);
  const program = PROGRAMS[id];
  const body = h('div', { class: 'program-body' });
  let bar;
  if (step) {
    course.bar = createCourseBar({ info: step, onNext: nextCourseStep, onSkip: skipCourseStep, onStop: stopCourse });
    bar = course.bar.el;
  } else {
    bar = h(
      'div',
      { class: 'program-bar' },
      h('h1', {}, info ? `STEP ${info.step} ${info.title}` : id),
      button('← 홈으로', showHome, { variant: 'secondary' }),
      button('활동 기록 보기', () => showResults({ program: id }), { variant: 'secondary' }),
    );
  }
  appEl.innerHTML = '';
  appEl.append(bar, body);

  if (!program) {
    body.append(message('이 프로그램은 아직 준비 중이에요.', 'info'));
    return;
  }
  current = program;
  try {
    program.mount(body, step ? courseCtx(step) : ctx);
  } catch (err) {
    console.error(err);
    body.append(message('화면을 여는 중에 문제가 생겼어요. 홈으로 돌아가 다시 해 볼까요?', 'retry'));
  }
}

// ---- 시연 코스 (docs/decisions.md 3번, #59) ----
// 순서는 src/data/course.json. 프로그램 코드는 바꾸지 않는다:
//   - 활동이 끝났는지는 기록 알림(log.onRecord)으로 안다
//   - 코스 동안 프로그램에 넘기는 ctx.log 만 감싸서 기록에 detail.course 를 붙인다
const coursePlan = loadCourse(courseJson, CATALOG);
const courseStore = createCourseStore();
let course = null; // 진행 중인 코스 { id, index, bar }

/** 코스 동안 프로그램에 넘기는 ctx: 기록에 detail.course 만 붙인다 (나머지는 ctx 그대로) */
function courseCtx(step) {
  const id = course.id;
  return {
    ...ctx,
    log: { ...ctx.log, record: (r) => ctx.log.record(tagRecord(r, { id, order: step.order, of: step.of })) },
  };
}

// 지금 활동의 기록이 저장되면 막대에 "다음 활동으로" 버튼을 보여준다
devices.log.onRecord((rec) => {
  if (!course || screen !== 'program') return;
  const c = courseOf(rec);
  if (c?.id === course.id && c.order === course.index + 1) course.bar?.setFinished();
});

/** 코스 시작 화면의 장치 안내 한 줄 */
function deviceNote() {
  const list = devices.status();
  const off = list.filter((d) => ['webcam', 'robot', 'wondercam'].includes(d.key) && d.mock).map((d) => d.label);
  return off.length > 0 ? `${off.join('·')} 연결 전이에요. 화면 버튼으로도 할 수 있어요.` : '';
}

function showCourseIntro() {
  leaveProgram();
  course = null;
  setScreen('course');
  renderCourseIntro(appEl, {
    plan: coursePlan,
    deviceNote: deviceNote(),
    onStart: startCourse,
    onHome: showHome,
  });
}

function startCourse() {
  const id = newCourseId();
  courseStore.start({ id, plan: coursePlan.map((s) => s.program) });
  course = { id, index: 0, bar: null };
  ctx.robot.hello().catch((err) => console.error('코스 시작 인사 오류', err));
  showStepIntro();
}

function showStepIntro() {
  leaveProgram();
  setScreen('course');
  const step = stepInfo(coursePlan, course.index);
  renderStepIntro(appEl, { info: step, onStart: () => showProgram(step.program, step), onStop: stopCourse });
}

function nextCourseStep() {
  if (!course) return;
  if (course.index >= coursePlan.length - 1) {
    finishCourse();
    return;
  }
  course.index += 1;
  showStepIntro();
}

/** "이 활동 건너뛰기": 기록 없이 다음 활동으로 (요약에서 "건너뜀") */
function skipCourseStep() {
  if (!course) return;
  courseStore.skip(course.id, course.index + 1);
  nextCourseStep();
}

/** "코스 그만하기": 지금까지 저장된 기록은 남는다 (요약에서 나머지는 "하지 않음") */
function stopCourse() {
  if (course) courseStore.end(course.id, { finished: false, endedAt: new Date().toISOString() });
  showHome();
}

function finishCourse() {
  const id = course.id;
  courseStore.end(id, { finished: true, endedAt: new Date().toISOString() });
  leaveProgram();
  course = null;
  setScreen('course');
  const summary = summarizeCourse(courseStore.get(id), devices.log.list());
  renderCourseSummary(appEl, { summary, onHome: showHome, onResults: () => showResults() });
  ctx.robot
    .hello()
    .then(() => ctx.robot.rest())
    .catch((err) => console.error('코스 마침 인사 오류', err));
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
