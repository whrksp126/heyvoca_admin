#!/bin/bash
# AWS Elastic Beanstalk 배포용 ZIP 생성 스크립트.
# React SPA(frontend/)를 먼저 빌드해 app/static/spa 에 산출물을 넣은 뒤 zip 한다.
# (EB Python 플랫폼은 npm 을 돌리지 못하므로 로컬 빌드 후 포함하는 방식)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "▶ React SPA 빌드 (frontend/)…"
if ! command -v npm >/dev/null 2>&1; then
  echo "❌ npm 이 필요합니다 (Node 18+). 설치 후 다시 실행하세요."
  exit 1
fi
( cd frontend && npm ci && npm run build )
echo "✅ SPA 빌드 완료 → app/static/spa"

# 기존 배포 파일 삭제
rm -f deploy.zip

# ZIP 생성 (불필요한 파일 제외, app/static/spa 빌드 산출물은 포함)
zip -r deploy.zip . \
    -x "*.git*" \
    -x "*__pycache__*" \
    -x "*.pyc" \
    -x "*.pyo" \
    -x "*.pyd" \
    -x "venv/*" \
    -x ".venv/*" \
    -x "env/*" \
    -x ".env" \
    -x "*.stackdump" \
    -x "deploy.sh" \
    -x "deploy.zip" \
    -x "*.db" \
    -x "frontend/node_modules/*" \
    -x "frontend/.vite/*"

echo ""
echo "✅ deploy.zip 생성 완료!"
echo ""
echo "다음 단계:"
echo "1. AWS EB 콘솔 → 환경 → Upload and Deploy → deploy.zip 업로드"
echo "2. 또는 EB CLI: eb deploy"
