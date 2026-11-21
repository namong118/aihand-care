# 활동 화면 공통 클래스 (#33)

디자인 시안 v11(파스텔, 2026-11-16 확정)에 맞춘 STEP 활동 화면용 클래스입니다. 정의는 `src/ui/styles.css`의 "활동 화면 공통"에 있습니다.
STEP 화면은 아래 클래스 이름만 붙이면 되고, 색·크기를 `style`로 직접 쓰지 않아도 됩니다.

## 활동 색

활동 화면 바깥 `program-body`에 `step1`~`step4` 클래스가 붙어 있습니다 (`main.js`). 그래서 안쪽에서 `var(--step-bg)`(파스텔 바탕), `var(--step-fg)`(같은 계열 진한 글자·그림)를 쓰면 그 활동 색이 나옵니다.

| 활동 | 바탕 `--step-bg` | 글자·그림 `--step-fg` |
|---|---|---|
| STEP 1 숫자 기억 | 민트 `#D7EFE3` | `#1D6B4C` |
| STEP 2 가위바위보 | 버터 `#FAEFCC` | `#7A5200` |
| STEP 3 색깔손 | 라일락 `#E9E2F9` | `#5B3FA6` |
| STEP 4 손운동 | 하늘 `#DFE8FB` | `#2D4E9E` |

## 클래스

| 클래스 | 쓰는 곳 |
|---|---|
| `act-head` | 맨 위 한 줄: 진행 알약과 작은 표시들 |
| `act-progress` | "문제 1 / 5" 알약 (활동 색) |
| `act-tag` | 흰 작은 알약 ("카드 1 / 3", "한 번 더 해 보는 중") |
| `act-card` | 흰 카드 (테두리·그림자 없음). `act-card-row`를 같이 붙이면 가로 배치 |
| `act-label` | 카드 안 작은 회색 제목 ("로봇이 낸 손", "이번 말") |
| `act-question` | 문제·지시 큰 글자 (60px, 굵기 600). 길면 `style`로 44~48px |
| `act-text` | 카드 안 설명 글 (24px) |
| `act-prompt` | 가운데 큰 안내 ("로봇을 잘 보세요", 카운트다운) |
| `act-art`, `act-art-lg` | 활동 색 그림 칸 (64px / 104px). 안에 `handIcon()` 그림이나 글자 |
| `act-answers` | 답 버튼 칸 (grid). 버튼 수에 맞춰 `grid-template-columns` |
| `act-answer` | 큰 흰 답 버튼 (104px). 안에 `act-art` + 글자 |
| `act-foot` | 아래 줄: 안내 한 줄(`act-foot-text`) + 건너뛰기 같은 작은 버튼 |
| `act-list` | 요약 목록. `li` 안에 `act-list-no`, `act-list-main`, `act-list-state` |

손모양 그림은 `src/ui/icons.js`의 `handIcon('ROCK' | 'PAPER' | 'V', 크기)`를 씁니다. 그림 옆에는 꼭 글자를 같이 씁니다.

## 예: 답 버튼

```js
import { handIcon } from '../../ui/icons.js';

h('div', { class: 'act-answers', style: { 'grid-template-columns': 'repeat(3, minmax(0, 1fr))' } },
  h('button', { type: 'button', class: 'act-answer', onClick: () => onAnswer('ROCK') },
    h('span', { class: 'act-art' }, handIcon('ROCK')),
    '바위',
  ),
);
```

## 도전 활동 단계 고르기 (`src/ui/level-picker.js`)

도전 활동(숫자 야구·이어 세기·카드 섞기 등)은 모두 시작 화면에서 **1·2·3단계**를 고릅니다. 모양이 같도록 이 부품을 같이 씁니다. 클래스는 `level-*` (`styles.css` "도전 활동 단계 고르기").

```js
import { levelPicker } from '../../ui/level-picker.js';

container.append(levelPicker({
  title: '카드 섞기',
  lead: '카드 4장이 섞여요. 로봇이 손가락으로 묻는 자리의 색을 알려 주세요.',
  levels: [
    { level: 1, desc: '네 번 천천히 섞어요' },
    { level: 2, desc: '여섯 번, 두 곳을 물어요' },
    { level: 3, desc: '여덟 번, 빠르게' },
  ],
  selected: 1,            // 미리 고른 단계: ctx.settings.challengeLevel 이 1·2·3 이면 그 값, 아니면 1
  onStart: (level) => { /* 그 단계로 시작 */ },
}));
```

- 세 단계는 늘 한 줄에 놓입니다 (Mock 화면의 가상 로봇손 칸이 있어도). 설명(`desc`)은 짧게 한 줄로 씁니다
- 고른 단계는 활동 색 테두리와 "✔ 고름" 글자로 보여 줍니다 (색만으로 알리지 않음)
- 예: `src/programs/challenge-baseball/screen.js`

## 7인치(1280×720)

답 버튼과 건너뛰기는 코스 막대가 있어도 스크롤 없이 첫 화면에 보여야 합니다. 2026-11-16 Mock 화면 기준 맨 아래 버튼 위치: STEP 1 708px, STEP 2 716px, STEP 3 629px, STEP 4 653px.
