// 보호자 폰 앱 시작 (#62). guardian/index.html 이 이 파일을 불러온다.
// 흐름: 주소(# 뒤) 읽기 → 연결 저장 → Supabase 에서 요약 읽기 → 참여 달력
//   #c=코드&n=호칭  QR로 열림: 폰에 저장하고 주소에서 지운다 (주소를 남에게 보내도 코드가 따라가지 않게)
//   #demo          예시 화면 (가상 인물 순자 님, 저장하지 않음)
//   그 밖          저장된 연결로 열기, 없으면 코드 입력 화면
// 스테이션 함수(src/guardian/index.js)는 불러오지 않는다: 그 파일은 불러오면 보내기 타이머가 켜진다.

import './phone.css';
import { formatCode } from '../logic.js';
import { localDate } from '../../dashboard/course-logic.js';
import {
  parseHash,
  normalizeCode,
  cleanDisplayName,
  pageTitle,
  pairedText,
  countByDate,
  monthOf,
  shiftMonth,
  monthRange,
  dayTitle,
  coursesOn,
} from './logic.js';
import routines from '../../data/routines.json';
import { demoSummaries, DEMO_NAME } from './demo.js';
import { hasApi, fetchSummaries } from './api.js';
import { loadConnection, saveConnection, clearConnection } from './store.js';
import { renderConnect, renderHome, renderSettings, renderDay } from './screen.js';

const TAG = '[보호자 앱]';
const REFRESH_AFTER_MS = 60 * 1000; // 앱으로 돌아왔을 때 1분이 지났으면 새로 불러오기

const root = document.getElementById('app');
const today = () => localDate(new Date().toISOString());

const state = {
  view: 'home', // 'connect' | 'home' | 'settings' | 'day'
  day: null, // 회차 화면의 날짜 'YYYY-MM-DD'
  tab: 0, // 회차 탭 (그날 몇 번째 코스)
  trend: 'step2-rps', // 모아 보기 "반응 시간 변화"에서 고른 활동
  conn: null, // { code, name }
  demo: false,
  summaries: [],
  status: 'loading', // 'loading' | 'ok' | 'empty' | 'error' | 'nosetup'
  loadedAt: null,
  month: monthOf(today()),
  notice: '',
  saved: false,
  connectError: '',
};

/** 주소에서 # 뒤를 지운다 (새로고침해도 다시 읽지 않게) */
function clearHash() {
  history.replaceState(null, '', location.pathname + location.search);
}

function start() {
  const parsed = parseHash(location.hash);
  Object.assign(state, { view: 'home', day: null, tab: 0, notice: '', saved: false, connectError: '', month: monthOf(today()), loadedAt: null });

  state.demo = parsed.kind === 'demo';
  if (state.demo) {
    state.conn = { code: null, name: DEMO_NAME };
    state.summaries = demoSummaries(today());
    state.status = 'ok';
    render();
    return;
  }

  state.summaries = [];
  if (parsed.kind === 'pair') {
    const before = loadConnection();
    const name = parsed.name || (before?.code === parsed.code ? before.name : '');
    state.conn = { code: parsed.code, name };
    saveConnection(state.conn);
    state.notice = pairedText(name);
    clearHash();
  } else {
    state.conn = loadConnection();
    if (parsed.kind === 'bad') {
      clearHash();
      state.connectError = 'QR 주소에서 연결 코드를 읽지 못했어요. 스테이션 화면의 코드를 직접 넣어 주세요.';
      if (state.conn) state.notice = 'QR 주소에서 연결 코드를 읽지 못해, 전에 연결한 기록을 보여 드려요.';
    }
  }

  if (!state.conn) {
    state.view = 'connect';
    render();
    return;
  }
  refresh();
}

async function refresh() {
  if (state.demo || !state.conn) return;
  if (!hasApi()) {
    console.info(`${TAG} VITE_SUPABASE_URL·VITE_SUPABASE_ANON_KEY 가 없어 기록을 읽지 않아요. #demo 로 예시 화면을 볼 수 있어요.`);
    state.status = 'nosetup';
    render();
    return;
  }
  const code = state.conn.code;
  state.status = 'loading';
  render();
  try {
    const list = await fetchSummaries(code);
    if (state.conn?.code !== code || state.demo) return; // 그사이 연결이 바뀌었으면 버린다
    state.summaries = list;
    state.status = list.length ? 'ok' : 'empty';
    state.loadedAt = new Date().toISOString();
  } catch (err) {
    console.error(`${TAG} 요약을 읽지 못했어요`, err);
    state.status = 'error';
  }
  render();
}

