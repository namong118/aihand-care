# 시연 코스: 진행 방식과 데이터 형식

결정 사항: `docs/decisions.md` 3번 · 이슈 #59 · 코드: `src/data/course.json`, `src/dashboard/course-logic.js`, `src/dashboard/course-store.js`, `src/dashboard/course.js`

## 1. 진행 방식

- 순서는 `src/data/course.json` 한곳에만 둔다: 손운동(STEP 4) → 가위바위보(STEP 2) → 숫자 기억(STEP 1) → 색깔손(STEP 3). STEP 번호·폴더명은 바꾸지 않는다.
- 화면 흐름: 홈 "코스 시작하기" → 코스 시작(활동 4개, 장치 안내) → 활동 사이 안내("1번째 활동", 입력 방법이 바뀌면 안내) → 활동 화면(위쪽 코스 막대) → … → 코스 요약
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

## 2. 기록에 붙는 값 (`detail.course`)

```js
detail: {
  ...프로그램이 넣은 값,
  course: { id: '2026-11-13T07:19:00.000Z', order: 2, of: 4 },
}
```

| 키 | 뜻 |
|---|---|
| `id` | 코스를 시작한 시각 (ISO 문자열, UTC). 시각 기반 ID이고 정렬이 그대로 된다 |
| `order` | 코스 안에서 몇 번째 활동인지 (1부터) |
| `of` | 코스 활동 수 |

코스 밖에서 하나만 한 기록에는 `detail.course`가 없다.

## 3. 코스 진행 정보 (`aihand-care.courses.v1`)

기록으로는 알 수 없는 것만 따로 저장한다 (`course-store.js`, 이 브라우저 localStorage).

```js
{ id, plan: ['step4-coach', 'step2-rps', 'step1-memory', 'step3-stroop'], skipped: [2], finished: true, endedAt: '…' }
```

- `skipped`: "이 활동 건너뛰기"로 넘어간 활동의 `order`
- `finished`: "코스 마치기"까지 갔으면 `true`, "코스 그만하기"면 `false`

## 4. 코스 요약 형식 (결과 화면 #8 · 보호자 앱 #62 공통)

`summarizeCourse(meta, records)`가 만든다. 여러 코스는 `groupCourses(records, metas)` (최근 코스부터).

```js
{
  version: 1,
  courseId: '2026-11-13T07:19:00.000Z',
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
- 보호자 앱(#62)은 이 객체를 그대로 보내고 `courseId`를 중복 방지 키로 쓴다 (다시 보내도 한 번만 저장).

## 5. 반응 시간 변화 (#8)

`reactionTrend(records, program)` → `[{ date, avgReactionMs, rounds }]` (날짜 오름차순, 문제 수 가중 평균, 코스 밖 기록 포함, 반응 시간이 없는 날은 뺌).
