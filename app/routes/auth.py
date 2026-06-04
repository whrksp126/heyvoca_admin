"""
어드민 인증 — Admin 테이블 + Flask-Login 세션.

React SPA 용으로 JSON 응답을 사용한다. 세션 쿠키 기반이므로 React 는 같은 출처
/api/* 호출 시 쿠키만으로 인증된다(토큰/ADMIN_API_KEY 브라우저 노출 없음).
"""
from flask import Blueprint, request, jsonify
from flask_login import login_user, login_required, logout_user, current_user

from app.models.models import Admin

bp = Blueprint('auth', __name__)


@bp.route('/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or request.form
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''

    user = Admin.query.filter(Admin.user_id == username).first()
    if user and user.check_password(password):
        login_user(user)
        return jsonify({'code': 200, 'message': 'ok', 'data': {'user_id': user.user_id}})

    return jsonify({'code': 401, 'message': '아이디 또는 비밀번호를 확인하세요.'}), 401


@bp.route('/logout', methods=['POST', 'GET'])
@login_required
def logout():
    logout_user()
    return jsonify({'code': 200, 'message': 'logged out'})


@bp.route('/me', methods=['GET'])
def me():
    """세션 상태 확인 — 항상 200, authenticated 불리언으로 React 가 로그인 화면 분기."""
    if current_user.is_authenticated:
        return jsonify({'authenticated': True, 'data': {'user_id': current_user.user_id}})
    return jsonify({'authenticated': False})
