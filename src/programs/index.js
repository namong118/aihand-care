// 프로그램 목록. main.js 가 id 로 프로그램을 찾는다.
// 새 프로그램을 만들면 여기에 한 줄 추가한다.

import step2 from './step2-rps/index.js';

export const PROGRAMS = {
  [step2.id]: step2,
};
