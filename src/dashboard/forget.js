// 사용자 지우기 화면: 설정 → "사용자 지우기" → 지울 분 고르기 → 한 번 더 확인 → 다 지움.
// 동의서·동의 화면의 "언제든 지울 수 있어요"를 화면에서 직접 할 수 있게 한다 (docs/consent/face-consent.html "지우는 방법").
// 무엇을 지우는지(호칭, 시작 단계, 활동 기록, 보호자 앱 연결·요약)는 main.js 가 정하고, 여기서는 그리기만 한다.
// 얼굴은 로봇 카메라(WonderCam) 안에만 있어서 앱이 지울 수 없다 → 다 지운 뒤 카메라에서도 지워 달라고 안내한다.
// 모양은 홈 밖 화면 공통 (ui/page.js)

import { h, button, message, firstOnly } from '../ui/components.js';
import { pageHead, pageCard, pageTile, pageList, pageActions, headButton } from '../ui/page.js';

/**
 * 지울 분 고르기.
 * @param o.users   [{ userId, displayName, faceId }] (호칭 가나다순)
 * @param o.onPick  (user) => 확인 화면으로
 * @param o.onHome  "← 홈으로"
 */
export function renderForgetList(container, { users, onPick, onHome }) {
  container.innerHTML = '';
  container.append(
    h(
      'div',
      { class: 'page' },
      pageHead('설정', '사용자 지우기', headButton('← 홈으로', onHome)),
      pageCard(
        users.length > 0 ? '지울 분을 골라 주세요' : null,
        users.length > 0
          ? [
              h('p', { class: 'settings-levels' }, '호칭을 누르면 지우기 전에 한 번 더 여쭤봐요.'),
              h(
                'div',
                { class: 'page-tile-grid', role: 'group', 'aria-label': '지울 분 고르기' },
                users.map((u) => pageTile(u.displayName, u.faceId ? `얼굴 ${u.faceId}번 등록` : '호칭만 등록', () => onPick(u))),
              ),
            ]
          : h('p', { class: 'page-text' }, '등록한 분이 없어요.'),
      ),
    ),
  );
}

/**
 * 한 번 더 확인. 무엇이 지워지는지 보여 준다.
 * @param o.name       호칭
 * @param o.records    이 기계에서 지워질 활동 기록 수
 * @param o.hasFace    얼굴을 등록한 분인지 (카메라에서도 지워야 함)
 * @param o.onConfirm  "지우기"
 * @param o.onCancel   "그만두기"
 */
export function renderForgetConfirm(container, { name, records, hasFace, onConfirm, onCancel }) {
  const [confirm, cancel] = firstOnly(onConfirm, onCancel);
  container.innerHTML = '';
  container.append(
    h(
      'div',
      { class: 'page' },
      pageHead('사용자 지우기', `${name}의 정보를 지울까요?`),
      pageCard(
        '지우면 되돌릴 수 없어요. 아래 것이 모두 지워져요.',
        pageList([
          hasFace ? '호칭과 얼굴 번호' : '호칭',
          '시작 단계',
          records > 0 ? `이 기계에 남은 활동 기록 ${records}개` : '이 기계에 남은 활동 기록 (지금은 없음)',
          '보호자 앱 연결과 보호자 앱에 보낸 활동 요약 (인터넷이 연결되면 지워져요)',
        ]),
        hasFace ? message('로봇 카메라 안의 얼굴은 이 화면에서 지울 수 없어요. 지운 뒤에 방법을 알려 드릴게요.', 'info') : null,
      ),
      pageActions(button('지우기', confirm), button('그만두기', cancel, { variant: 'secondary' })),
    ),
  );
}

/**
 * 다 지운 뒤.
 * @param o.name    호칭
 * @param o.faceId  얼굴 번호 (없으면 null). 있으면 카메라에서도 지워 달라고 안내
 * @param o.onHome  "홈으로"
 */
export function renderForgetDone(container, { name, faceId, onHome }) {
  const hasFace = faceId !== null && faceId !== undefined;
  container.innerHTML = '';
  container.append(
    h(
      'div',
      { class: 'page' },
      pageHead('사용자 지우기', `${name}의 정보를 지웠어요`),
      hasFace
        ? pageCard(
            '로봇 카메라에서도 얼굴을 지워 주세요',
            h('p', { class: 'page-text' }, `로봇 카메라(WonderCam)에 ${faceId}번 얼굴이 아직 남아 있어요.`),
            h('p', { class: 'page-text' }, `이용하시는 곳(운영자)이 카메라에서 ${faceId}번 얼굴을 지워 주세요.`),
          )
        : message('호칭, 시작 단계, 활동 기록을 모두 지웠어요.', 'good'),
      pageActions(button('홈으로', onHome)),
    ),
  );
}
