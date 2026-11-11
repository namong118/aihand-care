// 웹캠 + MediaPipe Hand Landmarker 로 손모양을 인식하는 모듈.
// hand/index.js 가 "웹캠 켜기" 때만 불러온다 (import()). 처음 화면을 가볍게 하려고.
//
// 시연 장비: 라즈베리파이 5 + 로지텍 C270, Chromium. 그래서
//  - 손 1개만 인식, 해상도 기본 640×480
//  - GPU 로 먼저 시도하고, 안 되면 CPU 로 바꾼다
//  - 모델(public/models/)과 WASM(public/mediapipe/wasm/, 빌드 때 복사)을 같은 주소에서 불러온다.
//    인터넷(CDN)을 쓰지 않는다.
//
// 반환 형태와 이벤트 값은 docs/hand-api.md 를 따른다 (mock.js 와 같은 onPose).

import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { codeToName } from './codes.js';
import { landmarksToCode, createCodeSmoother, flipHandedness } from './fingers.js';

// GitHub Pages 주소(/aihand-care/)에서도 맞게 BASE_URL 을 붙인다 (vite.config.js 참고)
const BASE = import.meta.env.BASE_URL;
const WASM_PATH = `${BASE}mediapipe/wasm`;
const MODEL_PATH = `${BASE}models/hand_landmarker.task`;

const TICK_MS = 100; // onPose 를 보내는 간격 (Mock 과 같음)

// 기본 해상도. 고르기 목록은 hand/index.js 의 resolutions
const DEFAULT_RESOLUTION = { width: 640, height: 480 };

/** getUserMedia 오류 → 화면 안내 문구 */
function cameraErrorText(err) {
  switch (err?.name) {
    case 'NotAllowedError':
      return '카메라 사용을 허용해 주세요';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return '웹캠을 찾지 못했어요';
    case 'NotReadableError':
      return '다른 프로그램이 웹캠을 쓰고 있어요';
    default:
      return '웹캠을 켜지 못했어요';
  }
}

async function createLandmarker(delegate) {
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
  return HandLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_PATH, delegate },
    runningMode: 'VIDEO',
    numHands: 1,
  });
}

/**
 * @param {object} o
 * @param {Array} o.poses         data/poses.json
 * @param {Function} o.onStop     웹캠이 꺼지거나 끊겼을 때 cb(reason). 사용자가 끈 경우 reason 은 null
 * @returns 웹캠 손 인식 장치
 */
