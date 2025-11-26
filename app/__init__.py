# app/__init__.py
from flask import Flask, redirect, url_for
from config import Config
from app.extensions import db, login_manager
from uuid import UUID

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'
    login_manager.login_message = '로그인이 필요한 페이지입니다.'

    from app.routes import auth, bookstore, voca
    app.register_blueprint(auth.bp, url_prefix='/auth')
    app.register_blueprint(bookstore.bp, url_prefix='/bookstore')
    app.register_blueprint(voca.bp, url_prefix='/voca')

    from app.models.models import Admin

    @login_manager.user_loader
    def load_user(user_id):
        try:
            # UUID로 변환
            if not isinstance(user_id, UUID):
                user_id = UUID(user_id)
            
            # Admin 계정만 확인 (관리자 페이지)
            return Admin.query.get(user_id)
        except Exception:
            return None

    @login_manager.unauthorized_handler
    def unauthorized():
        # 로그인하지 않은 사용자를 로그인 페이지로 리디렉트
        return redirect(url_for('auth.login'))

    @app.route('/')
    def index():
        # 루트 경로는 bookstore 목록으로 리디렉트
        from flask_login import current_user
        if current_user.is_authenticated:
            return redirect(url_for('bookstore.bookstore_list'))
        else:
            return redirect(url_for('auth.login'))

    return app
