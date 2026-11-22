// 등록 화면 그리기 (복지사·팀원용). 판단은 하지 않고 보여 주기만 한다.
// 어느 단계에서든 [← 홈으로]가 있다.

import { h, button, message } from '../ui/components.js';
import { FACE_CONSENT, RECORD_NOTICE } from './consent.js';
import { NAME_MAX } from './users.js';
import { createPairing, drawQr } from '../guardian/index.js';

export function createRegisterScreen(container, { onCancel }) {
  container.innerHTML = '';
  const area = h('div', { class: 'program-body login-register' });
  container.append(area);

  function set(...children) {
    area.innerHTML = '';
    area.append(
      ...children.flat().filter(Boolean),
      h('div', { class: 'row' }, button('← 홈으로', onCancel, { variant: 'secondary' })),
    );
  }

  const lines = (list) => list.map((l) => h('p', {}, l));

  return {
    /** 1. 얼굴 동의 (활동 기록 안내와 따로) */
    consent(onAgree, onDisagree) {
      set(
        h('p', { class: 'big-prompt' }, FACE_CONSENT.title),
        lines(FACE_CONSENT.lines),
        h(
          'div',
          { class: 'row' },
          button(FACE_CONSENT.agree, onAgree),
          button(FACE_CONSENT.disagree, onDisagree, { variant: 'secondary' }),
        ),
      );
    },

    /** 활동 기록 안내. [등록하지 않을게요]는 동의서 2번 "동의하지 않습니다"와 같다 (손님으로 이용) */
    recordNotice(onOk, onDecline) {
      set(
        h('p', { class: 'big-prompt' }, RECORD_NOTICE.title),
        lines(RECORD_NOTICE.lines),
        h(
          'div',
          { class: 'row' },
          button(RECORD_NOTICE.ok, onOk),
          button(RECORD_NOTICE.decline, onDecline, { variant: 'secondary' }),
        ),
      );
    },

    /** 2. 호칭 적기. error: 다시 적어야 할 때 안내 */
    name(onSubmit, { value = '', error = null } = {}) {
      const input = h('input', {
        type: 'text',
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
        h('p', { class: 'big-prompt' }, '실명 대신 불러 드릴 호칭을 적어 주세요.'),
        error && message(error, 'retry'),
        h('div', { class: 'row' }, input, button('다음', submit)),
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
        h('p', { class: 'big-prompt' }, '카메라에서 얼굴을 학습해 주세요.'),
        h('p', {}, '1. 카메라 화면이 얼굴 인식인지 확인하세요.'),
        h('p', {}, '2. Function 레버를 왼쪽으로 밀고, "+"를 얼굴 가운데에 맞추세요.'),
        h('p', {}, '3. 다시 왼쪽으로 민 다음, 아래로 눌러 OK 하세요.'),
        h('p', {}, '4. 카메라 화면에 나온 번호를 아래에서 골라 주세요.'),
        h('p', {}, 'Navigation 레버를 밀면 카메라 메뉴가 바뀌어요. 다음 번호로 넘길 때만 오른쪽으로 미세요.'),
        seen !== null && message(`지금 카메라가 ${seen}번 얼굴을 보고 있어요.`, 'info'),
        freeIds.length > 0
          ? h(
              'div',
              { class: 'row', role: 'group', 'aria-label': '얼굴 번호 고르기' },
              freeIds.map((id) => button(`${id}번`, () => onPick(id))),
            )
          : message('얼굴 번호 1~5번이 모두 쓰이고 있어요. 다른 분을 먼저 지우거나 호칭만 등록해 주세요.', 'retry'),
        h('div', { class: 'row' }, button('얼굴 없이 호칭만 등록', onNameOnly, { variant: 'secondary' })),
      );
    },

    /** 3. (learnFace 가 있을 때) 학습 중 */
    learning(id) {
      set(message(`얼굴을 ${id}번으로 학습하고 있어요. 카메라를 봐 주세요.`, 'info'));
    },

    /** 5. 인식 시험 */
    testing(user, onSkip) {
      set(
        h('p', { class: 'big-prompt' }, '잘 알아보는지 볼게요.'),
        h('p', {}, `방금 등록한 얼굴(${user.displayName})을 카메라에 보여 주세요.`),
        h('div', { class: 'row' }, button('시험 건너뛰기', onSkip, { variant: 'secondary' })),
      );
    },

    /** 인식 시험 결과가 맞지 않을 때 */
    testFailed(kind, onRetry, onFinish) {
      const text =
        kind === 'other'
          ? '다른 분으로 알아봤어요. 카메라에서 다시 학습해 볼까요?'
          : '아직 잘 알아보지 못했어요. 다시 해 볼까요?';
      set(
        message(text, 'retry'),
        h('div', { class: 'row' }, button('다시 보기', onRetry), button('그대로 마치기', onFinish, { variant: 'secondary' })),
      );
    },

    /**
     * 6. 끝: 보호자 연결 QR (#62, #145)
     * createPairing 은 부를 때마다 새 연결 코드를 만든다. 이 화면은 등록 한 번에 한 번만 그리므로 여기서 한 번 부른다
     */
    finished(user, { tested }, onFinish) {
      const qrSlot = h('div', { class: 'qr-slot', 'aria-label': '보호자 연결 자리' });
      set(
        message(`등록을 마쳤어요: ${user.displayName}`, 'good'),
        user.faceId !== null
          ? h('p', {}, tested ? '얼굴도 잘 알아봤어요.' : '얼굴 알아보기는 아직 시험하지 않았어요.')
          : h('p', {}, '로그인할 때 호칭 버튼을 눌러 주세요.'),
        qrSlot,
        h('div', { class: 'row' }, button('마치기', onFinish)),
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
