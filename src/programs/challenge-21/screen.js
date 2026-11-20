// 21 게임 화면 그리기. 판정은 하지 않고 보여주기만 한다.
// 모양은 styles.css "활동 화면 공통"(act-*) 클래스와 단계 고르기(src/ui/level-picker.js).

import { h, button, message } from '../../ui/components.js';
import { levelPicker } from '../../ui/level-picker.js';
import { countFrom, goodSpots, josa } from './logic.js';

/** 단계 설명 (시작 화면) */
const LEVEL_DESC = {
  1: '한 번에 3개까지, 로봇이 가끔 실수해요',
  2: '끝 숫자와 개수가 판마다 바뀌어요',
  3: '한 번에 4개까지, 로봇이 실수하지 않아요',
};

const FINGER_TEXT = { 1: '손가락 하나', 2: '손가락 둘', 3: '손가락 셋', 4: '손가락 넷' };

export function createScreen(container) {
  container.innerHTML = '';
  const area = h('div', { class: 'program-body' });
  container.append(area);

  function set(...children) {
    area.innerHTML = '';
    area.append(...children.flat().filter(Boolean));
  }

  const card = (...children) => h('div', { class: 'act-card' }, ...children);
  let handLine = null; // 웹캠 손 인식 상태 한 줄 (내 차례에만)

  function head({ level, end, maxStep }) {
    return h(
      'div',
      { class: 'act-head' },
      h('span', { class: 'act-progress' }, `끝 숫자 ${end}`),
      h('span', { class: 'act-tag' }, `${level}단계`),
      h('span', { class: 'act-tag' }, `한 번에 1~${maxStep}개`),
    );
  }

  /**
   * 1부터 끝 숫자까지 칸. 센 수는 누가 셌는지 글자(나/로봇)로도 보여 준다 (색만으로 알리지 않음).
   * owners: { [수]: 'me'|'robot' }, fresh: 방금 센 수 목록 (굵은 테두리)
   */
  function track({ end, owners, fresh = [] }) {
    const cols = Math.ceil(end / 2);
    return h(
      'div',
      {
        class: 'act-card',
        style: { display: 'grid', 'grid-template-columns': `repeat(${cols}, minmax(0, 1fr))`, gap: '6px', padding: '14px' },
        'aria-label': `1부터 ${end}까지`,
      },
      Array.from({ length: end }, (_, i) => {
        const n = i + 1;
        const who = owners[n];
        const isEnd = n === end;
        return h(
          'div',
          {
            style: {
              display: 'flex',
              'flex-direction': 'column',
              'align-items': 'center',
              'justify-content': 'center',
              'min-height': '64px',
              'border-radius': '14px',
              background: who === 'me' ? 'var(--step-bg)' : who === 'robot' ? 'var(--c-text)' : 'transparent',
              color: who === 'robot' ? 'var(--c-surface)' : 'var(--c-text)',
              border: isEnd ? '3px dashed var(--step-fg)' : fresh.includes(n) ? '3px solid var(--step-fg)' : '1px solid var(--c-line)',
            },
          },
          h('span', { style: { 'font-size': '24px', 'font-weight': '700', 'line-height': '1.1' } }, String(n)),
          h(
            'span',
            { style: { 'font-size': '14px', 'line-height': '1.2', 'min-height': '17px' } },
            who === 'me' ? '나' : who === 'robot' ? '로봇' : isEnd ? '끝' : '',
          ),
        );
      }),
    );
  }

  return {
    /** 시작 화면: 규칙 + 1·2·3단계 고르기 */
    levels({ selected }, onStart) {
      set(
        levelPicker({
          title: '21 게임',
          lead: '내가 먼저, 1부터 로봇과 번갈아 수를 이어 세요. 몇 개를 셀지 손가락으로 보여 주세요. 끝 숫자를 로봇이 부르게 만들어 보세요.',
          levels: [1, 2, 3].map((level) => ({ level, desc: LEVEL_DESC[level] })),
          selected,
          onStart,
        }),
      );
    },

    /** 이번 판 안내 */
    intro({ level, end, maxStep }, onGo) {
      set(
        head({ level, end, maxStep }),
        card(
          h('p', { class: 'act-question', style: { 'text-align': 'center', 'font-size': '48px' } }, `이번 끝 숫자는 ${end}${josa(end, '이에요', '예요')}`),
          h(
            'p',
            { class: 'act-text', style: { 'text-align': 'center' } },
            `1부터 번갈아 세요. 한 번에 1개부터 ${maxStep}개까지 셀 수 있어요. ${end}${josa(end, '을', '를')} 로봇이 부르게 만들어 보세요.`,
          ),
        ),
        h('div', { class: 'row', style: { 'justify-content': 'center' } }, button('시작하기', onGo)),
      );
    },

    /**
     * 내 차례: 1~끝 칸, 손가락 개수 버튼.
     * allowed: 이번에 셀 수 있는 개수 목록 (끝 숫자를 넘지 않게)
     */
    myTurn({ level, end, maxStep, now, owners, fresh, robotSaid, allowed, holdSec }, onPick, onStop) {
      handLine = h('p', { class: 'act-label', style: { 'text-align': 'center', margin: '0', 'min-height': '24px' } }, '');
      set(
        head({ level, end, maxStep }),
        track({ end, owners, fresh }),
        card(
          h(
            'p',
            { class: 'act-text', style: { 'text-align': 'center', margin: '0', 'font-weight': '600' } },
            robotSaid ? `로봇이 ${robotSaid.join(', ')}까지 셌어요. ` : '',
            `내 차례예요. ${now + 1}부터 몇 개를 셀까요?`,
          ),
          h(
            'p',
            { class: 'act-label', style: { 'text-align': 'center', margin: '0' } },
            `손가락 개수를 ${holdSec}초 보여 주거나 아래 버튼을 눌러 주세요`,
          ),
          handLine,
        ),
        h(
          'div',
          { class: 'act-answers', role: 'group', 'aria-label': '셀 개수 고르기', style: { 'grid-template-columns': `repeat(${maxStep}, minmax(0, 1fr)) auto` } },
          Array.from({ length: maxStep }, (_, i) => {
            const n = i + 1;
            const ok = allowed.includes(n);
            const nums = countFrom(now, n);
            return h(
              'button',
              {
                type: 'button',
                class: 'act-answer',
                'aria-label': ok ? `${n}개 세기: ${nums.join(', ')}` : `${n}개는 끝 숫자를 넘어요`,
                style: { 'flex-direction': 'column', gap: '2px', 'min-height': '96px' },
                disabled: ok ? null : true,
                onClick: () => onPick(n),
              },
              h('span', { style: { 'font-size': '32px', 'font-weight': '700' } }, `${n}개`),
              h('span', { style: { 'font-size': '18px' } }, ok ? nums.join(', ') : '넘어요'),
            );
          }),
          h(
            'button',
            { type: 'button', class: 'act-answer', style: { 'font-size': '20px', 'min-height': '96px', padding: '12px' }, onClick: onStop },
            '그만하기',
          ),
        ),
      );
    },

    /** 웹캠으로 지금 보이는 손가락 (내 차례에만). count: 1~4 | null, kind: 'none'|'other'|'count' */
    showHand({ kind, count, ok }) {
      if (!handLine) return;
      handLine.textContent =
        kind === 'count'
          ? ok
            ? `${FINGER_TEXT[count]} 보여요 — 그대로 잠깐 있어 주세요`
            : `${FINGER_TEXT[count]}: 이번에는 셀 수 없는 개수예요`
          : kind === 'other'
            ? '검지부터 손가락을 펴서 개수를 보여 주세요'
            : '';
    },

    /** 내가 센 뒤 / 로봇이 생각하고 세는 중 */
    counting({ level, end, maxStep, owners, fresh, who, said }) {
      handLine = null;
      set(
        head({ level, end, maxStep }),
        track({ end, owners, fresh }),
        card(
          h(
            'p',
            { class: 'act-prompt', style: { margin: '0' } },
            who === 'me'
              ? `${said.join(', ')}!`
              : said
                ? `로봇: ${said.length}개 — ${said.join(', ')}`
                : '로봇이 생각하고 있어요…',
          ),
          who === 'robot' && said
            ? h('p', { class: 'act-text', style: { 'text-align': 'center', margin: '0' } }, `로봇 손: ${FINGER_TEXT[said.length]}`)
            : null,
        ),
      );
    },

    /** 판이 끝났을 때 */
    finished({ end, maxStep, owners, winner, myTurns, hint }, onAgain, onLevels) {
      handLine = null;
      set(
        winner === 'me'
          ? message(`해내셨어요! 로봇이 ${end}${josa(end, '을', '를')} 불렀어요.`, 'good')
          : winner === 'robot'
            ? message(`이번에는 ${end}${josa(end, '을', '를')} 부르셨어요. 다음 판에서 또 해 봐요.`, 'info')
            : message('이번 판은 여기까지 할게요.', 'info'),
        track({ end, owners }),
        winner === 'robot' && hint
          ? h('p', { class: 'act-text', style: { margin: '0' } }, `알아 두면 좋아요: 내 차례를 ${goodSpots(end, maxStep).join(', ')}에서 끝내 보세요. 그러면 ${end}${josa(end, '은', '는')} 로봇 차례에 와요.`)
          : myTurns
            ? h('p', { class: 'act-text', style: { margin: '0' } }, `${myTurns}번 세셨어요.`)
            : null,
        h('div', { class: 'row' }, button('한 판 더 하기', onAgain), button('단계 바꾸기', onLevels, { variant: 'secondary' })),
      );
    },
  };
}
