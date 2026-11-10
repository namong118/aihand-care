// 실제 카드 입력: 사용자가 카드를 AIHand 의 WonderCam 에 보여준다.
//   색 카드(STEP 3)   태그 모드: 'TAG,<번호>' / 'TAG,NONE' → tags.json 으로 색으로 바꿔 onCard({ color })
//   숫자 카드(STEP 1) 숫자 모드: 'NUM,<1~5>' / 'NUM,NONE' → onNumber({ number })
// 카메라는 한 번에 한 모드만 쓴다. 모드 바꾸기는 index.js 가 한다.
//
// 흐름: WonderCam → micro:bit(펌웨어 F3) → 로봇 시리얼 → robot/serial.js 가 값만 꺼내 넘김 → 여기
//
// - 펌웨어는 보이는 값이 바뀔 때만 줄을 보낸다. 같은 카드를 계속 들고 있으면 다시 오지 않는다.
// - 카드가 0.5초 넘게 안 보이면 NONE 줄이 온다. 이때는 알리지 않고 "지금 보이는 카드"만 비운다.
// - 표에 없는 태그 번호는 무시하고 console.warn.
// - 모양은 mock.js 와 같다: { kind: 'serial', onCard(cb), onNumber(cb) }
//
// [검증 필요] 종이 카드로 인식 거리·조명 확인 전 (docs/hardware-check.md 4번, docs/cards.md 4번)

import { tagIdToColor } from './cards.js';
import tags from './tags.json';

export function createSerialCard({ table = tags.ids } = {}) {
  const cardListeners = new Set();
  const numberListeners = new Set();
  let shown = null; // 지금 보이는 색 카드 { id, color }. color 는 표에 없으면 null
  let shownNumber = null; // 지금 보이는 숫자 카드 (1~5)

  return {
    kind: 'serial',

    // ---- ctx.card 로 공개되는 부분 ----
    onCard(cb) {
      cardListeners.add(cb);
      return () => cardListeners.delete(cb);
    },
    onNumber(cb) {
      numberListeners.add(cb);
      return () => numberListeners.delete(cb);
    },

    // ---- core/card/index.js 전용 ----
    /** 로봇 시리얼의 TAG 줄. id: '0' 같은 태그 번호, 카드가 사라지면 null */
    handleTag(id) {
      if (id === null) {
        shown = null;
        return;
      }
      const color = tagIdToColor(id, table);
      shown = { id, color };
      if (!color) {
        console.warn(`카드 표(tags.json)에 없는 태그 번호예요: ${id}`);
        return;
      }
      const event = { color };
      cardListeners.forEach((cb) => cb(event));
    },

    /** 로봇 시리얼의 NUM 줄. n: 1~5, 숫자 카드가 사라지면 null */
    handleNumber(n) {
      shownNumber = n;
      if (n === null) return;
      const event = { number: n };
      numberListeners.forEach((cb) => cb(event));
    },

    /** 모드를 바꾸면 보이던 카드는 없는 것으로 친다 (펌웨어와 같은 규칙) */
    reset() {
      shown = null;
      shownNumber = null;
    },

    /** 지금 보이는 색 카드 (상태 표시용). 없으면 null */
    shown: () => shown,
    /** 지금 보이는 숫자 카드 (상태 표시용). 없으면 null */
    shownNumber: () => shownNumber,
  };
}
