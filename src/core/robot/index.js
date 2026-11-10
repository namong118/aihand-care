// 로봇 출력 장치 선택: 처음에는 Mock(화면 속 로봇손), "AIHand 연결" 버튼으로 연결하면 실제 AIHand.
// 연결이 끊기면 다시 Mock 으로 돌아가서 활동이 멈추지 않게 한다.
// 프로그램은 이 파일을 직접 import 하지 않고 ctx.robot 만 쓴다.

import { createMockRobot } from './mock.js';
import { createSerialRobot, openSerialPort, isSerialSupported } from './serial.js';

/**
 * @returns 로봇 전환기. ctx.robot 함수(hello, showPose, react, rest)는 지금 쓰는 장치로 보낸다.
 *          대시보드용: connect, setSpeed, status, onChange, mountControls
 *          core/card 용: onTag(WonderCam 이 읽은 태그 번호), camMode(WonderCam 모드 전환)
 */
export function createRobot({ poses, openPort = openSerialPort, supported = isSerialSupported }) {
  const mock = createMockRobot({ poses });
  let serial = null; // 연결되어 있으면 serial 로봇
  let everConnected = false;
  let connecting = false;
  let note = '화면 속 로봇손';
  const listeners = new Set();
  const tagListeners = new Set();

  const active = () => serial ?? mock;
  function changed() {
    listeners.forEach((cb) => cb());
  }
  function setNote(text) {
    if (note === text) return;
    note = text;
    changed();
  }

  function backToMock(reason) {
    serial = null;
    note = `${reason}. 화면 속 로봇손으로 계속해요`;
    changed();
  }

  return {
    get kind() {
      return active().kind;
    },

    // ---- ctx.robot ----
    hello: () => active().hello(),
    showPose: (name) => active().showPose(name),
    react: (kind) => active().react(kind),
    rest: () => active().rest(),

    // ---- 대시보드 ----
    /**
     * "AIHand 연결" 버튼에서 부른다. 포트 고르기 창은 클릭 안에서만 열 수 있으므로
     * 이 함수는 클릭 처리 함수에서 await 없이 바로 불러야 한다.
     * @returns {Promise<boolean>} 연결 성공 여부
     */
    async connect({ speed } = {}) {
      if (serial || connecting) return Boolean(serial);
      if (!supported()) {
        setNote('연결하려면 Chrome에서 열어 주세요');
        return false;
      }
      let port;
      try {
        port = await openPort();
      } catch (e) {
        // 창을 닫은 경우(NotFoundError)는 조용히 넘어간다
        if (e?.name !== 'NotFoundError') setNote('포트를 열지 못했어요. 다른 프로그램이 쓰고 있는지 확인해 주세요');
        return false;
      }
      connecting = true;
      setNote('연결 확인 중…');
      const robot = createSerialRobot({
        port,
        onLost: (reason) => {
          if (serial === robot) backToMock(reason);
          // 포트를 닫아 두어야 USB 를 다시 꽂았을 때 "AIHand 연결" 로 다시 열 수 있다
          robot.close();
        },
        onResult: ({ ok, text }) => {
          if (serial === robot) setNote(ok ? '' : text);
        },
        onTag: (id) => {
          if (serial === robot) tagListeners.forEach((cb) => cb(id));
        },
      });
      const ok = await robot.check();
      connecting = false;
      if (!ok) {
        await robot.close();
        setNote('AIHand 가 응답하지 않아요. 펌웨어 F2 와 전원을 확인해 주세요');
        return false;
      }
      serial = robot;
      everConnected = true;
      note = '';
      changed();
      if (speed) await robot.speed(speed);
      return true;
    },

    /** 홈에서 진행 속도를 바꿀 때. 실제 AIHand 에 연결되어 있을 때만 SPEED 를 보낸다 */
    setSpeed(value) {
      return serial ? serial.speed(value) : Promise.resolve(null);
    },

    /** WonderCam 모드 전환 ('TAG'). 실제 AIHand 에 연결되어 있지 않으면 null */
    camMode(mode) {
      return serial ? serial.camMode(mode) : Promise.resolve(null);
    },

    /** WonderCam 태그 줄 구독. cb(id): '0'~'3' 같은 태그 번호, 카드가 사라지면 null */
    onTag(cb) {
      tagListeners.add(cb);
      return () => tagListeners.delete(cb);
    },

    /** 상태 표시줄용 */
    status() {
      if (serial) return { state: 'connected', mock: false, note };
      return { state: everConnected ? 'disconnected' : 'mock', mock: true, note, connecting };
    },

    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },

    /** Mock 패널의 가상 로봇손 */
    mountControls(container) {
      return mock.mountControls(container);
    },
  };
}
