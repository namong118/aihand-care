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
  let stopNear = () => {}; // followBall 의 onNear 구독 끊기

  const ctx = {
    hand: {
      onPose: (cb) => hand.onPose(cb),
      waitForPose: makeWaitForPose((cb) => hand.onPose(cb)),
      // 웹캠 미리 보기: preview(<video>, onActive) → 연결 끊기 함수. 웹캠이 꺼져 있으면 onActive(false)
      preview: (video, onActive) => hand.attachPreview(video, onActive),
    },
    robot: {
      showPose: (name) => robot.showPose(name),
      react: (kind) => robot.react(kind),
      hello: () => robot.hello(),
      rest: () => robot.rest(),
      /**
       * 공 따라가기 (공 주고받기, 펌웨어 F5): on 이면 카메라를 색 모드로 바꾸고 손목이 공(Color ID 1)을 따라 돈다.
       * 공이 손 가까이 오면 펌웨어가 스스로 멈추고 onNear() 를 한 번 부른다 (이때 쥐면 된다).
       * 끄면 손목은 그 자리에 둔다. 다른 로봇 명령을 보내면 core 가 먼저 끈다.
       * @returns {Promise<boolean>} 실제로 따라가기를 켰으면 true (Mock·F4 이하·카메라 문제면 false, 그래도 활동은 그대로)
       */
      followBall: async (on, onNear) => {
        stopNear();
        if (!on) {
          await robot.track(false);
          return false;
        }
        if (robot.kind !== 'serial') return false;
        card.useColor();
        if (!(await card.ready())) return false;
        if (typeof onNear === 'function') {
          const off = robot.onBallNear(() => {
            stopNear();
            onNear();
          });
          stopNear = () => {
            off();
            stopNear = () => {};
          };
        }
        const msg = await robot.track(true);
        if (msg?.type !== 'DONE') stopNear();
        return msg?.type === 'DONE';
      },
    },
    card: {
      onCard: (cb) => card.onCard(cb), // 색 카드: cb({ color: 'red' | 'blue' | 'yellow' | 'green' })
      onNumber: (cb) => card.onNumber(cb), // 숫자 카드: cb({ number: 1~5 })
      onFace: (cb) => card.onFace(cb), // 얼굴 로그인: cb({ faceId: 번호 | 'unknown' | null }). 펌웨어 F4 또는 Mock 얼굴 버튼
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
