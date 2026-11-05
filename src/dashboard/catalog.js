// 홈 화면에 보여줄 프로그램 소개. 순서대로 STEP 1~4.
// 문구에는 치료·예방 효과를 주장하는 표현을 쓰지 않는다.

export const CATALOG = [
  {
    id: 'step1-memory',
    step: 1,
    title: '기억손',
    desc: '로봇이 보여준 손모양을 잘 보고 기억했다가 똑같이 만들어 봐요.',
  },
  {
    id: 'step2-rps',
    step: 2,
    title: '사고력 가위바위보',
    desc: '"이겨주세요", "져주세요" 같은 말에 맞게 가위바위보를 내 봐요.',
  },
  {
    id: 'step3-stroop',
    step: 3,
    title: '색깔손',
    desc: '글자의 뜻이 아니라 글자의 색깔에 맞는 색 카드를 골라 봐요.',
  },
  {
    id: 'step4-coach',
    step: 4,
    title: '손운동 코칭',
    desc: '로봇의 시범을 보면서 손을 쥐었다 폈다 함께 움직여 봐요.',
  },
];

export function findProgramInfo(id) {
  return CATALOG.find((p) => p.id === id) ?? null;
}
