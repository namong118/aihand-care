// 색 태그 입력 Mock (WonderCam 대신).
// 키보드 R/B/Y/G 또는 화면의 색 버튼으로 onTag 이벤트를 만든다.

export function createMockTag({ tags }) {
  const listeners = new Set();
  const viewListeners = new Set();

  function emit(id) {
    if (!tags.some((t) => t.id === id)) throw new Error(`tags.json 에 없는 태그: ${id}`);
    const event = { id };
    listeners.forEach((cb) => cb(event));
    viewListeners.forEach((cb) => cb(event));
  }

  function onKey(e) {
    // 글자 입력칸에 타자 칠 때는 무시
    const target = e.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const tag = tags.find((t) => t.key.toLowerCase() === e.key.toLowerCase());
    if (tag) emit(tag.id);
  }

  let keyboardOn = false;

  return {
    kind: 'mock',

    // ---- ctx.tag 로 공개되는 부분 ----
    onTag(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },

    // ---- Mock 패널 전용 ----
    emit,
    destroy() {
      if (keyboardOn) window.removeEventListener('keydown', onKey);
      keyboardOn = false;
      listeners.clear();
      viewListeners.clear();
    },

    mountControls(container) {
      if (!keyboardOn) {
        window.addEventListener('keydown', onKey);
        keyboardOn = true;
      }
      container.innerHTML = '';
      const title = document.createElement('h2');
      title.textContent = '색 태그 입력 (WonderCam 대신)';
      const hint = document.createElement('p');
      hint.className = 'mock-status';
      hint.textContent = '키보드 R 빨강 · B 파랑 · Y 노랑 · G 초록';
      const grid = document.createElement('div');
      grid.className = 'mock-grid';
      for (const t of tags) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-small tag-btn';
        btn.style.setProperty('--tag-color', t.color);
        btn.textContent = `${t.label} (${t.key})`;
        btn.addEventListener('click', () => emit(t.id));
        grid.append(btn);
      }
      const last = document.createElement('p');
      last.className = 'mock-status';
      last.textContent = '마지막 태그: 없음';
      container.append(title, hint, grid, last);

      viewListeners.add((e) => {
        const t = tags.find((x) => x.id === e.id);
        last.textContent = `마지막 태그: ${t.label}`;
      });
    },
  };
}