function connectManually({ code, name }) {
  const c = normalizeCode(code);
  if (!c) return '연결 코드 12글자를 다시 확인해 주세요. (예: ABCD-EFGH-JKMN)';
  state.conn = { code: c, name: cleanDisplayName(name) };
  saveConnection(state.conn);
  state.view = 'home';
  state.summaries = [];
  state.notice = pairedText(state.conn.name);
  refresh();
  return '';
}

/** 날짜를 누르면 회차 화면 (6-5 B). 휴대폰 뒤로 가기로 달력에 돌아올 수 있게 기록을 하나 쌓는다 */
function openDay(date) {
  Object.assign(state, { view: 'day', day: date, tab: 0, notice: '' });
  history.pushState({ view: 'day', date }, '');
  render();
  window.scrollTo(0, 0);
}

function closeDay() {
  Object.assign(state, { view: 'home', day: null, tab: 0 });
  render();
}

// 휴대폰 뒤로 가기: 회차 화면이면 달력으로 (주소 # 가 바뀔 때는 hashchange 의 start 가 맡는다)
window.addEventListener('popstate', (e) => {
  if (e.state?.view === 'day' && state.conn) {
    Object.assign(state, { view: 'day', day: e.state.date, tab: 0 });
    render();
  } else if (state.view === 'day') {
    closeDay();
  }
});

function render() {
  if (state.view === 'day' && state.conn) {
    renderDay(root, {
      title: dayTitle(state.day),
      courses: coursesOn(state.summaries, state.day),
      index: state.tab,
      routines,
      demo: state.demo,
      onTab: (i, focus) => {
        state.tab = i;
        render();
        if (focus) document.getElementById(`tab-${i}`)?.focus();
      },
      // 이 앱 안에서 연 화면이면 뒤로 가기와 같게, 아니면(새로고침 등) 그냥 달력으로
      onBack: () => (history.state?.view === 'day' ? history.back() : closeDay()),
    });
    return;
  }

  if (state.view === 'connect') {
    renderConnect(root, {
      error: state.connectError,
      onSubmit: connectManually,
      onDemo: () => {
        location.hash = 'demo';
      },
    });
    return;
  }

  if (state.view === 'settings') {
    renderSettings(root, {
      conn: state.conn,
      codeText: formatCode(state.conn.code),
      saved: state.saved,
      onSaveName: (name) => {
        state.conn = { ...state.conn, name: cleanDisplayName(name) };
        saveConnection(state.conn);
        state.saved = true;
        render();
      },
      onDisconnect: () => {
        const ok = window.confirm('이 폰에서 연결을 해제할까요? 다시 보려면 QR을 다시 찍거나 코드를 넣어야 해요.');
        if (!ok) return;
        clearConnection();
        Object.assign(state, { conn: null, summaries: [], view: 'connect', notice: '', connectError: '' });
        render();
      },
      onBack: () => {
        state.view = 'home';
        state.notice = '';
        render();
      },
    });
    return;
  }

  const t = today();
  renderHome(root, {
    title: pageTitle(state.conn.name),
    demo: state.demo,
    notice: state.notice,
    status: state.status,
    loadedAt: state.loadedAt,
    month: state.month,
    range: monthRange(t),
    counts: countByDate(state.summaries),
    summaries: state.summaries,
    trendProgram: state.trend,
    onTrend: (id) => {
      state.trend = id;
      render();
    },
    today: t,
    onPrev: () => {
      state.month = shiftMonth(state.month, -1);
      render();
    },
    onNext: () => {
      state.month = shiftMonth(state.month, 1);
      render();
    },
    onReload: () => {
      state.notice = '';
      refresh();
    },
    onOpenDay: (date) => {
      state.month = monthOf(date);
      openDay(date);
    },
    onSettings: () => {
      state.view = 'settings';
      state.saved = false;
      render();
    },
    onExitDemo: () => {
      location.hash = '';
    },
  });
}

window.addEventListener('hashchange', start);

// 홈 화면 앱은 뒤로 갔다 돌아와도 새로 열리지 않는다. 돌아왔을 때 1분이 지났으면 새로 불러온다
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || state.view !== 'home' || state.demo || !state.conn) return;
  const last = state.loadedAt ? Date.parse(state.loadedAt) : 0;
  if (Date.now() - last > REFRESH_AFTER_MS) refresh();
});

// 홈 화면에 추가했을 때 화면 파일을 폰에 저장해 빨리 열리게 (배포 빌드에서만. 개발 서버에서는 끈다)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}guardian/sw.js`)
    .catch((err) => console.warn(`${TAG} 서비스 워커를 켜지 못했어요`, err));
}

start();
