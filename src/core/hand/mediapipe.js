// 웹캠 + MediaPipe Hand Landmarker 로 손모양을 인식하는 모듈.
// index.js 가 "웹캠 켜기" 버튼을 눌렀을 때만 불러온다 (첫 화면을 빨리 열고, 테스트에서 불러오지 않게).
//
// 흐름: 웹캠 영상 → (화면 프레임마다) 랜드마크 21개 → fingers.js 로 5비트 code → 안정화
//       → 0.1초마다 onPose 로 { code, name, handedness, stableMs } 를 보낸다 (mock.js 와 같은 모양)
//
// 인터넷 없이 동작하도록 파일을 모두 이 앱 안에서 불러온다.
//  - wasm: npm 패키지 안의 파일을 Vite 가 함께 묶는다 (?url)
//  - 모델: public/models/hand_landmarker.task
// 반환 형태와 이벤트 값은 docs/hand-api.md 를 따른다.

import { HandLandmarker } from '@mediapipe/tasks-vision';
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url';
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url';
import { codeToName } from './codes.js';
import { landmarksToCode, createCodeStabilizer } from './fingers.js';

const TICK_MS = 100; // onPose 를 보내는 간격 (mock.js 와 같음)
// GitHub Pages 주소(/aihand-care/)에서도 맞도록 BASE_URL 을 붙인다 (vite.config.js 참고)
const MODEL_PATH = `${import.meta.env.BASE_URL}models/hand_landmarker.task`;

const CAMERA_ERROR_TEXT = {
  NotAllowedError: '웹캠 사용을 허용해 주세요',
  NotFoundError: '웹캠을 찾지 못했어요',
  OverconstrainedError: '웹캠을 찾지 못했어요',
  NotReadableError: '다른 프로그램이 웹캠을 쓰고 있어요',
};

/** 화면에 보여줄 오류 문구를 담은 Error */
function friendlyError(text, cause) {
  const err = new Error(text);
  err.cause = cause;
  return err;
}

async function createLandmarker() {
  const fileset = { wasmLoaderPath, wasmBinaryPath };
  const options = (delegate) => ({
    baseOptions: { modelAssetPath: MODEL_PATH, delegate },
    runningMode: 'VIDEO',
    numHands: 1,
  });
  try {
    return await HandLandmarker.createFromOptions(fileset, options('GPU'));
  } catch (err) {
    console.warn('GPU 로 손 인식을 시작하지 못해 CPU 로 다시 시도합니다', err);
    return HandLandmarker.createFromOptions(fileset, options('CPU'));
  }
}

/**
 * MediaPipe 는 거울처럼 뒤집힌(셀카) 영상을 기준으로 왼손·오른손을 정한다.
 * 웹캠 원본 영상을 그대로 넣으므로 반대로 바꾼다. [검증 필요] 실물 웹캠으로 확인
 */
function flipHandedness(label) {
  if (label === 'Left') return 'Right';
  if (label === 'Right') return 'Left';
  return null;
}

/**
 * 웹캠을 켜고 손 인식을 시작한다.
 * @param {object} options
 * @param {{name:string, code:string, label:string}[]} options.poses  data/poses.json
 * @param {(reason: string) => void} [options.onLost]  웹캠이 중간에 끊기면 한 번 불린다
 * @returns {Promise<{ kind: 'mediapipe', el: HTMLElement, onPose(cb): () => void, stop(): void }>}
 *          실패하면 화면에 보여줄 문구를 message 로 가진 Error 로 reject
 */
