#!/bin/bash
# 라즈베리파이에서 최신 코드를 받아 다시 빌드한다. 인터넷이 될 때 실행한다.
# 끝나면 키오스크를 다시 열어야(또는 다시 부팅해야) 새 화면이 보인다.

set -e
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

# 라즈베리파이의 npm 버전이 package-lock.json 을 조금 바꿔 놓아 git pull 이 막히는 일이 있다. 받기 전에 되돌린다.
git checkout -- package-lock.json
# 스테이션은 항상 main(팀이 합친 코드)으로 시연한다
git switch main
git pull
npm ci
npm run build

# 키오스크가 켜져 있던 앱 서버는 예전 빌드를 보고 있을 수 있으니 끈다 (키오스크를 다시 열면 새로 켜진다)
pkill -f "vite preview" || true
echo "빌드 끝. 키오스크를 다시 열거나 다시 부팅하세요."
