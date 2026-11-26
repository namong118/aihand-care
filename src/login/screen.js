// 로그인 화면 그리기. 판단은 하지 않고 보여 주기만 한다.
// 어느 단계에서든 [손님으로 시작]과 [← 홈으로]가 있다.
// 모양은 홈 밖 화면 공통 (ui/page.js): 작은 안내 + 큰 제목, 흰 카드, 호칭은 칸 버튼

import { h, button, message } from '../ui/components.js';
import { pageHead, pageCard, pageTile, pageActions, headButton } from '../ui/page.js';

const EYEBROW = '오늘의 활동 시작';

export function createScreen(container, { onGuest, onCancel }) {
  container.innerHTML = '';
  const area = h('div', { class: 'page login' });
  container.append(area);

  /** title: 큰 제목, content: 그 아래 내용, actions: 버튼들. 버튼 줄 끝에 늘 [손님으로 시작] */
  function set(title, content = [], actions = []) {
    area.innerHTML = '';
    area.append(
      pageHead(EYEBROW, title, headButton('← 홈으로', onCancel)),
      ...[content].flat().filter(Boolean),
      pageActions(...actions, button('손님으로 시작', onGuest, { variant: 'secondary' })),
    );
  }

  return {
    waiting() {
      set('잠시만 기다려 주세요', message('카메라를 준비하고 있어요.', 'info'));
    },

    /** 얼굴 보여 주기. onChoose: [호칭으로 고르기] */
    showFace(onChoose) {
      set(
        '로봇 카메라에 얼굴을 보여 주세요',
        pageCard(null, h('p', { class: 'page-text' }, '잠깐 그대로 계시면 알아볼게요. 버튼으로 고르셔도 돼요.')),
        [button('호칭으로 고르기', onChoose)],
      );
    },

    /** "○○님 맞으세요?" */
    confirm(user, onYes, onNo) {
      set(`${user.displayName} 맞으세요?`, [], [button('네', onYes), button('아니요', onNo, { variant: 'secondary' })]);
    },

    /**
     * 호칭 버튼 목록. users: 가나다순, note: 위에 붙는 안내 (없으면 null)
     * 등록된 분이 없으면 손님으로 시작하도록 안내한다
     */
    choose(users, onPick, note = null) {
      set(
        users.length > 0 ? '호칭을 골라 주세요' : '아직 등록된 분이 없어요',
        [
          note && message(note, 'retry'),
          users.length > 0
            ? h(
                'div',
                { class: 'page-tile-grid login-names', role: 'group', 'aria-label': '호칭 고르기' },
                users.map((u) => pageTile(u.displayName, null, () => onPick(u))),
              )
            : pageCard(null, h('p', { class: 'page-text' }, '손님으로 시작해 주세요. 호칭은 설정에서 등록할 수 있어요.')),
        ],
      );
    },
  };
}
