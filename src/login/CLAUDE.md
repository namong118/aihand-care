# 얼굴 로그인 (login)

- **담당:** C
- 이 폴더 밖 파일은 고치지 않는다. `main.js`·`dashboard/`·`core/`를 고쳐야 할 것 같으면 멈추고 담당 A에게 알린다 (대시보드 연결과 WonderCam 쪽은 A).
- 이슈: #79 얼굴 번호 확정, #80 사용자 저장, #83 동의서, #81 로그인 화면, #84 등록 화면, #85 실물 테스트

## 정해진 것 (2026-11-13, #75)

- 실명 대신 **호칭·별명**만 받는다. 얼굴 데이터는 **WonderCam 모듈 안에만** (라즈베리파이·Supabase에 얼굴 사진·특징값 저장 안 함)
- 로그인은 코스 시작 때만. 손님 모드는 `userId: null`
- 얼굴 번호 확정은 같은 번호 1.5초 연속, "아니요" 한 번이면 바로 호칭 버튼

## 사용자 저장 (`users.js`, #80)

- localStorage 키: **`aihand-care.users.v1`** (기록 `aihand-care.records.v1`과 같은 형식)
- 저장 모양: `[{ userId, displayName, faceId, consentAt }, ...]`
  - `userId`: 시각 기반 ID (`'u-2026-11-13T10:00:00.000Z'`)
  - `displayName`: 호칭·별명 (실명 아님), 12글자까지, 같은 호칭은 받지 않음
  - `faceId`: WonderCam 얼굴 번호, 얼굴 없이 호칭만 등록하면 `null`. 같은 번호를 두 사람에게 주지 않음
  - `consentAt`: 얼굴 동의 시각, 얼굴이 없으면 `null`
- `remove(userId)`는 `{ user, forgetFaceId }`를 돌려준다. `forgetFaceId`가 있으면 "WonderCam에서도 이 얼굴을 지워 주세요" 안내를 띄운다
- Supabase 동기화는 B 경민 #62 설계에 맞춘다 (여기서 테이블을 정하지 않는다)

## 등록 화면 (`mountRegister`, #84)

- WonderCam 얼굴 번호는 **1~5번** (공식 확장 Hiwonder/WonderCam). 5명까지 얼굴 등록, 그 뒤로는 호칭만 등록
- 공식 확장에는 학습 명령이 없다 → `ctx.card.learnFace`가 없으면 카메라 레버로 학습하고 번호를 고른다 [검증 필요] #76 결과로 확정
- 키오스크 터치 화면에는 화면 키보드가 없을 수 있다. 등록은 복지사·팀원이 USB 키보드로 한다고 가정 [검증 필요]

## 하지 말아야 할 것

- `src/core/`를 import 하지 않는다. 화면은 `ctx`만 쓴다
- 순수 함수 파일(`logic.js`, `users.js`의 저장소 바깥 함수)에서 DOM·ctx를 쓰지 않는다
- 실명, 얼굴 사진, 얼굴 특징값을 저장하지 않는다
- "치료·예방 효과" 같은 표현을 쓰지 않는다
