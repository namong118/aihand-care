#!/bin/bash
# 라즈베리파이에서 한 번만 실행한다: 부팅하면 키오스크(scripts/kiosk.sh)가 자동으로 켜지게 등록한다.
# 데스크톱 메뉴(기타)에도 "AIHand 시연" 아이콘을 만들어, 키오스크를 닫은 뒤 다시 열 수 있게 한다.
# 자동 실행을 끄려면: ./scripts/install-kiosk.sh --remove

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
AUTOSTART="$HOME/.config/autostart/aihand-kiosk.desktop"
MENU="$HOME/.local/share/applications/aihand-kiosk.desktop"

if [ "$1" = "--remove" ]; then
  rm -f "$AUTOSTART"
  echo "자동 실행을 껐습니다. (메뉴 아이콘은 남겨 둡니다: $MENU)"
  exit 0
fi

chmod +x "$APP_DIR/scripts/kiosk.sh" "$APP_DIR/scripts/update-station.sh"
mkdir -p "$(dirname "$AUTOSTART")" "$(dirname "$MENU")"

for f in "$AUTOSTART" "$MENU"; do
  cat >"$f" <<EOF
[Desktop Entry]
Type=Application
Name=AIHand 시연
Comment=aihand-care 앱을 전체 화면으로 엽니다
Exec=$APP_DIR/scripts/kiosk.sh
Icon=chromium
Terminal=false
Categories=Other;
EOF
done

echo "등록했습니다."
echo "  자동 실행: $AUTOSTART"
echo "  메뉴 아이콘: $MENU"
echo "다시 부팅하면(sudo reboot) 앱이 전체 화면으로 뜹니다."
