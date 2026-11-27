// 카드 입력 장치 선택: 처음에는 Mock(키보드·버튼), AIHand 를 연결하면 실제 WonderCam.
// 프로그램은 이 파일을 직접 import 하지 않고 ctx.card 만 쓴다.
//
// WonderCam 은 AIHand 에 달려 있고, 인식 결과는 로봇 시리얼(USB)로 같이 온다. 그래서 따로 연결 버튼이 없다.
//
// 카메라 모드는 한 번에 하나다: 태그(색 카드, onCard) / 숫자(숫자 카드, onNumber) / 얼굴(얼굴 로그인, onFace).
// 모드는 여기서 알아서 바꾼다.
//   - onCard 를 새로 구독하면 태그 모드, onNumber 는 숫자 모드, onFace 는 얼굴 모드를 원하는 것으로 본다.
//   - 얼굴 모드는 펌웨어 F4 부터 (#77). F3 이하면 CAM,FACE 에 ERR,BAD_ARG 가 오고, 얼굴 번호는
//     개발자 입력의 Mock 버튼으로만 받는다 (ready() 는 false, 상태에 "펌웨어 F4가 필요해요").
//   - 구독을 해제해도 모드는 그대로 둔다. (STEP 3 처럼 문제마다 구독·해제하는 프로그램이 있어서,
//     해제할 때 바꾸면 문제마다 모드를 바꾸게 된다)
//   - 원하는 모드와 카메라 모드가 다르면 'CAM,TAG' / 'CAM,NUM' / 'CAM,FACE' 를 보낸다. 로봇 명령과 같은 줄(큐)을 쓰고
//     최대 약 5초 걸린다. 그동안 상태는 'switching'. 프로그램은 await ctx.card.ready() 로 기다릴 수 있다.
//   - AIHand 를 연결하면 지금 원하는 모드(처음에는 태그)로 맞춘다.
//
// 실제 WonderCam 을 쓰는 동안에도 개발자 입력의 버튼·키보드는 계속 동작한다 (카드가 안 읽힐 때 대신 입력).

import { createMockCard } from './mock.js';
import { createSerialCard } from './serial.js';

export { CARD_COLORS, isCardColor, tagIdToColor } from './cards.js';
export { CARD_NUMBERS, isCardNumber, MOCK_FACE_IDS, isFaceId } from './mock.js';

const MOCK_NOTE = '카드 대신 키보드·버튼';
/** 모드 바꾸기 실패(ERR,CAM_MODE·시간 초과) 때 개발자 입력에 보여 줄 할 일 (README "켜는 순서") */
export const CAM_STUCK_HELP =
  'WonderCam 모드를 바꾸지 못했어요. 카메라 화면이 로딩 중에 멈췄다면 micro:bit USB와 AIHand 전원을 모두 뺐다가, ' +
  'AIHand 전원 → 카메라 화면이 뜬 뒤 → USB 순서로 다시 켜 주세요. 지금은 키보드·버튼으로 입력해요';
const MODE_LABEL = { TAG: '태그 모드', NUM: '숫자 모드', FACE: '얼굴 모드', COLOR: '색 모드' };
// 펌웨어가 그 모드를 모를 때(CAM 에 ERR,BAD_ARG) 안내. 숫자는 F3, 얼굴은 F4, 색(공 따라가기)은 F5 부터
const NEED_FIRMWARE = {
  NUM: '숫자 카드는 펌웨어 F3가 필요해요',
  FACE: '얼굴 인식은 펌웨어 F4가 필요해요',
  COLOR: '공 따라가기는 펌웨어 F5가 필요해요',
};

/**
 * @param colors  data/colors.json
 * @param robot   core/robot 의 전환기 (kind, onChange, onTag, onNumber, onFace, camMode). 없으면 Mock 만 쓴다
 * @param mock    카드 Mock (테스트에서 emit·emitNumber·emitFace 를 직접 부르려고 넘긴다). 없으면 새로 만든다
 * @returns ctx.card 용 onCard·onNumber·onFace·ready 와 대시보드용 kind, status, onChange, mountControls
 */
