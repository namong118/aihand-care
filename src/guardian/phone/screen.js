// 보호자 폰 앱 화면 그리기. 계산은 logic.js, 흐름은 main.js 가 맡는다.
// 표현 원칙(docs/guardian-app.md 6-12): "활동 기록"만, 점수·판정 없이, 안 한 날은 빈칸.

import { compareMonth, monthCells, daysInMonth, monthText, timeText } from './logic.js';

/** 작은 요소 만들기 도우미: h('p', { class: 'x', onClick }, '글자', 자식요소) */
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'class') el.className = value;
    else el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

function appName() {
  return h('p', { class: 'app-name' }, '손잇다 보호자');
}

// ---- 연결 화면 ----

/**
 * 코드를 직접 넣는 화면 (QR 없이 열었을 때, 연결을 지운 뒤)
 * onSubmit({ code, name }) → 문제가 있으면 안내 글자를 돌려준다
 */
export function renderConnect(root, { error = '', onSubmit, onDemo }) {
  const message = h('p', { class: 'form-msg', role: 'alert', id: 'connect-msg' }, error);
  const codeInput = h('input', {
    id: 'code',
    name: 'code',
    type: 'text',
    inputmode: 'text',
    autocomplete: 'off',
    autocapitalize: 'characters',
    spellcheck: 'false',
    maxlength: '16',
    placeholder: 'ABCD-EFGH-JKMN',
    'aria-describedby': 'connect-msg',
  });
  const nameInput = h('input', { id: 'name', name: 'name', type: 'text', autocomplete: 'off', maxlength: '12', placeholder: '예: 어머니' });

  const form = h(
    'form',
    { class: 'card form', novalidate: true },
    h('label', { for: 'code' }, '연결 코드 (12글자)'),
    codeInput,
    h('label', { for: 'name' }, '어르신 호칭 (선택)'),
    nameInput,
    message,
    h('button', { type: 'submit', class: 'btn primary' }, '연결하기'),
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const problem = onSubmit({ code: codeInput.value, name: nameInput.value });
    if (problem) {
      message.textContent = problem;
      codeInput.focus();
    }
  });

  root.replaceChildren(
    h(
      'main',
      { class: 'page' },
      h('header', { class: 'top' }, h('div', {}, appName(), h('h1', {}, '보호자 연결'))),
      h(
        'p',
        { class: 'lead' },
        '스테이션 화면의 QR을 폰 카메라로 찍으면 저절로 연결돼요. QR을 찍기 어려우면 화면에 보이는 연결 코드를 넣어 주세요.',
      ),
      form,
      h('button', { type: 'button', class: 'btn', onClick: onDemo }, '예시 화면 보기'),
    ),
  );
  codeInput.focus();
}

// ---- 첫 화면 (참여 달력) ----

function statusBlock({ status, onReload }) {
  if (status === 'ok') return null;
  const text = {
    loading: '기록을 불러오는 중이에요…',
    empty: '아직 받은 활동 기록이 없어요. 스테이션에서 연결을 준비하는 중이거나, 아직 코스를 하지 않으셨을 수 있어요. 코스를 마치면 여기에 보여요.',
    error: '기록을 가져오지 못했어요. 인터넷 연결을 확인한 뒤 다시 불러와 주세요.',
    nosetup: '이 주소에서는 기록을 불러올 수 없어요 (저장소 주소가 설정되지 않았어요). 예시 화면은 볼 수 있어요.',
  }[status];
  return h(
    'div',
    { class: `card status status-${status}`, role: 'status' },
    h('p', {}, text),
    status === 'error' ? h('button', { type: 'button', class: 'btn', onClick: onReload }, '다시 불러오기') : null,
  );
}

