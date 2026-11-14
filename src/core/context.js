// ctx 만들기: 설정에 따라 실제 장치 또는 Mock 을 골라 프로그램에 넘길 ctx 를 만든다.
// 실제/Mock 은 장치별로 정한다. 로봇은 "AIHand 연결" 버튼으로 실제 AIHand 로 바뀌고,
// 카드 입력은 AIHand 에 WonderCam 이 있으면 함께 실제로 바뀐다 (card/index.js).
// 손 인식은 "웹캠 켜기" 버튼으로 실제 웹캠(MediaPipe)으로 바뀐다 (hand/index.js).

import poses from '../data/poses.json';
import colors from '../data/colors.json';
import { createHand, makeWaitForPose } from './hand/index.js';
import { createRobot } from './robot/index.js';
import { createCard } from './card/index.js';
import { createLog } from './log.js';

export const DEFAULT_SETTINGS = {
  mock: true, // 처음에는 모두 가상 장치. 손 인식·로봇·카드는 버튼으로 장치별 전환 (devices.status() 참고)
  difficulty: 'easy', // 'easy' | 'normal' | 'hard'
  speed: 'NORMAL', // 'SLOW' | 'NORMAL' (진행 속도)
};

/**
 * @param {object} settings  DEFAULT_SETTINGS 모양의 객체. 같은 객체를 ctx.settings 로 넘기므로
 *                           대시보드에서 값을 바꾸면 프로그램도 바뀐 값을 본다.
 * @returns {{ ctx, devices }}
 *   ctx: 프로그램에 넘기는 객체 (hand, robot, card, log, settings)
 *   devices: 대시보드·Mock 패널 전용 (장치 원본과 상태 목록)
 */
export function createContext(settings) {
  const hand = createHand({ poses });
  const robot = createRobot({ poses });
  const card = createCard({ colors, robot }); // WonderCam 결과는 로봇 시리얼로 온다
  const log = createLog();

  const ctx = {
    hand: {
      onPose: (cb) => hand.onPose(cb),
      waitForPose: makeWaitForPose((cb) => hand.onPose(cb)),
    },
    robot: {
      showPose: (name) => robot.showPose(name),
      react: (kind) => robot.react(kind),
      hello: () => robot.hello(),
      rest: () => robot.rest(),
    },
    card: {
      onCard: (cb) => card.onCard(cb), // 색 카드: cb({ color: 'red' | 'blue' | 'yellow' | 'green' })
      onNumber: (cb) => card.onNumber(cb), // 숫자 카드: cb({ number: 1~5 })
      onFace: (cb) => card.onFace(cb), // 얼굴 로그인: cb({ faceId: 번호 | 'unknown' | null }). #77 전까지 Mock 만
      ready: () => card.ready(), // WonderCam 모드 바꾸기가 끝날 때까지 기다림 (실제 카메라 준비면 true)
    },
    log: { record: (rec) => log.record(rec) },
    settings,
  };

  const devices = {
    hand,
    robot,
    card,
    log,
    /** 상태 표시줄에 보여줄 장치 목록 */
    status() {
      const h = hand.status();
      return [
        { key: 'webcam', label: '웹캠', state: h.state, mock: h.mock, note: h.mock ? '사용 안 함' : '켜짐' },
        { key: 'hand', label: '손 인식', ...h },
        { key: 'robot', label: 'AIHand', ...robot.status() },
        { key: 'wondercam', label: 'WonderCam', ...card.status() },
      ];
    },
  };

  return { ctx, devices };
}
