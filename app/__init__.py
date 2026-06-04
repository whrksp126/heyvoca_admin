# app/__init__.py
from flask import Flask, request, jsonify, redirect
from config import Config
from app.extensions import db, login_manager
from uuid import UUID

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    login_manager.init_app(app)

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

    return app
