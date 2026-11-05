// 장치 상태 표시줄: 웹캠, 손 인식, AIHand, WonderCam 상태와 실제/Mock 여부를 항상 표시.
// 상태는 색이 아니라 글자로 보여준다.

import { h } from '../ui/components.js';

const STATE_TEXT = {
  mock: '가상',
  connected: '연결됨',
  disconnected: '연결 안 됨',
};

export function renderStatusbar(el, { devices, settings }) {
  el.innerHTML = '';
  for (const d of devices) {
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
  }
  el.append(
    h('span', { class: 'status-item status-user' }, h('strong', {}, '사용자: '), settings.user ?? '선택 안 함'),
  );
}
