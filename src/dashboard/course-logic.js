// 시연 코스: 순서 검사, 기록 묶기, 코스 요약 (순수 함수, DOM·ctx 사용 금지).
// 코스 순서는 src/data/course.json 한곳에만 둔다. STEP 번호·폴더명은 바꾸지 않는다 (docs/decisions.md 3번).
//
// 코스 동안 저장되는 기록에는 detail.course = { id, order, of } 가 붙는다 (tagRecord).
// 코스 요약(summarizeCourse)은 결과 화면(#8)과 보호자 앱(#62)이 같이 쓰는 형식이다. 자세한 형식은 docs/course.md.
// 평가처럼 보이는 값(비율·점수)은 만들지 않는다. 완료 수·건너뜀·반응 시간만 모은다.

/** 코스 요약 형식 버전. 형식을 바꾸면 올린다 (보호자 앱이 읽는다) */
export const SUMMARY_VERSION = 1;

/** 스테이션 현지 시간대. 코스 날짜는 이 시간대로 센다 */
export const TIME_ZONE = 'Asia/Seoul';

/** 입력 방법 */
export const INPUTS = ['hand', 'card'];

/**
 * course.json 검사. 프로그램이 catalog 에 있는지, 중복이 없는지, 입력 방법이 맞는지 본다.
 * @param list     course.json 내용 [{ program, input }]
 * @param catalog  dashboard/catalog.js 의 CATALOG
 * @returns 같은 목록 (복사본)
 */
export function loadCourse(list, catalog) {
  if (!Array.isArray(list) || list.length === 0) throw new Error('코스에 활동이 없습니다.');
  const ids = new Set(catalog.map((p) => p.id));
  const seen = new Set();
  return list.map((step) => {
    if (!ids.has(step.program)) throw new Error(`코스에 없는 프로그램이 있습니다: ${step.program}`);
    if (seen.has(step.program)) throw new Error(`코스에 같은 프로그램이 두 번 있습니다: ${step.program}`);
    if (!INPUTS.includes(step.input)) throw new Error(`입력 방법은 hand 또는 card 입니다: ${step.input}`);
    seen.add(step.program);
    return { program: step.program, input: step.input };
  });
}

/** 코스 id: 코스를 시작한 시각 (ISO 문자열). 날짜순 정렬이 그대로 된다 */
export function newCourseId(now = new Date()) {
  return now.toISOString();
}

/**
 * 기록에 코스 정보를 붙인다. 원래 기록과 detail 은 바꾸지 않고 새 객체를 돌려준다.
 * @param record  프로그램이 ctx.log.record 에 넘긴 값
 * @param course  { id, order, of, userId }
 *   userId: 코스 시작 때 로그인한 사용자 (#82). 손님이면 null. 넘기지 않으면 붙이지 않는다 (예전 기록과 같은 모양)
 */
export function tagRecord(record, { id, order, of, userId }) {
  const course = userId === undefined ? { id, order, of } : { id, order, of, userId };
  return { ...record, detail: { ...(record.detail ?? {}), course } };
}

/** 코스를 누가 했는지: 등록한 분 / 손님 / 알 수 없음(로그인 기능 #82 전 코스) */
export const WHO = { user: 'user', guest: 'guest', unknown: 'unknown' };

/**
 * 코스를 누가 했는지 → { userId, who }.
 * 진행 정보(meta)를 먼저 보고, 없으면 그 코스 기록의 detail.course 를 본다.
 *   - userId 값이 있으면 등록한 분          → { userId: 'u-…', who: 'user' }
 *   - userId 키가 있고 값이 null 이면 손님  → { userId: null, who: 'guest' }
 *   - userId 키가 아예 없으면 로그인 기능 전 코스 → { userId: null, who: 'unknown' }
 * 손님과 예전 코스는 둘 다 userId 가 null 이라 "키가 있는지"로 나눈다.
 */
export function courseUser(meta, records = []) {
  const fromValue = (userId) =>
    typeof userId === 'string' ? { userId, who: WHO.user } : { userId: null, who: WHO.guest };
  if (meta && 'userId' in meta) return fromValue(meta.userId);
  const tagged = records.map(courseOf).find((c) => c?.id === meta?.id && 'userId' in c);
  if (tagged) return fromValue(tagged.userId);
  return { userId: null, who: WHO.unknown };
}

/**
 * 코스의 index 번째(0부터) 활동 정보.
 * @returns { order, of, program, input, inputChanged, isLast }
 *   inputChanged: 바로 앞 활동과 입력 방법이 다르면 true (첫 활동은 false)
 */
