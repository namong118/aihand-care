// 개발자 입력 (Mock): 페이지 맨 아래 점선 영역. 기본은 접힘.
// 손 인식·색 카드·숫자 카드 대신 버튼으로 입력하는 패널과 웹캠·WonderCam 상태를 담는다.
// 웹캠 손 인식 측정(카메라·해상도 고르기, 미리보기, FPS)도 여기에 둔다. 라즈베리파이에서 FPS 를 잴 때 쓴다.
// 접혀 있어도 패널은 붙어 있으므로 키보드 R/B/Y/G·1~5 입력은 계속 동작한다.

import { h } from '../ui/components.js';
import { outlineButton } from './statusbar.js';

const STATE_TEXT = {
  mock: '가상',
  checking: '확인 중',
  switching: '모드 바꾸는 중', // 화면에는 "WonderCam: 모드 바꾸는 중 (숫자 모드로)"
  connected: '연결됨',
  missing: '찾지 못함',
  disconnected: '연결 안 됨',
};

/**
 * @param devices  createContext 의 devices
 * @returns { el, renderStatus(list), webcamOptions() }
 *   el 은 페이지에 붙일 영역, renderStatus 는 장치 상태 갱신,
 *   webcamOptions 는 고른 카메라·해상도 ({ deviceId, width, height }, 상단 바 "웹캠 켜기"도 이 값을 쓴다)
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

  // 웹캠 손 인식 (측정용)
  const webcam = createWebcamBox(devices.hand);
  body.append(webcam.el);

  // 손모양 입력 패널: 웹캠이 켜져 있어도 쓸 수 있다 (누르고 있는 동안은 버튼이 우선)
  {
    const box = h('div', { class: 'dev-box' });
    body.append(box);
    devices.hand.mountControls(box);
  }
  // 색 카드 입력 패널 (Mock 일 때만). 패널 내용은 core 의 mountControls 가 그린다
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
    webcam.refresh();
  }

  return { el, renderStatus, webcamOptions: webcam.options };
}

/**
 * 웹캠 손 인식 측정 상자: 카메라·해상도 고르기, 켜기·끄기, FPS·GPU/CPU·실제 해상도·지금 손모양, 미리보기.
 * @param hand  devices.hand (손 인식 전환기)
 */
function createWebcamBox(hand) {
  let deviceId = ''; // '' = 기본 카메라
  let res = hand.resolutions.find((r) => r.width === 640) ?? hand.resolutions[0];

  const cameraSelect = h('select', { class: 'dev-select', 'aria-label': '카메라' }, h('option', { value: '' }, '기본 카메라'));
  const resSelect = h(
    'select',
    { class: 'dev-select', 'aria-label': '해상도' },
    hand.resolutions.map((r) => h('option', { value: `${r.width}x${r.height}` }, `${r.width}×${r.height}`)),
  );
  resSelect.value = `${res.width}x${res.height}`;

  const options = () => ({ deviceId: deviceId || undefined, width: res.width, height: res.height });
  // 켜져 있을 때 카메라·해상도를 바꾸면 바로 다시 켠다
  const restartIfOn = () => {
    if (hand.kind === 'mediapipe') hand.startWebcam(options());
  };
  cameraSelect.addEventListener('change', () => {
    deviceId = cameraSelect.value;
    restartIfOn();
  });
  resSelect.addEventListener('change', () => {
    const [w, hgt] = resSelect.value.split('x').map(Number);
    res = { width: w, height: hgt };
    restartIfOn();
  });

  const startBtn = outlineButton('웹캠 켜기', () => hand.startWebcam(options()));
  const stopBtn = outlineButton('웹캠 끄기', () => hand.stopWebcam());
  const info = h('p', { class: 'mock-status', 'aria-live': 'off' }, '웹캠 꺼짐');
  const preview = h('div', { class: 'webcam-preview' });

  const el = h(
    'div',
    { class: 'dev-box' },
    h('h2', {}, '웹캠 손 인식 (측정용)'),
    h('div', { class: 'dev-row' }, cameraSelect, resSelect, startBtn, stopBtn),
    info,
    preview,
  );

  function showInfo() {
    const cam = hand.webcam;
    if (!cam || !cam.running) {
      info.textContent = `웹캠 꺼짐 · ${hand.status().note}`;
      return;
    }
    const i = cam.info();
    const size = i.width ? `${i.width}×${i.height}` : '해상도 확인 중';
    const pose = i.code === null ? '손 없음' : `${i.code}${i.name ? ` (${i.name})` : ' (목록에 없는 모양)'}`;
    info.textContent = `FPS ${i.fps.toFixed(1)} · ${i.delegate ?? '?'} · ${size} · 인식: ${pose}`;
  }
  setInterval(showInfo, 500);

  let camerasLoaded = false;
  async function loadCameras() {
    const list = await hand.listCameras();
    if (list.length === 0) return;
    camerasLoaded = true;
    // replaceChildren 은 배열을 펼치지 않으므로 ... 로 펼쳐서 넘긴다
    cameraSelect.replaceChildren(
      h('option', { value: '' }, '기본 카메라'),
      ...list.map((c) => h('option', { value: c.deviceId }, c.label)),
    );
    cameraSelect.value = deviceId;
  }

  /** 손 인식 상태가 바뀔 때 (renderStatus 에서 부른다) */
  function refresh() {
    const on = hand.kind === 'mediapipe';
    const starting = hand.status().starting;
    startBtn.disabled = starting;
    startBtn.lastChild.textContent = starting ? '켜는 중…' : on ? '다시 켜기' : '웹캠 켜기';
    stopBtn.disabled = !on;
    // 미리보기 video 는 웹캠 장치가 처음 만들어질 때 한 번 붙인다
    if (hand.webcam && !preview.firstChild) preview.append(hand.webcam.video);
    preview.hidden = !on;
    // 카메라 이름은 웹캠을 한 번 허용한 뒤에야 나오므로, 켜기를 한 번 시도한 뒤 목록을 다시 읽는다.
    // 기본 카메라가 실패해도(다른 프로그램이 사용 중 등) 다른 카메라를 고를 수 있게, 실패했을 때도 읽는다
    if (!camerasLoaded && !starting) loadCameras();
    showInfo();
  }

  return { el, options, refresh };
}
