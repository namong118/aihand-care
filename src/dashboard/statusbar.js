// 상단 바: 앱 이름, 장치 상태 알약 2개(AIHand, 손 인식)와 연결 버튼, "활동 기록"·"설정" 버튼.
// 웹캠·WonderCam 상태는 맨 아래 개발자 입력 영역에 보여준다 (devpanel.js).
// 상태는 색만이 아니라 글자로도 보여준다.

import { h } from '../ui/components.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** 문자열 SVG 를 요소로 만든다 (그림 전용, 화면 읽기 프로그램에서는 숨김) */
export function svgIcon(markup) {
  const wrap = document.createElement('span');
  wrap.className = 'icon';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.innerHTML = markup;
  return wrap;
}

const LOGO = `<svg width="30" height="30" viewBox="0 0 30 30" xmlns="${SVG_NS}"><rect x="3" y="9" width="4.5" height="13" rx="2.25" fill="var(--c-accent)"/><rect x="9" y="3" width="4.5" height="19" rx="2.25" fill="var(--c-accent)"/><rect x="15" y="3" width="4.5" height="19" rx="2.25" fill="var(--c-accent)"/><rect x="21" y="12" width="4.5" height="10" rx="2.25" fill="#AFC0EA"/><rect x="2" y="18" width="25" height="10" rx="4" fill="#DCE4F7"/></svg>`;
const ICON_CHART = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="${SVG_NS}"><path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 15l4-4 3 3 5-6"/></svg>`;
const ICON_GEAR = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="${SVG_NS}"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`;

/** 테두리 버튼 (상단 바·설정·개발자 영역 공통, 높이 48px) */
export function outlineButton(label, onClick, { icon, pressed, expanded, disabled } = {}) {
  return h(
    'button',
    {
      type: 'button',
      class: 'btn-outline',
      onClick,
      'aria-pressed': pressed === undefined ? null : String(Boolean(pressed)),
      'aria-expanded': expanded === undefined ? null : String(Boolean(expanded)),
      disabled: disabled ? true : null,
    },
    icon ? svgIcon(icon) : null,
    label,
  );
}

function robotPill(d, actions) {
  if (d.state === 'connected') {
    return [
      h(
        'span',
        { class: 'pill pill-ok' },
        h('span', { class: 'pill-dot', 'aria-hidden': 'true' }),
        'AIHand 연결됨',
        d.note ? ` · ${d.note}` : '',
      ),
    ];
  }
  // 연결 안 됨: 회색 알약 + "AIHand 연결" 버튼. 안내(Chrome에서 열어 주세요 등)는 알약 안에 쓴다
  const text = d.state === 'disconnected' ? 'AIHand 연결 안 됨' : 'AIHand';
  return [
    h('span', { class: 'pill' }, text, d.note ? ` · ${d.note}` : ''),
    actions.connectRobot
      ? outlineButton(d.connecting ? '연결 중…' : 'AIHand 연결', actions.connectRobot, {
          disabled: d.connecting,
        })
      : null,
  ];
}

function handPill(d, actions) {
  if (d.state === 'connected') {
    return [
      h(
        'span',
        { class: 'pill pill-ok' },
        h('span', { class: 'pill-dot', 'aria-hidden': 'true' }),
        '손 인식 · 웹캠',
      ),
      actions.stopCamera ? outlineButton('웹캠 끄기', actions.stopCamera) : null,
    ];
  }
  // 웹캠 꺼짐: 회색 알약(화면 버튼 또는 안내 문구) + "웹캠 켜기" 버튼
  return [
    h('span', { class: 'pill' }, `손 인식 · ${d.note ?? '화면 버튼'}`),
    actions.startCamera
      ? outlineButton(d.starting ? '켜는 중…' : '웹캠 켜기', actions.startCamera, { disabled: d.starting })
      : null,
  ];
}

/**
 * @param el        상단 바 자리 (#statusbar)
 * @param devices   devices.status() 결과
 * @param actions   { connectRobot(), startCamera(), stopCamera(), showResults(), toggleSettings(), goHome() }
 * @param settingsOpen  설정 영역이 열려 있는지
 */
export function renderStatusbar(el, { devices, actions = {}, settingsOpen = false }) {
  el.innerHTML = '';
  const robot = devices.find((d) => d.key === 'robot');
  const hand = devices.find((d) => d.key === 'hand');

  el.append(
    h(
      'div',
      { class: 'topbar' },
      h('div', { class: 'topbar-brand' }, svgIcon(LOGO), h('span', { class: 'topbar-name' }, 'aihand-care')),
      h(
        'div',
        { class: 'topbar-status', role: 'status', 'aria-label': '장치 상태' },
        robot ? robotPill(robot, actions) : null,
        hand ? handPill(hand, actions) : null,
      ),
      h(
        'div',
        { class: 'topbar-actions' },
        outlineButton('활동 기록', actions.showResults, { icon: ICON_CHART }),
        outlineButton('설정', actions.toggleSettings, { icon: ICON_GEAR, expanded: settingsOpen }),
      ),
    ),
  );
}
