// 색 카드 입력 장치 선택: 처음에는 Mock(키보드·버튼), AIHand 를 연결하면 실제 WonderCam.
// 프로그램은 이 파일을 직접 import 하지 않고 ctx.card 만 쓴다.
//
// WonderCam 은 AIHand 에 달려 있고, 인식 결과는 로봇 시리얼(USB)로 같이 온다.
// 그래서 따로 연결 버튼이 없다. 로봇이 실제 AIHand 로 바뀌면 'CAM,TAG' 를 보내 확인하고,
//   DONE,CAM     → 실제 WonderCam 사용 (상태: connected)
//   ERR,NO_CAM 등 → WonderCam 을 못 찾음, Mock 유지 (상태: missing)
// 로봇 연결이 끊기면 다시 Mock 으로 돌아간다.
//
// 실제 WonderCam 을 쓰는 동안에도 개발자 입력의 색 버튼·키보드는 계속 동작한다.
// (로봇을 연결해도 손모양 입력 패널이 남는 것과 같다. 카드가 안 읽힐 때 대신 입력하는 용도)

import { createMockCard } from './mock.js';
import { createSerialCard } from './serial.js';

export { CARD_COLORS, isCardColor, tagIdToColor } from './cards.js';

const MOCK_NOTE = '카드 대신 키보드·버튼';

/**
 * @param colors  data/colors.json
 * @param robot   core/robot 의 전환기 (kind, onChange, onTag, camMode). 없으면 Mock 만 쓴다
 * @returns ctx.card 용 onCard 와 대시보드용 kind, status, onChange, mountControls
 */
export function createCard({ colors, robot = null }) {
  const mock = createMockCard({ colors });
  let real = null; // 실제 WonderCam (createSerialCard)
  let state = 'mock'; // 'mock' | 'checking' | 'connected' | 'missing' | 'disconnected'
  let note = MOCK_NOTE;
  const cardListeners = new Set();
  const listeners = new Set();

  function changed() {
    listeners.forEach((cb) => cb());
  }
  function emit(event) {
    cardListeners.forEach((cb) => cb(event));
  }
  mock.onCard(emit);

  function labelOf(color) {
    return colors.find((c) => c.color === color)?.label ?? color;
  }

  // 로봇이 실제 AIHand 로 바뀌면 WonderCam 을 확인하고, Mock 으로 돌아가면 카드도 Mock 으로
  async function sync() {
    if (robot.kind === 'serial') {
      if (state !== 'mock' && state !== 'disconnected') return; // 이미 확인했거나 확인 중
      state = 'checking';
      note = 'WonderCam 확인 중…';
      changed();
      const msg = await robot.camMode('TAG');
      if (robot.kind !== 'serial') return sync(); // 확인하는 사이 연결이 끊김
      if (msg?.type === 'DONE') {
        real = createSerialCard();
        real.onCard(emit);
        state = 'connected';
        note = '';
      } else {
        state = 'missing';
        note = missingNote(msg);
      }
      changed();
    } else if (state !== 'mock' && state !== 'disconnected') {
      real = null;
      state = 'disconnected';
      note = `AIHand 연결이 끊겨 ${MOCK_NOTE}`;
      changed();
    }
  }

  if (robot) {
    robot.onChange(() => {
      sync();
    });
    robot.onTag((id) => {
      if (!real) return;
      real.handleTag(id);
      changed(); // "지금 보이는 카드" 표시 갱신
    });
  }

  return {
    get kind() {
      return real ? 'serial' : 'mock';
    },

    // ---- ctx.card ----
    onCard(cb) {
      cardListeners.add(cb);
      return () => cardListeners.delete(cb);
    },

    // ---- 대시보드 ----
    /** 장치 상태 (개발자 입력 영역). 실제 WonderCam 이면 지금 보이는 카드도 알려 준다 */
    status() {
      if (state === 'connected') {
        const shown = real.shown();
        let text = '보이는 카드 없음';
        if (shown) text = shown.color ? `보이는 카드: ${labelOf(shown.color)} (태그 ${shown.id})` : `태그 ${shown.id} (카드 표에 없음)`;
        return { state, mock: false, note: `태그 모드 · ${text}` };
      }
      return { state, mock: true, note };
    },

    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },

    /** 개발자 입력의 색 버튼·키보드 (Mock 패널) */
    mountControls(container) {
      return mock.mountControls(container);
    },
  };
}

function missingNote(msg) {
  if (msg?.message === 'NO_CAM') return 'WonderCam을 찾지 못했어요. 케이블을 확인하고 AIHand를 다시 연결해 주세요';
  if (msg?.message === 'UNKNOWN_CMD') return '펌웨어 F2가 필요해요';
  return 'WonderCam이 응답하지 않아요. 키보드·버튼으로 입력해요';
}
