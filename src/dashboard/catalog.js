// 프로그램 소개. 순서는 시연 코스 순서(src/data/course.json): 손운동 → 가위바위보 → 숫자 기억 → 색깔손.
// 결과 화면 표·고르기 버튼도 이 순서. STEP 번호(step)는 폴더·색 이름에만 쓰고 화면에는 쓰지 않는다 (CLAUDE.md "시연 코스")
// 문구에는 치료·예방 효과를 주장하는 표현을 쓰지 않는다.
// tag: 알약 글자, name: 홈 코스 카드·하나만 해 보기의 짧은 이름, short: 홈 코스 카드 설명 한 줄
// 색은 styles.css 의 STEP 색 (step1~step4)

export const CATALOG = [
  {
    id: 'step4-coach',
    step: 4,
    tag: '손 움직임',
    title: '손운동 코칭',
    name: '손운동',
    short: '로봇손을 따라 손을 움직여요',
    desc: '로봇의 시범을 보면서 손을 쥐었다 폈다 함께 움직여 보세요.',
  },
  {
    id: 'step2-rps',
    step: 2,
    tag: '생각',
    title: '사고력 가위바위보',
    name: '가위바위보',
    short: '말에 맞게 손을 내요',
    desc: '“져 주세요” 같은 조건을 읽고, 조건에 맞는 손을 내 보세요.',
  },
  {
    id: 'step1-memory',
    step: 1,
    tag: '기억',
    title: '숫자 기억',
    name: '숫자 기억',
    short: '숫자를 기억해 카드로 답해요',
    desc: '로봇이 손가락으로 보여준 숫자를 기억했다가, 같은 순서로 숫자 카드를 보여 주세요.',
  },
  {
    id: 'step3-stroop',
    step: 3,
    tag: '집중', // '주의'는 경고로 읽힐 수 있어 바꿈 (2026-11-13)
    title: '색깔손',
    name: '색깔손',
    short: '글자 색과 같은 카드를 보여 줘요',
    desc: '글자의 뜻이 아니라 글자의 색과 같은 색깔 카드를 보여주세요.',
  },
];

// 도전 활동: 기본 활동마다 같은 도구로 하는 짝이 하나씩 있다 (11/20 결정, #132).
// 홈의 기본 활동 카드 아래 칸에 붙고, 코스에는 들어가지 않는다. 단계는 활동 시작 화면에서 1·2·3단계로 고른다.
// pair: 짝 기본 활동 id, step: 짝 기본 활동의 STEP 번호 (색을 같게 쓴다)
// 프로그램(src/programs/index.js)에 아직 없는 것은 홈에서 "준비 중"으로 보인다.
export const CHALLENGES = [
  {
    id: 'challenge-ball',
    pair: 'step4-coach',
    step: 4,
    tag: '도전',
    title: '공 주고받기',
    name: '공 주고받기',
    short: '로봇손과 공을 주고받아요',
    desc: '로봇손에 공을 건네고, 로봇이 펴 주는 공을 받아 보세요.',
    singleLevel: true, // 단계 없이 한 가지로만 한다 (2026-11-27 실물 테스트). 시작 단계 고르기·"N단계" 표시에서 뺀다
  },
  {
    id: 'challenge-count',
    pair: 'step2-rps',
    step: 2,
    tag: '도전',
    title: '이어 세기',
    name: '이어 세기',
    short: '로봇과 번갈아 수를 세요',
    desc: '로봇과 번갈아 손가락으로 수를 이어 세요. 마지막 수를 말하지 않게 해 보세요.',
  },
  {
    id: 'challenge-baseball',
    pair: 'step1-memory',
    step: 1,
    tag: '도전',
    title: '숫자 야구',
    name: '숫자 야구',
    short: '로봇이 숨긴 숫자를 찾아요',
    desc: '로봇이 몰래 정한 숫자를 숫자 카드로 맞혀 보세요. 로봇이 손가락으로 힌트를 줘요.',
  },
  {
    id: 'challenge-shuffle',
    pair: 'step3-stroop',
    step: 3,
    tag: '도전',
    title: '카드 섞기',
    name: '카드 섞기',
    short: '섞인 카드 자리를 따라가요',
    desc: '카드 4장이 섞여요. 로봇이 손가락으로 묻는 자리의 카드 색을 알려 주세요.',
  },
];

/** 기본 활동이든 도전 활동이든 id 로 소개를 찾는다 */
export function findProgramInfo(id) {
  return CATALOG.find((p) => p.id === id) ?? CHALLENGES.find((p) => p.id === id) ?? null;
}

/** 기본 활동 id 의 짝 도전 활동 소개. 없으면 null */
export function challengeFor(basicId) {
  return CHALLENGES.find((c) => c.pair === basicId) ?? null;
}
