// 손 인식 장치 선택: 처음에는 Mock(화면 버튼), "웹캠 켜기" 버튼으로 실제 웹캠 손 인식(MediaPipe).
// 웹캠이 꺼지거나 끊기면 다시 Mock 으로 돌아가서 활동이 멈추지 않게 한다 (robot/index.js 와 같은 방식).
// 프로그램은 이 파일을 직접 import 하지 않고 ctx.hand 만 쓴다.
//
// 웹캠이 켜져 있어도 Mock 손모양 버튼은 계속 쓸 수 있다.
// 버튼으로 손모양을 들고 있는 동안(손 내리기 전까지)은 버튼 입력이 우선이고, 웹캠 결과는 무시한다.

import { createMockHand } from './mock.js';

export { codeToName, nameToCode } from './codes.js';
export { makeWaitForPose, isConfirmedPose } from './wait.js';

/**
 * @param {object} o
 * @param {Array} o.poses  data/poses.json
 * @param {Function} o.loadWebcam  mediapipe.js 불러오기 (테스트에서 바꿀 수 있게)
 * @returns 손 인식 전환기. onPose 는 지금 쓰는 장치의 결과를 보낸다.
 *          대시보드용: startWebcam, stopWebcam, status, onChange, webcam, listCameras
 *          Mock 패널용: select, lower, onView, mountControls
 */
export function createHand({ poses, loadWebcam = () => import('./mediapipe.js') }) {
  const mock = createMockHand({ poses });
  const listeners = new Set();
  const changeListeners = new Set();
  let module = null; // 불러온 mediapipe.js
  let webcam = null; // 웹캠 장치 (한 번 만들면 계속 쓴다)
  let starting = false;
  let everStarted = false;
  let note = '화면 버튼';

  function forward(pose) {
    listeners.forEach((cb) => cb(pose));
  }
  function changed() {
    changeListeners.forEach((cb) => cb());
  }

  mock.onPose(forward);

  const webcamOn = () => Boolean(webcam?.running);

  return {
    get kind() {
      return webcamOn() ? 'mediapipe' : 'mock';
    },

    // ---- ctx.hand ----
    onPose(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },

    // ---- 대시보드 ----
    /**
     * "웹캠 켜기" 버튼, 개발자 입력의 카메라·해상도 고르기에서 부른다.
     * 이미 켜져 있으면 새 설정으로 다시 켠다.
     * @param {{ deviceId?: string, width?: number, height?: number }} opts
     * @returns {Promise<boolean>} 켜졌는지
     */
    async startWebcam(opts = {}) {
      if (starting) return false;
      starting = true;
      note = '웹캠 켜는 중…';
      changed();
      try {
        if (!module) module = await loadWebcam();
        if (!webcam) {
          webcam = module.createMediaPipeHand({
            poses,
            onStop: (reason) => {
              note = reason ? `${reason}. 화면 버튼으로 계속해요` : '화면 버튼';
              changed();
            },
          });
          webcam.onPose((pose) => {
            if (!mock.holding) forward(pose);
          });
        }
        await webcam.start(opts);
        everStarted = true;
        note = '웹캠';
        return true;
      } catch (err) {
        console.warn('웹캠 손 인식을 켜지 못했어요', err);
        note = err?.message || '웹캠을 켜지 못했어요';
        return false;
      } finally {
        starting = false;
        changed();
      }
    },

    /** 웹캠 끄기 → 화면 버튼(Mock)으로 */
    stopWebcam() {
      webcam?.stop();
    },

    /** 웹캠 장치 (미리보기 video, info()). 켠 적이 없으면 null */
    get webcam() {
      return webcam;
    },

    /** 카메라 목록 [{ deviceId, label }]. 웹캠을 켠 적이 없으면 빈 배열일 수 있다 */
    async listCameras() {
      if (!module) return [];
      return module.listCameras();
    },

    /** 해상도 고르기 목록과 기본값 (mediapipe.js 를 불러오기 전에도 쓸 수 있게 여기 둔다) */
    resolutions: [
      { width: 320, height: 240 },
      { width: 640, height: 480 },
      { width: 1280, height: 720 },
    ],

    /** 상태 표시줄용 */
    status() {
      if (webcamOn()) return { state: 'connected', mock: false, note, starting };
      return { state: everStarted ? 'disconnected' : 'mock', mock: true, note, starting };
    },

    onChange(cb) {
      changeListeners.add(cb);
      return () => changeListeners.delete(cb);
    },

    // ---- Mock 패널 (화면 버튼) ----
    select: (name) => mock.select(name),
    lower: () => mock.lower(),
    onView: (cb) => mock.onView(cb),
    mountControls: (container) => mock.mountControls(container),

    destroy() {
      webcam?.destroy();
      mock.destroy();
      listeners.clear();
      changeListeners.clear();
    },
  };
}
