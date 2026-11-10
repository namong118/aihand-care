// 실제 색 카드 입력: 사용자가 색깔 카드를 AIHand 의 WonderCam 에 보여준다 (카드 방식 A, AprilTag).
//
// 흐름: WonderCam → micro:bit(펌웨어 F2) → 로봇 시리얼 'TAG,<번호>' / 'TAG,NONE'
//       → robot/serial.js 가 번호만 꺼내 넘김 → 여기서 tags.json 으로 색으로 바꿔 onCard({ color })
//
// - 펌웨어는 보이는 카드가 바뀔 때만 'TAG,<번호>' 를 보낸다. 같은 카드를 계속 들고 있으면 다시 오지 않는다.
// - 카드가 0.5초 넘게 안 보이면 'TAG,NONE' 이 온다. 이때는 onCard 를 부르지 않고 "지금 보이는 카드"만 비운다.
// - 표에 없는 번호(다른 태그)는 무시하고 console.warn.
// - 모양은 mock.js 와 같다: { kind: 'serial', onCard(cb) }, cb({ color })
//
// [검증 필요] 종이 카드로 인식 거리·조명 확인 전 (docs/hardware-check.md 4번, docs/cards.md 4번)

import { tagIdToColor } from './cards.js';
import tags from './tags.json';

export function createSerialCard({ table = tags.ids } = {}) {
  const listeners = new Set();
  let shown = null; // 지금 보이는 카드 { id, color }. color 는 표에 없으면 null

  return {
    kind: 'serial',

    // ---- ctx.card 로 공개되는 부분 ----
    onCard(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
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
      listeners.forEach((cb) => cb(event));
    },

    /** 지금 보이는 카드 (상태 표시용). 없으면 null */
    shown: () => shown,
  };
}
