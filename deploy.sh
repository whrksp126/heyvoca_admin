#!/bin/bash
# AWS Elastic Beanstalk 배포용 ZIP 파일 생성 스크립트

# 기존 배포 파일 삭제
rm -f deploy.zip

# ZIP 파일 생성 (불필요한 파일 제외)
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
    -x "*.db"

echo ""
echo "✅ deploy.zip 생성 완료!"
echo ""
echo "다음 단계:"
echo "1. AWS EB 콘솔 → 환경 → Upload and Deploy → deploy.zip 업로드"
echo "2. 또는 EB CLI: eb deploy"

