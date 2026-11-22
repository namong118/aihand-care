// 보호자 앱(#62) 스테이션 쪽 함수. 다른 화면은 이 파일의 함수만 부른다.
// 설계: docs/guardian-app.md 5번 "다른 담당자에게 넘기는 함수"
//
//   createPairing(userId) → { url, shortCode }   연결 코드 만들기 (등록 화면 #84, QR 보기 #82)
//   drawQr(element, url)                         QR 그리기 (QR 그림 + 연결 코드 글자)
//   sendCourseSummary(summary)                   코스 끝에 요약 보내기 (main.js finishCourse·stopCourse)
//   listPairings(userId) / revokePairing(code)   연결 목록 보기·연결 끊기 (#82)
//   forgetUser(userId)                           사용자를 지울 때 Supabase 기록도 지우기
//   outboxStatus() → { waiting, lastSentAt, mock }
//
// ⚠️ 이 파일을 불러오면(import) 바로 보내기를 한 번 시도하고, 그 뒤로 1분마다와
//    인터넷이 다시 연결될 때(online 이벤트) 대기열을 다시 보낸다 (2026-11-19 결정).
//    main.js 가 이 파일을 불러오므로 앱을 켤 때 저절로 시작된다.
//    보내기는 화면 흐름을 기다리게 하지 않는다: 위 함수들은 보내기가 끝나기 전에 바로 돌아온다.
//
// 보내기 모드: .env.local 에 VITE_SUPABASE_URL·VITE_SUPABASE_ANON_KEY·VITE_STATION_KEY 가
// 모두 있으면 진짜, 하나라도 없으면 Mock (보낸 것처럼 대기열을 비우고 콘솔에 남긴다).
// TODO(11/23): 진짜 보내기(fetch → Supabase RPC)는 아직 없다. 지금은 진짜 모드여도 대기열에 남겨 둔다.

import QRCode from 'qrcode';
import { createUserStore } from '../login/users.js';
import { createGuardianStore } from './store.js';
import {
  makeCode,
  formatCode,
  pairingUrl,
  parsePairingUrl,
  sendMode,
  shouldSend,
  SKIP_TEXT,
  pairingsOf,
  addPairing,
  removePairing,
  removeUserPairings,
  pairingItem,
  summaryItem,
  revokeItem,
  enqueue,
  forgetInOutbox,
  flushOutbox,
  outboxStatusOf,
} from './logic.js';

const RETRY_MS = 60 * 1000; // 1분마다 다시 보내기
const TAG = '[보호자 앱]';
const KIND_TEXT = { pairing: '연결 코드', summary: '코스 요약', revoke: '연결 끊기', forget: '사용자 지우기' };

const store = createGuardianStore();
const mode = sendMode(import.meta.env);
let lastSentAt = null; // 메모리에만 둔다 (새로고침하면 null)
let flushing = null; // 보내는 중이면 그 Promise (두 번 겹쳐 보내지 않게)
let again = false; // 보내는 중에 새로 부르면, 끝난 뒤 한 번 더 보낸다

// ---- 보내기 ----

function describe(item) {
  const who = item.userId ?? '';
  const extra = item.courseId ? ` · 코스 ${item.courseId}` : item.code ? ` · ${formatCode(item.code)}` : '';
  return `${KIND_TEXT[item.kind]} (${who}${extra})`;
}

/** Mock: 보내지 않고 "보낸 것처럼" 성공. 콘솔에 남긴다 */
async function mockSend(item) {
  console.info(`${TAG} Mock: 보낸 것처럼 처리 → ${describe(item)}`);
}

/** 진짜 보내기. TODO(11/23): fetch 로 Supabase RPC 부르기. 지금은 실패로 두어 대기열에 남긴다 */
async function realSend() {
  throw new Error('실제 전송은 아직 만들지 않았어요 (11/23 예정)');
}

function isOffline() {
  return globalThis.navigator?.onLine === false;
}

/**
 * 대기열을 보내 본다. 기다리지 않아도 된다 (Promise 를 돌려주지만 에러를 내지 않는다).
 * 인터넷이 없으면 시도하지 않고 남겨 둔다. 다시 연결되면 online 이벤트로 다시 부른다.
 */