function calendar({ month, range, counts, today, onPrev, onNext }) {
  const cells = monthCells(month).map((cell) => {
    if (!cell) return h('div', { class: 'day blank', 'aria-hidden': 'true' });
    const n = counts.get(cell.date) ?? 0;
    const isToday = cell.date === today;
    const label = `${month.month}월 ${cell.day}일${isToday ? ' 오늘' : ''}${n ? `, ${n}번 함께함` : ''}`;
    return h(
      'div',
      { class: ['day', n ? 'has' : '', isToday ? 'today' : ''].join(' ').trim(), role: 'listitem', 'aria-label': label },
      h('span', { class: 'dn', 'aria-hidden': 'true' }, cell.day),
      n ? h('span', { class: 'sp', 'aria-hidden': 'true' }, '🌱', n > 1 ? h('small', {}, n) : null) : null,
    );
  });

  return h(
    'section',
    { class: 'card', 'aria-labelledby': 'cal-title' },
    h(
      'div',
      { class: 'cal-head' },
      h('button', { type: 'button', class: 'navbtn', 'aria-label': '이전 달', disabled: compareMonth(month, range.min) <= 0, onClick: onPrev }, '‹'),
      h('h2', { id: 'cal-title', 'aria-live': 'polite' }, `${month.year}년 ${month.month}월`),
      h('button', { type: 'button', class: 'navbtn', 'aria-label': '다음 달', disabled: compareMonth(month, range.max) >= 0, onClick: onNext }, '›'),
    ),
    h('div', { class: 'cal', 'aria-hidden': 'true' }, DOW.map((d, i) => h('div', { class: `dow${i === 0 ? ' sun' : ''}` }, d))),
    h('div', { class: 'cal', role: 'list', 'aria-label': `${month.month}월 달력` }, cells),
    h(
      'div',
      { class: 'cal-foot' },
      h('span', {}, '🌱 = 함께한 날'),
      h('b', {}, monthText(daysInMonth(counts, month), month, today)),
    ),
  );
}

/**
 * 첫 화면: 제목, 상태 안내, 참여 달력
 * props: { title, demo, notice, status, loadedAt, month, range, counts, today, onPrev, onNext, onReload, onSettings, onExitDemo }
 */
export function renderHome(root, props) {
  const { title, demo, notice, status, loadedAt, onReload, onSettings, onExitDemo } = props;
  const actions = h(
    'div',
    { class: 'top-actions' },
    demo
      ? h('button', { type: 'button', class: 'btn small', onClick: onExitDemo }, '예시 나가기')
      : [
          h('button', { type: 'button', class: 'btn small', onClick: onReload, disabled: status === 'loading' }, '새로 불러오기'),
          h('button', { type: 'button', class: 'btn small', onClick: onSettings }, '설정'),
        ],
  );

  root.replaceChildren(
    h(
      'main',
      { class: 'page' },
      h('header', { class: 'top' }, h('div', {}, appName(), h('h1', {}, title)), actions),
      demo ? h('p', { class: 'banner', role: 'note' }, '예시 화면이에요. 가상 인물 순자 님의 기록이에요.') : null,
      notice ? h('p', { class: 'banner ok', role: 'status' }, notice) : null,
      statusBlock({ status, onReload }),
      calendar(props),
      loadedAt && !demo ? h('p', { class: 'loaded-at' }, `${timeText(loadedAt)}에 불러왔어요`) : null,
    ),
  );
}

// ---- 설정 ----

/** 설정: 호칭 바꾸기, 연결 해제 */
export function renderSettings(root, { conn, codeText, saved, onSaveName, onDisconnect, onBack }) {
  const nameInput = h('input', { id: 'name', type: 'text', autocomplete: 'off', maxlength: '12', value: conn.name, placeholder: '예: 어머니' });
  const nameForm = h(
    'form',
    { class: 'card form' },
    h('h2', {}, '호칭'),
    h('label', { for: 'name' }, '화면 제목에 보일 어르신 호칭 (이 폰에만 저장돼요)'),
    nameInput,
    saved ? h('p', { class: 'form-msg ok', role: 'status' }, '저장했어요') : null,
    h('button', { type: 'submit', class: 'btn primary' }, '호칭 저장'),
  );
  nameForm.addEventListener('submit', (e) => {
    e.preventDefault();
    onSaveName(nameInput.value);
  });

  root.replaceChildren(
    h(
      'main',
      { class: 'page' },
      h('header', { class: 'top' }, h('div', {}, appName(), h('h1', {}, '설정')), h('button', { type: 'button', class: 'btn small', onClick: onBack }, '← 기록으로')),
      nameForm,
      h(
        'section',
        { class: 'card' },
        h('h2', {}, '연결'),
        h('p', {}, '연결 코드 ', h('b', { class: 'code' }, codeText)),
        h('p', { class: 'sub' }, '연결을 해제하면 이 폰에서 코드가 지워져요. 다시 보려면 QR을 다시 찍거나 코드를 넣어 주세요. 스테이션 쪽 연결까지 끊으려면 담당 선생님께 말씀해 주세요.'),
        h('button', { type: 'button', class: 'btn danger', onClick: onDisconnect }, '연결 해제'),
      ),
    ),
  );
}