export function stepInfo(plan, index) {
  const step = plan[index];
  if (!step) throw new Error(`코스에 ${index + 1}번째 활동이 없습니다.`);
  const prev = plan[index - 1];
  return {
    order: index + 1,
    of: plan.length,
    program: step.program,
    input: step.input,
    inputChanged: Boolean(prev) && prev.input !== step.input,
    isLast: index === plan.length - 1,
  };
}

/**
 * 코스 진행 표시(활동 사이 안내의 목록, 활동 화면 위쪽 막대)에 쓰는 활동별 상태.
 * @param plan     loadCourse() 결과
 * @param index    지금 활동 (0부터)
 * @param skipped  "이 활동 건너뛰기"로 넘어간 order 목록 (course-store 의 skipped)
 * @returns [{ order, program, input, state }]
 *   state: 'done'(마침) | 'skipped'(건너뜀) | 'now'(지금) | 'next'(아직)
 */
export function courseProgress(plan, index, skipped = []) {
  return plan.map((step, i) => {
    const order = i + 1;
    let state = 'next';
    if (i < index) state = skipped.includes(order) ? 'skipped' : 'done';
    else if (i === index) state = 'now';
    return { order, program: step.program, input: step.input, state };
  });
}

/** ISO 시각 → 그 시간대의 날짜 'YYYY-MM-DD' (기본: 스테이션 현지 시간 Asia/Seoul) */
export function localDate(iso, timeZone = TIME_ZONE) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // en-CA 는 날짜를 YYYY-MM-DD 로 쓴다
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/**
 * 회차별 평균 반응 시간을 문제 수(total)로 가중해 평균한다.
 * 반응 시간이 없거나(null) 문제 수가 0인 회차는 뺀다. 남는 회차가 없으면 null. 정수 ms 로 반올림.
 * @param rounds  [{ total, avgReactionMs }]
 */
export function weightedReaction(rounds) {
  let sum = 0;
  let weight = 0;
  for (const r of rounds) {
    if (!Number.isFinite(r.avgReactionMs) || !Number.isFinite(r.total) || r.total <= 0) continue;
    sum += r.avgReactionMs * r.total;
    weight += r.total;
  }
  return weight === 0 ? null : Math.round(sum / weight);
}

/** 기록의 코스 정보. 코스 밖 기록이면 null */
export function courseOf(record) {
  const c = record?.detail?.course;
  return c && typeof c.id === 'string' ? c : null;
}

/**
 * 코스 하나 → 코스 요약 (결과 화면 #8, 보호자 앱 #62 공통 형식, docs/course.md).
 * @param meta     코스 진행 정보 { id, plan: [program...], skipped: [order...], finished, endedAt }
 * @param records  기록 목록 (다른 코스·코스 밖 기록이 섞여 있어도 된다)
 * @param timeZone 날짜를 셀 시간대 (기본 Asia/Seoul)
 */
export function summarizeCourse(meta, records, timeZone = TIME_ZONE) {
  const mine = records.filter((r) => courseOf(r)?.id === meta.id);
  const skipped = new Set(meta.skipped ?? []);
  const activities = meta.plan.map((program, i) => {
    const order = i + 1;
    const rounds = mine.filter((r) => courseOf(r).order === order);
    const status = rounds.length > 0 ? 'played' : skipped.has(order) ? 'skipped' : 'notPlayed';
    return {
      order,
      program,
      status,
      rounds: rounds.length,
      total: rounds.reduce((a, r) => a + r.total, 0),
      done: rounds.reduce((a, r) => a + r.done, 0),
      skipped: rounds.reduce((a, r) => a + (r.skipped ?? 0), 0),
      avgReactionMs: weightedReaction(rounds),
    };
  });
  const ends = mine.map((r) => r.endedAt).sort();
  return {
    version: SUMMARY_VERSION,
    courseId: meta.id,
    // 누가 한 코스인지 (#82). userId: 손님·로그인 기능 전 코스는 null, who: 'user' | 'guest' | 'unknown'
    ...courseUser(meta, mine),
    date: localDate(meta.id, timeZone),
    startedAt: meta.id,
    endedAt: meta.endedAt ?? ends[ends.length - 1] ?? null,
    finished: Boolean(meta.finished),
    activities,
  };
}

