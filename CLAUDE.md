# CLAUDE.md — heyvoca_admin

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

heyvoca 어드민 (Flask 3 백엔드 + React SPA 프론트). 자체 비즈니스 로직은 거의 없고, heyvoca_back의 `/admin/*` API를 호출하는 thin client (Flask 프록시가 `X-Admin-API-Key` 주입 → 키 브라우저 비노출). **배포는 ghmate 홈서버 Docker (dev/stg/prod) — `./deploy.sh dev|stg|prod`.**

> ⚠️ 과거 AWS Elastic Beanstalk + Jinja2 SSR 였으나 2026-06 에 **React SPA 전환 + 홈서버 Docker 이전 완료**. EB/Jinja2/zip 배포는 폐기. (`application.py`/`.ebextensions/`/`deploy.zip` 등은 잔재 — 배포 경로 아님)

---

## Commands

```bash
# 로컬 (docker) — 컨테이너 heyvoca_admin_local (포트 5101)
#   프론트는 host 에서 `cd frontend && npm run build` 후 볼륨 마운트
docker compose -f docker-compose.local.yml up --build -d

# 배포 (홈서버 docker — heyvoca_service 와 동일 방식: SSH → git pull → up --build)
./deploy.sh dev
./deploy.sh stg
./deploy.sh prod
```

---

## Architecture

Flask 3.0 + SQLAlchemy 2.0 + Flask-Login (인증/세션) + **React SPA(`frontend/`, Vite+Tailwind)**. Flask 는 ① 세션 인증(`/auth/*`) ② 보안 프록시(`/api/<path>`→heyvoca_back `/admin/<path>`, X-Admin-API-Key 주입) ③ SPA 서빙(catch-all→`app/static/spa/index.html`) 담당. Jinja2 SSR 아님(폐기).

### 진입점

| 파일 | 용도 |
|------|------|
| `run.py` | 로컬 진입점 (`app.run(debug=True)`) |
| `application.py` | EB WSGI 진입점 (`application = create_app()` 객체명 고정 — `.ebextensions/01_flask.config`의 `WSGIPath: application:application`) |

### 디렉토리 구조

```
heyvoca_admin/
├── app/
│   ├── __init__.py          # Flask 앱 팩토리 (create_app), Blueprint 등록, login_manager.user_loader
│   ├── extensions.py        # db, login_manager 싱글톤
│   ├── models/
│   │   └── models.py        # Admin / User / Level 등 (BinaryUUID PK, heyvoca_back과 schema 공유)
│   ├── routes/
│   │   ├── auth.py          # /auth/login, /auth/logout (Admin.check_password)
│   │   ├── bookstore.py     # /bookstore, /bookstore/voca_books (OpenAI 호출 포함)
│   │   └── voca.py          # /voca (단어 CRUD, heyvoca_back /admin/voca 프록시)
│   ├── templates/           # Jinja2 (base.html + bookstore_list / voca_list / voca_books_list / login + modals/)
│   └── static/js/
├── .ebextensions/
│   ├── 01_flask.config      # WSGIPath, /static 매핑
│   └── 02_python.config     # FLASK_ENV=production
├── config.py                # Config (DATABASE_URL, BACKEND_URL, ADMIN_API_KEY, *_API_KEY)
├── run.py / application.py
├── requirements.txt
└── deploy.sh                # deploy.zip 빌드
```

### 인증 흐름

`Admin` 테이블(BinaryUUID PK, `user_id` + `password` 해시) + Flask-Login. `auth/login`에서 `Admin.query.filter(Admin.user_id == username).first()` → `check_password_hash` → `login_user(user)`. 비로그인 사용자는 `unauthorized_handler`가 `/auth/login`으로 리디렉트.

### heyvoca_back 호출 패턴

`app/routes/voca.py`와 `app/routes/bookstore.py`에 동일한 `api()` 헬퍼:

