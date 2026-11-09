// 개발자 입력 (Mock): 페이지 맨 아래 점선 영역. 기본은 접힘.
// 손 인식·색 카드 대신 버튼으로 입력하는 패널과 웹캠·WonderCam 상태를 담는다.
// 접혀 있어도 패널은 붙어 있으므로 키보드 R/B/Y/G 입력은 계속 동작한다.

import { h } from '../ui/components.js';

const STATE_TEXT = { mock: '가상', connected: '연결됨', disconnected: '연결 안 됨' };

/**
 * @param devices  createContext 의 devices
 * @returns { el, renderStatus(list) }  el 은 페이지에 붙일 영역, renderStatus 는 장치 상태 갱신
 */
export function createDevPanel(devices) {
  let open = false;
  const label = h('span', {}, '펼치기');
  const toggle = h(
    'button',
    { type: 'button', class: 'dev-toggle', 'aria-expanded': 'false', 'aria-controls': 'dev-body' },
    h('span', {}, '개발자 입력 (Mock) · 손모양·카드를 버튼으로 대신 입력'),
    label,
  );
  const status = h('p', { class: 'dev-status' });
  const body = h('div', { class: 'dev-body', id: 'dev-body', hidden: true }, status);

  toggle.addEventListener('click', () => {
    open = !open;
    body.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    label.textContent = open ? '접기' : '펼치기';
  });

  // 손모양·색 카드 입력 패널 (Mock 일 때만). 패널 내용은 core 의 mountControls 가 그린다
  if (devices.hand.kind === 'mock') {
    const box = h('div', { class: 'dev-box' });
    body.append(box);
    devices.hand.mountControls(box);
  }
  if (devices.card.kind === 'mock') {
    const box = h('div', { class: 'dev-box' });
    body.append(box);
    devices.card.mountControls(box);
  }

  const el = h('section', { class: 'dev-panel', 'aria-label': '개발자 입력' }, toggle, body);

  /** 웹캠·WonderCam 상태 (상단 바에서 옮겨 온 것) */
  function renderStatus(list) {
    status.textContent = list
      .filter((d) => d.key === 'webcam' || d.key === 'wondercam')
      .map((d) => `${d.label}: ${STATE_TEXT[d.state] ?? d.state}${d.note ? ` (${d.note})` : ''} · ${d.mock ? 'Mock' : '실제'}`)
      .join('   |   ');
  }

  return { el, renderStatus };
}
