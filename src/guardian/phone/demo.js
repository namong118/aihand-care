// 보호자 폰 앱 예시 데이터 (#demo 로 열면 보인다)
// 가상 인물 "순자 님"의 코스 요약. 형식은 docs/course.md 4번 (summarizeCourse 와 같은 모양).
// 날짜는 오늘을 기준으로 앞으로 당겨서 만든다 (언제 열어도 최근 기록처럼 보이게).
// 숫자는 실제 앱과 같게 맞춘다 (PR #152 리뷰):
//   손운동 전체 동작 = 고른 루틴의 동작 수 × 반복 (src/data/routines.json, step4-coach expandRoutine 과 같은 계산)
//     손 깨우기 6 (2동작 × 3번), 손가락 숫자 세기 6, 반가운 만남 5, 하루 마무리 3. 루틴 여러 개면 합
//   가위바위보·숫자 기억·색깔손 = 한 회차 5문제 ("한 번 더" 하면 10문제)

import routines from '../../data/routines.json';

export const DEMO_NAME = '순자 님';

/** 루틴 하나를 하면 기록되는 동작 수 (repeat 이 없거나 0 이하면 1번) */
function motionsOf(id) {
  const r = routines.find((x) => x.id === id);
  return r ? r.steps.length * Math.max(1, r.repeat ?? 1) : 0;
}

// 활동 쓰는 법
//   손운동:            { routines: [...], left: 따라 하지 못한 수, skipped, rt }   (전체 = 루틴 동작 수 합)
//   가위바위보·숫자 기억: { out: [한 번에, 다시 해서, 함께 확인, 건너뜀], rt, rounds? }  (합 = 5 × rounds)
//   색깔손:            { done, rt }                                              (전체 5)
//   'skip' = 활동을 건너뜀, 'none' = 하지 않음 (그만둔 뒤)
const COURSES = [
  // [며칠 전, 시작 시각(한국), 걸린 분, 끝까지 했는지, [손운동, 가위바위보, 숫자 기억, 색깔손]]
  [52, '10:00', 21, true, [{ routines: ['basic-grip'], rt: 3500 }, { out: [3, 1, 1, 0], rt: 1800 }, { out: [2, 1, 1, 1], rt: 2500 }, { done: 4, rt: 2000 }]],
  [45, '10:10', 23, true, [{ routines: ['finger-count'], rt: 3400 }, { out: [3, 1, 1, 0], rt: 1700 }, { out: [3, 1, 1, 0], rt: 2300 }, { done: 4, rt: 1900 }]],
  [38, '10:05', 22, true, [{ routines: ['basic-grip'], skipped: 1, rt: 3300 }, { out: [4, 1, 0, 0], rt: 1600 }, { out: [2, 2, 0, 1], rt: 2400 }, { done: 5, rt: 1800 }]],
  [31, '10:20', 24, true, [{ routines: ['happy-meeting'], rt: 3200 }, { out: [3, 1, 1, 0], rt: 1600 }, { out: [3, 1, 1, 0], rt: 2200 }, { done: 4, rt: 1800 }]],
  [24, '10:00', 22, true, [{ routines: ['basic-grip'], rt: 3300 }, { out: [3, 1, 1, 0], rt: 1700 }, { out: [2, 2, 0, 1], rt: 2300 }, { done: 4, rt: 1900 }]],
  [15, '10:10', 24, true, [{ routines: ['basic-grip'], rt: 3300 }, { out: [3, 1, 1, 0], rt: 1700 }, { out: [2, 2, 0, 1], rt: 2300 }, { done: 4, rt: 1900 }]],
  [13, '10:00', 26, true, [{ routines: ['finger-count'], rt: 3100 }, { out: [4, 1, 0, 0], rt: 1500 }, { out: [5, 2, 2, 1], rt: 2100, rounds: 2 }, { done: 5, rt: 1700 }]],
  [8, '10:20', 25, true, [{ routines: ['happy-meeting'], skipped: 1, rt: 3400 }, { out: [3, 1, 1, 0], rt: 1600 }, { out: [2, 1, 1, 1], rt: 2400 }, { done: 4, rt: 1800 }]],
  [6, '10:05', 15, false, [{ routines: ['basic-grip'], rt: 2900 }, { out: [3, 1, 1, 0], rt: 1500 }, 'skip', 'none']],
  [5, '10:05', 22, true, [{ routines: ['basic-grip', 'day-closing'], skipped: 1, rt: 3000 }, { out: [3, 1, 0, 1], rt: 1400 }, { out: [4, 1, 0, 0], rt: 2000 }, { done: 5, rt: 1600 }]],
  [5, '14:30', 15, true, [{ routines: ['day-closing'], rt: 2800 }, { out: [5, 0, 0, 0], rt: 1300 }, { out: [2, 1, 1, 1], rt: 2200 }, { done: 4, rt: 1700 }]],
  [1, '10:15', 23, true, [{ routines: ['finger-count'], left: 1, rt: 3200 }, { out: [4, 1, 0, 0], rt: 1400 }, { out: [3, 1, 1, 0], rt: 1900 }, { done: 5, rt: 1500 }]],
];

const PROGRAMS = ['step4-coach', 'step2-rps', 'step1-memory', 'step3-stroop']; // 코스 순서

/** 'YYYY-MM-DD' 에서 n일 전 */
function daysBefore(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10);
}

function activity(order, program, a) {
  const base = { order, program, rounds: 0, total: 0, done: 0, skipped: 0, avgReactionMs: null, outcomes: null, routines: null };
  if (a === 'skip') return { ...base, status: 'skipped' };
  if (a === 'none') return { ...base, status: 'notPlayed' };
  const played = { ...base, status: 'played', rounds: a.rounds ?? 1, avgReactionMs: a.rt };
  if (program === 'step4-coach') {
    const total = a.routines.reduce((n, id) => n + motionsOf(id), 0);
    const skipped = a.skipped ?? 0;
    return { ...played, total, skipped, done: total - skipped - (a.left ?? 0), routines: a.routines };
  }
  if (a.out) {
    const [first, second, shown, skipped] = a.out;
    return {
      ...played,
      total: first + second + shown + skipped,
      done: first + second,
      skipped,
      outcomes: { first, second, shown, skipped },
    };
  }
  return { ...played, total: 5 * played.rounds, done: a.done };
}

/**
 * 예시 코스 요약 목록 (최근 것부터).
 * today: 한국 날짜 'YYYY-MM-DD'
 */
export function demoSummaries(today) {
  return COURSES.map(([ago, time, minutes, finished, acts]) => {
    const date = daysBefore(today, ago);
    const start = new Date(`${date}T${time}:00+09:00`);
    const startedAt = start.toISOString();
    return {
      version: 1,
      courseId: startedAt,
      userId: 'u-demo',
      who: 'user',
      date,
      startedAt,
      endedAt: new Date(start.getTime() + minutes * 60000).toISOString(),
      finished,
      activities: acts.map((a, i) => activity(i + 1, PROGRAMS[i], a)),
    };
  }).reverse();
}
