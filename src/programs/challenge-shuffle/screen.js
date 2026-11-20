// 도전 활동 "카드 섞기" 화면 그리기. 판정은 하지 않고 보여주기만 한다.
// 모양은 styles.css "활동 화면 공통"(act-*) 클래스 (시안 v11, docs/ui-classes.md).
// 카드·자리 모양은 이 활동 전용이라 공통 스타일을 고치지 않고 이 파일에서 style 로 준다.

import { h, button, message } from '../../ui/components.js';

// 크기 (7인치 1280×720에서 스크롤 없이 보이게)
const CARD_H = 120; // 카드 높이(px)
const LIFT = 70; // 들린 카드가 올라가는 높이(px). 다른 카드 위로 지나가고, 위쪽 진행 표시는 가리지 않는다
const BACK = 'repeating-linear-gradient(45deg, #5B3FA6 0 14px, #6E52B8 14px 28px)'; // 뒷면 무늬 (4장 모두 같음)

/** 단계 고르기 버튼 아래 한 줄 설명 */
const LEVEL_TEXT = {
  1: '천천히 네 번 섞어요. 한 자리를 물어요.',
  2: '여섯 번 섞어요. 두 자리를 물어요.',
  3: '빠르게 여덟 번 섞어요. 두 자리를 물어요.',
};

