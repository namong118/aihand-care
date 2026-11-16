# 시연 코스: 진행 방식과 데이터 형식

결정 사항: `docs/decisions.md` 3번 · 이슈 #59 · 코드: `src/data/course.json`, `src/dashboard/course-logic.js`, `src/dashboard/course-store.js`, `src/dashboard/course.js`

## 1. 진행 방식

- 순서는 `src/data/course.json` 한곳에만 둔다: 손운동(STEP 4) → 가위바위보(STEP 2) → 숫자 기억(STEP 1) → 색깔손(STEP 3). STEP 번호·폴더명은 바꾸지 않는다.
- 화면 흐름: 홈 "코스 시작하기" → 로그인(얼굴 또는 호칭 버튼, 손님, #82) → 코스 시작(활동 4개, 장치 안내) → 활동 사이 안내("1번째 활동", 입력 방법이 바뀌면 안내) → 활동 화면(위쪽 코스 막대) → … → 코스 요약
- **프로그램 코드는 바꾸지 않는다.**
  - 활동이 끝났는지는 기록 알림(`log.onRecord`)으로 안다. 프로그램은 회차가 끝나면 원래대로 `ctx.log.record()`를 부른다.
  - 코스 동안 프로그램에 넘기는 `ctx.log`만 감싸서 기록에 `detail.course`를 붙인다.
  - `ctx.course`는 만들지 않는다 (2026-11-13 결정).
- 코스 막대 버튼
  - 기록을 받기 전: "이 활동 건너뛰기", "코스 그만하기" (둘 다 한 번 더 묻는다)
  - 기록을 받은 뒤: "다음 활동으로 →" (마지막은 "코스 마치기"), "코스 그만하기"
  - 프로그램의 "한 번 더 하기"는 그대로 쓸 수 있다. 그 회차도 같은 활동으로 묶인다.
- 활동 역할 설명(조건 판단, 주의 전환 등)은 화면에 넣지 않는다. 발표 자료에서만 설명한다.
- 새로고침하면 진행 중이던 코스는 이어 가지 않는다. 그때까지 저장된 기록은 남는다.
- 로그인은 코스 시작 때만 한다 (`docs/decisions.md` 4번). STEP 하나만 할 때는 로그인하지 않는다. 코스 동안 화면에 지금 하시는 분(호칭 또는 "손님")을 알약으로 보여 준다.
- 사용자 등록(선생님용)은 상단 바 "설정" → "사용자 등록하기" (등록 화면 #84). 어르신이 보는 홈에는 두지 않는다.

## 2. 기록에 붙는 값 (`detail.course`)

```js
detail: {
  ...프로그램이 넣은 값,
  course: { id: '2026-11-13T07:19:00.000Z', order: 2, of: 4, userId: 'u-2026-11-13T01:00:00.000Z' },
}
```

| 키 | 뜻 |
|---|---|
| `id` | 코스를 시작한 시각 (ISO 문자열, UTC). 시각 기반 ID이고 정렬이 그대로 된다 |
| `order` | 코스 안에서 몇 번째 활동인지 (1부터) |
| `of` | 코스 활동 수 |
| `userId` | 코스 시작 때 로그인한 분 (`src/login/users.js`의 시각 기반 ID). **손님이면 `null`**. 로그인 기능(#82) 전 기록에는 이 키가 없다 |

- 호칭(`displayName`)은 기록에 넣지 않는다. 화면에 보일 때만 사용자 목록(`aihand-care.users.v2`)에서 찾는다. 그래서 사용자를 지우면 그 기록은 "등록이 지워진 분"으로 보인다.

코스 밖에서 하나만 한 기록에는 `detail.course`가 없다.

## 3. 코스 진행 정보 (`aihand-care.courses.v1`)

기록으로는 알 수 없는 것만 따로 저장한다 (`course-store.js`, 이 브라우저 localStorage).

```js
{ id, userId: 'u-…' | null, plan: ['step4-coach', 'step2-rps', 'step1-memory', 'step3-stroop'], skipped: [2], finished: true, endedAt: '…' }
```

- `userId`: 위 2번과 같은 값 (손님 `null`). 기록이 하나도 없이 그만둔 코스도 누가 했는지 알 수 있게 여기에도 둔다

- `skipped`: "이 활동 건너뛰기"로 넘어간 활동의 `order`
- `finished`: "코스 마치기"까지 갔으면 `true`, "코스 그만하기"면 `false`

## 4. 코스 요약 형식 (결과 화면 #8 · 보호자 앱 #62 공통)

`summarizeCourse(meta, records)`가 만든다. 여러 코스는 `groupCourses(records, metas)` (최근 코스부터).

```js
{
  version: 1,
  courseId: '2026-11-13T07:19:00.000Z',
  userId: 'u-2026-11-13T01:00:00.000Z',  // 손님·로그인 기능 전 코스는 null (#82)
  date: '2026-11-13',              // 스테이션 현지 시간(Asia/Seoul) 기준 날짜
  startedAt: '2026-11-13T07:19:00.000Z',
  endedAt:   '2026-11-13T07:41:12.000Z',
  finished: true,                  // "코스 마치기"까지 갔는지
  activities: [
    { order: 1, program: 'step4-coach',  status: 'played',    rounds: 1, total: 4, done: 4, skipped: 0, avgReactionMs: null },
    { order: 2, program: 'step2-rps',    status: 'skipped',   rounds: 0, total: 0, done: 0, skipped: 0, avgReactionMs: null },
    { order: 3, program: 'step1-memory', status: 'played',    rounds: 2, total: 6, done: 5, skipped: 1, avgReactionMs: 1500 },
    { order: 4, program: 'step3-stroop', status: 'notPlayed', rounds: 0, total: 0, done: 0, skipped: 0, avgReactionMs: null },
  ],
}
```

| 키 | 뜻 |
|---|---|
| `status` | `played` 기록이 있음 / `skipped` 건너뛰기로 넘어감 / `notPlayed` 하지 않음 (그만둔 뒤의 활동 등) |
| `rounds` | 그 활동을 몇 번 했는지 ("한 번 더 하기"를 하면 2 이상) |
| `total`, `done`, `skipped` | 회차들의 합. `skipped`는 활동 안에서 건너뛴 문제·동작 수 (활동 건너뛰기와 다름) |
| `avgReactionMs` | 회차별 평균 반응 시간을 **문제 수(`total`)로 가중**한 평균. 반응 시간이 없으면 `null` |

- 넣지 않는 것: 정답률·점수 같은 비율이나 평가 값, 손 유지 시간, 프로그램별 `detail`(문제 내용 등).
- 화면에는 "완료 4 / 5", "건너뜀", "하지 않음"처럼 "활동 기록"으로만 보여 준다.
- 날짜(`date`)는 Asia/Seoul 기준이다. 한국 시간 자정~오전 9시는 UTC로는 전날이지만 한국 날짜로 센다. 스테이션 시계가 맞아야 한다 (#60 시계 맞추기).
- 보호자 앱(#62)은 이 객체를 그대로 보내고 `courseId`를 중복 방지 키로 쓴다 (다시 보내도 한 번만 저장). 어느 보호자에게 보낼지는 `userId`로 고른다. `userId`가 `null`(손님)이면 보내지 않는다.
- `userId`는 형식 버전 1에 뒤에 더한 키다 (있던 키는 그대로라 `version`은 올리지 않았다).

## 5. 반응 시간 변화 (#8)

`reactionTrend(records, program)` → `[{ date, avgReactionMs, rounds }]` (날짜 오름차순, 문제 수 가중 평균, 코스 밖 기록 포함, 반응 시간이 없는 날은 뺌).

## 6. 결과 화면의 날짜별 기록 (#8)

`groupByDay(records, metas)` → `[{ date, courses: [코스 요약...], singles: [기록...] }]`

- 하루 = 그날 한 코스들(위 4번 형식) + 코스 밖에서 하나만 한 활동(`detail.course`가 없는 기록)
- 최근 날짜부터, 하루 안에서도 최근 것부터. 날짜는 Asia/Seoul 기준
- 기록 없이 진행 정보만 있는 코스(시작하자마자 그만둠)도 그날에 보인다
- 결과 화면(`src/dashboard/results.js`) 탭: 날짜별 기록 / 활동별 모아 보기 / 반응 시간 변화 / 회차별 기록(활동 고르기·CSV)
- 비율(%)은 보여 주지 않는다. "완료 수 / 전체"로만 쓴다
- 날짜별 기록에서 하신 분을 고를 수 있다: 모든 분 / 등록된 분 호칭 / 손님 (`filterDaysByUser`, #82). 등록된 분이 없으면 고르는 줄이 없다. 사람별로 나눠 보기만 하고, 사람끼리 비교하는 표나 순위는 만들지 않는다
- 사용자를 고르면 코스 밖에서 하나만 한 활동은 빠진다 (로그인하지 않으므로). 로그인 기능 전 코스는 "손님"에 들어간다
