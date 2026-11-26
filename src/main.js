// 앱 진입점: ctx 를 만들고 홈 → 프로그램 → 결과 화면을 전환한다.

import './ui/styles.css';
import { createContext, DEFAULT_SETTINGS } from './core/context.js';
import { renderStatusbar } from './dashboard/statusbar.js';
import { renderHome } from './dashboard/home.js';
import { renderSettings } from './dashboard/settings.js';
import { createDevPanel } from './dashboard/devpanel.js';
import { renderResults } from './dashboard/results.js';
import { CATALOG, findProgramInfo } from './dashboard/catalog.js';
import { loadCourse, newCourseId, tagRecord, stepInfo, courseProgress, courseOf, summarizeCourse } from './dashboard/course-logic.js';
import { createCourseStore } from './dashboard/course-store.js';
import { renderCourseIntro, renderStepIntro, createCourseBar, renderCourseSummary, programTitle } from './dashboard/course.js';
import courseJson from './data/course.json';
import { loadSavedSettings, saveSettings, removeOldUsers } from './dashboard/prefs.js';
import { h, button, message } from './ui/components.js';
import { PROGRAMS } from './programs/index.js';
import login from './login/index.js';
import { createUserStore } from './login/users.js';
import { sendCourseSummary } from './guardian/index.js';
import { makeCourseGreeting } from './ai/greeting.js';

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
// 전에 "AIHand 연결"로 허락한 AIHand 는 켤 때·USB 를 다시 꽂을 때 자동으로 연결한다 (키오스크, #60)
devices.robot.startAutoConnect(() => settings.speed);

