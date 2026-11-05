// 프로그램 목록. main.js 가 id 로 프로그램을 찾는다.
// 새 프로그램을 만들면 여기에 한 줄 추가한다.

import step1 from './step1-memory/index.js';
import step2 from './step2-rps/index.js';
import step3 from './step3-stroop/index.js';

export const PROGRAMS = {
  [step1.id]: step1,
  [step2.id]: step2,
  [step3.id]: step3,
};