```python
def api(method, path, **kwargs):
    url = current_app.config['BACKEND_URL'] + '/admin' + path
    headers = {'X-Admin-API-Key': current_app.config['ADMIN_API_KEY']}
    resp = getattr(requests, method)(url, headers=headers, **kwargs)
    return resp.json(), resp.status_code
```

새 admin 기능 추가 시 이 패턴 그대로 사용. 단어/단어장/서점 데이터는 직접 SQLAlchemy로 만지지 말고 백엔드 `/admin/*` 통해 처리.

---

## 환경변수 (`.env`)

```
SECRET_KEY=...
DATABASE_URL=mysql+pymysql://voca:voca!@34@localhost:3310/heyvoca
# 또는 DB_USER/DB_PASSWORD/DB_HOST/DB_PORT/DB_NAME 개별 지정 (config.py가 둘 다 지원)
BACKEND_URL=http://localhost:5100        # heyvoca_back
ADMIN_API_KEY=...                        # 백엔드 /admin/* 인증 헤더값
OPENAI_API_KEY=...
GEMINI_API_KEY=...
ANTHROPIC_API_KEY=...
```

- 로컬 DB 포트 기본 `3310` (heyvoca_service local docker-compose와 동일)
- `.env`는 gitignore. EB 배포에서는 EB 콘솔 환경변수로 주입

---

## DB

- heyvoca_back과 **동일한 `heyvoca` schema 공유**
- 스키마 변경은 반드시 `heyvoca_service/heyvoca_back/migrations/`에서 Flask-Migrate로 (루트 `.claude/rules/db-migration.md` 참조)
- admin 레포에서는 schema 변경 금지. `admin` 테이블만 어드민 전용

---

## 배포 (홈서버 Docker)

heyvoca_service 와 동일하게 ghmate 홈서버 Docker 로 dev/stg/prod 운영. `deploy.sh` 가 SSH → git pull → 빌드까지 자동.

```bash
./deploy.sh dev    # SSH → /srv/projects/heyvoca_admin git pull → docker compose -p heyvoca_admin_dev up --build -d admin → nginx reload → 부팅 헬스체크
./deploy.sh stg
./deploy.sh prod   # compose 파일은 docker-compose.yml
```

- 서버 경로: `/srv/projects/heyvoca_admin` (git `main`)
- 컨테이너: `heyvoca_admin_{dev,stg,prod}` (gunicorn `run:app`, 내부 :5000), 글로벌 `nginx_proxy` 네트워크 조인
- 도메인: `dev-heyvoca-admin` / `stg-heyvoca-admin` / `heyvoca-admin.ghmate.com` (nginx-proxy/conf.d/heyvoca.conf)
- 멀티스테이지 Dockerfile 이 **서버에서** node 로 vite 빌드 후 python 런타임 구성 (로컬 npm 빌드 불필요)
- SSH: `ssh -i ~/.ssh/ghmate_server -p 222 ghmate@ghmate.iptime.org`

---

## 알아두면 좋은 것 (non-obvious)

- 비즈니스 로직 99%는 `heyvoca_back /admin/*` 호출 — 라우트 파일이 얇음. 데이터 변경 로직은 백엔드 쪽 admin blueprint에서 찾아야 함
- admin API 인증은 `X-Admin-API-Key` 헤더. heyvoca_back에 `X-Admin-Token` 흔적도 보이는데 실제 호출 시 어떤 헤더를 쓰는지 코드 직접 확인
- gunicorn 진입점은 `run:app` (Dockerfile/compose CMD). `application.py`(구 EB `application` 객체)는 잔재 — 현재 배포 경로 아님
- `deploy.zip`, `bash.exe.stackdump`, `.ebextensions/` 는 구 EB 잔재 (배포와 무관) — 작업 중 덮어쓰지 않도록 주의
- `Admin` 모델은 `is_active`/`is_authenticated`를 메소드로 정의 (Flask-Login은 보통 property 기대) — 동작은 하지만 손볼 일 있으면 인지
- `config.py`의 `_build_db_url()`은 `DATABASE_URL` 비밀번호에 미인코딩 `@`가 있으면 None 반환하고 개별 env로 폴백
