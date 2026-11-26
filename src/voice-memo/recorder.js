// 마이크 녹음 (MediaRecorder). 자브라 스피커폰이 있으면 그 마이크를 쓴다.
// 녹음은 인터넷 없이 브라우저 안에서만 한다.

import { pickMimeType, pickMicId } from './logic.js';

/**
 * 마이크를 켜고 녹음을 시작한다. 마이크가 없거나 허락하지 않으면 Error(message = 화면 안내 문구)
 * @returns {Promise<{ stop(): Promise<{ blob, durationMs, mimeType }>, cancel(): void }>}
 */
export async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    throw new Error('이 브라우저에서는 녹음할 수 없어요');
  }
  let stream;
  try {
    // 처음에는 기본 마이크로 허락을 받고, 장치 이름이 보이면 자브라로 바꾼다 (허락 전에는 이름이 비어 있다)
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const micId = pickMicId(await navigator.mediaDevices.enumerateDevices());
    const current = stream.getAudioTracks()[0]?.getSettings().deviceId;
    if (micId && micId !== current) {
      stream.getTracks().forEach((t) => t.stop());
      stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: micId } } });
    }
  } catch (err) {
    stream?.getTracks().forEach((t) => t.stop());
    console.warn('마이크를 켜지 못했어요', err);
    throw new Error('마이크를 켜지 못했어요. 마이크가 연결되어 있는지, 마이크 사용을 허락했는지 확인해 주세요.');
  }

  const mimeType = pickMimeType((t) => MediaRecorder.isTypeSupported(t));
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const startedAt = performance.now();
  recorder.start();
  const release = () => stream.getTracks().forEach((t) => t.stop());

  return {
    /** 녹음 마치기 → 녹음 파일 */
    stop() {
      return new Promise((resolve) => {
        recorder.onstop = () => {
          release();
          const type = recorder.mimeType || mimeType || 'audio/webm';
          resolve({ blob: new Blob(chunks, { type }), durationMs: performance.now() - startedAt, mimeType: type });
        };
        recorder.stop();
      });
    },
    /** 녹음 버리기 (화면을 나갈 때) */
    cancel() {
      recorder.onstop = null;
      if (recorder.state !== 'inactive') recorder.stop();
      release();
    },
  };
}
