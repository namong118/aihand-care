# 음성 안내 (#61)

라즈베리파이 Chromium에는 한국어 음성이 없어서 브라우저 음성(`speechSynthesis`)이 소리 없이 넘어간다 (`docs/hardware-check.md` 5번).
그래서 **음성 파일을 미리 만들어** 앱에 넣는다 (`docs/decisions.md` 5번).
목소리는 오프라인 한국어 음성 **Supertonic 3**(sherpa-onnx) **1번 목소리·품질 5** (2026-11-25 D가 들어 보고 정함. 그전에는 Windows Heami).
AI 인사처럼 매번 다른 문장은 같은 목소리로 **바로 만들어 읽는다** (아래 "실시간 읽기").

## 어떻게 동작하나

- 프로그램은 `src/ui/voice.js`의 `speak(문구)`, `stopSpeaking()`만 쓴다
- `speak`는 문구를 **문장**으로 나눈다 (마침표·느낌표·물음표 뒤 띄어쓰기). 문장마다 파일이 하나 있다
  - 예: `'잘하셨어요! 글자 색은 빨강이었어요.'` → `잘하셨어요!` 파일 + `글자 색은 빨강이었어요.` 파일을 이어서 재생
- 문장 중 하나라도 파일이 없으면 브라우저 음성으로 읽는다. Windows Chrome에서는 들리지만 **라즈베리파이에서는 조용하다**
  - 개발 중에는 브라우저 콘솔에 `[음성] 음성 파일 없음`이 뜬다
  - 예외: `speak(문구, { live: true })`는 파일이 없는 문장을 **실시간 읽기 서버**로 만든다 (아래)
- 음성은 화면 글자를 대신하지 않는다. 같은 문구를 화면에도 보여 준다

| 파일 | 하는 일 |
|---|---|
| `src/ui/voice.js` | 재생 (파일 → `live`면 읽기 서버 → 브라우저 음성) |
| `src/ui/voice-text.js` | 문장 나누기, 읽기 바꾸기("5문제" → "다섯 문제", "1번" → "일 번"), 파일 이름 |
| `src/programs/voice-lines.js` | STEP 1~4의 `voiceLines()`를 모은다 |
| `scripts/make-voice.js` | 음성 파일 만들기 (`npm run voice`) |
| `scripts/supertonic.py` | Supertonic 목소리 설정 한곳. `batch`(파일 만들기) · `serve`(실시간 읽기 서버) |
| `public/voice/*.wav` | 음성 파일 (문장 하나에 하나, 22,050Hz 모노, 앞뒤 무음 다듬음) |
| `src/data/voice.json` | 문장 ↔ 파일 표 |

## 문구를 고치거나 새로 넣을 때

1. 프로그램 문구를 고친다. 음성으로 읽는 문구는 각 프로그램의 `voiceLines()`에 들어 있어야 한다
   - STEP 1 `logic.js`, STEP 2 `logic.js`, STEP 3 `lines.js`, STEP 4 `logic.js` (아래쪽 "음성 안내")
   - STEP 4 동작 문구는 `src/data/routines.json`의 `say`
2. `npm run voice` (Windows·라즈베리파이·맥 모두. 처음 한 번 아래 "Supertonic 준비")
   - 새 문장만 파일을 만들고, 쓰지 않는 파일은 지운다. 모두 다시 만들려면 `npm run voice -- --all`
3. `npm test`: `src/ui/voice-files.test.js`가 모든 문장에 파일이 있는지 확인한다
4. 바뀐 `public/voice/`와 `src/data/voice.json`도 함께 커밋한다

## 음성 (Supertonic)

- **Supertonic 3** int8 (sherpa-onnx 변환, 모델 코드 MIT·모델 OpenRAIL-M), **1번 목소리**, **품질(num_steps) 5**, CPU 2개. 설정은 `scripts/supertonic.py` 맨 위 한곳
  - 고른 이유 (2026-11-25, 노트북 + 자브라로 들어 봄): 목소리 10가지 중 1번. 품질 3은 어색했고 8은 느렸다. CPU 4개로 늘려도 거의 빨라지지 않았다
- 숫자 읽기 (`toSpoken`, 화면 글자는 그대로):
  - 개수(`개·문제·판`) 앞은 우리말 수: `5문제` → "다섯 문제", `3개` → "세 개"
  - 번호·시간(`번·초·분`) 앞은 한자어 수: `1번` → "일 번", `3초` → "삼 초". 숫자 그대로 두면 Supertonic 이 "1번"을 "한 번"으로 읽었다
- 발음이 어색한 문장이 있으면 `toSpoken`에 바꿀 규칙을 넣는다

### Supertonic 준비 (처음 한 번)

프로젝트 밖 `~/aihand-ai/`에 둔다 (앱 저장소에 넣지 않는다).

