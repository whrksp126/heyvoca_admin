import os
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
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-key-please-change-in-production'
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
    ADMIN_API_KEY = os.environ.get('ADMIN_API_KEY', '')
    GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
    ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY', '')
    OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')


