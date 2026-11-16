// 로그인 화면 그리기. 판단은 하지 않고 보여 주기만 한다.
// 어느 단계에서든 [손님으로 시작]과 [← 홈으로]가 있다.

import { h, button, message } from '../ui/components.js';

export function createScreen(container, { onGuest, onCancel }) {
  container.innerHTML = '';
  const area = h('div', { class: 'program-body login' });
  container.append(area);

  function set(...children) {
    area.innerHTML = '';
    area.append(
      ...children.flat().filter(Boolean),
      h(
        'div',
        { class: 'row' },
        button('손님으로 시작', onGuest, { variant: 'secondary' }),
        button('← 홈으로', onCancel, { variant: 'secondary' }),
      ),
    );
  }

  return {
    waiting() {
      set(message('카메라를 준비하고 있어요. 잠시만 기다려 주세요.', 'info'));
    },

    /** 얼굴 보여 주기. onChoose: [호칭으로 고르기] */
    showFace(onChoose) {
      set(
        h('p', { class: 'big-prompt' }, '로봇 카메라에 얼굴을 보여 주세요.'),
        h('p', {}, '잠깐 그대로 계시면 알아볼게요.'),
        h('div', { class: 'row' }, button('호칭으로 고르기', onChoose)),
      );
    },

    /** "○○님 맞으세요?" */
    confirm(user, onYes, onNo) {
      set(
        h('p', { class: 'big-prompt' }, `${user.displayName} 맞으세요?`),
        h('div', { class: 'row' }, button('네', onYes), button('아니요', onNo, { variant: 'secondary' })),
      );
    },

    /**
     * 호칭 버튼 목록. users: 가나다순, note: 위에 붙는 안내 (없으면 null)
     * 등록된 분이 없으면 손님으로 시작하도록 안내한다
     */
    choose(users, onPick, note = null) {
      set(
        note && message(note, 'retry'),
        users.length > 0
          ? [
              h('p', { class: 'big-prompt' }, '호칭을 골라 주세요.'),
              h(
                'div',
                { class: 'row', role: 'group', 'aria-label': '호칭 고르기' },
                users.map((u) => button(u.displayName, () => onPick(u))),
              ),
            ]
          : h('p', {}, '아직 등록된 분이 없어요. 손님으로 시작해 주세요.'),
      );
    },
  };
}
