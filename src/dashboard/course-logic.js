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
 * @param course  { id, order, of }
 */
export function tagRecord(record, { id, order, of }) {
  return { ...record, detail: { ...(record.detail ?? {}), course: { id, order, of } } };
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
