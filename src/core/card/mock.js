// 카드 입력 Mock: 카드를 WonderCam에 보여주는 대신 키보드나 화면 버튼으로 입력한다.
//   색 카드:   키보드 R/B/Y/G 또는 색 버튼 → onCard({ color })
//   숫자 카드: 키보드 1~5 또는 숫자 버튼   → onNumber({ number })

import { isCardColor } from './cards.js';

const KEYS = { r: 'red', b: 'blue', y: 'yellow', g: 'green' };
export const CARD_NUMBERS = [1, 2, 3, 4, 5];

export function isCardNumber(n) {
  return CARD_NUMBERS.includes(n);
}

/** @param colors data/colors.json ([{ color, label, hex }]) — 버튼 글자와 색 표시에 쓴다 */
export function createMockCard({ colors }) {
  const listeners = new Set();
  const numberListeners = new Set();
  const viewListeners = new Set();

  function emit(color) {
    if (!isCardColor(color)) throw new Error(`카드 색이 아닙니다: ${color}`);
    const event = { color };
    listeners.forEach((cb) => cb(event));
    viewListeners.forEach((cb) => cb(event));
  }

  function emitNumber(n) {
    if (!isCardNumber(n)) throw new Error(`숫자 카드는 1~5 입니다: ${n}`);
    const event = { number: n };
    numberListeners.forEach((cb) => cb(event));
    viewListeners.forEach((cb) => cb(event));
  }

  function onKey(e) {
    // 글자 입력칸에 타자 칠 때는 무시
    const target = e.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const color = KEYS[e.key.toLowerCase()];
    if (color) emit(color);
    const n = Number(e.key);
    if (isCardNumber(n)) emitNumber(n);
  }

  let keyboardOn = false;

  return {
    kind: 'mock',

    // ---- ctx.card 로 공개되는 부분 ----
    onCard(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    onNumber(cb) {
      numberListeners.add(cb);
      return () => numberListeners.delete(cb);
    },

    // ---- Mock 패널 전용 ----
    emit,
    emitNumber,
    destroy() {
      if (keyboardOn) window.removeEventListener('keydown', onKey);
      keyboardOn = false;
      listeners.clear();
      numberListeners.clear();
      viewListeners.clear();
    },

    mountControls(container) {
      if (!keyboardOn) {
        window.addEventListener('keydown', onKey);
        keyboardOn = true;
      }
      const keyOf = (color) => Object.keys(KEYS).find((k) => KEYS[k] === color).toUpperCase();

      container.innerHTML = '';
      const title = document.createElement('h2');
      title.textContent = '카드 — 카드 대신 입력(Mock)';
      const hint = document.createElement('p');
      hint.className = 'mock-status';
      hint.textContent =
        'WonderCam에 카드를 보여주는 대신 눌러요. 색: 키보드 R 빨강 · B 파랑 · Y 노랑 · G 초록 / 숫자: 키보드 1~5';
      const grid = document.createElement('div');
      grid.className = 'mock-grid';
      for (const c of colors) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-small color-btn';
        btn.style.setProperty('--card-color', c.hex);
        btn.textContent = `${c.label} (${keyOf(c.color)})`;
        btn.addEventListener('click', () => emit(c.color));
        grid.append(btn);
      }
      const numberGrid = document.createElement('div');
      numberGrid.className = 'mock-grid';
      for (const n of CARD_NUMBERS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-small';
        btn.textContent = `숫자 ${n}`;
        btn.setAttribute('aria-label', `숫자 카드 ${n}`);
        btn.addEventListener('click', () => emitNumber(n));
        numberGrid.append(btn);
      }
      const last = document.createElement('p');
      last.className = 'mock-status';
      last.textContent = '마지막 카드: 없음';
      container.append(title, hint, grid, numberGrid, last);

      viewListeners.add((e) => {
        if (e.number) {
          last.textContent = `마지막 카드: 숫자 ${e.number}`;
          return;
        }
        const c = colors.find((x) => x.color === e.color);
        last.textContent = `마지막 카드: ${c.label}`;
      });
    },
  };
}