```bash
# 1) Python 가상환경 + sherpa-onnx
python -m venv ~/aihand-ai/tts-venv
~/aihand-ai/tts-venv/Scripts/python -m pip install sherpa-onnx      # 라즈베리파이·맥: tts-venv/bin/python
# 2) 모델 (sherpa-onnx 공식 릴리스, 약 122MB)
mkdir -p ~/aihand-ai/tts-models && cd ~/aihand-ai/tts-models
curl -LO https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/sherpa-onnx-supertonic-3-tts-int8-2026-05-11.tar.bz2
tar xjf sherpa-onnx-supertonic-3-tts-int8-2026-05-11.tar.bz2
```

- 다른 곳에 두었으면 `VOICE_PYTHON`(python 경로), `VOICE_MODEL_DIR`(모델 폴더)로 알려 준다
- 133문장을 처음 만드는 데 노트북에서 약 5분

## 실시간 읽기 (AI 인사 등)

```
speak(문구, { live: true })
  → 문장마다: 음성 파일이 있으면 파일, 없으면 POST /tts → Vite 넘기기 → 127.0.0.1:8090 (scripts/supertonic.py serve)
  → 서버가 없으면 남은 문장은 브라우저 음성
```

- 서버 켜기: `~/aihand-ai/tts-venv/Scripts/python scripts/supertonic.py serve` (같은 기기에서만 받음, 한 번에 한 문장씩)
- 한 문장을 재생하는 동안 다음 문장을 만든다. 서버는 한 번에 하나만 만들어서, **앞 문장이 준비된 뒤에** 다음 문장을 맡긴다 (동시에 맡기면 첫 소리가 8.7초로 늦어졌다)
- **손 인식을 쉬는 화면에서만** `live: true`를 쓴다 (라즈베리파이 열, `docs/ai-greeting.md`). 활동 중 문장은 모두 미리 만든 파일
- 2026-11-25 노트북 측정: 3.7초짜리 문장을 서버가 2.7초에 만듦(앱 경로 2.9초). 브라우저에서 두 문장 인사: 첫 소리 5.8초, 문장 사이 11ms로 이어짐 [라즈베리파이 검증 필요]

## 박자 ("가위, 바위, 보!")

STEP 2는 "보!"를 부른 순간 로봇에 손을 내라고 보내고, 동시에 모드는 그 순간을 기준으로 제때 냈는지 판정한다. 그래서 소리가 늦게 나면 안 된다.

- 음성 엔진은 문장 앞뒤에 무음을 넣는다 (Heami 앞 약 0.18초) → `supertonic.py`가 **앞 0.03초, 뒤 0.3초**만 남기고 자른다 (뒤 0.3초는 문장을 이어 읽을 때의 쉼)
- Supertonic 파일(2026-11-25): "가위"·"바위"·"보!"의 소리는 0.3~0.43초 안에 끝나서 박자(0.75초)보다 짧다
- `voice.js`는 파일마다 Audio 하나를 만들어 다시 쓴다. STEP 2는 화면을 열 때 `preloadVoice('가위', '바위', '보!')`로 미리 불러 둔다
- 2026-11-24 노트북(Chrome) 측정: 부른 순간부터 재생 시작까지 처음 12~18ms, 그다음부터 1~7ms. 파일 앞 무음을 더해도 "보!"는 0.1초 안에 들린다

## 읽는 것과 읽지 않는 것

| STEP | 읽는 것 | 읽지 않는 것 |
|---|---|---|
| 1 숫자 기억 | 시작 안내, "이번에는 숫자 N개", 답할 차례, 결과, 끝 | 로봇이 보여 주는 숫자 |
| 2 가위바위보 | "가위, 바위, 보!", 조건, 결과·도움말, 끝 | |
| 3 색깔손 | 시작 멘트, 문제 번호, 오래 기다릴 때 안내, 결과, 끝 | 문제의 글자 뜻 (과제가 달라진다) |
| 4 손운동 | 동작 문구(`say`), 좋아요·괜찮아요, 미리 든 손 안내, 끝 (`step4-coach/CLAUDE.md` 표) | 숫자 세기("하나") |

## 아직 확인하지 않은 것

- [ ] 라즈베리파이 + 자브라 스피커에서 재생 (지연, 소리 크기). 자브라를 기본 출력으로 맞추는 방법은 #60
- [x] "가위, 바위, 보!" 구호 박자: 노트북에서 확인 (위 "박자")
- [ ] 같은 확인을 라즈베리파이에서. 그리고 "보!" 소리와 AIHand가 실제로 손을 내는 때가 얼마나 차이 나는지 (시리얼·서보 움직임 시간)
- 음성 인식("네·아니요·다시")은 음성 안내를 마친 뒤 시간이 남으면 시험한다 (#61)
