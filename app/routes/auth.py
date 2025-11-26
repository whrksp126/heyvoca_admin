from flask import Blueprint, render_template, redirect, url_for, request, flash, jsonify
from flask_login import login_user, login_required, logout_user
from app.models.models import User, Admin
from app.extensions import db

from werkzeug.security import check_password_hash


bp = Blueprint('auth', __name__)

@bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        user = Admin.query.filter(Admin.user_id == username).first()

        if user and user.check_password(password):
            login_user(user)
            return redirect(url_for('bookstore.bookstore_list'))
        else:
            error = '로그인 실패. 아이디 또는 비밀번호를 확인하세요.'
            return render_template('login.html', error=error)
    return render_template('login.html')

@bp.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('auth.login'))

@bp.route('/protected')
@login_required
def protected():
    return '로그인된 사용자만 볼 수 있는 페이지입니다.' 