let screen = 'home'; // 'home' | 'program' | 'results' | 'course' | 'login'
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
  renderSettings(settingsEl, {
    open: settingsOpen,
    settings,
    setSetting,
    close: () => toggleSettings(false),
    openRegister: showRegister,
  });
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
  // 손 인식은 활동 화면에서만 한다. 다른 화면에서는 쉬어서 라즈베리파이 열을 줄인다 (웹캠 영상은 켜 둔 채)
  devices.hand.rest(name !== 'program');
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
  who = null; // 다음 코스는 다시 로그인
  setScreen('home');
  renderHome(appEl, {
    settings,
    plan: coursePlan.map((s) => s.program),
    openSettings: () => toggleSettings(true),
    openResults: () => showResults(),
    startProgram: (id) => showProgram(id),
    startCourse: showLogin,
    hasProgram: (id) => Boolean(PROGRAMS[id]), // 도전 활동이 아직 없으면 홈에서 "준비 중"
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
  // stepN: 활동 화면 안쪽에서 그 STEP 색(--step-bg/-fg)을 쓸 수 있게 (styles.css "활동 화면 공통")
  const body = h('div', { class: `program-body${info ? ` step${info.step}` : ''}` });
  let bar;
  if (step) {
    course.bar = createCourseBar({
      info: step,
      progress: progressNow(),
      who: whoText(),
      onNext: nextCourseStep,
      onSkip: skipCourseStep,
      onStop: stopCourse,
    });
    bar = course.bar.el;
  } else {
    bar = h(
      'div',
      { class: `program-bar${info ? ` step${info.step}` : ''}` },
      // 7인치(1280×720)에서 한 줄에 들어가게 활동 갈래는 작은 알약으로 (#102). STEP 번호는 화면에 쓰지 않는다
      h('h1', {}, info ? [h('span', { class: 'step-pill' }, info.tag), ` ${info.title}`] : id),
      smallButton(button('← 홈으로', showHome, { variant: 'secondary' })),
      smallButton(button('기록 보기', () => showResults({ program: id }), { variant: 'secondary' })),
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
    // 하나만 해 보기(코스 밖)일 때는 ctx.single = true. 프로그램이 코스 밖에서만 보여 줄 화면을 고를 수 있게 (STEP 2 동시에 가위바위보)
    program.mount(body, step ? courseCtx(step) : { ...ctx, single: true });
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
const userStore = createUserStore(); // 얼굴 로그인 사용자 목록 (src/login/users.js, 호칭·얼굴 번호만)
let course = null; // 진행 중인 코스 { id, index, bar }
let who = null; // 코스 시작 때 로그인한 분 { userId, displayName, via }. 손님이면 userId·displayName 이 null (#82)

/** 코스 동안 프로그램에 넘기는 ctx: 기록에 detail.course(사용자 포함)만 붙인다 (나머지는 ctx 그대로) */
function courseCtx(step) {
  const id = course.id;
  const userId = who?.userId ?? null;
  return {
    ...ctx,
    log: { ...ctx.log, record: (r) => ctx.log.record(tagRecord(r, { id, order: step.order, of: step.of, userId })) },
  };
}

/** 화면에 보일 지금 하시는 분: 호칭, 손님이면 "손님" */
function whoText() {
  return who ? (who.displayName ?? '손님') : null;
}

// 지금 활동의 기록이 저장되면 막대에 "다음 활동으로" 버튼을 보여준다
devices.log.onRecord((rec) => {
  if (!course || screen !== 'program') return;
  const c = courseOf(rec);
  if (c?.id === course.id && c.order === course.index + 1) course.bar?.setFinished();
});

/** 위쪽 막대 버튼은 글자를 조금 작게 (높이 64px 는 그대로) */
function smallButton(el) {
  el.classList.add('btn-small');
  return el;
}

/** 코스 시작 화면의 장치 안내 한 줄 */
function deviceNote() {
  const list = devices.status();
  const off = list.filter((d) => ['webcam', 'robot', 'wondercam'].includes(d.key) && d.mock).map((d) => d.label);
  return off.length > 0 ? `${off.join('·')} 연결 전이에요. 화면 버튼으로도 할 수 있어요.` : '';
}

// ---- 얼굴 로그인 (#82, 화면은 src/login C 담당) ----
// 홈 "코스 시작하기" → 로그인 → 코스 시작 화면. STEP 하나만 할 때는 로그인하지 않는다.

/** 로그인 화면. 끝나면 코스 시작 화면, "← 홈으로"면 홈 */
function showLogin() {
  leaveProgram();
  course = null;
  who = null;
  setScreen('login');
  current = login;
  login.mount(appEl, ctx, {
    store: userStore,
    onDone: (user) => {
      current = null;
      who = user;
      showCourseIntro();
    },
    onCancel: () => {
      current = null;
      showHome();
    },
  });
}

/** 사용자 등록 화면 (선생님용, 설정 영역의 "사용자 등록하기"). 끝나거나 그만두면 홈 */
function showRegister() {
  toggleSettings(false);
  leaveProgram();
  course = null;
  setScreen('login');
  current = login;
  const back = () => {
    current = null;
    showHome();
  };
  login.mountRegister(appEl, ctx, { store: userStore, onDone: back, onCancel: back });
}

function showCourseIntro() {
  leaveProgram();
  course = null;
  setScreen('course');
  renderCourseIntro(appEl, {
    plan: coursePlan,
    deviceNote: deviceNote(),
    who: whoText(),
    onStart: startCourse,
    onHome: showHome,
  });
}

function startCourse() {
  const id = newCourseId();
  courseStore.start({ id, plan: coursePlan.map((s) => s.program), userId: who?.userId ?? null });
  course = { id, index: 0, bar: null };
  ctx.robot.hello().catch((err) => console.error('코스 시작 인사 오류', err));
  showStepIntro();
}

function showStepIntro() {
  leaveProgram();
  setScreen('course');
  const step = stepInfo(coursePlan, course.index);
  renderStepIntro(appEl, {
    info: step,
    progress: progressNow(),
    who: whoText(),
    onStart: () => showProgram(step.program, step),
    onStop: stopCourse,
  });
}

/** 지금 코스의 활동별 상태 (마침·건너뜀·지금·아직) */
function progressNow() {
  return courseProgress(coursePlan, course.index, courseStore.get(course.id)?.skipped ?? []);
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
  const id = course?.id;
  if (id) courseStore.end(id, { finished: false, endedAt: new Date().toISOString() });
  showHome();
  // 보호자 앱(#62): 중간에 마친 코스도 요약을 보낸다. showHome(프로그램 정리) 뒤라 그때까지의 기록이 모두 들어간다
  if (id) sendCourseSummary(summarizeCourse(courseStore.get(id), devices.log.list()));
}

function finishCourse() {
  const id = course.id;
  courseStore.end(id, { finished: true, endedAt: new Date().toISOString() });
  leaveProgram();
  course = null;
  setScreen('course');
  const summary = summarizeCourse(courseStore.get(id), devices.log.list());
  const view = renderCourseSummary(appEl, { summary, who: whoText(), onHome: showHome, onResults: () => showResults() });
  // 오늘의 한마디: 오프라인 AI 가 따뜻한 인사를 만든다. 손 인식이 쉬는 중일 때만 AI 를 쓰고(열),
  // AI 가 없거나 금지어(건강·효과·점수 등)가 나오면 미리 써 둔 인사 (src/ai/greeting.js, docs/ai-greeting.md)
  makeCourseGreeting({
    summary,
    titleOf: programTitle,
    name: who?.displayName ?? null,
    canUseAi: () => devices.hand.isResting(),
  }).then((g) => view.setGreeting(g.text));
  sendCourseSummary(summary); // 보호자 앱(#62). 기다리지 않고, 손님·연결 안 한 분은 알아서 보내지 않는다
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
    courses: courseStore.list(),
    users: userStore.list(),
    filter: state,
    onFilter: (next) => showResults(next),
    onHome: showHome,
  });
}

// ---- 시작 ----
updateStatusbar();
mountMockPanel();
showHome();
