// 공 주고받기 화면 그리기. 진행·판단은 하지 않고 보여주기만 한다.
// 모양은 styles.css "활동 화면 공통"(act-*) 클래스와 단계 고르기(src/ui/level-picker.js).
// 손은 그림 없이 "오른손"·"왼손" 글자로 크게 보여 준다 (색이나 그림만으로 구분하지 않음).

import { h, button, message, firstOnly } from '../../ui/components.js';
import { levelPicker } from '../../ui/level-picker.js';
import { HAND_TEXT } from './logic.js';

/** 단계 설명 (시작 화면) */
const LEVEL_DESC = {
  1: '편한 한 손으로 건네고 받아요',
  2: '건네는 손과 받는 손을 바꿔요',
  3: '손이 매번 바뀌어요. 보고 기억해 주세요',
};

export function createScreen(container) {
  container.innerHTML = '';
  const area = h('div', { class: 'program-body' });
  container.append(area);

  let promptEl = null; // "셋, 둘, 하나" 를 바꿔 쓰는 줄
  let panel = null; // 건네는 손 → 받는 손 칸 (다시 보기 때 다시 그림)

  function set(...children) {
    area.innerHTML = '';
    area.append(...children.flat().filter(Boolean));
  }

  function head({ level, index, count }) {
    return h(
      'div',
      { class: 'act-head' },
      h('span', { class: 'act-progress' }, `${index} / ${count}번째`),
      h('span', { class: 'act-tag' }, `${level}단계`),
    );
  }

  /** 손 칸 하나. hand 가 null 이면 가려진 칸 ("?") */
  function handBox(label, hand, active) {
    return h(
      'div',
      {
        class: 'act-card',
        style: {
          flex: '1 1 0',
          'align-items': 'center',
          'text-align': 'center',
          padding: '16px',
          border: active ? '4px solid var(--step-fg, var(--c-accent))' : '1px solid var(--c-line)',
        },
        'aria-label': `${label}: ${hand ? HAND_TEXT[hand] : '기억한 손'}${active ? ', 지금 할 차례' : ''}`,
      },
      h('p', { class: 'act-label', style: { 'font-size': '24px' } }, active ? `▶ ${label}` : label),
      h('p', { style: { margin: '0', 'font-size': '56px', 'font-weight': '700', 'line-height': '1.2' } }, hand ? HAND_TEXT[hand] : '?'),
    );
  }

  /**
   * 건네는 손 → 받는 손.
   * pair: { give, receive }, hidden: 가린 칸 (3단계), active: 'give' | 'receive' | null (지금 할 차례 굵은 테두리)
   */
  function handPanel(pair, { hidden = false, active = null } = {}) {
    return h(
      'div',
      { style: { display: 'flex', gap: '16px', 'align-items': 'center' } },
      handBox('건네는 손', hidden ? null : pair.give, active === 'give'),
      h('span', { 'aria-hidden': 'true', style: { 'font-size': '40px', 'font-weight': '700' } }, '→'),
      handBox('받는 손', hidden ? null : pair.receive, active === 'receive'),
    );
  }

  /**
   * 진행 화면 한 장: 머리줄 + 손 칸 + 안내 두 줄 + 버튼 줄.
   * buttons: [{ label, onClick, variant, repeat }]
   *   화면을 넘기는 버튼은 두 번 눌러도 처음 하나만 받는다 (firstOnly).
   *   repeat: true 인 버튼([다시 보기])은 화면을 넘기지 않으므로 여러 번 눌러도 되고, 다른 버튼을 막지 않는다
   */
  function stage({ level, index, count, pair, hidden, active, prompt, sub, buttons = [] }) {
    panel = h('div', {}, handPanel(pair, { hidden, active }));
    promptEl = h('p', { class: 'act-prompt', style: { padding: '8px 0' }, 'aria-live': 'polite' }, prompt ?? '');
    const moving = buttons.filter((b) => !b.repeat);
    const once = firstOnly(...moving.map((b) => b.onClick));
    const handlers = buttons.map((b) => (b.repeat ? b.onClick : once[moving.indexOf(b)]));
    set(
      head({ level, index, count }),
      panel,
      h(
        'div',
        { class: 'act-card' },
        promptEl,
        sub ? h('p', { class: 'act-text', style: { 'text-align': 'center' } }, sub) : null,
      ),
      buttons.length
        ? h(
            'div',
            { class: 'row', style: { 'justify-content': 'center' } },
            buttons.map((b, i) => button(b.label, handlers[i], { variant: b.variant ?? 'primary' })),
          )
        : null,
    );
  }

  return {
    /** 시작 화면: 규칙 + 1·2·3단계 고르기 */
    levels({ selected }, onStart) {
      promptEl = null;
      set(
        levelPicker({
          title: '공 주고받기',
          lead: '화면이 알려 주는 손으로 로봇에게 공을 건네고, 로봇이 펴 주는 공을 받아 보세요. 공 하나를 준비해 주세요.',
          levels: [1, 2, 3].map((level) => ({ level, desc: LEVEL_DESC[level] })),
          selected,
          onStart,
        }),
      );
    },

    /** 지금 할 일 화면 (위 stage 참고) */
    stage,

    /** "셋", "둘", "하나" 처럼 안내 줄만 바꾸기 */
    prompt(text) {
      if (promptEl) promptEl.textContent = text;
    },

    /** 3단계 [다시 보기]: 가렸던 손을 이 화면 동안만 보여 준다 */
    reveal(pair, active) {
      if (!panel) return;
      panel.innerHTML = '';
      panel.append(handPanel(pair, { hidden: false, active }));
    },

    /** 기다리는 동안 안내 (로봇 준비 등) */
    waiting(text) {
      promptEl = null;
      set(message(text, 'info'));
    },

    /** 회차 끝 */
    finished({ done, level }, onAgain, onLevels) {
      promptEl = null;
      const [again, levels] = firstOnly(onAgain, onLevels);
      set(
        message(`다 하셨어요! 공을 ${done}번 주고받았어요.`, 'good'),
        h('p', { class: 'act-text' }, `${level}단계를 끝까지 하셨어요. 한 번 더 하거나 다른 단계를 골라 보세요.`),
        h('div', { class: 'row' }, button('한 번 더 하기', again), button('단계 바꾸기', levels, { variant: 'secondary' })),
      );
    },

    /** 그만하기로 끝났을 때 (기록하지 않음) */
    stopped({ done }, onAgain, onLevels) {
      promptEl = null;
      const [again, levels] = firstOnly(onAgain, onLevels);
      set(
        message(done > 0 ? `이번에는 여기까지 할게요. 공을 ${done}번 주고받았어요.` : '이번에는 여기까지 할게요.', 'info'),
        h('div', { class: 'row' }, button('처음부터 하기', again), button('단계 바꾸기', levels, { variant: 'secondary' })),
      );
    },
  };
}