export async function createMediaPipeHand({ poses, onLost = () => {} }) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw friendlyError('이 브라우저에서는 웹캠을 쓸 수 없어요. Chrome에서 열어 주세요');
  }

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      audio: false,
    });
  } catch (err) {
    throw friendlyError(CAMERA_ERROR_TEXT[err?.name] ?? '웹캠을 켜지 못했어요', err);
  }

  // 미리 보기 화면: 영상 + 랜드마크 그림 + 인식 결과 한 줄
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  const canvas = document.createElement('canvas');
  canvas.className = 'cam-overlay';
  const frame = document.createElement('div');
  frame.className = 'cam-frame';
  frame.append(video, canvas);
  const caption = document.createElement('p');
  caption.className = 'cam-caption';
  caption.textContent = '손을 화면에 보여 주세요';
  const el = document.createElement('div');
  el.className = 'cam-view';
  el.append(frame, caption);

  let landmarker;
  try {
    video.srcObject = stream;
    await video.play();
    landmarker = await createLandmarker();
  } catch (err) {
    stream.getTracks().forEach((t) => t.stop());
    throw friendlyError('손 인식을 준비하지 못했어요', err);
  }

  const listeners = new Set();
  const stabilizer = createCodeStabilizer({ frames: 3 });
  let state = { code: null, since: 0 };
  let handedness = null;
  let lastVideoTime = -1;
  let rafId = 0;
  let stopped = false;

  function makePose() {
    if (state.code === null) return { code: null, name: null, handedness: null, stableMs: 0 };
    return {
      code: state.code,
      name: codeToName(state.code, poses),
      handedness,
      stableMs: Date.now() - state.since,
    };
  }

  function draw(points) {
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const g = canvas.getContext('2d');
    g.clearRect(0, 0, w, h);
    if (!points) return;
    g.lineWidth = 4;
    g.strokeStyle = '#FFFFFF';
    for (const { start, end } of HandLandmarker.HAND_CONNECTIONS) {
      g.beginPath();
      g.moveTo(points[start].x * w, points[start].y * h);
      g.lineTo(points[end].x * w, points[end].y * h);
      g.stroke();
    }
    g.fillStyle = '#2F5BD3';
    for (const p of points) {
      g.beginPath();
      g.arc(p.x * w, p.y * h, 6, 0, Math.PI * 2);
      g.fill();
    }
  }

  // 화면 프레임마다: 새 영상 프레임이 있으면 손을 찾는다
  function onFrame() {
    if (stopped) return;
    rafId = requestAnimationFrame(onFrame);
    if (video.readyState < 2 || video.currentTime === lastVideoTime) return;
    lastVideoTime = video.currentTime;
    let result;
    try {
      result = landmarker.detectForVideo(video, performance.now());
    } catch (err) {
      console.error('손 인식 오류', err);
      return;
    }
    const world = result.worldLandmarks?.[0];
    state = stabilizer.update(world ? landmarksToCode(world) : null, Date.now());
    handedness = flipHandedness(result.handedness?.[0]?.[0]?.categoryName);
    draw(result.landmarks?.[0]);
  }
  rafId = requestAnimationFrame(onFrame);

  function showCaption(pose) {
    if (pose.code === null) {
      caption.textContent = '손을 화면에 보여 주세요';
    } else if (pose.name === null) {
      caption.textContent = '목록에 없는 손모양이에요';
    } else {
      const label = poses.find((p) => p.name === pose.name)?.label ?? pose.name;
      caption.textContent = `인식: ${label} (${(pose.stableMs / 1000).toFixed(1)}초)`;
    }
  }

  const timer = setInterval(() => {
    const pose = makePose();
    listeners.forEach((cb) => cb(pose));
    showCaption(pose);
  }, TICK_MS);

  function stop() {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(rafId);
    clearInterval(timer);
    stream.getTracks().forEach((t) => t.stop());
    landmarker.close();
    listeners.clear();
    el.remove();
  }

  // 웹캠 USB 를 뽑는 등으로 영상이 끊기면 멈추고 알린다
  stream.getVideoTracks()[0]?.addEventListener('ended', () => {
    if (stopped) return;
    stop();
    onLost('웹캠 연결이 끊겼어요');
  });

  return {
    kind: 'mediapipe',
    el,
    onPose(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    stop,
  };
}
