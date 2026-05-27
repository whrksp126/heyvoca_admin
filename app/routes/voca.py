from flask import Blueprint, render_template, request, jsonify, current_app
from flask_login import login_required
import requests

bp = Blueprint('voca', __name__)


def api(method, path, **kwargs):
    """heyvoca_back admin API 호출 헬퍼"""
    url = current_app.config['BACKEND_URL'] + '/admin' + path
    headers = {'X-Admin-API-Key': current_app.config['ADMIN_API_KEY']}
    resp = getattr(requests, method)(url, headers=headers, **kwargs)
    return resp.json(), resp.status_code


@bp.route('/', methods=['GET'])
@login_required
def voca_list():
    page = request.args.get('page', 1, type=int)
    q = request.args.get('q', '')

    params = {'page': page}
    if q:
        params['q'] = q

    resp, _ = api('get', '/voca', params=params)
    data = resp.get('data', {})
    p = data.get('pagination', {})

    class Pagination:
        def __init__(self, d):
            self.page = d.get('page', 1)
            self.per_page = d.get('per_page', 50)
            self.total = d.get('total', 0)
            self.pages = d.get('pages', 1)
            self.has_prev = d.get('has_prev', False)
            self.has_next = d.get('has_next', False)
            self.prev_num = self.page - 1 if self.has_prev else None
            self.next_num = self.page + 1 if self.has_next else None

        def iter_pages(self, left_edge=2, left_current=2, right_current=3, right_edge=2):
            last = 0
            for num in range(1, self.pages + 1):
                if num <= left_edge or \
                   (num > self.page - left_current - 1 and num < self.page + right_current) or \
                   num > self.pages - right_edge:
                    if last + 1 != num:
                        yield None
                    yield num
                    last = num

    return render_template('voca_list.html',
                           vocas=data.get('vocas', []),
                           pagination=Pagination(p),
                           search=q)


@bp.route('/api/voca/<int:voca_id>', methods=['GET'])
@login_required
def get_voca(voca_id):
    resp, status = api('get', f'/voca/{voca_id}')
    if resp.get('code') == 200:
        return jsonify({'success': True, 'voca': resp['data']})
    return jsonify({'success': False}), status


@bp.route('/api/voca/<int:voca_id>', methods=['PATCH'])
@login_required
def update_voca(voca_id):
    resp, status = api('patch', f'/voca/{voca_id}', json=request.json)
    if resp.get('code') == 200:
        return jsonify({'success': True})
    return jsonify({'success': False, 'error': resp.get('message', '오류 발생')}), status


@bp.route('/api/voca/<int:voca_id>/hide', methods=['PATCH'])
@login_required
def hide_voca(voca_id):
    resp, status = api('patch', f'/voca/{voca_id}/hide')
    if resp.get('code') == 200:
        return jsonify({'success': True})
    return jsonify({'success': False}), status


@bp.route('/api/voca/<int:voca_id>/show', methods=['PATCH'])
@login_required
def show_voca(voca_id):
    resp, status = api('patch', f'/voca/{voca_id}/show')
    if resp.get('code') == 200:
        return jsonify({'success': True})
    return jsonify({'success': False}), status
