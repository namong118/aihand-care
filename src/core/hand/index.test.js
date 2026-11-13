import { describe, it, expect, vi, afterEach } from 'vitest';
import { createHand } from './index.js';
import poses from '../../data/poses.json';

// 가짜 mediapipe.js: 웹캠 없이 전환기만 시험한다
function fakeModule({ fail = null } = {}) {
  const made = {};
  const mod = {
    createMediaPipeHand({ onStop }) {
      const listeners = new Set();
      const cam = {
        running: false,
        onPose(cb) {
          listeners.add(cb);
          return () => listeners.delete(cb);
        },
        async start() {
          if (fail) throw new Error(fail);
          cam.running = true;
        },
        stop(reason = null) {
          cam.running = false;
          onStop(reason);
        },
        send(pose) {
          listeners.forEach((cb) => cb(pose));
        },
        destroy() {},
      };
      made.cam = cam;
      return cam;
    },
    listCameras: async () => [{ deviceId: 'a', label: 'C270' }],
  };
  return { load: async () => mod, made };
}

const V = { code: '01100', name: 'V', handedness: 'Right', stableMs: 300 };

describe('손 인식 전환기', () => {
  let hand;
  afterEach(() => hand?.destroy());

  it('처음에는 Mock', () => {
    hand = createHand({ poses, loadWebcam: async () => ({}) });
    expect(hand.kind).toBe('mock');
    expect(hand.status()).toMatchObject({ state: 'mock', mock: true });
  });

  it('웹캠을 켜면 웹캠 결과가 onPose 로 간다', async () => {
    const f = fakeModule();
    hand = createHand({ poses, loadWebcam: f.load });
    const got = [];
    hand.onPose((p) => got.push(p));
    expect(await hand.startWebcam()).toBe(true);
    expect(hand.kind).toBe('mediapipe');
    expect(hand.status()).toMatchObject({ state: 'connected', mock: false, note: '웹캠' });
    f.made.cam.send(V);
    expect(got).toEqual([V]);
  });

  it('버튼으로 손모양을 들고 있는 동안은 웹캠 결과를 무시한다', async () => {
    const f = fakeModule();
    hand = createHand({ poses, loadWebcam: f.load });
    await hand.startWebcam();
    const got = [];
    hand.onPose((p) => got.push(p.name));
    hand.select('ROCK');
    f.made.cam.send(V);
    expect(got).toEqual(['ROCK']);
    hand.lower();
    f.made.cam.send(V);
    expect(got).toEqual(['ROCK', null, 'V']);
  });

  it('웹캠을 켜지 못하면 false, Mock 그대로, 안내 문구', async () => {
    const f = fakeModule({ fail: '카메라 사용을 허용해 주세요' });
    hand = createHand({ poses, loadWebcam: f.load });
    expect(await hand.startWebcam()).toBe(false);
    expect(hand.kind).toBe('mock');
    expect(hand.status().note).toBe('카메라 사용을 허용해 주세요');
  });

  it('웹캠이 끊기면 Mock 으로 돌아가고 알린다', async () => {
    const f = fakeModule();
    hand = createHand({ poses, loadWebcam: f.load });
    await hand.startWebcam();
    const onChange = vi.fn();
    hand.onChange(onChange);
    f.made.cam.stop('웹캠 연결이 끊겼어요');
    expect(onChange).toHaveBeenCalled();
    expect(hand.kind).toBe('mock');
    expect(hand.status()).toMatchObject({ state: 'disconnected', mock: true });
    expect(hand.status().note).toContain('웹캠 연결이 끊겼어요');
  });

  it('카메라 목록', async () => {
    const f = fakeModule();
    hand = createHand({ poses, loadWebcam: f.load });
    expect(await hand.listCameras()).toEqual([]); // 켜기 전
    await hand.startWebcam();
    expect(await hand.listCameras()).toEqual([{ deviceId: 'a', label: 'C270' }]);
  });
});
