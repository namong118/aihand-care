import { describe, it, expect, vi, afterEach } from 'vitest';
import { createHand } from './index.js';

const poses = [
  { name: 'ROCK', code: '00000', label: '주먹(바위)' },
  { name: 'V', code: '01100', label: '브이(가위)' },
];

/** 가짜 웹캠 모듈: emit 으로 손모양을 보내고, lose 로 끊김을 흉내 낸다 */
function fakeCamera() {
  const fake = { listeners: new Set(), stopped: false, onLost: null };
  fake.module = {
    async createMediaPipeHand({ onLost }) {
      fake.onLost = onLost;
      return {
        kind: 'mediapipe',
        el: { tag: 'cam-view' },
        onPose(cb) {
          fake.listeners.add(cb);
          return () => fake.listeners.delete(cb);
        },
        stop() {
          fake.stopped = true;
        },
      };
    },
  };
  fake.emit = (pose) => fake.listeners.forEach((cb) => cb(pose));
  return fake;
}

let hand;
afterEach(() => hand?.destroy());

describe('createHand (손 인식 전환기)', () => {
  it('처음에는 Mock 이고 버튼 손모양이 onPose 로 전달된다', () => {
    hand = createHand({ poses, loadCamera: async () => fakeCamera().module });
    const got = [];
    hand.onPose((p) => got.push(p.name));
    hand.select('V');
    expect(hand.kind).toBe('mock');
    expect(hand.status()).toMatchObject({ state: 'mock', mock: true });
    expect(got).toContain('V');
  });

  it('웹캠을 켜면 웹캠 결과만 전달하고 버튼 입력은 무시한다', async () => {
    const cam = fakeCamera();
    hand = createHand({ poses, loadCamera: async () => cam.module });
    const got = [];
    hand.onPose((p) => got.push(p.name));

    expect(await hand.startCamera()).toBe(true);
    expect(hand.kind).toBe('mediapipe');
    expect(hand.status()).toMatchObject({ state: 'connected', mock: false });
    expect(hand.cameraView).toEqual({ tag: 'cam-view' });

    got.length = 0;
    hand.select('V'); // 버튼 입력: 무시
    cam.emit({ code: '00000', name: 'ROCK', handedness: 'Right', stableMs: 0 });
    expect(got).toEqual(['ROCK']);
  });

  it('웹캠을 끄면 손 없음(null)을 한 번 보내고 Mock 으로 돌아간다', async () => {
    const cam = fakeCamera();
    hand = createHand({ poses, loadCamera: async () => cam.module });
    const got = [];
    hand.onPose((p) => got.push(p.code));
    await hand.startCamera();
    hand.stopCamera();
    expect(cam.stopped).toBe(true);
    expect(got.at(-1)).toBeNull();
    expect(hand.kind).toBe('mock');
    expect(hand.status()).toMatchObject({ state: 'disconnected', mock: true, note: '화면 버튼' });
    expect(hand.cameraView).toBeNull();
  });

  it('웹캠이 끊기면 안내 문구와 함께 Mock 으로 돌아간다', async () => {
    const cam = fakeCamera();
    hand = createHand({ poses, loadCamera: async () => cam.module });
    const onChange = vi.fn();
    hand.onChange(onChange);
    await hand.startCamera();
    cam.onLost('웹캠 연결이 끊겼어요');
    expect(hand.kind).toBe('mock');
    expect(hand.status().note).toBe('웹캠 연결이 끊겼어요. 화면 버튼으로 계속해요');
    expect(onChange).toHaveBeenCalled();
  });

  it('켜기에 실패하면 오류 문구를 상태에 보여주고 Mock 을 유지한다', async () => {
    hand = createHand({
      poses,
      loadCamera: async () => ({
        createMediaPipeHand: async () => {
          throw new Error('웹캠 사용을 허용해 주세요');
        },
      }),
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await hand.startCamera()).toBe(false);
    expect(hand.kind).toBe('mock');
    expect(hand.status()).toMatchObject({ state: 'mock', note: '웹캠 사용을 허용해 주세요', starting: false });
  });
});
