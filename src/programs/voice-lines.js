// STEP 1~4가 음성으로 읽을 수 있는 문구를 모두 모은다 (#61).
// 음성 파일 만들기(npm run voice)와 테스트(src/ui/voice-files.test.js)가 쓴다. 앱 화면은 이 파일을 쓰지 않는다.
// 프로그램에 음성 문구를 새로 넣으면 그 프로그램의 voiceLines() 에 넣고 npm run voice 를 실행한다.

import colors from '../data/colors.json';
import poses from '../data/poses.json';
import routines from '../data/routines.json';
import { voiceLines as step1 } from './step1-memory/logic.js';
import { voiceLines as step2 } from './step2-rps/logic.js';
import { voiceLines as step3 } from './step3-stroop/lines.js';
import { QUESTIONS_PER_ROUND as STEP3_TOTAL } from './step3-stroop/logic.js';
import { voiceLines as step4 } from './step4-coach/logic.js';

/** 프로그램별 문구 목록: { 'step1-memory': [...], ... } */
export function allVoiceLines() {
  return {
    'step1-memory': step1(),
    'step2-rps': step2(),
    'step3-stroop': step3(colors, STEP3_TOTAL),
    'step4-coach': step4(routines, poses),
  };
}
