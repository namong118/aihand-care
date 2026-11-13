// 로그인 화면 (#81): 코스 시작 때 대시보드가 띄운다. core 는 import 하지 않고 ctx 만 쓴다.
//
// 흐름
//   1. "잠시 기다려 주세요"  (onFace 구독 → core 가 얼굴 모드로 바꿈, await ctx.card.ready())
//   2. "얼굴을 보여 주세요"  (같은 번호 1.5초 → logic.js judgeFace)
//   3. "○○님 맞으세요?" [네] [아니요]
//   4. "아니요" 한 번, 모르는 얼굴, 오래 인식이 안 될 때 → 호칭 버튼 목록
//   5. 어디서든 [손님으로 시작] → onDone({ userId: null, displayName: null, via: 'guest' })
// 끝나면 onDone({ userId, displayName, via: 'face' | 'button' | 'guest' }), 홈으로 가면 onCancel()
//
// ctx.card.onFace 가 아직 없으면(A Mock 전) 얼굴 단계는 건너뛰고 호칭 버튼부터 보여 준다.
// 등록된 분이 없거나, 얼굴을 등록한 분이 없어도 호칭 버튼부터 보여 준다.

import { startFace, trackFace, judgeFace } from './logic.js';
import { createUserStore } from './users.js';
import { createScreen } from './screen.js';

/** 얼굴 확정 상태를 확인하는 간격 (onFace 는 번호가 바뀔 때만 오므로 타이머로도 본다) */
const CHECK_MS = 100;
/** 이만큼 지나도 얼굴을 확정하지 못하면 호칭 버튼으로 [검증 필요] 실물 테스트(#85) 때 조정 */
export const FACE_GIVE_UP_MS = 15000;

let session = null; // 지금 화면의 실행 상태. unmount 하면 alive = false

export default {
  mount(container, ctx, { onDone, onCancel, store = createUserStore() } = {}) {
    const s = { alive: true, stops: new Set() };
    session = s;
    const users = store.list();

    // 화면이 끝날 때 한 번만 부른다
    const finish = (cb, ...args) => {
      if (!s.alive) return;
      cleanup(s);
      cb?.(...args);
    };
    const done = (user, via) =>
      finish(onDone, { userId: user?.userId ?? null, displayName: user?.displayName ?? null, via });

    const screen = createScreen(container, {
      onGuest: () => done(null, 'guest'),
      onCancel: () => finish(onCancel),
    });

    const choose = (note) => {
      stopAll(s);
      screen.choose(users, (u) => done(u, 'button'), note);
    };

    const canFace = typeof ctx.card?.onFace === 'function' && users.some((u) => u.faceId !== null);
    if (!canFace) {
      choose(null);
      return;
    }
    watchFace(ctx, screen, s, users, {
      onUser: (user) => {
        stopAll(s);
        screen.confirm(
          user,
          () => done(user, 'face'),
          () => choose(null), // "아니요" 한 번이면 바로 호칭 버튼
        );
      },
      onUnknown: () => choose('얼굴을 찾지 못했어요. 호칭을 골라 주세요.'),
      onGiveUp: () => choose('얼굴이 잘 보이지 않아요. 호칭을 골라 주세요.'),
      onChoose: () => choose(null),
    }).catch((err) => console.error(err));
  },

  unmount() {
    if (!session) return;
    cleanup(session);
    session = null;
  },
};

/** 얼굴 모드 준비 → 얼굴 보여 주기 → 확정되면 알림 */
async function watchFace(ctx, screen, s, users, { onUser, onUnknown, onGiveUp, onChoose }) {
  let state = startFace();
  // 구독하면 core 가 얼굴 모드로 바꾼다. 바꾸는 동안 들어온 번호도 받아 둔다
  const offFace = ctx.card.onFace((e) => {
    state = trackFace(state, e?.faceId, Date.now());
  });
  s.stops.add(offFace);

  screen.waiting();
  await ctx.card.ready();
  if (!s.alive || !s.stops.has(offFace)) return;

  screen.showFace(onChoose);
  const shownAt = Date.now();
  const timer = setInterval(() => {
    const now = Date.now();
    const r = judgeFace(state, now, users);
    if (r.status === 'user') onUser(r.user);
    else if (r.status === 'unknown') onUnknown();
    else if (now - shownAt >= FACE_GIVE_UP_MS) onGiveUp();
  }, CHECK_MS);
  s.stops.add(() => clearInterval(timer));
}

/** 얼굴 구독과 타이머를 멈춘다 (화면은 그대로) */
function stopAll(s) {
  s.stops.forEach((stop) => stop());
  s.stops.clear();
}

function cleanup(s) {
  s.alive = false;
  stopAll(s);
}
