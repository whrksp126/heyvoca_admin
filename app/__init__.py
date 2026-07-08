# app/__init__.py
import os
from flask import Flask, request, jsonify, redirect
from config import Config
from app.extensions import db, login_manager, limiter
from uuid import UUID


def _seed_local_admin(app):
    """로컬 온보딩 전용(SEED_LOCAL_ADMIN=1): admin 테이블 보장 + 기본 콘솔 계정 시드.

    - 신규/기존 팀원 누구나 컨테이너만 뜨면 로그인 가능하도록 idempotent 하게 동작.
    - 계정은 SEED_ADMIN_USER/SEED_ADMIN_PASSWORD(기본 admin/admin!@34)로 1회 생성.
    - dev/stg/prod 는 이 플래그가 없어 절대 실행되지 않음(하드코딩 계정 유출 방지).
    """
    from sqlalchemy.exc import IntegrityError
    from app.models.models import Admin
    user_id = os.environ.get('SEED_ADMIN_USER', 'admin')
    password = os.environ.get('SEED_ADMIN_PASSWORD', 'admin!@34')
    with app.app_context():
        try:
            # admin 테이블만 정확히 생성(이미 있으면 skip). 다른 모델 테이블은 건드리지 않음.
            Admin.__table__.create(db.engine, checkfirst=True)
            if not Admin.query.filter_by(user_id=user_id).first():
                db.session.add(Admin(user_id, password))
                db.session.commit()
                app.logger.info(f"[seed] 로컬 admin 계정 생성: {user_id}")
        except IntegrityError:
            db.session.rollback()  # 멀티 워커 레이스(다른 워커가 먼저 생성) — 정상
        except Exception as e:
            db.session.rollback()
            app.logger.warning(f"[seed] 로컬 admin 시드 skip: {e}")

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    login_manager.init_app(app)
    limiter.init_app(app)

    # 블루프린트 등록
    #   auth      : Admin 세션 로그인/로그아웃 (JSON)
    #   ai        : OpenAI 단어 생성 (/api/ai/*)
    #   api_proxy : heyvoca_back /admin/* 제너릭 프록시 (/api/*)
    #   spa       : React SPA catch-all (마지막)
    from app.routes import auth, ai, api_proxy, spa
    app.register_blueprint(auth.bp, url_prefix='/auth')
    app.register_blueprint(ai.bp)
    app.register_blueprint(api_proxy.bp)
    app.register_blueprint(spa.bp)

    from app.models.models import Admin

    @login_manager.user_loader
    def load_user(user_id):
        try:
            if not isinstance(user_id, UUID):
                user_id = UUID(user_id)
            return Admin.query.get(user_id)
        except Exception:
            return None

    @login_manager.unauthorized_handler
    def unauthorized():
        # API(XHR)는 401 JSON, 그 외는 SPA 루트로 (React 가 로그인 화면 표시)
        if request.path.startswith('/api'):
            return jsonify({'code': 401, 'message': 'Unauthorized'}), 401
        return redirect('/')

    # 로컬 온보딩: admin 콘솔 계정 자동 시드 (local 전용 플래그)
    if os.environ.get('SEED_LOCAL_ADMIN') == '1':
        _seed_local_admin(app)

    return app
