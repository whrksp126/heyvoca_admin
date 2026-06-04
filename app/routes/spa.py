"""
React SPA 서빙.

빌드 산출물은 app/static/spa/ 에 위치(Vite base='/static/spa/').
- 정적 자산(/static/spa/assets/*)은 Flask 기본 static 라우트(로컬) 또는
  EB staticfiles 매핑(/static → app/static)이 직접 서빙.
- 그 외 모든 클라이언트 라우트(/, /voca-books, /overview ...)는 index.html 을 반환해
  React Router(클라이언트 라우팅)가 처리하도록 한다.

/api, /auth 는 각 블루프린트가 더 구체적인 규칙으로 먼저 매칭되므로 가로채지 않는다.
"""
import os
from flask import Blueprint, current_app, send_from_directory, jsonify

bp = Blueprint('spa', __name__)


def _spa_dir():
    return os.path.join(current_app.static_folder, 'spa')


@bp.route('/', defaults={'path': ''})
@bp.route('/<path:path>')
def serve_spa(path):
    spa_dir = _spa_dir()
    index = os.path.join(spa_dir, 'index.html')
    if not os.path.exists(index):
        return jsonify({
            'code': 500,
            'message': 'SPA 빌드 산출물이 없습니다. heyvoca_admin/frontend 에서 `npm run build` 를 먼저 실행하세요.',
        }), 500
    return send_from_directory(spa_dir, 'index.html')
