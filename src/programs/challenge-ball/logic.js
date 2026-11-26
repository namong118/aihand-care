// 도전 활동 "공 주고받기": 화면이 알려 준 손으로 공을 로봇에게 건네고, 알려 준 손으로 돌려받는다 (순수 함수, DOM·ctx 사용 금지)
//
// 손은 'right' | 'left' 로만 다룬다. 한 번 주고받기 = { give: 건네는 손, receive: 받는 손 }.
// 어느 손을 썼는지는 확인하지 않는다 (센서 없음, 사용자를 믿는다). 그래서 맞고 틀림을 따지지 않는다.

/** 한 회차에 주고받는 횟수 (로봇이 공을 쥐는 횟수. 약지 문제를 생각해 10번 이하로) */
export const EXCHANGES = 4;

/** 손 이름 (화면 글자) */
export const HAND_TEXT = { right: '오른손', left: '왼손' };

/** 3단계에서 고르는 4가지 손 지시 */
export const ALL_PAIRS = [
  { give: 'right', receive: 'right' },
  { give: 'right', receive: 'left' },
  { give: 'left', receive: 'left' },
  { give: 'left', receive: 'right' },
];

/**
 * 단계별 값
 *   1단계: 한 손으로 건네고 받기 (시작할 때 고른 손), 지시가 계속 보임
 *   2단계: 건네는 손과 받는 손이 다름, 번마다 번갈아, 지시가 계속 보임
 *   3단계: 4가지 중 무작위 (바로 앞과 다르게), 지시를 보고 나면 가려짐
 */
export const LEVELS = {
  1: { mode: 'same', hide: false },
  2: { mode: 'alternate', hide: false },
  3: { mode: 'random', hide: true },
};

/** 단계 값. 1~3이 아니면 1단계 */
export function levelSpec(level) {
  return LEVELS[level] ?? LEVELS[1];
}

/** 시작 화면에서 미리 선택할 단계. challengeLevel 이 1·2·3이면 그대로, 없거나 다른 값이면 1 */
export function defaultLevel(challengeLevel) {
  return [1, 2, 3].includes(challengeLevel) ? challengeLevel : 1;
}

/** 반대 손 */
export function otherHand(hand) {
  return hand === 'left' ? 'right' : 'left';
}

/**
 * 한 회차의 손 지시 목록.
 *   level: 1 | 2 | 3, count: 주고받는 횟수
 *   hand: 1단계에서 고른 손 (없으면 'right'), 2단계는 이 손으로 먼저 건넨다
 * 반환 예 (2단계): [{ give: 'right', receive: 'left' }, { give: 'left', receive: 'right' }, ...]
 */
export function makeInstructions(level, count = EXCHANGES, hand = 'right', rand = Math.random) {
  const first = hand === 'left' ? 'left' : 'right';
  const { mode } = levelSpec(level);
  const list = [];
  for (let i = 0; i < count; i++) {
    if (mode === 'same') {
      list.push({ give: first, receive: first });
    } else if (mode === 'alternate') {
      const give = i % 2 === 0 ? first : otherHand(first);
      list.push({ give, receive: otherHand(give) });
    } else {
      // 바로 앞과 같은 지시는 이어 나오지 않게 한다 (같은 걸 두 번 하면 기억할 거리가 없다)
      const prev = list[i - 1];
      const choices = prev ? ALL_PAIRS.filter((p) => !samePair(p, prev)) : ALL_PAIRS;
      const pick = choices[Math.floor(rand() * choices.length)] ?? choices[0];
      list.push({ ...pick });
    }
  }
  return list;
}

/** 두 손 지시가 같은지 */
export function samePair(a, b) {
  return Boolean(a && b) && a.give === b.give && a.receive === b.receive;
}

/** 손 지시 한 줄 글자. 예: "오른손으로 건네고, 왼손으로 받아요" */
export function instructionText({ give, receive }) {
  return `${HAND_TEXT[give]}으로 건네고, ${HAND_TEXT[receive]}으로 받아요`;
}

/** 속도 느리게(SLOW)인지 */
const isSlow = (speed) => speed === 'SLOW';

/** "셋, 둘, 하나" 한 박자(ms) */
export function beatMs(speed) {
  return isSlow(speed) ? 1500 : 1000;
}

/** 3단계에서 지시를 보여 주다가 가리기까지 시간(ms). [준비됐어요]를 누르면 바로 가린다. 가린 뒤에도 [준비됐어요]를 눌러야 넘어간다 */
export function hideMs(speed) {
  return isSlow(speed) ? 8000 : 5000;
}

/**
 * 받기 모양: 웹캠에 펼친 손이 보이면 로봇이 공을 내려놓는다 (2026-11-26 A).
 * 손바닥을 위로 받친 손은 웹캠에서 손가락이 겹쳐 보여 엄지가 흔들리기 쉬워서, 엄지만 접힌 FOUR 도 받기로 친다.
 * 왼손·오른손은 확인하지 않는다 (사용자를 믿는다).
 */
export const RECEIVE_POSES = ['PAPER', 'FOUR'];

/** 받기 모양을 이만큼 유지하면 확정(ms). 손을 받친 채 오래 들고 있지 않아도 되게 짧게 */
export function receiveHoldMs(speed) {
  return isSlow(speed) ? 800 : 500;
}

/**
 * 받을 손을 기다리는 최대 시간(ms). 그동안 로봇은 공을 쥐고 있으므로 오래 두지 않는다 (11/23 약지 문제).
 * 이 안에 손이 안 보이고 버튼도 누르지 않으면 "손을 받쳐 주세요 — 셋, 둘, 하나" 뒤 내려놓는다
 */
export function receiveWaitMs(speed) {
  return isSlow(speed) ? 15000 : 10000;
}

/** 받기 모양 이름인지 (화면에 "손이 보여요" 안내용) */
export function isReceivePose(name) {
  return RECEIVE_POSES.includes(name);
}

/**
 * 한 회차 기록 공통 필드.
 * exchanges: [{ give, receive, retries, replays }] (끝까지 주고받은 번만)
 *   total = 주고받기로 한 횟수, done = 끝까지 주고받은 횟수
 *   avgReactionMs = null (맞고 틀림이나 반응 시간을 재지 않는다)
 */
export function summarizeSession(exchanges, total = EXCHANGES) {
  return {
    total,
    done: exchanges.length,
    skipped: 0,
    avgReactionMs: null,
  };
}
