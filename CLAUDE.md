# aihand-care

AIHand 로봇손과 웹캠 손동작 인식을 이용한 고령자 인지·손운동 활동 웹 앱.
2026 청년 피지컬AI 일경험 프로젝트, 4인 팀. 제출 12/7, 발표 12/10.

프로그램 4종: STEP 1 숫자 기억, STEP 2 사고력 가위바위보, STEP 3 색깔손, STEP 4 손운동 코칭.

팀이 확정한 결정 사항은 `docs/decisions.md`에 모은다. 아래 내용과 다르면 먼저 그 문서를 확인한다.

## 시연 구성

시연은 **웹 대시보드 + AIHand 실물 1대**로 한다. 라즈베리파이 시연 스테이션 1대에 AIHand 1대를 USB로 연결하는 구성만 지원하며, 여러 대 동시 연결 코드는 만들지 않는다.

- 시연 스테이션 (로봇손 앞 전용): 라즈베리파이 5 + Touch Display 2 (7인치, 보드는 디스플레이 뒷면) + Active Cooler + 로지텍 C270 웹캠 + USB 스피커폰(자브라 스피크 510). 브라우저는 Chromium
- 전원을 켜면 Chromium **키오스크 모드**로 앱이 전체 화면 자동 실행된다. 활동 기록(localStorage)을 유지해야 하므로 시크릿 모드(`--incognito`)는 쓰지 않는다
- 스테이션은 **인터넷 없이** 동작한다: 라즈베리파이에서 `npm run build` → `npm run preview`로 로컬 실행 (README "라즈베리파이 준비"). MediaPipe wasm·모델은 앱에 포함, 글꼴은 라즈베리파이 시스템 글꼴(`fonts-noto-cjk`, `font-family`의 `'Noto Sans CJK KR'`)로 보장한다. 배포 주소(GitHub Pages)는 개발·공유용
- 시연 때는 휴대폰 핫스팟을 켜 둔다 (RTC 배터리가 없어 시계 맞추기, 보호자 앱 전송). 핫스팟이 끊겨도 앱이 멈추지 않게 위의 오프라인 구성은 그대로 지킨다
- 라즈베리파이 성능과 7인치 화면(1280×720)을 기준으로 판단한다 (손 인식은 손 1개, 기본 640×480)
- 미션맵: AIHand는 세워 두고 웹캠은 로봇 받침대 바로 앞. 손 인식과 카드 보여 주는 자리는 로봇 앞 같은 위치 한곳 (웹캠과 WonderCam이 같은 자리를 본다)

### 시연 코스

- 순서: **손운동(STEP 4) → 가위바위보(STEP 2) → 숫자 기억(STEP 1) → 색깔손(STEP 3)** (손으로 하는 활동 → 카드로 하는 활동, 쉬운 것 → 어려운 것)
- STEP 번호와 폴더명은 바꾸지 않는다. 화면에는 코스 순서로 "1번째 활동: 손운동"처럼 보여 준다
- 앞 활동 결과로 다음 활동을 맞춤 조정하는 기능은 지금 범위에서 뺐다 (`docs/decisions.md` 3번)
- 코스는 대시보드가 진행한다. 프로그램 코드는 코스를 몰라도 된다: 활동 끝은 기록 알림으로 알고, 코스 동안 `ctx.log`만 감싸 기록에 `detail.course = { id, order, of }`를 붙인다. `ctx.course`는 만들지 않는다
- 코스 요약 형식(결과 화면·보호자 앱 공통)과 진행 방식: `docs/course.md`

- 웹 대시보드: 프로그램 선택, 진행 화면, 장치 연결 상태, 활동 결과를 한 화면 흐름에서 보여준다.
- AIHand: 문제 출제·시범·피드백 동작을 실제로 수행한다.
- 시연의 핵심 흐름은 "센서 입력(웹캠·WonderCam) → 웹 판단 → AIHand 동작 출력"이 화면과 실물에서 동시에 보이는 것이다.

이 앱은 교육·체험용 인지 자극 활동 도구다. 치료·예방 효과를 주장하는 문구나 기능을 만들지 않는다. "치매 예방", "인지 기능 향상", "효과", "치료" 같은 표현을 앱과 발표에 쓰지 않는다. 근거 자료와 쓸 수 있는 표현은 `docs/research/evidence.md`, 결정 사항은 `docs/decisions.md`.

## 실행