export function createScreen(container, colors) {
  container.innerHTML = '';
  const area = h('div', { class: 'program-body' });
  container.append(area);
  const find = (color) => colors.find((c) => c.color === color);

  let alive = true;
  const running = new Set(); // 진행 중인 애니메이션 (닫을 때 모두 멈춘다)
  let hintEl = null; // 답을 기다릴 때 붙는 안내 (한 번만)
  let holders = []; // 자리마다 카드를 담는 칸 (0~3). 칸은 움직이지 않고 카드만 움직인다
  let numbers = []; // 자리 번호 글자
  let promptEl = null; // 카드 아래 안내 한 줄
  let bottomEl = null; // 맨 아래: 색 버튼이나 결과 문구

  function set(...children) {
    area.innerHTML = '';
    hintEl = null;
    area.append(...children.flat().filter(Boolean));
  }

  /** 브라우저 내장 애니메이션. transform 만 움직인다 (라즈베리파이에서 가볍게). 없거나 화면이 닫히면 바로 끝 */
  function animate(el, frames, ms) {
    if (!alive || typeof el.animate !== 'function') return Promise.resolve(null);
    const a = el.animate(frames, { duration: ms, easing: 'ease-in-out', fill: 'forwards' });
    running.add(a);
    const done = () => {
      running.delete(a);
      return a;
    };
    return a.finished.then(done, done);
  }

  /** 색 고르기 버튼 (카드 대체 입력). 색 칸 + 색 이름 글자 (색만으로 알리지 않는다) */
  function answerButtons(onPick) {
    return h(
      'div',
      { class: 'act-answers', role: 'group', 'aria-label': '색 고르기', style: { 'grid-template-columns': `repeat(${colors.length}, minmax(0, 1fr))` } },
      colors.map((c) =>
        h(
          'button',
          { type: 'button', class: 'act-answer', onClick: () => onPick(c.color) },
          h('span', { class: 'act-art', 'aria-hidden': 'true', style: { background: c.hex, width: '48px', height: '48px', 'border-radius': '14px' } }),
          c.label,
        ),
      ),
    );
  }

  /** 카드 면 바꾸기: up = 앞면(색 + 색 이름), 아니면 뒷면(무늬만) */
  function setFace(card, up) {
    const c = find(card.dataset.color);
    card.dataset.up = up ? '1' : '';
    card.innerHTML = '';
    card.style.background = up ? c.hex : BACK;
    card.setAttribute('aria-label', up ? `${c.label} 카드` : '뒤집힌 카드');
    if (up) card.append(h('span', { style: { background: 'rgba(255,255,255,0.92)', color: '#1f1b18', 'border-radius': '999px', padding: '4px 16px', 'font-size': '28px', 'font-weight': '700' } }, c.label));
    else card.append(h('span', { 'aria-hidden': 'true', style: { color: '#fff', 'font-size': '56px', 'font-weight': '700', opacity: '0.85' } }, '?'));
  }

  /** 카드 한 장 뒤집기 (가로로 접혔다가 펴진다) */
  async function flip(card, up) {
    if (Boolean(card.dataset.up) === up) return;
    const a1 = await animate(card, [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], 180);
    setFace(card, up);
    const a2 = await animate(card, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], 180);
    [a1, a2].forEach((x) => x && x.cancel());
  }

  /** 물어보는 자리 표시 (테두리 + 번호 글자 강조. 색만으로 알리지 않게 "▲ 3번"처럼 글자도 바꾼다). -1 이면 표시 지움 */
  function mark(position) {
    holders.forEach((hd, i) => {
      const on = i === position;
      hd.style.outline = on ? '6px solid #1f1b18' : 'none';
      numbers[i].style.background = on ? '#1f1b18' : 'transparent';
      numbers[i].style.color = on ? '#fff' : '#1f1b18';
      numbers[i].textContent = on ? `▲ ${i + 1}번` : `${i + 1}번`;
    });
  }

  /**
   * 자리 a 와 b 의 카드 바꾸기 (한 번에 한 장만 움직인다, 11/20 결정)
   * ① a 카드가 들려서 b 자리 위로 → ② b 카드가 빈 a 자리로 → ③ 들린 카드가 내려옴
   */
  async function swapAnim(a, b, moveMs) {
    const ca = holders[a].firstChild;
    const cb = holders[b].firstChild;
    const dx = holders[b].getBoundingClientRect().left - holders[a].getBoundingClientRect().left;
    ca.style.zIndex = '10'; // 들린 카드는 다른 카드 위로 지나간다
    const up = `translate(${dx}px, ${-LIFT}px) scale(1.05)`;
    const a1 = await animate(ca, [{ transform: 'translate(0, 0)' }, { transform: up }], moveMs);
    const b1 = await animate(cb, [{ transform: 'translate(0, 0)' }, { transform: `translate(${-dx}px, 0)` }], moveMs);
    const a2 = await animate(ca, [{ transform: up }, { transform: `translate(${dx}px, 0)` }], Math.round(moveMs * 0.6));
    // 움직인 자리에 실제로 옮겨 담고 애니메이션은 지운다 (보이는 위치는 같다)
    holders[a].append(cb);
    holders[b].append(ca);
    [a1, b1, a2].forEach((x) => x && x.cancel());
    ca.style.zIndex = '';
  }

  return {
    /** 시작 화면: 단계 고르기. selected = 미리 선택할 단계(1~3), onStart(level) */
    intro(selected, onStart) {
      let level = selected;
      const render = () => {
        set(
          h(
            'div',
            { class: 'act-card' },
            h('p', { class: 'act-text' }, '카드 4장이 뒤집혀 섞여요. 눈으로 잘 따라가서, 로봇이 손가락으로 묻는 자리의 카드 색을 색깔 카드로 보여 주세요. 아래 버튼을 눌러도 돼요.'),
          ),
          h(
            'div',
            { class: 'act-answers', role: 'group', 'aria-label': '단계 고르기', style: { 'grid-template-columns': 'repeat(3, minmax(0, 1fr))' } },
            [1, 2, 3].map((n) => {
              const on = n === level;
              return h(
                'button',
                {
                  type: 'button',
                  class: 'act-answer',
                  'aria-pressed': String(on),
                  onClick: () => { level = n; render(); },
                  style: { 'flex-direction': 'column', gap: '6px', 'box-shadow': on ? 'inset 0 0 0 4px #1f1b18' : null },
                },
                // 고른 단계는 테두리와 함께 "✔" 글자로도 알린다 (색만으로 알리지 않기)
                h('span', { style: { 'font-size': '28px', 'font-weight': '700' } }, on ? `✔ ${n}단계` : `${n}단계`),
                h('span', { style: { 'font-size': '20px', 'font-weight': '400' } }, LEVEL_TEXT[n]),
              );
            }),
          ),
          h('p', { class: 'act-text' }, '색깔이 잘 구분되지 않으시면 이 활동은 건너뛰셔도 괜찮아요.'),
          h('div', { class: 'row' }, button('시작하기', () => onStart(level))),
        );
      };
      render();
    },

    waiting(text) {
      set(message(text, 'info'));
    },

    /** 한 판 시작: 카드 4장을 앞면으로 한 줄. order = ['blue', 'red', ...] (자리 0~3) */
    board(order, { index, count }, level) {
      holders = [];
      numbers = [];
      const slots = order.map((color, i) => {
        const card = h('div', {
          'data-color': color,
          role: 'img',
          style: {
            position: 'relative', width: '100%', height: '100%', 'border-radius': '18px',
            display: 'flex', 'align-items': 'center', 'justify-content': 'center',
            'box-shadow': '0 4px 10px rgba(0,0,0,0.18)', 'will-change': 'transform',
          },
        });
        setFace(card, true);
        const holder = h('div', { style: { width: '100%', 'max-width': '120px', height: `${CARD_H}px`, 'border-radius': '20px', 'outline-offset': '6px' } }, card);
        const no = h('span', { style: { 'font-size': '28px', 'font-weight': '700', padding: '2px 16px', 'border-radius': '999px', color: '#1f1b18' } }, `${i + 1}번`);
        holders.push(holder);
        numbers.push(no);
        return h('div', { style: { width: '100%', display: 'flex', 'flex-direction': 'column', 'align-items': 'center', gap: '10px' } }, holder, no);
      });
      // 안내 글자는 카드 아래 (들린 카드가 글자를 가리지 않게, 묻는 말이 답 버튼 바로 위에 오게)
      promptEl = h('p', { class: 'act-prompt', role: 'status', style: { padding: '0', 'font-size': '32px' } }, '');
      bottomEl = h('div', {});
      set(
        h(
          'div',
          { class: 'act-head' },
          h('span', { class: 'act-progress', 'aria-label': `${count}판 중 ${index}번째` }, `판 ${index} / ${count}`),
          h('span', { class: 'act-tag' }, `카드 섞기 · ${level}단계`),
        ),
        h('div', { style: { display: 'grid', 'grid-template-columns': `repeat(${order.length}, minmax(0, 1fr))`, gap: '20px', 'justify-items': 'center', 'padding-top': `${LIFT - 30}px` } }, slots),
        promptEl,
        bottomEl,
      );
    },

    /** 카드 아래 안내 한 줄 */
    say(text) {
      if (promptEl) promptEl.textContent = text;
    },

    /** 카드 모두 뒤집기 (up = true 면 앞면으로) */
    async flipAll(up) {
      await Promise.all(holders.map((hd) => flip(hd.firstChild, up)));
    },

    /** 섞기: swaps 순서대로 한 쌍씩. 끝나면 화면에 놓인 색 순서를 돌려준다 (applySwaps 결과와 맞추기용) */
    async shuffle(swaps, moveMs) {
      for (const [a, b] of swaps) {
        if (!alive) break;
        await swapAnim(a, b, moveMs);
      }
      return holders.map((hd) => hd.firstChild.dataset.color);
    },

    /** 자리 묻기: 그 자리를 표시하고 색 버튼을 보여 준다 */
    ask(position, onPick) {
      mark(position);
      if (hintEl) hintEl.remove();
      hintEl = null;
      promptEl.textContent = `${position + 1}번 자리 카드는 무슨 색일까요?`;
      bottomEl.replaceChildren(answerButtons(onPick));
    },

    /** 답을 오래 기다릴 때 안내를 붙인다 (묻는 화면은 그대로) */
    hint(text) {
      if (hintEl) return;
      hintEl = message(text, 'info');
      area.append(hintEl);
    },

    /** 고른 뒤: 그 자리 카드를 뒤집어 보여 주고 결과 문구. more = 이 판에 물을 자리가 더 있음 */
    async reveal(position, { correct, answer, more }) {
      if (hintEl) hintEl.remove();
      hintEl = null;
      const label = find(answer).label;
      const text = correct
        ? `잘 따라가셨어요! ${position + 1}번 자리에는 ${label}이 있었어요.`
        : `여기에는 ${label}이 있었어요. ${more ? '다음 자리도 잘 생각해 보세요.' : '다음 판도 잘 보세요.'}`;
      bottomEl.replaceChildren(message(text, correct ? 'good' : 'info'));
      await flip(holders[position].firstChild, true);
    },

    /** 판 끝: 표시를 지우고 모든 카드를 앞면으로 */
    async revealAll() {
      mark(-1);
      promptEl.textContent = '카드가 이렇게 놓여 있었어요.';
      await Promise.all(holders.map((hd) => flip(hd.firstChild, true)));
    },

    /** 회차 끝: summary = { total, done }, rounds = 판 수 */
    end({ total, done }, rounds, onAgain, onChoose) {
      holders = [];
      set(
        message(`${rounds}판을 모두 마쳤어요. 수고하셨어요!`, 'good'),
        h('p', {}, `물어본 카드 ${total}장 가운데 ${done}장의 색을 찾아 주셨어요.`),
        h('p', {}, '이번 회차가 끝났어요. 한 번 더 해도 좋아요.'),
        h('div', { class: 'row' }, button('한 번 더 하기', onAgain), button('단계 다시 고르기', onChoose, { variant: 'secondary' })),
      );
    },

    /** 화면을 닫을 때: 움직이는 카드를 모두 멈춘다 */
    destroy() {
      alive = false;
      running.forEach((a) => a.cancel());
      running.clear();
    },
  };
}
