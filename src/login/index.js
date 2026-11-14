// 로그인 화면 (#81): 코스 시작 때 대시보드가 띄운다. core 는 import 하지 않고 ctx 만 쓴다.
//
// 흐름
//   1. "잠시 기다려 주세요"  (onFace 구독 → core 가 얼굴 모드로 바꿈, await ctx.card.ready())
//   2. "얼굴을 보여 주세요"  (같은 번호 1.5초 → logic.js judgeFace)
//   3. "○○님 맞으세요?" [네] [아니요]
//   4. "아니요" 한 번, 모르는 얼굴, 오래 인식이 안 될 때 → 호칭 버튼 목록
//   5. 어디서든 [손님으로 시작] → onDone({ userId: null, displayName: null, via: 'guest' })
// 끝나면 onDone({ userId, displayName, via: 'face' | 'button' | 'guest' }), 홈으로 가면 onCancel()
// 등록 화면(mountRegister, #84)은 아래 mountRegister 설명 참고
//
// ctx.card.onFace 가 아직 없으면(A Mock 전) 얼굴 단계는 건너뛰고 호칭 버튼부터 보여 준다.
// 등록된 분이 없거나, 얼굴을 등록한 분이 없어도 호칭 버튼부터 보여 준다.

import { startFace, trackFace, judgeFace } from './logic.js';
import { createUserStore, makeUser } from './users.js';
import { freeFaceIds, checkRegistered } from './register.js';
import { createScreen } from './screen.js';
import { createRegisterScreen } from './register-screen.js';

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

  /**
   * 등록 화면 (#84, 복지사·팀원용). 끝나면 onDone(등록한 사용자), 홈으로 가면 onCancel()
   *   1. 얼굴 동의 → 동의하지 않으면 호칭만 등록 (faceId: null)
   *   2. 활동 기록 안내 → 호칭 적기
   *   3. 얼굴 학습: ctx.card.learnFace 가 있으면 빈 번호로 학습, 없으면 카메라 레버로 학습하고 번호 고르기
   *   4. 저장 → 5. 인식 시험 (onFace 가 있을 때) → 6. 끝 (보호자 연결 QR 자리)
   */
  mountRegister(container, ctx, { onDone, onCancel, store = createUserStore() } = {}) {
    const s = { alive: true, stops: new Set() };
    session = s;
    const finish = (cb, ...args) => {
      if (!s.alive) return;
      cleanup(s);
      cb?.(...args);
    };
    const screen = createRegisterScreen(container, { onCancel: () => finish(onCancel) });
    const canWatch = typeof ctx.card?.onFace === 'function';
    let withFace = false;
    let consentAt = null;

    const end = (user, tested) => {
      stopAll(s);
      screen.finished(user, { tested }, () => finish(onDone, user));
    };

    // 4. 저장. 호칭이 겹치거나 번호가 이미 쓰이면 호칭 단계로 돌아가 안내한다
    const save = (displayName, faceId) => {
      stopAll(s);
      let user;
      try {
        user = store.add({ displayName, faceId, consentAt });
      } catch (err) {
        askName(displayName, err.message);
        return;
      }
      if (user.faceId !== null && canWatch) test(user);
      else end(user, false);
    };

    // 5. 인식 시험: 방금 등록한 사람으로 확정되는지
    const test = (user) => {
      stopAll(s);
      screen.testing(user, () => end(user, false));
      followFace(ctx, s, (getState) => {
        const shownAt = Date.now();
        const timer = setInterval(() => {
          const now = Date.now();
          const kind = checkRegistered(judgeFace(getState(), now, store.list()), user.userId);
          if (kind === 'ok') end(user, true);
          else if (kind !== 'waiting' || now - shownAt >= FACE_GIVE_UP_MS) {
            stopAll(s);
            screen.testFailed(kind === 'waiting' ? 'unknown' : kind, () => test(user), () => end(user, false));
          }
        }, CHECK_MS);
        s.stops.add(() => clearInterval(timer));
      }).catch((err) => console.error(err));
    };

    // 3. 얼굴 학습
    const learn = (displayName) => {
      const free = freeFaceIds(store.list());
      if (typeof ctx.card?.learnFace === 'function' && free.length > 0) {
        const id = free[0];
        screen.learning(id);
        Promise.resolve(ctx.card.learnFace(id))
          .then(() => s.alive && save(displayName, id))
          .catch((err) => {
            console.error(err);
            if (s.alive) learnByCamera(displayName, free);
          });
        return;
      }
      learnByCamera(displayName, free);
    };
    const learnByCamera = (displayName, free) => {
      const pick = (id) => save(displayName, id);
      const nameOnly = () => save(displayName, null);
      screen.learnByCamera(free, pick, nameOnly);
      if (!canWatch) return;
      // 카메라가 보고 있는 번호를 같이 보여 준다 (고르는 데 도움)
      let seen = null;
      const offFace = ctx.card.onFace((e) => {
        const id = typeof e?.faceId === 'number' || /^\d+$/.test(String(e?.faceId)) ? Number(e.faceId) : null;
        if (id === seen) return;
        seen = id;
        screen.learnByCamera(free, pick, nameOnly, seen);
      });
      s.stops.add(offFace);
    };

    // 2. 호칭
    const askName = (value = '', error = null) => {
      screen.name(
        (raw) => {
          // 번호 없이 먼저 호칭만 검사한다 (빈칸·길이·같은 호칭)
          try {
            makeUser(store.list(), { displayName: raw }, Date.now());
          } catch (err) {
            askName(raw, err.message);
            return;
          }
          if (withFace) learn(raw);
          else save(raw, null);
        },
        { value, error },
      );
    };

    // 1. 동의
    screen.consent(
      () => {
        withFace = true;
        consentAt = new Date().toISOString();
        screen.recordNotice(() => askName());
      },
      () => {
        withFace = false;
        consentAt = null;
        screen.recordNotice(() => askName());
      },
    );
  },

  unmount() {
    if (!session) return;
    cleanup(session);
    session = null;
  },
};

/** 얼굴 모드 준비 → 얼굴 보여 주기 → 확정되면 알림 */
async function watchFace(ctx, screen, s, users, { onUser, onUnknown, onGiveUp, onChoose }) {
  screen.waiting();
  await followFace(ctx, s, (getState) => {
    screen.showFace(onChoose);
    const shownAt = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      const r = judgeFace(getState(), now, users);
      if (r.status === 'user') onUser(r.user);
      else if (r.status === 'unknown') onUnknown();
      else if (now - shownAt >= FACE_GIVE_UP_MS) onGiveUp();
    }, CHECK_MS);
    s.stops.add(() => clearInterval(timer));
  });
}

/**
 * 얼굴 번호를 따라간다: onFace 구독(core 가 얼굴 모드로 바꿈) → await ready() → onReady(getState)
 * 바꾸는 동안 들어온 번호도 받아 둔다. 그사이 화면이 끝나거나 다른 단계로 가면 onReady 를 부르지 않는다
 */
async function followFace(ctx, s, onReady) {
  let state = startFace();
  const offFace = ctx.card.onFace((e) => {
    state = trackFace(state, e?.faceId, Date.now());
  });
  s.stops.add(offFace);
  await ctx.card.ready();
  if (!s.alive || !s.stops.has(offFace)) return;
  onReady(() => state);
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
