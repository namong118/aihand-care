# 손 인식 API (`ctx.hand`)와 ctx 요약

프로그램은 `core/`를 직접 import 하지 않고, `mount(container, ctx)`로 받은 `ctx`만 쓴다.

## `ctx.hand.onPose(cb)`

손 인식 결과가 나올 때마다 `cb(pose)`를 부른다. 반환값은 **구독 해제 함수**다. `unmount()`에서 꼭 부른다.

```js
const off = ctx.hand.onPose((pose) => {
  // pose = { code, name, handedness, stableMs }
});
// 나중에
off();
```

| 필드 | 값 | 설명 |
|---|---|---|
| `code` | `'01100'` 또는 `null` | 5비트 문자열 [엄지, 검지, 중지, 약지, 새끼], `1` = 펴짐. 손이 없으면 `null` |
| `name` | `'V'` 또는 `null` | `src/data/poses.json`의 이름. 목록에 없는 모양이면 `null` |
| `handedness` | `'Right'` / `'Left'` / `null` | 오른손·왼손. Mock은 항상 `'Right'` |
| `stableMs` | 숫자(ms) | 같은 `code`가 연속으로 유지된 시간 |

`onPose`는 0.1초마다 계속 불린다. 유지 게이지(예: STEP 4의 "0.6 / 1.0초")처럼 **지금 상태를 계속 보여줄 때** 쓴다.
"이 손모양으로 답을 정한다"처럼 **입력을 확정할 때는 아래 `waitForPose`를 쓴다.**

## `ctx.hand.waitForPose({ holdMs, since, names, signal })`

손모양 입력이 **확정되면** resolve 되는 Promise를 돌려준다. 확정 규칙은 모든 프로그램이 같다 (`src/core/hand/wait.js`).

1. 이름 있는 손모양이고 (`names`를 주면 그 안의 손모양만)
2. `holdMs` 이상 같은 모양을 유지했고
3. `since` 시각 이후에 **새로 만든** 손모양이어야 한다
   (문제가 나오기 전부터 들고 있던 손이 바로 답이 되는 것을 막는다)

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `holdMs` | `1000` | 유지해야 하는 시간(ms). 입력 확정 시간은 각 프로그램이 정한다 |
| `since` | 부른 시각 (`Date.now()`) | 이 시각 이후에 만든 손모양만 인정 |
| `names` | `null` (모든 손모양) | 예: `['ROCK', 'PAPER', 'V']` |
| `signal` | 없음 | `AbortController`의 `signal`. abort 하면 Promise가 **`null`로** resolve 된다 (에러 없음) |

resolve 값: 확정된 `pose` (`{ code, name, handedness, stableMs }`) 또는 abort 됐을 때 `null`.

### 화면 버튼(대체 입력)과 함께 쓰는 예

```js
const stop = new AbortController();
const picked = await Promise.race([
  ctx.hand.waitForPose({ holdMs: 1000, since: shownAt, names: HANDS, signal: stop.signal })
    .then((pose) => pose && { hand: pose.name, via: 'hand' }),
  new Promise((resolve) => showButtons((hand) => resolve({ hand, via: 'button' }))),
]);
stop.abort(); // 버튼이 먼저 눌렸으면 기다리던 손 입력을 멈춘다
```

`unmount()`에서는 기다리는 중인 `waitForPose`를 모두 abort 한다.

### 손모양 목록 (`src/data/poses.json`)

| name | code | 화면 이름 |
|---|---|---|
| `ROCK` | `00000` | 주먹(바위) |
| `PAPER` | `11111` | 손바닥(보) |
| `V` | `01100` | 브이(가위) |
| `INDEX` | `01000` | 검지 하나 |
| `THREE` | `01110` | 손가락 셋 |
| `FOUR` | `01111` | 손가락 넷 |
| `THUMB` | `10000` | 엄지 척 |

AIHand가 이 손모양을 모두 만들 수 있는지는 아직 확인하지 않았다 → `hardware-check.md`

### Mock 손 인식 (토글 방식)

- 오른쪽 패널의 손모양 버튼을 **한 번 누르면** 그 손모양을 계속 들고 있는 상태가 된다.
- 들고 있는 동안 **0.1초마다** `onPose`가 발생하고 `stableMs`가 늘어난다.
- 다른 손모양을 누르면 바뀌고 `stableMs`는 0부터 다시 센다. 같은 버튼을 다시 누르면 그대로 유지된다.
- **손 내리기**를 누르면 `{ code: null, name: null, handedness: null, stableMs: 0 }`을 한 번 보내고 멈춘다.

### 실제 손 인식 (구현 전)

`src/core/hand/mediapipe.js`에서 웹캠 + MediaPipe Hand Landmarker로 구현 예정. 같은 `onPose` 형태를 지킨다.

---

## ctx 전체 요약

| 이름 | 형태 | 설명 |
|---|---|---|
| `ctx.hand.onPose(cb)` | 구독 해제 함수 반환 | 0.1초마다 현재 손 상태. 유지 게이지 등에 사용 |
| `ctx.hand.waitForPose(opts)` | Promise | 손모양 입력 확정. 위 참고 |
| `ctx.robot.showPose(name)` | Promise | 로봇이 손모양을 만든다. `DONE` 받으면 resolve |
| `ctx.robot.react('ok' \| 'retry')` | Promise | 칭찬 / "다시 해 볼까요" 반응 |
| `ctx.robot.hello()` | Promise | 인사 |
| `ctx.robot.rest()` | Promise | 손 내리기 |
| `ctx.card.onCard(cb)` | 구독 해제 함수 반환 | `cb({ color })`, color는 `'red'`·`'blue'`·`'yellow'`·`'green'`. 카드 ID는 넘어오지 않는다. Mock: 키보드 R/B/Y/G 또는 "카드 대신 입력" 버튼 |
| `ctx.log.record(rec)` | 저장된 기록 | 회차가 끝날 때 공통 필드로 기록 (아래) |
| `ctx.settings` | 객체 | `{ mock, user, difficulty: 'easy'\|'normal'\|'hard', speed: 'SLOW'\|'NORMAL' }` |

### `ctx.log.record` 공통 필드

```js
ctx.log.record({
  program: 'step2-rps',
  user: ctx.settings.user,
  startedAt, endedAt,     // new Date().toISOString()
  total, done,            // 필수. 숫자
  skipped,                // 없으면 0
  avgReactionMs,          // 해당 없으면 null
  detail: {},             // 프로그램별 추가 정보
});
```

필수 필드(`program`, `user`, `startedAt`, `endedAt`, `total`, `done`)가 없으면 에러가 난다. 공통 필드 외의 값은 저장되지 않으니 `detail` 안에 넣는다.
