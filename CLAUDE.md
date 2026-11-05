# aihand-care

AIHand 로봇손과 웹캠 손동작 인식을 이용한 고령자 인지·손운동 활동 웹 앱.
2026 청년 피지컬AI 일경험 프로젝트, 4인 팀. 제출 12/7, 발표 12/10.

프로그램 4종: STEP 1 기억손, STEP 2 사고력 가위바위보, STEP 3 색깔손, STEP 4 손운동 코칭.

## 시연 구성

시연은 **웹 대시보드 + AIHand 실물 1대**로 한다. 노트북 1대에 AIHand 1대를 USB로 연결하는 구성만 지원하며, 여러 대 동시 연결 코드는 만들지 않는다.

- 웹 대시보드: 프로그램 선택, 진행 화면, 장치 연결 상태, 활동 결과를 한 화면 흐름에서 보여준다.
- AIHand: 문제 출제·시범·피드백 동작을 실제로 수행한다.
- 시연의 핵심 흐름은 "센서 입력(웹캠·WonderCam) → 웹 판단 → AIHand 동작 출력"이 화면과 실물에서 동시에 보이는 것이다.

이 앱은 교육·체험용 인지 자극 활동 도구다. 치료·예방 효과를 주장하는 문구나 기능을 만들지 않는다.

## 실행

- `npm install` → `npm run dev` → Chrome 또는 Edge에서 `http://localhost:5173`
- 테스트: `npm test` (Vitest)
- Web Serial(로봇 연결)은 Chrome·Edge에서만 동작한다. 다른 브라우저 지원 코드는 만들지 않는다.

## 기술 스택

- Vite + 순수 JavaScript (ES 모듈). React·TypeScript를 쓰지 않는다. 기초반 팀원이 읽을 수 있어야 한다.
- 손 인식: `@mediapipe/tasks-vision` Hand Landmarker
- 로봇 통신: Web Serial API → micro:bit (MakeCode 펌웨어)
- 테스트: Vitest. 화면 코드가 아닌 `logic.js`만 테스트한다.

## 폴더 구조와 담당

```
src/
  main.js              앱 진입, 화면 전환                 (A)
  core/                공통 모듈. 프로그램 담당자는 수정 금지 (A)
    hand/              손 인식: mediapipe.js, mock.js, wait.js(입력 확정), codes.js, index.js
    robot/             로봇 출력: serial.js, mock.js, protocol.js, index.js
    card/              색 카드 입력: serial.js, mock.js, index.js, cards.js, tags.json(ID→색, core 전용)
    context.js         ctx 생성 (설정에 따라 실제/Mock 선택)
    log.js             결과 기록, CSV 내보내기
  dashboard/           웹 대시보드: 홈, 장치 상태, 결과 화면 (A)
  programs/
    step1-memory/      STEP 1 기억손                      (A)
    step2-rps/         STEP 2 사고력 가위바위보           (D)
    step3-stroop/      STEP 3 색깔손                      (C)
    step4-coach/       STEP 4 손운동 코칭                 (B)
  ui/                  공통 UI 부품과 styles.css          (A)
  data/                poses.json, colors.json, routines.json
firmware/              micro:bit MakeCode 프로젝트, .hex  (A)
docs/                  프로토콜, API, 테스트 기록, 회의록
```

작업 중인 사람의 담당 폴더 밖 파일을 고쳐야 할 것 같으면, 고치지 말고 먼저 이유를 설명하고 확인을 받는다.

## 핵심 규칙: 프로그램은 ctx만 사용한다

모든 프로그램은 `src/programs/<이름>/index.js`에서 아래 형태를 export 한다.

```js
export default {
  id: 'step2-rps',
  title: '사고력 가위바위보',
  mount(container, ctx) { /* 화면 그리기, 이벤트 연결 */ },
  unmount() { /* 타이머·구독 해제 */ },
};
```

`ctx`에는 다음이 들어 있다. 프로그램은 `core/`를 직접 import 하지 않는다.

- `ctx.hand.onPose(cb)` → `cb({ code, name, handedness, stableMs })`, 구독 해제 함수 반환
  - `code`: 5비트 문자열 [엄지,검지,중지,약지,새끼], 1=펴짐. 손이 없으면 `null`
  - `name`: `data/poses.json`의 이름 (`ROCK`, `PAPER`, `V`, `INDEX` 등), 없으면 `null`
  - `stableMs`: 같은 code가 연속 유지된 시간. 유지 게이지처럼 현재 상태를 보여줄 때 쓴다
- `ctx.hand.waitForPose({ holdMs, since, names, signal })` → 확정된 pose로 resolve 되는 Promise
  - 확정 규칙(공통): `since` 이후에 만든 손모양을 `holdMs` 이상 유지. `names`로 받을 손모양 제한
  - `signal`(AbortController)을 abort 하면 `null`로 resolve. 화면 버튼과 `Promise.race`로 함께 쓴다
  - 입력 확정 규칙을 프로그램 안에 따로 만들지 않는다. `holdMs` 값은 각 프로그램이 정한다
  - 자세한 내용은 `docs/hand-api.md`
