#!/bin/bash
# 시연 스테이션(라즈베리파이) 키오스크 실행 스크립트.
# 1) 앱 서버(npm run preview)를 켜고  2) 서버가 준비되면  3) Chromium을 키오스크 모드(전체 화면)로 연다.
# 부팅할 때 자동으로 실행된다 (scripts/install-kiosk.sh 가 등록). 직접 실행해도 된다: ./scripts/kiosk.sh
# 빌드(npm run build)는 하지 않는다. 코드를 바꾼 뒤에는 scripts/update-station.sh 로 빌드해 둔다.

# 이 스크립트가 있는 폴더의 한 단계 위 = aihand-care 폴더
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# 주소(포트)를 바꾸면 안 된다. 활동 기록(localStorage)은 주소별로 따로 저장되므로,
# 주소가 바뀌면 이전 기록이 안 보인다.
PORT=4173
URL="http://localhost:${PORT}/aihand-care/"

# 키오스크 전용 Chromium 프로필. 평소 쓰는 Chromium과 섞이지 않고,
# 활동 기록·카메라 허용·AIHand 포트 허용이 여기 남는다. (시크릿 모드는 끄면 기록이 지워져서 쓰지 않는다)
PROFILE_DIR="$HOME/.config/aihand-kiosk"
LOG="$HOME/.cache/aihand-kiosk.log"

mkdir -p "$(dirname "$LOG")"
exec >>"$LOG" 2>&1
echo "==== $(date '+%F %T') 키오스크 시작"

if [ ! -f "$APP_DIR/dist/index.html" ]; then
  echo "dist/ 가 없습니다. 먼저 scripts/update-station.sh 로 빌드하세요."
  exit 1
fi

# 1) 앱 서버: 이미 켜져 있으면(키오스크를 닫았다 다시 연 경우) 그대로 쓴다
if ! curl -s -o /dev/null "$URL"; then
  echo "앱 서버 시작"
  cd "$APP_DIR" || exit 1
  # --strictPort: 4173이 이미 쓰이고 있으면 다른 포트로 바꾸지 말고 멈춘다 (주소가 바뀌면 기록이 안 보임)
  nohup npm run preview -- --host 127.0.0.1 --port "$PORT" --strictPort >>"$LOG" 2>&1 &
fi

# 2) 서버 준비될 때까지 기다리기 (최대 60초)
for _ in $(seq 1 60); do
  curl -s -o /dev/null "$URL" && break
  sleep 1
done
if ! curl -s -o /dev/null "$URL"; then
  echo "앱 서버가 60초 안에 켜지지 않았습니다."
  exit 1
fi

# Chromium 프로필 설정 파일을 실행 전에 고쳐 둔다 (Chromium이 꺼져 있을 때만 고칠 수 있다)
#   - 전원을 그냥 뽑으면 다음에 "Chromium이 제대로 종료되지 않았습니다" 창이 뜬다 → 정상 종료로 표시
#   - 브라우저 언어가 영어면 "번역할까요?" 창이 뜬다 → 언어를 한국어로, 번역 끄기
#     (Linux에서는 --lang 옵션이 무시되어 설정 파일로 정한다)
PREFS="$PROFILE_DIR/Default/Preferences"
mkdir -p "$(dirname "$PREFS")"
# 인터넷이 될 때 Chromium이 동영상 DRM 부품(WidevineCdm)을 자동으로 받는데, 라즈베리파이에서는
# 다음 실행부터 이 부품 때문에 Chromium이 바로 꺼진다 (2026-11-13 확인). 앱에 필요 없으니 지운다.
rm -rf "$PROFILE_DIR/WidevineCdm"
node -e '
  const fs = require("fs");
  const file = process.argv[1];
  let p = {};
  try { p = JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
  p.profile = { ...p.profile, exit_type: "Normal", exited_cleanly: true };
  p.intl = { ...p.intl, accept_languages: "ko-KR,ko", selected_languages: "ko-KR,ko" };
  p.translate = { ...p.translate, enabled: false };
  fs.writeFileSync(file, JSON.stringify(p));
' "$PREFS"
export LANGUAGE=ko

# 3) Chromium 키오스크
#   --kiosk                      주소창·탭 없이 전체 화면
#   --noerrdialogs, --disable-session-crashed-bubble, --disable-infobars  알림 창 끄기
#   --no-first-run               처음 실행 안내 화면 건너뛰기
#   --password-store=basic       자동 로그인 때 "키링 잠금 해제" 창이 뜨지 않게
#   --autoplay-policy=...        화면을 누르기 전에도 음성 안내가 나오게
#   --lang=ko (+ 위 LANGUAGE=ko) 카메라 허용 같은 브라우저 안내를 한국어로
#   --disable-features=Translate 번역 기능 끄기 (위 설정 파일과 함께 한 번 더)
#   --check-for-update-interval  업데이트 알림 끄기 (인터넷 없이 쓰므로)
#   --disable-component-update   부품 자동 내려받기 끄기 (위 WidevineCdm이 다시 받아지지 않게)
#   --ozone-platform=wayland     라즈베리파이 데스크톱(labwc)은 Wayland. ssh에서 실행해도 화면을 찾게 명시
# ssh에서 실행할 때를 위해 데스크톱 화면 정보를 채운다 (부팅 때 자동 실행에서는 이미 있다)
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
export WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-wayland-0}"
echo "Chromium 실행: $URL"
chromium \
  --user-data-dir="$PROFILE_DIR" \
  --ozone-platform=wayland \
  --kiosk \
  --noerrdialogs \
  --disable-session-crashed-bubble \
  --disable-infobars \
  --no-first-run \
  --password-store=basic \
  --autoplay-policy=no-user-gesture-required \
  --lang=ko \
  --disable-features=Translate \
  --check-for-update-interval=31536000 \
  --disable-component-update \
  "$URL"

echo "==== $(date '+%F %T') Chromium 종료 (앱 서버는 켜 둔 채로 둠)"
