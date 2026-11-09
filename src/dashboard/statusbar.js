// 장치 상태 표시줄: 웹캠, 손 인식, AIHand, WonderCam 상태와 실제/Mock 여부를 항상 표시.
// 상태는 색이 아니라 글자로 보여준다.

import { h, button } from '../ui/components.js';

const STATE_TEXT = {
  mock: '가상',
  connected: '연결됨',
  disconnected: '연결 안 됨',
};

/**
 * @param actions  { connectRobot() } "AIHand 연결" 버튼을 눌렀을 때 부를 함수
 */
export function renderStatusbar(el, { devices, actions = {} }) {
  el.innerHTML = '';
  for (const d of devices) {
    // AIHand 가 연결되어 있지 않으면 연결 버튼을 함께 보여준다
    const connectBtn =
      d.key === 'robot' && d.state !== 'connected' && actions.connectRobot
        ? button(d.connecting ? '연결 중…' : 'AIHand 연결', actions.connectRobot, {
            variant: 'secondary',
            disabled: d.connecting,
          })
        : null;
    el.append(
      h(
        'span',
        { class: 'status-item' },
        h('strong', {}, `${d.label}: `),
        STATE_TEXT[d.state] ?? d.state,
        d.note ? ` (${d.note})` : '',
        d.mock ? h('span', { class: 'status-badge' }, 'Mock') : h('span', { class: 'status-badge' }, '실제'),
      ),
    );
    if (connectBtn) el.append(connectBtn);
  }
}