function trySend() {
  if (flushing) {
    again = true;
    return flushing;
  }
  const waiting = store.loadOutbox().length;
  if (waiting === 0) return Promise.resolve();
  if (isOffline()) {
    console.info(`${TAG} 인터넷이 없어 보낼 것 ${waiting}건을 남겨 둡니다. 연결되면 보냅니다.`);
    return Promise.resolve();
  }
  flushing = flushOutbox({
    load: store.loadOutbox,
    save: store.saveOutbox,
    send: mode.mock ? mockSend : realSend,
    now: () => Date.now(),
  })
    .then(({ sent, failed }) => {
      if (sent > 0) lastSentAt = new Date().toISOString();
      if (failed) {
        again = false; // 실패했으면 바로 다시 하지 않고 1분 뒤·online 때

        const left = store.loadOutbox().length;
        console.warn(`${TAG} 보내지 못해 ${left}건을 남겨 둡니다 (다음에 다시): ${failed.lastError ?? ''}`, describe(failed));
      }
    })
    .catch((err) => console.error(`${TAG} 보내기 오류`, err))
    .finally(() => {
      flushing = null;
      if (again) {
        again = false;
        trySend();
      }
    });
  return flushing;
}

// ---- 시작: 불러올 때 한 번 ----

function start() {
  if (typeof window === 'undefined') return;
  // 개발 서버에서 코드를 고치면 이 파일이 다시 실행된다. 예전 타이머·이벤트를 먼저 끈다
  const prev = globalThis.__aihandGuardian;
  if (prev) {
    clearInterval(prev.timer);
    window.removeEventListener('online', prev.onOnline);
  }
  const onOnline = () => trySend();
  const timer = setInterval(trySend, RETRY_MS);
  window.addEventListener('online', onOnline);
  globalThis.__aihandGuardian = { timer, onOnline };

  if (mode.mock) {
    console.info(`${TAG} Mock 으로 동작합니다 (보내지 않고 보낸 것처럼 처리). 빠진 값: ${mode.missing.join(', ')}`);
  }
  trySend(); // 앱을 켤 때 남아 있던 것 보내기
}

start();

// ---- 다른 화면이 부르는 함수 ----

/**
 * 연결 코드를 만들고 Supabase 등록을 대기열에 넣는다.
 * 호칭은 사용자 목록(src/login/users.js)에서 찾는다. 목록에 없는 userId 면 에러.
 * 인터넷이 없어도 바로 돌아온다 (QR은 바로 보여 줄 수 있다).
 * 반환: { url, shortCode } url 은 QR 주소, shortCode 는 화면용 'ABCD-EFGH-JKMN'
 */
export function createPairing(userId) {
  const user = createUserStore().findById(userId);
  if (!user) throw new Error('등록된 사용자를 찾을 수 없어요.');

  const pairings = store.loadPairings();
  const taken = new Set(pairings.map((p) => p.code));
  let code;
  do {
    code = makeCode((arr) => crypto.getRandomValues(arr));
  } while (taken.has(code)); // 겹칠 일은 사실상 없지만 혹시 몰라

  const now = Date.now();
  store.savePairings(addPairing(pairings, { code, userId, createdAt: new Date(now).toISOString() }));
  store.saveOutbox(enqueue(store.loadOutbox(), pairingItem({ code, userId }, now)));
  trySend();

  return { url: pairingUrl(code, user.displayName), shortCode: formatCode(code) };
}

/**
 * QR 그리기: 안내 + QR 그림 + 연결 코드 글자. 보호자가 폰 카메라로 찍으면 폰 앱이 열리고 연결된다.
 *   - 그림은 SVG 라 크게 키워도 선명하다. 화면이 어두워도 찍히게 흰 바탕·검은 무늬·가장자리 여백
 *   - 인터넷이 없어도 그린다 (qrcode 패키지가 앱 안에 들어 있다, docs/decisions.md 4번)
 *   - QR 을 그리지 못하면 코드 글자만 남긴다 (보호자가 폰 앱에 직접 넣을 수 있다)
 * 코드 글자도 함께 보여 주므로, 부르는 쪽은 shortCode 를 따로 보여 주지 않아도 된다.
 * 반환: 그림을 다 그리면 끝나는 Promise (기다리지 않아도 된다)
 */
