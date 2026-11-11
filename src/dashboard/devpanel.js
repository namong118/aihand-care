// 개발자 입력 (Mock): 페이지 맨 아래 점선 영역. 기본은 접힘.
// 손 인식·색 카드·숫자 카드 대신 버튼으로 입력하는 패널, 로봇 손모양 시험 버튼, 웹캠·WonderCam 상태를 담는다.
// 접혀 있어도 패널은 붙어 있으므로 키보드 R/B/Y/G·1~5 입력은 계속 동작한다.

import { h } from '../ui/components.js';
import poses from '../data/poses.json';

const STATE_TEXT = {
  mock: '가상',
  checking: '확인 중',
  switching: '모드 바꾸는 중', // 화면에는 "WonderCam: 모드 바꾸는 중 (숫자 모드로)"
  connected: '연결됨',
  missing: '찾지 못함',
  disconnected: '연결 안 됨',
};

/**
 * 로봇 손모양 시험: 버튼을 누르면 연결된 AIHand 가 바로 그 손모양·동작을 한다 (시연 전 로봇 점검용).
 * AIHand 에 연결되어 있을 때만 누를 수 있다.
 * @param robot  devices.robot
 * @returns { el, update(connected) }
 */
function createRobotTest(robot) {
  const hint = h('p', { class: 'mock-status' });
  const last = h('p', { class: 'mock-status', 'aria-live': 'polite' }, '마지막 명령: 없음');
  const buttons = [];

  function testButton(label, command) {
    const btn = h('button', { type: 'button', class: 'btn btn-small' }, label);
    btn.addEventListener('click', async () => {
      last.textContent = `보내는 중: ${label}`;
      try {
        const result = await command();
        // 로봇 응답: { type: 'DONE' } 또는 { type: 'ERR', message } (core/robot/serial.js)
        last.textContent =
          result?.type === 'ERR' ? `${label}: 로봇이 하지 못했어요 (${result.message})` : `완료: ${label}`;
      } catch (err) {
        console.error('로봇 시험 명령 오류', err);
        last.textContent = `${label}: 보내지 못했어요`;
      }
    });
    buttons.push(btn);
    return btn;
  }

  const el = h(
    'div',
    { class: 'dev-box' },
    h('h2', {}, '로봇 손모양 시험 (AIHand 직접 움직이기)'),
    hint,
    h('div', { class: 'mock-grid' }, poses.map((p) => testButton(p.label, () => robot.showPose(p.name)))),
    h(
      'div',
      { class: 'mock-grid' },
      testButton('쉬는 자세', () => robot.rest()),
      testButton('인사', () => robot.hello()),
      testButton('칭찬 반응', () => robot.react('ok')),
      testButton('다시 반응', () => robot.react('retry')),
    ),
    last,
  );

  function update(connected) {
    hint.textContent = connected
      ? '누르면 연결된 AIHand가 바로 그 동작을 해요. 활동 진행 중에는 누르지 마세요.'
      : '상단 "AIHand 연결"을 누른 뒤 쓸 수 있어요.';
    buttons.forEach((b) => {
      b.disabled = !connected;
    });
  }
  update(false);

  return { el, update };
}

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
  // 웹캠 손 인식이 켜져 있으면 아래 손모양 버튼은 프로그램에 전달되지 않는다 (core/hand/index.js)
  const camHint = h('p', { class: 'dev-status', hidden: true }, '웹캠 손 인식 중에는 손모양 버튼 입력이 쉬어요. 상단 "웹캠 끄기"를 누르면 다시 쓸 수 있어요.');
  const robotTest = createRobotTest(devices.robot);
  const body = h('div', { class: 'dev-body', id: 'dev-body', hidden: true }, status, camHint, robotTest.el);

  toggle.addEventListener('click', () => {
    open = !open;
    body.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    label.textContent = open ? '접기' : '펼치기';
  });

  // 손모양·색 카드 입력 패널. 패널 내용은 core 의 mountControls 가 그린다
  // 손 인식은 웹캠을 켰다 껐다 할 수 있으므로 손모양 버튼은 항상 붙여 둔다
  if (devices.hand.mountControls) {
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
    camHint.hidden = list.find((d) => d.key === 'hand')?.state !== 'connected';
    robotTest.update(list.find((d) => d.key === 'robot')?.state === 'connected');
  }

  return { el, renderStatus };
}
