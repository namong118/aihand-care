// 로봇 출력 장치 선택: 처음에는 Mock(화면 속 로봇손), "AIHand 연결" 버튼으로 연결하면 실제 AIHand.
// 한 번 허락한 AIHand 는 앱을 켤 때와 USB 를 다시 꽂을 때 자동으로 다시 연결한다 (startAutoConnect, 키오스크용).
// 연결이 끊기면 다시 Mock 으로 돌아가서 활동이 멈추지 않게 한다.
// 프로그램은 이 파일을 직접 import 하지 않고 ctx.robot 만 쓴다.

import { createMockRobot } from './mock.js';
import { createSerialRobot, openSerialPort, openGrantedPort, isSerialSupported } from './serial.js';

/** USB 를 꽂은 뒤 micro:bit 가 켜져 PING 에 답할 때까지 기다리는 시간 */
export const PLUG_WAIT_MS = 1500;

/**
 * @returns 로봇 전환기. ctx.robot 함수(hello, showPose, react, rest)는 지금 쓰는 장치로 보낸다.
 *          대시보드용: connect, setSpeed, status, onChange, mountControls
 *          core/card 용: onTag(태그 번호), onNumber(숫자 카드), onFace(얼굴 번호), camMode(WonderCam 모드 전환)
 */