export function createCard({ colors, robot = null, mock = createMockCard({ colors }) }) {
  const real = createSerialCard(); // 실제 WonderCam 의 값 (active 모드일 때만 줄을 넘긴다)
  const cardListeners = new Set();
  const numberListeners = new Set();
  const faceListeners = new Set();
  const listeners = new Set();

  let wanted = 'TAG'; // 프로그램이 원하는 모드 (가장 최근 구독 기준)
  let active = null; // 카메라의 지금 모드 (DONE,CAM 으로 확인된 것). null = 실제 카드 입력 없음
  let switchingTo = null; // 바꾸는 중인 모드
  let switching = null; // 바꾸기가 끝나면 resolve 되는 Promise
  let linked = false; // 실제 AIHand 에 연결된 뒤 WonderCam 을 다루기 시작했는지
  let everLinked = false;
  let fatal = false; // 카메라 없음·F1 펌웨어: 이번 연결에서는 다시 시도하지 않는다
  const unsupported = new Set(); // 이 펌웨어가 모르는 모드 (F2 의 NUM)
  const failed = new Set(); // 바꾸지 못한 모드: 이번 연결에서는 다시 시도하지 않는다
  let problem = null; // 상태 표시에 덧붙일 안내

  function changed() {
    listeners.forEach((cb) => cb());
  }
  const emitCard = (event) => cardListeners.forEach((cb) => cb(event));
  const emitNumber = (event) => numberListeners.forEach((cb) => cb(event));
  const emitFace = (event) => faceListeners.forEach((cb) => cb(event));
  mock.onCard(emitCard);
  mock.onNumber(emitNumber);
  mock.onFace(emitFace);
  real.onCard(emitCard);
  real.onNumber(emitNumber);
  real.onFace(emitFace);

  function labelOf(color) {
    return colors.find((c) => c.color === color)?.label ?? color;
  }

  // 로봇 연결이 끊기면 처음 상태로 (다시 연결하면 처음부터 다시 맞춘다)
  function unlink() {
    if (!linked) return;
    linked = false;
    active = null;
    fatal = false;
    unsupported.clear();
    failed.clear();
    problem = null;
    real.reset();
    changed();
  }

  async function switchTo(mode) {
    switchingTo = mode;
    changed();
    const msg = await robot.camMode(mode);
    switchingTo = null;
    if (robot.kind !== 'serial') return; // 바꾸는 사이 연결이 끊김 (sync 가 정리)
    if (msg?.type === 'DONE') {
      real.reset();
      active = mode;
      problem = null;
    } else if (msg?.message === 'BAD_ARG') {
      // 펌웨어 F2 는 CAM,NUM, F2·F3 은 CAM,FACE 를 모른다. 카메라 모드는 그대로
      unsupported.add(mode);
      problem = NEED_FIRMWARE[mode] ?? `${MODE_LABEL[mode]}를 쓸 수 없어요`;
    } else if (msg?.message === 'NO_CAM') {
      fatal = true;
      active = null;
      problem = 'WonderCam을 찾지 못했어요. 케이블을 확인하고 AIHand를 다시 연결해 주세요';
    } else if (msg?.message === 'UNKNOWN_CMD') {
      fatal = true;
      active = null;
      problem = '펌웨어 F4가 필요해요';
    } else {
      // ERR,CAM_MODE · 시간 초과 등: 카메라 모드를 알 수 없다.
      // 실물에서는 WonderCam 이 켜지다 멈춘(로딩 동그라미) 경우였고, 명령을 다시 보내거나 micro:bit USB 만
      // 다시 꽂아서는 풀리지 않았다. USB·AIHand 전원을 모두 끊고 다시 켜야 풀린다 (hardware-check 부록 12)
      failed.add(mode);
      active = null;
      problem = CAM_STUCK_HELP;
    }
    changed();
  }

  /** 원하는 모드에 맞춘다. 바꾸는 중이면 그게 끝날 때(이어서 또 바꾸면 그것까지) resolve */
  function sync() {
    if (!robot) return Promise.resolve();
    if (robot.kind !== 'serial') {
      unlink();
      return Promise.resolve();
    }
    if (!linked) {
      linked = true;
      everLinked = true;
    }
    if (switching) return switching;
    if (fatal || active === wanted || unsupported.has(wanted) || failed.has(wanted)) return Promise.resolve();
    switching = switchTo(wanted).then(() => {
      switching = null;
      return sync(); // 바꾸는 사이 원하는 모드가 또 바뀌었을 수 있다
    });
    return switching;
  }

  function want(mode) {
    wanted = mode;
    sync();
  }

  if (robot) {
    robot.onChange(() => {
      sync();
    });
    robot.onTag((id) => {
      if (active !== 'TAG') return;
      real.handleTag(id);
      changed(); // "지금 보이는 카드" 표시 갱신
    });
    robot.onNumber((n) => {
      if (active !== 'NUM') return;
      real.handleNumber(n);
      changed();
    });
    robot.onFace((faceId) => {
      if (active !== 'FACE') return;
      real.handleFace(faceId);
      changed();
    });
  }

  return {
    get kind() {
      return active ? 'serial' : 'mock';
    },
    /** 카메라의 지금 모드 ('TAG' | 'NUM' | 'FACE' | null) */
    get mode() {
      return active;
    },

    // ---- ctx.card ----
    /** 색 카드. cb({ color }). 구독하면 카메라를 태그 모드로 바꾼다 */
    onCard(cb) {
      cardListeners.add(cb);
      want('TAG');
      return () => cardListeners.delete(cb);
    },
    /** 숫자 카드. cb({ number: 1~5 }). 구독하면 카메라를 숫자 모드로 바꾼다 */
    onNumber(cb) {
      numberListeners.add(cb);
      want('NUM');
      return () => numberListeners.delete(cb);
    },
    /**
     * 얼굴 로그인. cb({ faceId }) — faceId: 학습된 얼굴 번호(1 이상 정수) | 'unknown'(모르는 얼굴) | null(안 보임).
     * 구독하면 카메라를 얼굴 모드로 바꾼다 (펌웨어 F4). Mock 얼굴 버튼으로도 들어온다
     */
    onFace(cb) {
      faceListeners.add(cb);
      want('FACE');
      return () => faceListeners.delete(cb);
    },
    /**
     * 색 모드(공 따라가기, 펌웨어 F5)를 원한다. 카드 구독처럼 받는 값은 없다 (손목은 펌웨어가 움직인다).
     * ctx 에는 직접 열지 않고 ctx.robot.followBall 이 쓴다 (context.js)
     */
    useColor() {
      want('COLOR');
    },

    /**
     * 모드 바꾸기가 끝날 때까지 기다린다. 구독한 바로 뒤에 부른다.
     * @returns {Promise<boolean>} 실제 WonderCam 이 원하는 모드로 준비됐으면 true, Mock 입력만 되면 false
     */
    async ready() {
      await sync();
      return active !== null && active === wanted;
    },

    // ---- 대시보드 ----
    /** 장치 상태 (개발자 입력 영역). 실제 WonderCam 이면 지금 보이는 카드도 알려 준다 */
    status() {
      if (!linked) {
        return everLinked
          ? { state: 'disconnected', mock: true, note: `AIHand 연결이 끊겨 ${MOCK_NOTE}` }
          : { state: 'mock', mock: true, note: MOCK_NOTE };
      }
      if (switchingTo) return { state: 'switching', mock: false, note: `${MODE_LABEL[switchingTo]}로` };
      const extra = problem ? ` · ${problem}` : '';
      if (active === 'TAG') {
        const shown = real.shown();
        let text = '보이는 카드 없음';
        if (shown) text = shown.color ? `보이는 카드: ${labelOf(shown.color)} (태그 ${shown.id})` : `태그 ${shown.id} (카드 표에 없음)`;
        return { state: 'connected', mock: false, note: `태그 모드 · ${text}${extra}` };
      }
      if (active === 'NUM') {
        const n = real.shownNumber();
        const text = n ? `보이는 숫자: ${n}` : '보이는 숫자 없음';
        return { state: 'connected', mock: false, note: `숫자 모드 · ${text}${extra}` };
      }
      if (active === 'FACE') {
        const f = real.shownFace();
        let text = '보이는 얼굴 없음';
        if (f === 'unknown') text = '모르는 얼굴';
        else if (f !== null) text = `얼굴 ${f}번`;
        return { state: 'connected', mock: false, note: `얼굴 모드 · ${text}${extra}` };
      }
      if (active === 'COLOR') return { state: 'connected', mock: false, note: `색 모드 · 공 따라가기${extra}` };
      return { state: 'missing', mock: true, note: problem ?? MOCK_NOTE };
    },

    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },

    /** 개발자 입력의 색·숫자·얼굴 버튼과 키보드 (Mock 패널) */
    mountControls(container) {
      return mock.mountControls(container);
    },
  };
}
