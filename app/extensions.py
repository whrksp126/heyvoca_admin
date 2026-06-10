# app/extensions.py
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

db = SQLAlchemy()
login_manager = LoginManager()

# 로그인 브루트포스 완화 — Cloudflare 뒤이므로 실클라이언트 IP(CF-Connecting-IP) 우선.
def _client_ip():
    from flask import request
    return (request.headers.get('CF-Connecting-IP')
            or (request.headers.get('X-Forwarded-For', '').split(',')[0].strip())
            or get_remote_address())

limiter = Limiter(key_func=_client_ip, default_limits=[])
