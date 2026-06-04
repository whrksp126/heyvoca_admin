"""
heyvoca_back /admin/* 제너릭 프록시.

React SPA(같은 출처)에서 /api/<path> 로 호출하면, 세션 인증(@login_required)을
통과한 요청만 heyvoca_back 의 /admin/<path> 로 X-Admin-API-Key 를 주입해 전달한다.
→ ADMIN_API_KEY 는 브라우저에 절대 노출되지 않는다 (기존 thin-client 보안 모델 유지).

GET/POST/PATCH/PUT/DELETE + multipart(엑셀 업로드) 지원.
주의: /api/ai/* 는 ai 블루프린트가 먼저 매칭한다(정적 규칙 우선).
"""
import requests
from flask import Blueprint, request, jsonify, current_app, Response
from flask_login import login_required

bp = Blueprint('api_proxy', __name__, url_prefix='/api')

# 백엔드 응답을 그대로 흘려보낼 때 제외할 hop-by-hop 헤더
_EXCLUDED_RESP_HEADERS = {
    'content-encoding', 'content-length', 'transfer-encoding', 'connection',
}


@bp.route('/<path:subpath>', methods=['GET', 'POST', 'PATCH', 'PUT', 'DELETE'])
@login_required
def proxy(subpath):
    backend = current_app.config['BACKEND_URL'].rstrip('/')
    url = f'{backend}/admin/{subpath}'
    headers = {'X-Admin-API-Key': current_app.config['ADMIN_API_KEY']}
    method = request.method.lower()

    kwargs = {'params': request.args, 'headers': headers, 'timeout': 120}

    if request.files:
        # 엑셀 등 multipart 업로드 — 파일 + 폼 필드 함께 전달
        files = {
            key: (f.filename, f.stream, f.content_type)
            for key, f in request.files.items()
        }
        kwargs['files'] = files
        kwargs['data'] = request.form.to_dict()
    elif request.is_json:
        kwargs['json'] = request.get_json(silent=True)
    elif request.form:
        kwargs['data'] = request.form.to_dict()

    try:
        resp = getattr(requests, method)(url, **kwargs)
    except requests.RequestException as e:
        current_app.logger.error(f'[proxy] {method.upper()} {url} 실패: {e}')
        return jsonify({'code': 502, 'message': f'백엔드 연결 실패 ({e})'}), 502

    resp_headers = [
        (k, v) for k, v in resp.headers.items()
        if k.lower() not in _EXCLUDED_RESP_HEADERS
    ]
    return Response(resp.content, status=resp.status_code, headers=resp_headers)
