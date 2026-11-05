// 공통 화면 부품. 프로그램과 대시보드가 같이 쓴다.
// 고령자 UX 기본값(큰 글씨, 큰 버튼, 고대비)은 styles.css 에 들어 있다.

/**
 * 요소를 만드는 작은 도우미.
 *   h('button', { class: 'btn', onClick: fn }, '눌러 주세요')
 * props:
 *   class      → className
 *   onXxx      → addEventListener('xxx', ...)
 *   그 밖      → setAttribute (값이 false/null 이면 넣지 않음)
 * children: 문자열, 숫자, 요소, 또는 그 배열 (null 은 무시)
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === false || value === null || value === undefined) continue;
    if (key === 'class') el.className = value;
    else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'style' && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) el.style.setProperty(k, v);
    } else el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

/**
 * 큰 버튼.
 *   variant: 'primary' | 'secondary' | 'choice'
 *   pressed: choice 버튼에서 선택됨 표시 (글자 "✔" 도 함께 붙여 색에만 의존하지 않는다)
 */
export function button(label, onClick, { variant = 'primary', pressed, disabled } = {}) {
  const isChoice = pressed !== undefined;
  return h(
    'button',
    {
      type: 'button',
      class: `btn btn-${variant}`,
      onClick,
      'aria-pressed': isChoice ? String(Boolean(pressed)) : null,
      disabled: disabled ? true : null,
    },
    isChoice && pressed ? `✔ ${label}` : label,
  );
}

/** 안내 문구. tone: 'info' | 'good' | 'retry' (색과 함께 앞에 기호를 붙인다) */
export function message(text, tone = 'info') {
  const mark = { info: 'ℹ', good: '○', retry: '↻' }[tone] ?? '';
  return h('p', { class: `msg msg-${tone}`, role: 'status' }, `${mark} ${text}`);
}

/** 숫자를 "1.2초" 처럼 */
export function seconds(ms) {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '-';
  return `${(ms / 1000).toFixed(1)}초`;
}

/** ms 동안 기다리는 Promise */
export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
