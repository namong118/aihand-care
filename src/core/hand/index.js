// 손 인식 장치 선택: 처음에는 Mock(개발자 입력의 손모양 버튼), "웹캠 켜기" 버튼을 누르면 웹캠 손 인식.
// 웹캠이 꺼지거나 끊기면 다시 Mock 으로 돌아가서 활동이 멈추지 않게 한다 (robot/index.js 와 같은 방식).
// 프로그램은 이 파일을 직접 import 하지 않고 ctx.hand 만 쓴다.

import { createMockHand } from './mock.js';

export { codeToName, nameToCode } from './codes.js';
export { makeWaitForPose, isConfirmedPose } from './wait.js';

const NO_HAND = Object.freeze({ code: null, name: null, handedness: null, stableMs: 0 });

/**
 * @param {object} options
 * @param poses       data/poses.json
 * @param loadCamera  웹캠 손 인식 모듈을 불러오는 함수 (테스트에서 가짜로 바꾼다)
 * @returns 손 인식 전환기. onPose 는 지금 쓰는 장치(웹캠 또는 Mock)의 결과만 보낸다.
 *          대시보드용: startCamera, stopCamera, status, onChange, cameraView
 *          Mock 패널용: select, lower, onView, mountControls
 */
export function createHand({ poses, loadCamera = () => import('./mediapipe.js') }) {
  const mock = createMockHand({ poses });
  let camera = null; // 켜져 있으면 웹캠 손 인식
  let starting = false;
  let everOn = false;
  let note = '화면 버튼';
  const listeners = new Set();
  const changeListeners = new Set();

  function emit(pose) {
    listeners.forEach((cb) => cb(pose));
  }
  function changed() {
    changeListeners.forEach((cb) => cb());
  }

  // Mock 손모양은 웹캠이 꺼져 있을 때만 전달한다
  mock.onPose((pose) => {
    if (!camera) emit(pose);
  });

  function backToMock(text) {
    camera = null;
    note = text;
    emit(NO_HAND); // 웹캠으로 들고 있던 손모양이 남지 않게
    changed();
  }

  return {
    get kind() {
      return camera ? camera.kind : mock.kind;
    },

    // ---- ctx.hand ----
    onPose(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },

    // ---- 대시보드 ----
    /**
     * "웹캠 켜기" 버튼에서 부른다. 처음 켤 때 브라우저가 웹캠 사용 허락을 묻는다.
     * @returns {Promise<boolean>} 켜기 성공 여부
     */
    async startCamera() {
      if (camera || starting) return Boolean(camera);
      starting = true;
      note = '켜는 중…';
      changed();
      try {
        const { createMediaPipeHand } = await loadCamera();
        const cam = await createMediaPipeHand({
          poses,
          onLost: (reason) => {
            if (camera === cam) backToMock(`${reason}. 화면 버튼으로 계속해요`);
          },
        });
        mock.lower(); // 버튼으로 들고 있던 손모양은 내린다
        camera = cam;
        everOn = true;
        note = '웹캠';
        cam.onPose((pose) => {
          if (camera === cam) emit(pose);
        });
        return true;
      } catch (err) {
        console.error('웹캠 손 인식 시작 실패', err);
        note = err?.message || '웹캠을 켜지 못했어요';
        return false;
      } finally {
        starting = false;
        changed();
      }
    },

    /** "웹캠 끄기" 버튼. 화면 버튼 입력으로 돌아간다 */
    stopCamera() {
      if (!camera) return;
      const cam = camera;
      backToMock('화면 버튼');
      cam.stop();
    },

    /** 상태 표시줄용 (robot.status() 와 같은 모양) */
    status() {
      if (camera) return { state: 'connected', mock: false, note };
      return { state: everOn ? 'disconnected' : 'mock', mock: true, note, starting };
    },

    onChange(cb) {
      changeListeners.add(cb);
      return () => changeListeners.delete(cb);
    },

    /** 웹캠 미리 보기 화면 (켜져 있을 때만, 아니면 null) */
    get cameraView() {
      return camera?.el ?? null;
    },

    // ---- Mock 패널 (프로그램은 쓰지 않는다) ----
    select: (name) => mock.select(name),
    lower: () => mock.lower(),
    onView: (cb) => mock.onView(cb),
    mountControls: (container) => mock.mountControls(container),
    destroy() {
      camera?.stop();
      camera = null;
      mock.destroy();
      listeners.clear();
      changeListeners.clear();
    },
  };
}
