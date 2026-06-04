#!/bin/bash

# heyvoca_admin 배포 스크립트
# 사용법: ./deploy.sh [dev|stg|prod]
#
# 배포 방식: 홈서버에서 git pull → docker compose up --build
#   (멀티스테이지 Dockerfile 이 서버에서 node 로 vite 빌드 후 python 런타임 구성)
# local 환경은 별도: docker compose -f docker-compose.local.yml up --build -d
#
# 구 AWS Elastic Beanstalk(zip 업로드) 방식은 폐기됨 — ghmate 홈서버 Docker 로 이전 완료.

ENV=$1

# ─── 서버 접속 정보 ───
SSH_KEY="$HOME/.ssh/ghmate_server"
SSH_USER="ghmate"
SSH_HOST="ghmate.iptime.org"
SSH_PORT="222"
REMOTE_DIR="/srv/projects/heyvoca_admin"

if [[ -z "$ENV" ]]; then
    echo "사용법: ./deploy.sh [dev|stg|prod]"
    exit 1
fi

case $ENV in
    dev)
        COMPOSE_FILE="docker-compose.dev.yml"
        PROJECT_NAME="heyvoca_admin_dev"
        ;;
    stg)
        COMPOSE_FILE="docker-compose.stg.yml"
        PROJECT_NAME="heyvoca_admin_stg"
        ;;
    prod)
        COMPOSE_FILE="docker-compose.yml"
        PROJECT_NAME="heyvoca_admin_prod"
        ;;
    *)
        echo "잘못된 환경입니다: $ENV (dev, stg, prod 중 하나를 입력하세요)"
        exit 1
        ;;
esac

echo ">>> [admin/$ENV] 배포를 시작합니다..."

# 서버에서 git pull → 이미지 빌드 → 재시작
ssh -i "$SSH_KEY" -p "$SSH_PORT" "${SSH_USER}@${SSH_HOST}" "
    set -e
    cd ${REMOTE_DIR}
    echo '>>> git pull...'
    git pull
    echo '>>> docker build & up...'
    # --renew-anon-volumes: dev 의 SPA 익명 볼륨(/app/app/static/spa)이 옛 빌드를 붙들지 않게
    #   매 배포마다 새 이미지의 빌드 산출물로 갱신. (stg/prod 는 익명 볼륨 없어 무해)
    docker compose -p ${PROJECT_NAME} -f ${COMPOSE_FILE} up --build -d --force-recreate --renew-anon-volumes admin
    echo '>>> nginx reload (IP 캐시 갱신)...'
    docker exec nginx_proxy nginx -s reload
"

if [ $? -ne 0 ]; then
    echo ">>> [에러] 배포 실패. SSH 접속 및 서버 상태를 확인하세요."
    exit 1
fi

# ─── 배포 후 헬스체크 (gunicorn 부팅 확인) ───
echo ">>> [admin/$ENV] 컨테이너 부팅 대기 (최대 60초)..."
sleep 8
HEALTH_OUTPUT=$(ssh -i "$SSH_KEY" -p "$SSH_PORT" "${SSH_USER}@${SSH_HOST}" \
    "for i in \$(seq 1 12); do
        out=\$(docker logs heyvoca_admin_${ENV} --tail 200 2>&1)
        if echo \"\$out\" | grep -q 'Starting gunicorn'; then
            echo 'gunicorn 부팅 확인 OK'
            exit 0
        fi
        sleep 5
    done
    echo 'TIMEOUT: gunicorn 부팅 확인 못 함'
    exit 1")
HEALTH_RC=$?

echo "$HEALTH_OUTPUT"

if [ $HEALTH_RC -ne 0 ]; then
    echo ">>> [경고] 컨테이너 부팅 확인 실패. 서버에서 로그를 직접 확인하세요."
else
    echo ">>> [admin/$ENV] 부팅 확인 통과."
fi

echo ">>> [admin/$ENV] 배포 완료!"
