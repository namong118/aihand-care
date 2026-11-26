// 앱 진입점: ctx 를 만들고 홈 → 프로그램 → 결과 화면을 전환한다.

import './ui/styles.css';
import { createContext, DEFAULT_SETTINGS } from './core/context.js';
import { renderStatusbar } from './dashboard/statusbar.js';
import { renderHome } from './dashboard/home.js';
import { renderSettings } from './dashboard/settings.js';
import { createDevPanel } from './dashboard/devpanel.js';
import { renderResults } from './dashboard/results.js';
import { CATALOG, CHALLENGES, findProgramInfo } from './dashboard/catalog.js';
import { loadCourse, newCourseId, tagRecord, stepInfo, courseProgress, courseOf, summarizeCourse } from './dashboard/course-logic.js';
import { createCourseStore } from './dashboard/course-store.js';
import { renderCourseIntro, renderStepIntro, createCourseBar, renderCourseSummary } from './dashboard/course.js';
import courseJson from './data/course.json';
import findStartJson from './data/find-start.json';
import {
  loadFindStart,
  readyGroups,
  outcomeOf,
  nextPosition,
  recommendFor,
  newFindStartId,
  tagFindStart,
  findStartOf,
  settingsFor,
} from './dashboard/find-start-logic.js';
import {
  renderFindStartIntro,
  createFindStartBar,
  renderFindStartBetween,
  renderFindStartRecommend,
  renderFindStartOffer,
} from './dashboard/find-start.js';
import { loadSavedSettings, saveSettings, removeOldUsers } from './dashboard/prefs.js';
import { createLevelStore } from './dashboard/user-levels.js';
import { h, button, message } from './ui/components.js';
import { PROGRAMS } from './programs/index.js';
import login from './login/index.js';
import { createUserStore } from './login/users.js';
import { sendCourseSummary, forgetUser } from './guardian/index.js';
import { renderForgetList, renderForgetConfirm, renderForgetDone } from './dashboard/forget.js';

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

let screen = 'home'; // 'home' | 'program' | 'results' | 'course' | 'login' | 'find'
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

// ---- 사람별 시작 단계 (docs/decisions.md 3번 "맞춤 단계") ----
// 로그인한 분마다 저장한다. 코스는 그분의 단계로, 하나만 해 보기·손님은 홈 설정 그대로. 자동으로 올리지 않는다.
const levelStore = createLevelStore();
let levelEditing = null; // 설정에서 단계를 바꾸는 중인 분의 userId

/** 단계를 정할 수 있는 활동: 기본 활동(손운동은 난이도가 없어서 뺌) + 지금 있는 도전 활동 */
const LEVEL_ACTIVITIES = [
  ...CATALOG.filter((p) => p.id !== 'step4-coach').map((p) => ({ id: p.id, name: p.name, challenge: false })),
  ...CHALLENGES.filter((c) => PROGRAMS[c.id]).map((c) => ({ id: c.id, name: c.name, challenge: true })),
];

/** 지금 하시는 분의 시작 단계. 손님·로그인 전이면 {} */
function whoLevels() {
  return levelStore.get(who?.userId ?? null);
}

function updateSettings() {
  const users = settingsOpen ? userStore.list() : [];
  if (settingsOpen) levelStore.prune(users.map((u) => u.userId)); // 지워진 분의 단계 정리
  renderSettings(settingsEl, {
    open: settingsOpen,
    settings,
    setSetting,
    close: () => toggleSettings(false),
    openRegister: showRegister,
    openForget: showForgetList,
    openResults: () => {
      toggleSettings(false);
      showResults();
    },
    people: {
      users,
      levelsOf: (userId) => levelStore.get(userId),
      activities: LEVEL_ACTIVITIES,
      editing: levelEditing,
      onEdit: (userId) => {
        levelEditing = userId;
        updateSettings();
      },
      onSetLevel: (userId, id, level) => {
        levelStore.set(userId, { [id]: level });
        updateSettings();
      },
    },
  });
}

