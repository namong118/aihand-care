// 손 인식 Mock.
// 화면 버튼으로 손모양을 "토글"한다.
// - 손모양 버튼을 한 번 누르면 그 모양을 계속 들고 있는 상태가 된다.
// - 들고 있는 동안 0.1초마다 onPose 이벤트가 나가고 stableMs 가 늘어난다.
// - 다른 손모양을 누르면 바뀌고 stableMs 는 0부터 다시 센다.
// - "손 내리기"를 누르면 code: null 을 한 번 보내고 멈춘다.

import { codeToName, nameToCode } from './codes.js';

const TICK_MS = 100;

export function createMockHand({ poses, now = () => Date.now() }) {
  const listeners = new Set();
  let currentCode = null; // 지금 들고 있는 손모양 code. 없으면 null
  let since = 0; // 지금 손모양을 들기 시작한 시각
  let timer = null;
  const viewListeners = new Set(); // Mock 패널 화면 갱신용

  function makePose() {
    if (currentCode === null) {
      return { code: null, name: null, handedness: null, stableMs: 0 };
    }
    return {
      code: currentCode,
      name: codeToName(currentCode, poses),
      handedness: 'Right',
      stableMs: now() - since,
    };
  }

  function emit() {
    const pose = makePose();
    listeners.forEach((cb) => cb(pose));
    viewListeners.forEach((cb) => cb(pose));
  }

  function stopTimer() {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  /** 손모양 이름으로 고른다 ('ROCK' 등). 같은 모양을 다시 눌러도 유지된다. */
  function select(name) {
    const code = nameToCode(name, poses);
    if (code === null) throw new Error(`알 수 없는 손모양: ${name}`);
    if (code !== currentCode) {
      currentCode = code;
      since = now();
    }
    if (timer === null) timer = setInterval(emit, TICK_MS);
    emit();
  }

  /** 손 내리기: code null 을 한 번 보내고 멈춘다. */
  function lower() {
    stopTimer();
    currentCode = null;
    emit();
  }

  return {
    kind: 'mock',

    // ---- ctx.hand 로 공개되는 부분 ----
    onPose(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },

    // ---- Mock 패널 전용 (프로그램은 쓰지 않는다) ----
    select,
    lower,
    onView(cb) {
      viewListeners.add(cb);
      return () => viewListeners.delete(cb);
    },
    destroy() {
      stopTimer();
      listeners.clear();
      viewListeners.clear();
    },

    /** 화면 오른쪽 Mock 패널에 손모양 버튼을 그린다. */
    mountControls(container) {
      container.innerHTML = '';
      const title = document.createElement('h2');
      title.textContent = '사용자 손모양 입력 (웹캠 손 인식 대신 · 로봇은 안 움직여요)';
      const status = document.createElement('p');
      status.className = 'mock-status';
      status.textContent = '지금: 손 내림';

      const grid = document.createElement('div');
      grid.className = 'mock-grid';
      const buttons = new Map();
      for (const p of poses) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-small';
        btn.textContent = p.label;
        btn.setAttribute('aria-pressed', 'false');
        btn.addEventListener('click', () => select(p.name));
        buttons.set(p.code, btn);
        grid.append(btn);
      }
      const lowerBtn = document.createElement('button');
      lowerBtn.type = 'button';
      lowerBtn.className = 'btn btn-small btn-secondary';
      lowerBtn.textContent = '손 내리기';
      lowerBtn.addEventListener('click', lower);

      container.append(title, status, grid, lowerBtn);

      return this.onView((pose) => {
        for (const [code, btn] of buttons) {
          const on = code === pose.code;
          btn.setAttribute('aria-pressed', String(on));
          btn.textContent = (on ? '✔ ' : '') + poses.find((p) => p.code === code).label;
        }
        if (pose.code === null) {
          status.textContent = '지금: 손 내림';
        } else {
          const label = poses.find((p) => p.code === pose.code).label;
          status.textContent = `지금: ${label} (${(pose.stableMs / 1000).toFixed(1)}초 유지)`;
        }
      });
    },
  };
}
