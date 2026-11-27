// 등록 화면 그리기 (복지사·팀원용). 판단은 하지 않고 보여 주기만 한다.
// 어느 단계에서든 [← 홈으로]가 있다.
// 모양은 홈 밖 화면 공통 (ui/page.js): 작은 안내 + 큰 제목, 흰 카드, 안내 문구는 점 목록

import { h, button, message } from '../ui/components.js';
import { pageHead, pageCard, pageList, pageActions, headButton } from '../ui/page.js';
import { FACE_CONSENT, RECORD_NOTICE } from './consent.js';
import { NAME_MAX } from './users.js';
import { createPairing, drawQr } from '../guardian/index.js';

const EYEBROW = '사용자 등록';

export function createRegisterScreen(container, { onCancel }) {
  container.innerHTML = '';
  const area = h('div', { class: 'page login-register' });
  container.append(area);

  /** title: 큰 제목, children: 그 아래 내용 */
  function set(title, ...children) {
    area.innerHTML = '';
    area.append(pageHead(EYEBROW, title, headButton('← 홈으로', onCancel)), ...children.flat().filter(Boolean));
  }

  return {
    /** 1. 얼굴 동의 (활동 기록 안내와 따로) */
    consent(onAgree, onDisagree) {
      set(
        FACE_CONSENT.title,
        pageCard(null, pageList(FACE_CONSENT.lines)),
        pageActions(button(FACE_CONSENT.agree, onAgree), button(FACE_CONSENT.disagree, onDisagree, { variant: 'secondary' })),
      );
    },

    /** 활동 기록 안내. [등록하지 않을게요]는 동의서 2번 "동의하지 않습니다"와 같다 (손님으로 이용) */
    recordNotice(onOk, onDecline) {
      set(
        RECORD_NOTICE.title,
        pageCard(null, pageList(RECORD_NOTICE.lines)),
        pageActions(button(RECORD_NOTICE.ok, onOk), button(RECORD_NOTICE.decline, onDecline, { variant: 'secondary' })),
      );
    },

    /** 2. 호칭 적기. error: 다시 적어야 할 때 안내 */
    name(onSubmit, { value = '', error = null } = {}) {
      const input = h('input', {
        type: 'text',
        class: 'page-input',
        maxlength: String(NAME_MAX),
        value,
        'aria-label': '호칭',
        placeholder: '예: 봄날 어르신',
      });
      const submit = () => onSubmit(input.value);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submit();
      });
      set(
        '불러 드릴 호칭을 적어 주세요',
        error && message(error, 'retry'),
        pageCard(
          null,
          h('p', { class: 'settings-levels' }, `실명은 적지 않아요. ${NAME_MAX}글자까지 적을 수 있어요.`),
          h('div', { class: 'page-input-row' }, input, button('다음', submit)),
        ),
      );
      input.focus?.();
    },

    /**
     * 3. 얼굴 학습: 카메라 레버로 학습한 뒤 카메라 화면에 나온 번호를 고른다
     *   freeIds: 비어 있는 번호, seen: 지금 카메라가 보고 있는 번호 (없으면 null)
     *   onNameOnly: [얼굴 없이 호칭만 등록] (학습이 잘 안 되거나 번호가 다 찼을 때)
     */
    learnByCamera(freeIds, onPick, onNameOnly, seen = null) {
      set(
        '카메라에서 얼굴을 학습해 주세요',
        h(
          'div',
          { class: 'page-split' },
          pageCard(
            null,
            h(
              'ol',
              { class: 'page-list' },
              h('li', {}, '카메라 화면이 얼굴 인식인지 확인하세요.'),
              h('li', {}, 'Function 레버를 왼쪽으로 밀고, "+"를 얼굴 가운데에 맞추세요.'),
              h('li', {}, '다시 왼쪽으로 민 다음, 아래로 눌러 OK 하세요.'),
              h('li', {}, '카메라 화면에 나온 번호를 오른쪽에서 골라 주세요.'),
            ),
            h('p', { class: 'settings-note' }, 'Navigation 레버를 밀면 카메라 메뉴가 바뀌어요. 다음 번호로 넘길 때만 오른쪽으로 미세요.'),
          ),
          pageCard(
            '얼굴 번호',
            seen !== null ? message(`지금 카메라가 ${seen}번 얼굴을 보고 있어요.`, 'info') : null,
            freeIds.length > 0
              ? h(
                  'div',
                  { class: 'page-tabs', role: 'group', 'aria-label': '얼굴 번호 고르기' },
                  freeIds.map((id) => button(`${id}번`, () => onPick(id))),
                )
              : message('얼굴 번호 1~5번이 모두 쓰이고 있어요. 다른 분을 먼저 지우거나 호칭만 등록해 주세요.', 'retry'),
            button('얼굴 없이 호칭만 등록', onNameOnly, { variant: 'secondary' }),
          ),
        ),
      );
    },

    /** 3. (learnFace 가 있을 때) 학습 중 */
    learning(id) {
      set(`얼굴을 ${id}번으로 학습하고 있어요`, message('카메라를 봐 주세요.', 'info'));
    },

    /** 5. 인식 시험 */
    testing(user, onSkip) {
      set(
        '잘 알아보는지 볼게요',
        pageCard(null, h('p', { class: 'page-text' }, `방금 등록한 얼굴(${user.displayName})을 카메라에 보여 주세요.`)),
        pageActions(button('시험 건너뛰기', onSkip, { variant: 'secondary' })),
      );
    },

    /** 인식 시험 결과가 맞지 않을 때 */
    testFailed(kind, onRetry, onFinish) {
      const text =
        kind === 'other'
          ? '다른 분으로 알아봤어요. 카메라에서 다시 학습해 볼까요?'
          : '아직 잘 알아보지 못했어요. 다시 해 볼까요?';
      set(
        '다시 해 볼까요?',
        message(text, 'retry'),
        pageActions(button('다시 보기', onRetry), button('그대로 마치기', onFinish, { variant: 'secondary' })),
      );
    },

    /**
     * 6. 끝: 보호자 연결 QR (#62, #145)
     * createPairing 은 부를 때마다 새 연결 코드를 만든다. 이 화면은 등록 한 번에 한 번만 그리므로 여기서 한 번 부른다
     */
    finished(user, { tested }, onFinish) {
      const qrSlot = h('div', { class: 'qr-slot', 'aria-label': '보호자 연결 자리' });
      // QR(약 450px 높이)을 오른쪽에 두어 1280×720에서 "마치기" 버튼이 스크롤 없이 보이게 한다
      set(
        `등록을 마쳤어요: ${user.displayName}`,
        h(
          'div',
          { class: 'page-split' },
          h(
            'div',
            { class: 'page' },
            pageCard(
              null,
              user.faceId !== null
                ? h('p', { class: 'page-text' }, tested ? '얼굴도 잘 알아봤어요.' : '얼굴 알아보기는 아직 시험하지 않았어요.')
                : h('p', { class: 'page-text' }, '로그인할 때 호칭 버튼을 눌러 주세요.'),
            ),
            pageActions(button('마치기', onFinish)),
          ),
          qrSlot,
        ),
      );
      try {
        const { url } = createPairing(user.userId);
        drawQr(qrSlot, url);
      } catch (err) {
        // QR을 못 만들어도 등록은 끝났으므로 안내만 남긴다
        console.error(err);
        qrSlot.replaceChildren(h('p', {}, '보호자 연결 코드를 만들지 못했어요. 등록은 잘 끝났어요.'));
      }
    },
  };
}