function toggleSettings(open = !settingsOpen) {
  settingsOpen = open;
  if (!open) levelEditing = null;
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
  who = null; // 다음 코스는 다시 로그인
  finding = null; // 나의 시작 찾기 중에 홈으로 오면 저장하지 않고 끝
  setScreen('home');
  renderHome(appEl, {
    settings,
    plan: coursePlan.map((s) => s.program),
    openSettings: () => toggleSettings(true),
    startProgram: (id) => showProgram(id),
    startCourse: showLogin,
    hasProgram: (id) => Boolean(PROGRAMS[id]), // 도전 활동이 아직 없으면 홈에서 "준비 중"
    openFindStart: findGroups.length > 0 ? showFindStartLogin : null,
  });
}

/**
 * 프로그램 화면.
 * @param id     프로그램 id
 * @param step   코스 중이면 stepInfo() 결과. 위쪽 막대를 코스 막대로 바꾸고, 기록에 detail.course 를 붙인다
 * @param find   나의 시작 찾기 짧은 판이면 { no, of }. 위쪽 막대를 나의 시작 찾기 막대로 바꾸고, 기록에 detail.findStart 를 붙인다
 */
function showProgram(id, step = null, find = null) {
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
  } else if (find) {
    bar = createFindStartBar({
      program: id,
      role: finding.role,
      no: find.no,
      of: find.of,
      onSkip: () => finishFindStep('skipped'),
      onStop: showHome,
    }).el;
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
    // 홈에서 여는 하나만 해 보기는 로그인하지 않으므로(who 없음) 홈 설정 그대로.
    // 코스를 마친 뒤 요약 화면에서 여는 도전 활동은 그분의 단계로 (whoLevels, docs/decisions.md 3번)
    const runCtx = step ? courseCtx(step) : find ? findCtx() : { ...ctx, settings: settingsFor(id, settings, whoLevels()), single: true };
    program.mount(body, runCtx);
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

/** 코스 동안 프로그램에 넘기는 ctx: 그분의 시작 단계로 설정을 바꾸고, 기록에 detail.course(사용자 포함)를 붙인다 */
function courseCtx(step) {
  const id = course.id;
  const userId = who?.userId ?? null;
  return {
    ...ctx,
    settings: settingsFor(step.program, settings, whoLevels()),
    log: { ...ctx.log, record: (r) => ctx.log.record(tagRecord(r, { id, order: step.order, of: step.of, userId })) },
  };
}

/** 화면에 보일 지금 하시는 분: 호칭, 손님이면 "손님" */
function whoText() {
  return who ? (who.displayName ?? '손님') : null;
}

// 지금 활동의 기록이 저장되면 막대에 "다음 활동으로" 버튼을 보여준다
devices.log.onRecord((rec) => {
  onFindStartRecord(rec);
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

/**
 * 사용자 등록 화면 (설정 영역의 "사용자 등록하기"). 그만두면 홈.
 * 등록을 마치면 "등록한 분으로 바로 나의 시작 찾기"를 묻는다 (시연: 등록 → 시작 찾기 → 코스)
 */
function showRegister() {
  toggleSettings(false);
  leaveProgram();
  course = null;
  setScreen('login');
  current = login;
  login.mountRegister(appEl, ctx, {
    store: userStore,
    onDone: (user) => {
      current = null;
      showRegistered(user);
    },
    onCancel: () => {
      current = null;
      showHome();
    },
  });
}

// ---- 사용자 지우기 (설정 → "사용자 지우기", 동의서 "지우는 방법") ----
// 동의서대로 지워 달라고 하시면 바로 모두 지운다: 호칭·얼굴 번호(users.js), 시작 단계(user-levels.js),
// 이 기계의 그분 코스 기록(log)·코스 진행 정보(course-store), 보호자 앱 연결과 보낸 요약(guardian forgetUser, 인터넷이 되면).
// 얼굴은 로봇 카메라 안에만 있어서 앱이 지울 수 없다 → 다 지운 뒤 카메라에서 지워 달라고 안내.

/** 이 분의 기록인지 (코스 기록의 detail.course.userId) */
const isUserRecord = (userId) => (r) => courseOf(r)?.userId === userId;

function showForgetList() {
  toggleSettings(false);
  leaveProgram();
  course = null;
  who = null;
  setScreen('forget');
  renderForgetList(appEl, { users: userStore.list(), onPick: showForgetConfirm, onHome: showHome });
}

function showForgetConfirm(user) {
  setScreen('forget');
  renderForgetConfirm(appEl, {
    name: user.displayName,
    records: devices.log.list().filter(isUserRecord(user.userId)).length,
    hasFace: user.faceId !== null && user.faceId !== undefined,
    onConfirm: () => forgetAll(user),
    onCancel: showForgetList,
  });
}

/** 그분의 정보를 모두 지운다 */
function forgetAll(user) {
  const removed = userStore.remove(user.userId);
  levelStore.prune(userStore.list().map((u) => u.userId));
  devices.log.removeWhere(isUserRecord(user.userId));
  courseStore.removeUser(user.userId);
  forgetUser(user.userId); // 보호자 앱 연결 끊기 + Supabase 의 그분 요약 지우기 (대기열, 인터넷이 되면 보냄)
  renderForgetDone(appEl, { name: user.displayName, faceId: removed?.forgetFaceId ?? null, onHome: showHome });
}

/** 등록을 마친 뒤: 그분으로 바로 나의 시작 찾기 / 홈으로 */
function showRegistered(user) {
  if (!user?.userId || findGroups.length === 0) {
    showHome();
    return;
  }
  leaveProgram();
  setScreen('find');
  renderFindStartOffer(appEl, {
    who: user.displayName,
    onFind: () => {
      who = { userId: user.userId, displayName: user.displayName, via: 'register' };
      showFindStartIntro();
    },
    onHome: showHome,
  });
}

function showCourseIntro() {
  leaveProgram();
  course = null;
  setScreen('course');
  renderCourseIntro(appEl, {
    plan: coursePlan,
    deviceNote: deviceNote(),
    who: whoText(),
    levels: whoLevels(), // 그분의 시작 단계 → 목록에 "보통부터"
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
  // 도전 활동은 코스 밖. 마친 뒤 원하시면 그분의 도전 단계로 이어서 (손님은 1단계)
  const levels = whoLevels();
  const challenges = CHALLENGES.filter((c) => PROGRAMS[c.id]).map((c) => ({ id: c.id, name: c.name, level: levels[c.id] ?? 1 }));
  renderCourseSummary(appEl, {
    summary,
    who: whoText(),
    challenges,
    onChallenge: (programId) => showProgram(programId),
    onHome: showHome,
    onResults: () => showResults(),
  });
  sendCourseSummary(summary); // 보호자 앱(#62). 기다리지 않고, 손님·연결 안 한 분은 알아서 보내지 않는다
  ctx.robot
    .hello()
    .then(() => ctx.robot.rest())
    .catch((err) => console.error('코스 마침 인사 오류', err));
}

// ---- 나의 시작 찾기 ----
// 홈 "나의 시작 찾기" → 시작 안내 → 짝마다 기본 활동 짧은 판 → (해내시면) 도전 활동 1단계 짧은 판 → 추천 화면.
// 짝과 추천 단계는 src/data/find-start.json. 프로그램은 ctx.settings.findStart 가 true 면 짧은 판으로 한다.
// 짧은 판 기록에는 detail.findStart 가 붙고, 결과 화면 반응 시간 변화에서는 빠진다.
// 코스처럼 먼저 로그인한다. 정한 시작 단계는 그분의 것으로 저장 (user-levels.js). 손님은 추천만 보여 주고 저장하지 않는다.
const allFindGroups = loadFindStart(findStartJson, [...CATALOG, ...CHALLENGES].map((p) => p.id));
const findGroups = readyGroups(allFindGroups);
let finding = null; // 진행 중인 나의 시작 찾기 { id, index, role, no, results: { 짝 id: { basic, challenge } }, waiting }

/** 나의 시작 찾기 앞 로그인 (코스와 같은 화면). 끝나면 시작 안내, "← 홈으로"면 홈 */
function showFindStartLogin() {
  leaveProgram();
  course = null;
  finding = null;
  who = null;
  setScreen('login');
  current = login;
  login.mount(appEl, ctx, {
    store: userStore,
    onDone: (user) => {
      current = null;
      who = user;
      showFindStartIntro();
    },
    onCancel: () => {
      current = null;
      showHome();
    },
  });
}

function showFindStartIntro() {
  leaveProgram();
  course = null;
  finding = null;
  setScreen('find');
  renderFindStartIntro(appEl, { groups: findGroups, onStart: startFindStart, onHome: showHome });
}

function startFindStart() {
  finding = { id: newFindStartId(), index: 0, role: 'basic', no: 1, results: {}, waiting: false };
  runFindStep();
}

/** 지금 짝·역할의 짧은 판을 연다 */
function runFindStep() {
  const g = findGroups[finding.index];
  finding.waiting = true; // 이 활동의 기록을 기다리는 중
  showProgram(finding.role === 'basic' ? g.basic : g.challenge, null, { no: finding.no, of: findGroups.length * 2 });
}

/** 짧은 판에 넘기는 ctx: settings.findStart = true, 기록에 detail.findStart */
function findCtx() {
  const tag = { id: finding.id, group: findGroups[finding.index].id, role: finding.role };
  return {
    ...ctx,
    settings: { ...settings, findStart: true },
    log: { ...ctx.log, record: (r) => ctx.log.record(tagFindStart(r, tag)) },
  };
}

/** 짧은 판 기록이 저장되면 다음으로 (프로그램 흐름이 끝난 뒤에 화면을 바꾸도록 한 박자 뒤에) */
function onFindStartRecord(rec) {
  if (!finding?.waiting || screen !== 'program') return;
  const f = findStartOf(rec);
  if (f?.id !== finding.id || f.role !== finding.role || f.group !== findGroups[finding.index].id) return;
  finding.waiting = false;
  const outcome = outcomeOf(rec);
  setTimeout(() => finishFindStep(outcome), 0);
}

/** 짧은 판 하나가 끝남 (해냄·해 봄·건너뜀) */
function finishFindStep(outcome) {
  if (!finding) return;
  finding.waiting = false;
  const g = findGroups[finding.index];
  finding.results[g.id] = { ...finding.results[g.id], [finding.role]: outcome };
  const next = nextPosition(findGroups.length, finding, outcome);
  if (!next) {
    showFindRecommend();
    return;
  }
  const toChallenge = next.role === 'challenge';
  finding.index = next.index;
  finding.role = next.role;
  finding.no += 1;
  if (toChallenge) showFindBetween();
  else runFindStep();
}

/** 기본 활동을 해낸 뒤 도전 활동 안내 */
function showFindBetween() {
  leaveProgram();
  setScreen('find');
  renderFindStartBetween(appEl, {
    group: findGroups[finding.index],
    onGo: runFindStep,
    onPass: () => finishFindStep('skipped'),
    onStop: showHome,
  });
}

/** 추천 화면 */
function showFindRecommend() {
  leaveProgram();
  setScreen('find');
  const userId = who?.userId ?? null;
  const levels = whoLevels(); // 그분이 전에 정해 둔 단계 (하지 않은 짝은 이 값이 골라져 있음)
  const rows = findGroups.map((group) => {
    const rec = recommendFor(group, finding.results[group.id]);
    const pick = rec ?? {
      basic: levels[group.basic] ?? settings.difficulty,
      challenge: levels[group.challenge] ?? 1,
    };
    return { group, pick, recommended: Boolean(rec) };
  });
  renderFindStartRecommend(appEl, {
    rows,
    later: allFindGroups.filter((g) => !g.ready),
    who: who?.displayName ?? null,
    // 손님이면 저장하지 않는다 (onSave 없음 → 추천만 보여 줌)
    onSave: userId
      ? (picked) => {
          levelStore.set(userId, picked);
          showHome();
        }
      : null,
    onHome: showHome,
  });
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