- `ctx.robot.showPose(name)`, `ctx.robot.react('ok' | 'retry')`, `ctx.robot.hello()`, `ctx.robot.rest()`
  - 모두 Promise를 반환하고, 로봇이 `DONE`을 보내면 resolve 된다
- `ctx.card.onCard(cb)` → `cb({ color })`, 구독 해제 함수 반환
  - `color`: `'red' | 'blue' | 'yellow' | 'green'`. 사용자가 색깔 카드를 WonderCam에 보여주면 발생
  - 프로그램은 카드 ID를 모른다. ID→색 변환은 `core/card` 안에서만 한다 (카드 인식 방식은 [검증 필요])
- `ctx.log.record({ program, ...결과 })`
- `ctx.settings` (Mock 여부, 진행 속도 등)

각 프로그램 폴더는 다음 파일로 나눈다.

- `logic.js`: 문제 생성·판정 같은 순수 함수. DOM·ctx 사용 금지
- `logic.test.js`: logic.js 테스트
- `screen.js`: 화면 그리기
- `index.js`: 위 형태의 export, logic과 screen 연결

## 웹 대시보드

대시보드는 프로그램 바깥의 공통 화면이다. 프로그램을 고르고, 진행 중 상태와 결과를 보여준다.

- 홈: STEP 1~4 선택, 사용자 선택(이름만, 개인정보 저장 금지), 난이도·속도 설정
- 장치 상태 표시줄: 웹캠, 손 인식, AIHand 연결, WonderCam 상태와 실제/Mock 여부를 항상 표시
- 결과: 프로그램별 정답률·완료 횟수·평균 반응 시간, 회차별 기록, CSV 내보내기
- 대시보드는 `ctx.log`에 쌓인 기록만 읽는다. 프로그램 내부 상태를 직접 읽지 않는다.

모든 프로그램은 회차가 끝날 때 아래 공통 필드로 기록한다.

```js
ctx.log.record({
  program: 'step2-rps',     // 프로그램 id
  user: '홍길동',            // 대시보드에서 고른 사용자 이름
  startedAt, endedAt,       // ISO 시각 문자열
  total, done,              // 전체 문항(동작) 수, 완료·정답 수
  skipped,                  // 건너뛴 수 (없으면 0)
  avgReactionMs,            // 평균 반응 시간 (해당 없으면 null)
  detail: {},               // 프로그램별 추가 정보
});
```

결과 화면의 수치는 "활동 기록"으로만 표시한다. 인지 기능 점수나 상태 판정처럼 보이는 표현을 쓰지 않는다.

## 로봇 통신 프로토콜 v1

텍스트 한 줄 = 명령 하나, `\n`으로 끝난다. 자세한 내용은 `docs/protocol.md`.

- 웹 → 로봇: `HELLO`, `POSE,<이름>`, `REACT,OK`, `REACT,RETRY`, `REST`, `SPEED,SLOW|NORMAL`, `PING`
- 로봇 → 웹: `DONE,<명령>`, `TAG,<ID>`, `PONG`, `ERR,<내용>`

프로토콜을 바꾸는 변경은 `core/robot/protocol.js`, `firmware/`, `docs/protocol.md`를 함께 고친다.

## 하드웨어 관련 주의

- AIHand·WonderCam 기능 중 공식 문서와 실물로 검증되지 않은 것이 있다. 검증 상태는 `docs/hardware-check.md`에 기록한다.
- 검증되지 않은 기능(서보 속도 조절, WonderCam 카드 인식 방식 등)을 이미 동작하는 것처럼 코드를 쓰지 않는다. 필요하면 Mock으로 두고 TODO에 `[검증 필요]`를 적는다.
- 하드웨어가 없어도 모든 프로그램이 Mock 모드로 처음부터 끝까지 동작해야 한다.

## 고령자 UX 기본값

- 본문 글씨 24px 이상, 버튼 최소 높이 64px, 고대비 색
- 색만으로 정보를 전달하지 않는다 (글자 함께 표시)
- 손 인식이 안 될 때를 대비해 모든 입력에 화면 버튼 대체 입력을 둔다
- "실패", "틀렸습니다" 같은 표현 대신 "다시 해 볼까요?"를 쓴다

## 작업 방식

- 팀원 절반은 프로그래밍 초보다. 변경 후에는 무엇을 왜 바꿨는지 한국어로 짧게 설명한다.
- 작은 단위로 커밋한다. 커밋 메시지는 한국어, `[step2] 판정 함수 추가` 형식.
- `main`에 직접 push 하지 않는다. 브랜치 이름은 `step2/판정로직` 같은 형식, PR로 합친다.
- 새 npm 패키지를 추가하기 전에 이유를 설명하고 확인을 받는다.
