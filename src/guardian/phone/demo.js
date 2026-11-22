// 보호자 폰 앱 예시 데이터 (#demo 로 열면 보인다)
// 가상 인물 "순자 님"의 코스 요약. 형식은 docs/course.md 4번 (summarizeCourse 와 같은 모양).
// 날짜는 오늘을 기준으로 앞으로 당겨서 만든다 (언제 열어도 최근 기록처럼 보이게).
// 숫자는 화면 고르기 목업(docs/guardian-app.md 6번)과 같다.

export const DEMO_NAME = '순자 님';

const PROGRAMS = ['step4-coach', 'step2-rps', 'step1-memory', 'step3-stroop']; // 코스 순서

// 한 활동: [total, done, skipped, avgReactionMs, outcomes?, routines?]
// 'skip' = 활동을 건너뜀, 'none' = 하지 않음 (그만둔 뒤)
const COURSES = [
  // [며칠 전, 시작 시각(한국), 걸린 분, 끝까지 했는지, 활동 4개]
  [52, '10:00', 21, true, [[8, 8, 0, 3500, null, ['basic-grip']], [5, 4, 0, 1800, [3, 1, 1, 0]], [5, 3, 1, 2500, [2, 1, 1, 1]], [6, 5, 0, 2000]]],
  [45, '10:10', 23, true, [[8, 8, 0, 3400, null, ['finger-count']], [5, 4, 0, 1700, [3, 1, 1, 0]], [5, 4, 0, 2300, [3, 1, 1, 0]], [6, 5, 0, 1900]]],
  [38, '10:05', 22, true, [[8, 7, 1, 3300, null, ['basic-grip']], [5, 5, 0, 1600, [4, 1, 0, 0]], [5, 4, 1, 2400, [2, 2, 0, 1]], [6, 6, 0, 1800]]],
  [31, '10:20', 24, true, [[8, 8, 0, 3200, null, ['happy-meeting']], [6, 5, 0, 1600, [4, 1, 1, 0]], [5, 4, 0, 2200, [3, 1, 1, 0]], [6, 5, 0, 1800]]],
  [24, '10:00', 22, true, [[8, 8, 0, 3300, null, ['basic-grip']], [5, 4, 0, 1700, [3, 1, 1, 0]], [5, 4, 1, 2300, [2, 2, 0, 1]], [6, 5, 0, 1900]]],
  [15, '10:10', 24, true, [[8, 8, 0, 3300, null, ['basic-grip']], [5, 4, 0, 1700, [3, 1, 1, 0]], [5, 4, 1, 2300, [2, 2, 0, 1]], [6, 5, 0, 1900]]],
  [13, '10:00', 22, true, [[8, 8, 0, 3100, null, ['finger-count']], [5, 5, 0, 1500, [4, 1, 0, 0]], [5, 4, 0, 2100, [3, 1, 1, 0]], [6, 6, 0, 1700]]],
  [8, '10:20', 25, true, [[10, 9, 1, 3400, null, ['happy-meeting']], [6, 5, 0, 1600, [4, 1, 1, 0]], [5, 3, 1, 2400, [2, 1, 1, 1]], [6, 5, 0, 1800]]],
  [6, '10:05', 15, false, [[8, 8, 0, 2900, null, ['basic-grip']], [5, 4, 0, 1500, [3, 1, 1, 0]], 'skip', 'none']],
  [5, '10:05', 22, true, [[16, 15, 1, 3000, null, ['basic-grip', 'day-closing']], [5, 4, 1, 1400, [3, 1, 0, 1]], [5, 5, 0, 2000, [4, 1, 0, 0]], [6, 6, 0, 1600]]],
  [5, '14:30', 15, true, [[8, 8, 0, 2800, null, ['day-closing']], [5, 5, 0, 1300, [5, 0, 0, 0]], [4, 3, 0, 2200, [2, 1, 1, 0]], [6, 5, 0, 1700]]],
  [1, '10:15', 23, true, [[8, 7, 1, 3200, null, ['finger-count']], [6, 5, 0, 1400, [4, 1, 1, 0]], [5, 4, 0, 1900, [3, 1, 1, 0]], [6, 6, 0, 1500]]],
];

/** 'YYYY-MM-DD' 에서 n일 전 */
function daysBefore(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10);
}

function activity(order, program, a) {
  const base = { order, program, rounds: 0, total: 0, done: 0, skipped: 0, avgReactionMs: null, outcomes: null, routines: null };
  if (a === 'skip') return { ...base, status: 'skipped' };
  if (a === 'none') return { ...base, status: 'notPlayed' };
  const [total, done, skipped, avgReactionMs, out = null, routines = null] = a;
  return {
    ...base,
    status: 'played',
    rounds: 1,
    total,
    done,
    skipped,
    avgReactionMs,
    outcomes: out ? { first: out[0], second: out[1], shown: out[2], skipped: out[3] } : null,
    routines,
  };
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