- `npm install` → `npm run dev` → Chrome 또는 Edge에서 `http://localhost:5173` (시연: 라즈베리파이 Chromium)
- 테스트: `npm test` (Vitest)
- Web Serial(로봇 연결)은 Chrome·Edge·Chromium에서만 동작한다. 다른 브라우저 지원 코드는 만들지 않는다.

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
    step1-memory/      STEP 1 숫자 기억 (폴더명 유지)     (A)
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
- `ctx.card.onNumber(cb)` → `cb({ number })`, 구독 해제 함수 반환. `number`: 1~5 (숫자 카드, WonderCam 숫자 인식)
- `ctx.card.onFace(cb)` → `cb({ faceId })`, 구독 해제 함수 반환. `faceId`: 학습된 얼굴 번호(1 이상 정수) | `'unknown'`(모르는 얼굴) | `null`(안 보임). 얼굴 로그인용 (`src/login/`)
  - 펌웨어 얼굴 모드(#77) 전까지는 **개발자 입력의 Mock 얼굴 버튼으로만** 들어온다. 이때 `ctx.card.ready()`는 `false`
- `ctx.card.ready()` → WonderCam 모드 바꾸기가 끝나면 resolve (`true` = 실제 카메라 준비, `false` = Mock만)
  - 카메라는 한 번에 한 모드. `onCard` 구독 → 태그 모드, `onNumber` 구독 → 숫자 모드, `onFace` 구독 → 얼굴 모드(#77 뒤)로 core가 알아서 바꾼다
- `ctx.log.record({ program, ...결과 })`
- `ctx.settings` (Mock 여부, 진행 속도 등)

각 프로그램 폴더는 다음 파일로 나눈다.

- `logic.js`: 문제 생성·판정 같은 순수 함수. DOM·ctx 사용 금지
- `logic.test.js`: logic.js 테스트
- `screen.js`: 화면 그리기
- `index.js`: 위 형태의 export, logic과 screen 연결

## 웹 대시보드

대시보드는 프로그램 바깥의 공통 화면이다. 프로그램을 고르고, 진행 중 상태와 결과를 보여준다.

- 홈: 시연 코스 시작, STEP 1~4 개별 선택, 난이도·속도 설정. 사용자 이름은 받지 않는다 (개인정보 저장 금지)
- 장치 상태 표시줄: 웹캠, 손 인식, AIHand 연결, WonderCam 상태와 실제/Mock 여부를 항상 표시
- 결과: 날짜별 코스 기록, 활동별 완료 수, 반응 시간 변화, CSV 내보내기. 손 유지 시간 지표는 넣지 않는다
- 대시보드는 `ctx.log`에 쌓인 기록만 읽는다. 프로그램 내부 상태를 직접 읽지 않는다.

모든 프로그램은 회차가 끝날 때 아래 공통 필드로 기록한다.

```js
ctx.log.record({
  program: 'step2-rps',     // 프로그램 id
  startedAt, endedAt,       // ISO 시각 문자열
  total, done,              // 전체 문항(동작) 수, 완료·정답 수
  skipped,                  // 건너뛴 수 (없으면 0)
  avgReactionMs,            // 평균 반응 시간 (해당 없으면 null)
  detail: {},               // 프로그램별 추가 정보
});
```

결과 화면의 수치는 "활동 기록"으로만 표시한다. 인지 기능 점수나 상태 판정처럼 보이는 표현("정답률", "점수", "등급" 등)을 쓰지 않고 "완료 수"처럼 쓴다.

### 보호자·복지사용 폰 앱 (PWA)

- 스테이션의 QR로 한 번 연결하고, 코스가 끝나면 요약을 자동 전송한다. 인터넷이 없으면 대기열에 쌓았다가 연결되면 보낸다
- 클라우드는 Supabase. Supabase 패키지는 **팀 확인 후 추가**한다 (아직 추가하지 않음)
- 개인정보: 이름 등 개인정보는 받지 않는다. 기록은 시각 기반 ID, 보호자 앱은 **연결 코드로만** 묶는다
- 어르신은 폰을 조작하지 않는다

### 음성 안내

- 활동 안내는 음성으로도 들려준다. 라즈베리파이 Chromium에 한국어 음성(`speechSynthesis`)이 없으면 미리 녹음한 음성 파일로 바꾼다
- 간단한 소통(네·아니요·다시 같은 몇 단어)은 시간이 남으면 인터넷 없이 연결한다
- 음성은 화면 글자를 대신하지 않는다 (글자도 함께 표시)

## 로봇 통신 프로토콜 v1

텍스트 한 줄 = 명령 하나, `\n`으로 끝난다. 자세한 내용은 `docs/protocol.md`.

- 웹 → 로봇: `HELLO`, `POSE,<이름>`, `REACT,OK`, `REACT,RETRY`, `REST`, `SPEED,SLOW|NORMAL`, `PING`, `CAM,TAG|NUM`
- 로봇 → 웹: `DONE,<명령>`, `TAG,<번호>|NONE`, `NUM,<1~5>|NONE`, `PONG`, `ERR,<내용>`

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

- **작업을 시작하기 전에** 아래를 먼저 확인하고, 내게 온 할 일·댓글이 있으면 사용자에게 알린다. 팀원 사이 전달 사항은 담당자를 지정한 이슈와 PR 댓글로 남긴다.
  - `git switch main && git pull` (새 작업은 최신 main에서 새 브랜치로 시작한다)
  - `gh issue list --assignee @me` (내게 온 이슈)
  - `gh pr list --author @me --state all --limit 5` 후 `gh pr view <번호> --comments` (내 PR에 달린 새 댓글)
- 팀원 절반은 프로그래밍 초보다. 변경 후에는 무엇을 왜 바꿨는지 한국어로 짧게 설명한다.
- 작은 단위로 커밋한다. 커밋 메시지는 한국어, `[step2] 판정 함수 추가` 형식.
- `main`에 직접 push 하지 않는다. 브랜치 이름은 `step2/판정로직` 같은 형식, PR로 합친다.
- 새 npm 패키지를 추가하기 전에 이유를 설명하고 확인을 받는다.
