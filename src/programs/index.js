// 프로그램 목록. main.js 가 id 로 프로그램을 찾는다.
// 새 프로그램을 만들면 여기에 한 줄 추가한다.

import step1 from './step1-memory/index.js';
import step2 from './step2-rps/index.js';
import step3 from './step3-stroop/index.js';
import step4 from './step4-coach/index.js';
// 도전 활동 (홈의 기본 활동 카드 아래 칸, dashboard/catalog.js CHALLENGES)
import challengeBaseball from './challenge-baseball/index.js';
import challenge21 from './challenge-21/index.js';

export const PROGRAMS = {
  [step1.id]: step1,
  [step2.id]: step2,
  [step3.id]: step3,
  [step4.id]: step4,
  [challengeBaseball.id]: challengeBaseball,
  [challenge21.id]: challenge21,
};
