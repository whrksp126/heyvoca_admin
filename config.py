import os
import secrets
import logging
from datetime import timedelta
from dotenv import load_dotenv
from sqlalchemy.engine import URL

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, '.env'))

def _build_db_url():
    raw = os.environ.get('DATABASE_URL')
    if not raw:
        return None
    # 잘못 인코딩된 URL(예: 비밀번호의 '@' 미인코딩) 방어
    try:
        from sqlalchemy.engine import make_url
        parsed = make_url(raw)
        if parsed.host and '@' in parsed.host:
            return None
        return parsed
    except Exception:
        return None

class Config:
    # 세션 서명 키 — 알려진 하드코딩 기본값('dev-key...')을 제거(세션 위조 방지).
    # 환경변수 SECRET_KEY가 없으면 기동 시 랜덤 생성(안전하지만 재시작마다 세션 초기화)
    #  + 경고. 운영에서는 반드시 .env에 고정값을 둘 것.
    SECRET_KEY = os.environ.get('SECRET_KEY')
    if not SECRET_KEY:
        logging.getLogger(__name__).warning(
            'SECRET_KEY 미설정 → 임시 랜덤 키 사용(재시작 시 모든 세션 만료). .env에 SECRET_KEY를 설정하세요.'
        )
        SECRET_KEY = secrets.token_hex(32)

    SQLALCHEMY_DATABASE_URI = _build_db_url() or URL.create(
        drivername='mysql+pymysql',
        username=os.environ.get('DB_USER', 'voca'),
        password=os.environ.get('DB_PASSWORD', 'voca!@34'),
        host=os.environ.get('DB_HOST', 'localhost'),
        port=int(os.environ.get('DB_PORT', 3310)),
        database=os.environ.get('DB_NAME', 'heyvoca'),
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    BACKEND_URL = os.environ.get('BACKEND_URL', 'http://localhost:5100')

    # 세션 쿠키 보안 — HttpOnly(XSS로 쿠키 탈취 방지), SameSite=Lax(CSRF 완화), 12h 만료.
    # Secure는 HTTPS 환경에서만 — 로컬은 HTTP(localhost:5101)라 켜면 쿠키가 전송 안 돼
    # 로그인이 깨진다. 서버(dev/stg/prod)는 BACKEND_URL이 https라 자동으로 켜진다.
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    SESSION_COOKIE_SECURE = os.environ.get('BACKEND_URL', '').startswith('https')
    PERMANENT_SESSION_LIFETIME = timedelta(hours=12)
    ADMIN_API_KEY = os.environ.get('ADMIN_API_KEY', '')
    GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
    ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY', '')
    OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')