/**
 * 기록 목록 → 코스 요약 목록 (최근 코스부터).
 * metas 에 진행 정보가 있는 코스는 그것을 쓰고, 기록만 있는 코스(진행 정보가 지워진 경우)는
 * 기록에서 순서를 만들어 요약한다.
 * @param records  기록 목록
 * @param metas    코스 진행 정보 목록 (course-store)
 */
export function groupCourses(records, metas = [], timeZone = TIME_ZONE) {
  const byId = new Map(metas.map((m) => [m.id, m]));
  for (const r of records) {
    const c = courseOf(r);
    if (!c || byId.has(c.id)) continue;
    byId.set(c.id, { id: c.id, plan: [], skipped: [], finished: false });
  }
  // 진행 정보가 없는 코스: 기록의 order 로 plan 을 채운다
  for (const meta of byId.values()) {
    if (meta.plan.length > 0) continue;
    const plan = [];
    for (const r of records) {
      const c = courseOf(r);
      if (c?.id === meta.id) plan[c.order - 1] = r.program;
    }
    meta.plan = Array.from(plan, (p) => p ?? null);
  }
  return [...byId.values()]
    .map((meta) => summarizeCourse(meta, records, timeZone))
    .sort((a, b) => (a.courseId < b.courseId ? 1 : a.courseId > b.courseId ? -1 : 0));
}

/**
 * 결과 화면(#8)의 날짜별 기록: 하루 = 그날 한 코스들 + 코스 밖에서 하나만 한 활동들.
 * 날짜는 최근 날짜부터, 그날 안에서도 최근 것부터.
 * @param records  기록 목록
 * @param metas    코스 진행 정보 목록 (course-store)
 * @returns [{ date, courses: [코스 요약...], singles: [기록...] }]
 *   singles: detail.course 가 없는 기록. 시작 시각을 읽을 수 없는 기록은 date 가 null 인 날로 맨 뒤에 모은다
 */
export function groupByDay(records, metas = [], timeZone = TIME_ZONE) {
  const days = new Map();
  const dayOf = (date) => {
    if (!days.has(date)) days.set(date, { date, courses: [], singles: [] });
    return days.get(date);
  };
  for (const summary of groupCourses(records, metas, timeZone)) dayOf(summary.date).courses.push(summary);
  for (const r of records) {
    if (courseOf(r)) continue;
    dayOf(localDate(r.startedAt, timeZone)).singles.push(r);
  }
  const newestFirst = (a, b) => (a < b ? 1 : a > b ? -1 : 0);
  for (const day of days.values()) day.singles.sort((a, b) => newestFirst(a.startedAt, b.startedAt));
  return [...days.values()].sort((a, b) => {
    if (a.date === null) return 1;
    if (b.date === null) return -1;
    return newestFirst(a.date, b.date);
  });
}

/** 결과 화면에서 손님(로그인 없이 한 코스)을 고를 때 쓰는 값 */
export const GUEST = 'guest';

/**
 * 날짜별 기록(groupByDay 결과)을 한 분의 코스만 남긴다 (#82).
 * 코스 밖에서 하나만 한 활동은 로그인을 하지 않으므로 사용자를 고르면 빠진다.
 * @param days  groupByDay() 결과
 * @param user  null·undefined = 모든 분, GUEST = 손님(who 'guest'), 그 밖은 userId
 *              로그인 기능 전 코스(who 'unknown')는 "모든 분"에서만 보인다
 */
export function filterDaysByUser(days, user) {
  if (user === null || user === undefined) return days;
  const want = user === GUEST ? null : user;
  return days
    .map((day) => ({
      ...day,
      courses: day.courses.filter((c) => (want === null ? c.who === WHO.guest : c.userId === want)),
      singles: [],
    }))
    .filter((day) => day.courses.length > 0);
}

/**
 * 한 활동의 반응 시간 변화: 날짜별로 문제 수 가중 평균 (날짜 오름차순). 코스 밖 기록도 포함한다.
 * 반응 시간이 없는 날은 넣지 않는다.
 * @returns [{ date, avgReactionMs, rounds }]
 */
export function reactionTrend(records, program, timeZone = TIME_ZONE) {
  const byDate = new Map();
  for (const r of records) {
    if (r.program !== program) continue;
    const date = localDate(r.startedAt, timeZone);
    if (!date) continue;
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(r);
  }
  return [...byDate.entries()]
    .map(([date, rounds]) => ({ date, avgReactionMs: weightedReaction(rounds), rounds: rounds.length }))
    .filter((d) => d.avgReactionMs !== null)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