export function createRobot({
  poses,
  openPort = openSerialPort,
  openGranted = openGrantedPort,
  serialEvents = globalThis.navigator?.serial,
  supported = isSerialSupported,
}) {
  const mock = createMockRobot({ poses });
  let serial = null; // 연결되어 있으면 serial 로봇
  let everConnected = false;
  let connecting = false;
  let note = '화면 속 로봇손';
  const listeners = new Set();
  const tagListeners = new Set();
  const numberListeners = new Set();
  const faceListeners = new Set();
  const ballListeners = new Set(); // BALL,NEAR (공 따라가기 중 공이 손 가까이, 펌웨어 F5)

  const active = () => serial ?? mock;
  function changed() {
    listeners.forEach((cb) => cb());
  }
  function setNote(text) {
    if (note === text) return;
    note = text;
    changed();
  }

  /** "연결 중…" 표시를 켜고 끈다. 상태 표시줄이 다시 그려지도록 반드시 알린다 */
  function setConnecting(value) {
    if (connecting === value) return;
    connecting = value;
    changed();
  }

  function backToMock(reason) {
    serial = null;
    note = `${reason}. 화면 속 로봇손으로 계속해요`;
    changed();
  }

  /**
   * 포트를 받아 PING 확인 → 실제 AIHand 로 바꾼다. connect·startAutoConnect 가 함께 쓴다.
   * @param portPromise  열린 포트로 resolve (자동 연결에서 허락한 포트가 없으면 null)
   * @param auto  자동 연결이면 true: 포트를 못 열어도 안내 문구를 바꾸지 않는다
   */
  async function connectWith(portPromise, { speed, auto }) {
    setConnecting(true);
    let port;
    try {
      port = await portPromise;
    } catch (e) {
      setConnecting(false);
      // 창을 닫은 경우(NotFoundError)는 조용히 넘어간다
      if (!auto && e?.name !== 'NotFoundError') setNote('포트를 열지 못했어요. 다른 프로그램이 쓰고 있는지 확인해 주세요');
      return false;
    }
    if (!port) {
      setConnecting(false);
      return false;
    }
    setNote(auto ? '전에 연결한 AIHand 에 다시 연결하는 중…' : '연결 확인 중…');
    const robot = createSerialRobot({
      port,
      onLost: (reason) => {
        if (serial === robot) backToMock(reason);
        // 포트를 닫아 두어야 USB 를 다시 꽂았을 때 다시 열 수 있다 (자동 연결·"AIHand 연결")
        robot.close();
      },
      onResult: ({ ok, text }) => {
        if (serial === robot) setNote(ok ? '' : text);
      },
      onTag: (id) => {
        if (serial === robot) tagListeners.forEach((cb) => cb(id));
      },
      onNumber: (n) => {
        if (serial === robot) numberListeners.forEach((cb) => cb(n));
      },
      onFace: (faceId) => {
        if (serial === robot) faceListeners.forEach((cb) => cb(faceId));
      },
      onBallNear: () => {
        if (serial === robot) ballListeners.forEach((cb) => cb());
      },
    });
    const ok = await robot.check();
    setConnecting(false);
    if (!ok) {
      await robot.close();
      setNote('AIHand 가 응답하지 않아요. 펌웨어와 전원을 확인해 주세요');
      return false;
    }
    serial = robot;
    everConnected = true;
    note = '';
    changed();
    if (speed) await robot.speed(speed);
    // 연결하자마자 쉬는 자세를 한 번 보낸다. AIHand 서보(PWM)는 켜진 뒤 첫 명령을 정한 속도와 상관없이
    // 최고 속도로 움직이므로(2026-11-13 실물 확인), 그 빠른 첫 움직임을 활동 중이 아니라 연결할 때 끝낸다
    await robot.rest();
    return true;
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
    connect({ speed } = {}) {
      if (serial || connecting) return Promise.resolve(Boolean(serial));
      if (!supported()) {
        setNote('연결하려면 Chrome에서 열어 주세요');
        return Promise.resolve(false);
      }
      // 포트 고르기 창은 클릭 안에서만 열리므로 openPort 를 await 앞에서 바로 부른다
      return connectWith(openPort(), { speed, auto: false });
    },

    /**
     * 키오스크용 자동 연결. 전에 허락한 AIHand 가 있으면 고르기 창 없이 연결한다.
     * 앱을 켤 때 한 번, 그리고 USB 를 다시 꽂을 때마다(serial 'connect' 이벤트) 시도한다.
     * 허락한 포트가 없으면 아무것도 하지 않는다 (처음 한 번은 "AIHand 연결"을 눌러야 한다).
     * @param getSpeed  연결할 때 보낼 진행 속도를 돌려주는 함수 (설정이 바뀔 수 있어서 함수로 받는다)
     * @returns 그만두기 함수
     */
    startAutoConnect(getSpeed = () => undefined) {
      if (!supported()) return () => {};
      const tryGranted = () => {
        if (serial || connecting) return Promise.resolve(Boolean(serial));
        return connectWith(openGranted(), { speed: getSpeed(), auto: true });
      };
      let plugTimer = null;
      const onPlug = () => {
        // 꽂자마자는 micro:bit 가 아직 켜지는 중이라 잠깐 기다린다
        clearTimeout(plugTimer);
        plugTimer = setTimeout(tryGranted, PLUG_WAIT_MS);
      };
      serialEvents?.addEventListener?.('connect', onPlug);
      tryGranted();
      return () => {
        clearTimeout(plugTimer);
        serialEvents?.removeEventListener?.('connect', onPlug);
      };
    },


    /** 홈에서 진행 속도를 바꿀 때. 실제 AIHand 에 연결되어 있을 때만 SPEED 를 보낸다 */
    setSpeed(value) {
      return serial ? serial.speed(value) : Promise.resolve(null);
    },

    /** WonderCam 모드 전환 ('TAG' | 'NUM' | 'FACE' | 'COLOR'). 실제 AIHand 에 연결되어 있지 않으면 null */
    camMode(mode) {
      return serial ? serial.camMode(mode) : Promise.resolve(null);
    },

    /** 공 따라가기 켜기·끄기 (펌웨어 F5, TRACK,ON|OFF). 실제 AIHand 가 아니면 null. ctx.robot.followBall 이 쓴다 */
    track(on) {
      return serial ? serial.track(on) : Promise.resolve(null);
    },

    /** WonderCam 태그 줄 구독. cb(id): '0'~'3' 같은 태그 번호, 카드가 사라지면 null */
    onTag(cb) {
      tagListeners.add(cb);
      return () => tagListeners.delete(cb);
    },

    /** WonderCam 숫자 줄 구독. cb(n): 1~5, 숫자 카드가 사라지면 null */
    onNumber(cb) {
      numberListeners.add(cb);
      return () => numberListeners.delete(cb);
    },

    /** WonderCam 얼굴 줄 구독. cb(faceId): 학습된 얼굴 번호, 모르는 얼굴이면 'unknown', 얼굴이 사라지면 null */
    onFace(cb) {
      faceListeners.add(cb);
      return () => faceListeners.delete(cb);
    },

    /** 공 따라가기 중 공이 손 가까이 옴 (BALL,NEAR). 펌웨어는 이미 따라가기를 멈췄다. ctx.robot.followBall 이 쓴다 */
    onBallNear(cb) {
      ballListeners.add(cb);
      return () => ballListeners.delete(cb);
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