export function createMediaPipeHand({ poses, onStop = () => {} }) {
  const listeners = new Set();
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.className = 'webcam-video';

  let landmarker = null;
  let delegate = null; // 'GPU' | 'CPU'
  let stream = null;
  let running = false;
  let rafId = 0;
  let tickTimer = null;
  let lastVideoTime = -1;
  let smooth = createCodeSmoother(2);

  // 지금 손 상태
  let code = null;
  let handedness = null;
  let since = 0; // code 가 바뀐 시각

  // 초당 인식 횟수 (FPS)
  let frames = 0;
  let fpsFrom = 0;
  let fps = 0;

  function makePose() {
    if (code === null) return { code: null, name: null, handedness: null, stableMs: 0 };
    return { code, name: codeToName(code, poses), handedness, stableMs: Date.now() - since };
  }

  function emit() {
    const pose = makePose();
    listeners.forEach((cb) => cb(pose));
  }

  function setCode(next, hand) {
    if (next !== code) {
      code = next;
      since = Date.now();
    }
    handedness = next === null ? null : hand;
  }

  /** 한 프레임 인식. GPU 에서 오류가 나면 CPU 로 한 번 바꿔 본다 */
  async function detect() {
    const t = performance.now();
    let result;
    try {
      result = landmarker.detectForVideo(video, t);
    } catch (err) {
      if (delegate !== 'GPU') throw err;
      console.warn('GPU 인식 오류, CPU 로 바꿉니다', err);
      landmarker.close();
      landmarker = null;
      delegate = 'CPU';
      landmarker = await createLandmarker('CPU');
      return;
    }
    const lm = result.worldLandmarks?.[0] ?? null;
    const hand = flipHandedness(result.handedness?.[0]?.[0]?.categoryName);
    setCode(smooth(landmarksToCode(lm)), hand);

    frames += 1;
    if (t - fpsFrom >= 1000) {
      fps = (frames * 1000) / (t - fpsFrom);
      frames = 0;
      fpsFrom = t;
    }
  }

  async function loop() {
    if (!running) return;
    // 새 프레임이 들어왔을 때만 인식한다
    if (landmarker && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      try {
        await detect();
      } catch (err) {
        console.error('손 인식 오류', err);
        stop('손 인식 중에 문제가 생겼어요');
        return;
      }
    }
    if (running) rafId = requestAnimationFrame(loop);
  }

  /**
   * 웹캠을 켜고 인식을 시작한다. 실패하면 Error(message = 화면 안내 문구)를 던진다.
   * @param {{ deviceId?: string, width?: number, height?: number }} opts
   */
  async function start({ deviceId, width = DEFAULT_RESOLUTION.width, height = DEFAULT_RESOLUTION.height } = {}) {
    if (running) stopStream();
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('이 브라우저에서는 웹캠을 쓸 수 없어요');
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: width },
          height: { ideal: height },
        },
      });
    } catch (err) {
      console.warn('getUserMedia 실패', err);
      throw new Error(cameraErrorText(err));
    }
    const track = stream.getVideoTracks()[0];
    track.addEventListener('ended', () => stop('웹캠 연결이 끊겼어요'));

    video.srcObject = stream;
    await video.play();

    if (!landmarker) {
      try {
        delegate = 'GPU';
        landmarker = await createLandmarker('GPU');
      } catch (err) {
        console.warn('GPU 로 만들지 못해 CPU 로 바꿉니다', err);
        try {
          delegate = 'CPU';
          landmarker = await createLandmarker('CPU');
        } catch (err2) {
          console.error('손 인식 모델을 불러오지 못했어요', err2);
          stopStream();
          throw new Error('손 인식 모델을 불러오지 못했어요');
        }
      }
    }

    running = true;
    smooth = createCodeSmoother(2);
    setCode(null, null);
    frames = 0;
    fps = 0;
    fpsFrom = performance.now();
    lastVideoTime = -1;
    rafId = requestAnimationFrame(loop);
    tickTimer = setInterval(emit, TICK_MS);
  }

  function stopStream() {
    running = false;
    cancelAnimationFrame(rafId);
    if (tickTimer !== null) clearInterval(tickTimer);
    tickTimer = null;
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    video.srcObject = null;
  }

  /** 웹캠 끄기. reason 이 있으면 끊긴 것(오류), null 이면 사용자가 끈 것 */
  function stop(reason = null) {
    if (!running && !stream) return;
    stopStream();
    setCode(null, null);
    emit(); // 손이 사라졌다고 한 번 알린다
    onStop(reason);
  }

  return {
    kind: 'mediapipe',
    video, // 미리보기용 (개발자 입력 영역에 붙인다)

    onPose(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },

    start,
    stop,

    get running() {
      return running;
    },

    /** 측정용 정보: FPS, GPU/CPU, 실제 해상도, 카메라, 지금 code */
    info() {
      const s = stream?.getVideoTracks()[0]?.getSettings?.() ?? {};
      return {
        fps,
        delegate,
        width: s.width ?? null,
        height: s.height ?? null,
        deviceId: s.deviceId ?? null,
        code,
        name: codeToName(code, poses),
      };
    },

    destroy() {
      stop();
      listeners.clear();
      landmarker?.close();
      landmarker = null;
    },
  };
}

/** 연결된 카메라 목록. 카메라 이름은 웹캠을 한 번 허용한 뒤에야 보인다 */
export async function listCameras() {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const all = await navigator.mediaDevices.enumerateDevices();
  return all
    .filter((d) => d.kind === 'videoinput')
    .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `카메라 ${i + 1}` }));
}