export function drawQr(element, url) {
  const { code } = parsePairingUrl(url);
  const box = document.createElement('div');
  box.className = 'guardian-qr';
  box.dataset.url = url;
  box.style.cssText = 'display:grid;gap:12px;justify-items:center;text-align:center;';

  const lead = document.createElement('p');
  lead.textContent = '보호자 폰 카메라로 QR을 찍어 주세요';
  lead.style.cssText = 'margin:0;font-size:24px;font-weight:700;';

  const pic = document.createElement('div');
  pic.className = 'guardian-qr-image';
  pic.setAttribute('role', 'img');
  pic.setAttribute('aria-label', '보호자 연결 QR');
  pic.style.cssText = 'width:min(280px,60vw);aspect-ratio:1;background:#fff;border-radius:12px;line-height:0;';

  const hint = document.createElement('p');
  hint.textContent = '찍기 어려우면 폰 앱에 이 연결 코드를 넣어 주세요';
  hint.style.cssText = 'margin:0;font-size:24px;';

  const codeText = document.createElement('p');
  codeText.className = 'guardian-qr-code';
  codeText.textContent = code ? formatCode(code) : '코드를 만들지 못했어요';
  codeText.style.cssText = 'margin:0;font-size:40px;font-weight:700;letter-spacing:0.08em;';

  box.append(lead, pic, hint, codeText);
  element.replaceChildren(box);

  // 오류 정정 M: 화면 반사·흐림에 조금 견디면서 칸이 너무 잘아지지 않게. 여백 4칸은 QR 규격의 권장값
  return QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 4, color: { dark: '#000000', light: '#ffffff' } })
    .then((svg) => {
      pic.innerHTML = svg; // qrcode 가 만든 그림 (무늬만 있고 글자는 없다)
      const el = pic.querySelector('svg');
      el.setAttribute('width', '100%');
      el.setAttribute('height', '100%');
      el.setAttribute('shape-rendering', 'crispEdges');
      el.setAttribute('aria-hidden', 'true');
    })
    .catch((err) => {
      console.error(`${TAG} QR 을 그리지 못했어요. 연결 코드 글자만 보여 줍니다`, err);
      pic.remove();
      lead.textContent = '보호자 폰 앱에 이 연결 코드를 넣어 주세요';
      hint.remove();
    });
}

/**
 * 코스가 끝나면 부른다 ("코스 마치기"·"코스 그만하기" 둘 다). 기다리지 않아도 되고 에러를 내지 않는다.
 * 손님·로그인 기능 전 코스·보호자 앱을 연결하지 않은 분은 보내지 않는다.
 * 반환: { queued: true } 또는 { queued: false, reason }
 */
export function sendCourseSummary(summary) {
  try {
    const decision = shouldSend(summary, store.loadPairings());
    if (!decision.send) {
      console.info(`${TAG} 요약을 보내지 않아요: ${SKIP_TEXT[decision.reason]}`);
      return { queued: false, reason: decision.reason };
    }
    store.saveOutbox(enqueue(store.loadOutbox(), summaryItem(summary, Date.now())));
    trySend();
    return { queued: true };
  } catch (err) {
    console.error(`${TAG} 요약을 대기열에 넣지 못했어요`, err);
    return { queued: false, reason: 'error' };
  }
}

/** 그 사용자의 연결 목록, 먼저 연결한 것부터: [{ code, userId, createdAt, shortCode }] */
export function listPairings(userId) {
  return pairingsOf(store.loadPairings(), userId).map((p) => ({ ...p, shortCode: formatCode(p.code) }));
}

/** 연결 끊기: 그 폰은 더 이상 요약을 못 본다. 없는 코드면 false */
export function revokePairing(code) {
  const pairings = store.loadPairings();
  const pairing = pairings.find((p) => p.code === code);
  if (!pairing) return false;
  store.savePairings(removePairing(pairings, code));
  store.saveOutbox(enqueue(store.loadOutbox(), revokeItem(pairing, Date.now())));
  trySend();
  return true;
}

/**
 * 사용자를 지울 때 부른다 (userStore.remove 와 함께).
 * 스테이션의 연결 목록에서 빼고, Supabase의 그분 연결·요약을 모두 지우도록 대기열에 넣는다.
 */
export function forgetUser(userId) {
  store.savePairings(removeUserPairings(store.loadPairings(), userId));
  store.saveOutbox(forgetInOutbox(store.loadOutbox(), userId, Date.now()));
  trySend();
}

/** 장치 상태 표시용: { waiting 보낼 것 수, lastSentAt 마지막으로 보낸 시각(이번에 켠 뒤), mock } */
export function outboxStatus() {
  return outboxStatusOf(store.loadOutbox(), { lastSentAt, mock: mode.mock });
}
