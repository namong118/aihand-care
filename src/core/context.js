// ctx 만들기: 설정에 따라 실제 장치 또는 Mock 을 골라 프로그램에 넘길 ctx 를 만든다.
// 지금은 Mock 만 연결되어 있다.

import poses from '../data/poses.json';
import tags from '../data/tags.json';
import { createHand } from './hand/index.js';
import { createRobot } from './robot/index.js';
import { createTag } from './tag/index.js';
import { createLog } from './log.js';

export const DEFAULT_SETTINGS = {
  mock: true, // true: 가상 장치. 실제 장치 연결은 아직 구현 전
  user: null, // 대시보드에서 고른 사용자 이름
  difficulty: 'easy', // 'easy' | 'normal' | 'hard'
  speed: 'NORMAL', // 'SLOW' | 'NORMAL' (진행 속도)
};

/**
 * @param {object} settings  DEFAULT_SETTINGS 모양의 객체. 같은 객체를 ctx.settings 로 넘기므로
 *                           대시보드에서 값을 바꾸면 프로그램도 바뀐 값을 본다.
 * @returns {{ ctx, devices }}
 *   ctx: 프로그램에 넘기는 객체 (hand, robot, tag, log, settings)
 *   devices: 대시보드·Mock 패널 전용 (장치 원본과 상태 목록)
 */
export function createContext(settings) {
  // TODO: settings.mock === false 일 때 실제 장치 연결 (mediapipe.js, robot/serial.js, tag/serial.js)
  const hand = createHand({ poses });
  const robot = createRobot({ poses });
  const tag = createTag({ tags });
  const log = createLog();

  const ctx = {
    hand: { onPose: (cb) => hand.onPose(cb) },
    robot: {
      showPose: (name) => robot.showPose(name),
      react: (kind) => robot.react(kind),
      hello: () => robot.hello(),
      rest: () => robot.rest(),
    },
    tag: { onTag: (cb) => tag.onTag(cb) },
    log: { record: (rec) => log.record(rec) },
    settings,
  };

  const devices = {
    hand,
    robot,
    tag,
    log,
    /** 상태 표시줄에 보여줄 장치 목록 */
    status() {
      return [
        { key: 'webcam', label: '웹캠', state: 'mock', mock: true, note: '사용 안 함' },
        { key: 'hand', label: '손 인식', state: 'mock', mock: hand.kind === 'mock', note: '화면 버튼' },
        { key: 'robot', label: 'AIHand', state: 'mock', mock: robot.kind === 'mock', note: '화면 속 로봇손' },
        { key: 'wondercam', label: 'WonderCam', state: 'mock', mock: tag.kind === 'mock', note: '키보드·버튼' },
      ];
    },
  };

  return { ctx, devices };
}
