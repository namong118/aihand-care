// 홈 화면에 보여줄 프로그램 소개. 순서대로 STEP 1~4.
// 문구에는 치료·예방 효과를 주장하는 표현을 쓰지 않는다.
// tag: 카드 왼쪽 위 알약 글자, theme: styles.css 의 STEP 색 (step1~step4)

export const CATALOG = [
  {
    id: 'step1-memory',
    step: 1,
    tag: '기억',
    title: '기억손',
    // STEP 1 이 숫자 카드 순서 기억으로 바뀌면 설명과 그림(home.js)을 함께 바꾼다
    desc: '로봇이 차례로 보여준 손모양을 기억했다가, 같은 순서로 만들어 보세요.',
  },
  {
    id: 'step2-rps',
    step: 2,
    tag: '생각',
    title: '사고력 가위바위보',
    desc: '“져 주세요” 같은 조건을 읽고, 조건에 맞는 손을 내 보세요.',
  },
  {
    id: 'step3-stroop',
    step: 3,
    tag: '주의',
    title: '색깔손',
    desc: '글자의 뜻이 아니라 글자의 색과 같은 색깔 카드를 보여주세요.',
  },
  {
    id: 'step4-coach',
    step: 4,
    tag: '손 움직임',
    title: '손운동 코칭',
    desc: '로봇의 시범을 보면서 손을 쥐었다 폈다 함께 움직여 보세요.',
  },
];

export function findProgramInfo(id) {
  return CATALOG.find((p) => p.id === id) ?? null;
}
