// 로봇 Mock: 화면의 가상 로봇손(손가락 5개 SVG)으로 동작을 보여준다.
// 실제 로봇과 똑같이 protocol.js 로 명령 문자열을 만들고,
// 0.8초 뒤 'DONE,<명령>' 을 받은 것처럼 Promise 를 resolve 한다.

import * as protocol from './protocol.js';

export const MOCK_DELAY_MS = 800;

const FINGER_NAMES = ['엄지', '검지', '중지', '약지', '새끼'];

export function createMockRobot({ poses, delayMs = MOCK_DELAY_MS }) {
  const state = {
    code: '11111', // 지금 가상 손 모양 (처음은 편 손)
    label: '대기',
    lastCommand: '',
    busy: false,
  };
  const viewListeners = new Set();
  let queue = Promise.resolve(); // 명령은 실제 로봇처럼 하나씩 차례로 처리

  function notify() {
    viewListeners.forEach((cb) => cb({ ...state }));
  }

  function poseCode(name) {
    const p = poses.find((x) => x.name === name);
    if (!p) throw new Error(`poses.json 에 없는 손모양: ${name}`);
    return p.code;
  }

  /** 명령 한 줄을 "보내고" delayMs 뒤 DONE 을 받은 것처럼 처리한다. */
  function send(line, apply) {
    const run = () =>
      new Promise((resolve) => {
        state.busy = true;
        state.lastCommand = line.trim();
        apply();
        notify();
        setTimeout(() => {
          state.busy = false;
          notify();
          resolve(protocol.parseLine(`DONE,${protocol.commandName(line)}`));
        }, delayMs);
      });
    const p = queue.then(run);
    queue = p.catch(() => {});
    return p;
  }

  return {
    kind: 'mock',

    // ---- ctx.robot 으로 공개되는 부분 ----
    hello() {
      return send(protocol.hello(), () => {
        state.code = '11111';
        state.label = '인사하기';
      });
    },
    showPose(name) {
      // 이름 확인은 send 전에 해서 잘못된 이름이면 바로 에러가 나게 한다.
      const line = protocol.pose(name);
      const code = poseCode(name);
      const label = poses.find((x) => x.name === name).label;
      return send(line, () => {
        state.code = code;
        state.label = label;
      });
    },
    react(kind) {
      const line = protocol.react(kind);
      return send(line, () => {
        // [검증 필요] 실제 AIHand 의 OK/RETRY 반응 동작은 펌웨어에서 정한다.
        state.label = kind === 'ok' ? '잘했어요 반응' : '다시 해 볼까요 반응';
      });
    },
    rest() {
      return send(protocol.rest(), () => {
        state.code = '11111';
        state.label = '쉬기 (손 내림)';
      });
    },

    // ---- Mock 패널 전용 ----
    getState() {
      return { ...state };
    },
    onView(cb) {
      viewListeners.add(cb);
      return () => viewListeners.delete(cb);
    },

    /** 화면 오른쪽 Mock 패널에 가상 로봇손을 그린다. */
    mountControls(container) {
      container.innerHTML = '';
      const title = document.createElement('h2');
      title.textContent = '가상 로봇손 (AIHand 대신)';
      const figure = document.createElement('div');
      figure.className = 'robot-figure';
      const label = document.createElement('p');
      label.className = 'robot-label';
      const cmd = document.createElement('p');
      cmd.className = 'mock-status';
      container.append(title, figure, label, cmd);

      const render = (s) => {
        figure.innerHTML = handSvg(s.code);
        label.textContent = `${s.label}${s.busy ? ' …움직이는 중' : ''}`;
        cmd.textContent = s.lastCommand ? `보낸 명령: ${s.lastCommand}` : '보낸 명령: 없음';
      };
      render(state);
      return this.onView(render);
    },
  };
}

/** 5비트 code 로 손가락 5개 SVG 를 만든다. 펴진 손가락은 길게, 접힌 손가락은 짧게. */
export function handSvg(code) {
  const xs = [18, 58, 98, 138, 178];
  const fingers = [...code]
    .map((bit, i) => {
      const up = bit === '1';
      const h = up ? 110 : 34;
      const y = 150 - h;
      // 엄지는 조금 낮게 시작
      const dy = i === 0 ? 30 : 0;
      return `<rect x="${xs[i]}" y="${y + dy}" width="32" height="${h}" rx="16"
        fill="${up ? 'var(--robot-up)' : 'var(--robot-down)'}" stroke="var(--fg)" stroke-width="3">
        <title>${FINGER_NAMES[i]} ${up ? '펴짐' : '접힘'}</title></rect>`;
    })
    .join('');
  const text = [...code].map((b, i) => `${FINGER_NAMES[i]} ${b === '1' ? '펴짐' : '접힘'}`).join(', ');
  return `<svg viewBox="0 0 228 250" role="img" aria-label="가상 로봇손: ${text}">
    ${fingers}
    <rect x="10" y="140" width="208" height="100" rx="24" fill="var(--robot-palm)" stroke="var(--fg)" stroke-width="3"/>
  </svg>`;
}
