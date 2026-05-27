from flask import Blueprint, render_template, request, jsonify, current_app
from flask_login import login_required
from datetime import datetime
import requests
import json
import time
import re
from openai import OpenAI

bp = Blueprint('bookstore', __name__)


def api(method, path, **kwargs):
    """heyvoca_back admin API 호출 헬퍼"""
    url = current_app.config['BACKEND_URL'] + '/admin' + path
    headers = {'X-Admin-API-Key': current_app.config['ADMIN_API_KEY']}
    resp = getattr(requests, method)(url, headers=headers, **kwargs)
    return resp.json(), resp.status_code


# ──────────────────────────────────────────
# 페이지 렌더링
# ──────────────────────────────────────────

@bp.route('/', methods=['GET'])
@login_required
def bookstore_list():
    bookstores_resp, _ = api('get', '/bookstore')
    levels_resp, _ = api('get', '/level')
    categories_resp, _ = api('get', '/category')

    bookstores = bookstores_resp.get('data', [])
    for b in bookstores:
        if b.get('created_at'):
            b['created_at'] = datetime.fromisoformat(b['created_at'])
        if b.get('updated_at'):
            b['updated_at'] = datetime.fromisoformat(b['updated_at'])
        # 템플릿 호환성
        b['category_id_value'] = b.get('category_id')
        b['category_list'] = b.get('category_name', '-')
        b['voca_book'] = None  # 템플릿에서 voca_book.book_nm 사용
    levels = levels_resp.get('data', [])
    categories = categories_resp.get('data', [])

    return render_template('bookstore_list.html',
                           bookstores=bookstores,
                           levels=levels,
                           categories=categories)


@bp.route('/voca_books', methods=['GET'])
@login_required
def voca_books_list():
    page = request.args.get('page', 1, type=int)
    per_page = 12
    search = request.args.get('search', '')
    category = request.args.get('category', '')
    status = request.args.get('status', '')

    params = {}
    if search:
        params['search'] = search
    if category:
        params['category'] = category

    voca_books_resp, _ = api('get', '/voca_books', params=params)
    levels_resp, _ = api('get', '/level')
    categories_resp, _ = api('get', '/category')

    data = voca_books_resp.get('data', {})
    legacy_books = data.get('legacy', [])
    admin_books = data.get('admin', [])

    all_books = legacy_books + admin_books
    all_books.sort(key=lambda x: x.get('updated_at') or '', reverse=True)

    if status == 'registered':
        all_books = [b for b in all_books if b.get('is_registered')]
    elif status == 'unregistered':
        all_books = [b for b in all_books if not b.get('is_registered')]

    total = len(all_books)
    start = (page - 1) * per_page
    voca_books = all_books[start:start + per_page]

    class Pagination:
        def __init__(self, page, per_page, total, items):
            self.page = page
            self.per_page = per_page
            self.total = total
            self.items = items
            self.pages = (total + per_page - 1) // per_page if total > 0 else 1
            self.has_prev = page > 1
            self.has_next = page < self.pages
            self.prev_num = page - 1 if self.has_prev else None
            self.next_num = page + 1 if self.has_next else None

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

    pagination = Pagination(page, per_page, total, voca_books)

    return render_template('voca_books_list.html',
                           voca_books=voca_books,
                           pagination=pagination,
                           search=search,
                           category=category,
                           status=status,
                           levels=levels_resp.get('data', []),
                           categories=categories_resp.get('data', []))


# ──────────────────────────────────────────
# Bookstore API
# ──────────────────────────────────────────

@bp.route('/api/bookstore', methods=['POST'])
@login_required
def create_bookstore():
    resp, status = api('post', '/bookstore', json=request.json)
    if resp.get('code') == 200:
        return jsonify({'success': True, 'id': resp['data']['id']})
    return jsonify({'success': False, 'error': resp.get('message', '오류 발생')}), status


@bp.route('/api/bookstore/<int:bookstore_id>', methods=['PATCH'])
@login_required
def update_bookstore(bookstore_id):
    resp, status = api('patch', f'/bookstore/{bookstore_id}', json=request.json)
    if resp.get('code') == 200:
        return jsonify({'success': True})
    return jsonify({'success': False, 'error': resp.get('message', '오류 발생')}), status


@bp.route('/api/bookstore/<int:bookstore_id>', methods=['DELETE'])
@login_required
def delete_bookstore(bookstore_id):
    resp, status = api('delete', f'/bookstore/{bookstore_id}')
    if resp.get('code') == 200:
        return jsonify({'success': True, 'message': resp['data']['message']})
    return jsonify({'success': False, 'error': resp.get('message', '오류 발생')}), status


# ──────────────────────────────────────────
# VocaBook API
# ──────────────────────────────────────────

@bp.route('/api/voca_book', methods=['POST'])
@login_required
def create_voca_book():
    files = {}
    if 'excel_file' in request.files:
        f = request.files['excel_file']
        files['excel_file'] = (f.filename, f.stream, f.content_type)

    resp, status = api('post', '/voca_book', data=request.form, files=files)
    if resp.get('code') == 200:
        return jsonify({'success': True, 'id': resp['data']['id'], 'word_count': resp['data']['word_count'],
                        'message': f"단어장이 생성되었습니다. ({resp['data']['word_count']}개 단어)"})
    return jsonify({'success': False, 'error': resp.get('message', '오류 발생')}), status


@bp.route('/api/voca_book/<int:voca_book_id>', methods=['PATCH'])
@login_required
def update_voca_book(voca_book_id):
    resp, status = api('patch', f'/voca_book/{voca_book_id}', json=request.json)
    if resp.get('code') == 200:
        return jsonify({'success': True})
    return jsonify({'success': False, 'error': resp.get('message', '오류 발생')}), status


@bp.route('/voca_book/<int:voca_book_id>/words', methods=['GET'])
@login_required
def voca_book_words(voca_book_id):
    params = {'page': request.args.get('page', 1), 'per_page': request.args.get('per_page', 50)}
    resp, _ = api('get', f'/voca_book/{voca_book_id}/words', params=params)
    data = resp.get('data', {})
    return jsonify({'success': True, **data})


@bp.route('/api/voca_book/<int:voca_book_id>/word', methods=['POST'])
@login_required
def add_word_to_book(voca_book_id):
    resp, status = api('post', f'/voca_book/{voca_book_id}/word', json=request.json)
    if resp.get('code') == 200:
        return jsonify({'success': True, 'message': resp['data']['message']})
    return jsonify({'success': False, 'error': resp.get('message', '오류 발생')}), status


@bp.route('/api/voca_book/<int:voca_book_id>/word/<int:voca_id>', methods=['DELETE'])
@login_required
def remove_word_from_book(voca_book_id, voca_id):
    resp, status = api('delete', f'/voca_book/{voca_book_id}/word/{voca_id}')
    if resp.get('code') == 200:
        return jsonify({'success': True, 'message': resp['data']['message']})
    return jsonify({'success': False, 'error': resp.get('message', '오류 발생')}), status


# ──────────────────────────────────────────
# AdminVocaBook API
# ──────────────────────────────────────────

@bp.route('/api/admin_voca_book', methods=['POST'])
@login_required
def create_admin_voca_book():
    files = {}
    if 'excel_file' in request.files:
        f = request.files['excel_file']
        files['excel_file'] = (f.filename, f.stream, f.content_type)

    resp, status = api('post', '/admin_voca_book', data=request.form, files=files)
    if resp.get('code') == 200:
        return jsonify({'success': True, 'id': resp['data']['id'], 'word_count': resp['data']['word_count'],
                        'message': f"단어장이 생성되었습니다. ({resp['data']['word_count']}개 단어)"})
    return jsonify({'success': False, 'error': resp.get('message', '오류 발생')}), status


@bp.route('/api/admin_voca_book/<int:admin_voca_book_id>', methods=['PATCH'])
@login_required
def update_admin_voca_book(admin_voca_book_id):
    resp, status = api('patch', f'/admin_voca_book/{admin_voca_book_id}', json=request.json)
    if resp.get('code') == 200:
        return jsonify({'success': True})
    return jsonify({'success': False, 'error': resp.get('message', '오류 발생')}), status


@bp.route('/admin_voca_book/<int:admin_voca_book_id>/words', methods=['GET'])
@login_required
def admin_voca_book_words(admin_voca_book_id):
    params = {'page': request.args.get('page', 1), 'per_page': request.args.get('per_page', 50)}
    resp, _ = api('get', f'/admin_voca_book/{admin_voca_book_id}/words', params=params)
    data = resp.get('data', {})
    return jsonify({'success': True, **data})


@bp.route('/api/admin_voca_book/<int:admin_voca_book_id>/word', methods=['POST'])
@login_required
def add_word_to_admin_book(admin_voca_book_id):
    resp, status = api('post', f'/admin_voca_book/{admin_voca_book_id}/word', json=request.json)
    if resp.get('code') == 200:
        return jsonify({'success': True, 'message': resp['data']['message']})
    return jsonify({'success': False, 'error': resp.get('message', '오류 발생')}), status


@bp.route('/api/admin_voca_book/<int:admin_voca_book_id>/word/<int:voca_id>', methods=['DELETE'])
@login_required
def remove_word_from_admin_book(admin_voca_book_id, voca_id):
    resp, status = api('delete', f'/admin_voca_book/{admin_voca_book_id}/word/{voca_id}')
    if resp.get('code') == 200:
        return jsonify({'success': True, 'message': resp['data']['message']})
    return jsonify({'success': False, 'error': resp.get('message', '오류 발생')}), status


# ──────────────────────────────────────────
# AI 단어 생성
# ──────────────────────────────────────────

def _build_condition_text(book_nm, category, situation):
    parts = []
    if category:
        parts.append(f'카테고리: {category}')
    if situation:
        parts.append(f'주제/상황: {situation}')
    if book_nm:
        parts.append(f'단어장 이름: {book_nm}')
    return '\n'.join(parts) if parts else '일반 영어 어휘'


def _call_openai(client, count, condition_text, exclude_words=None):
    exclude_text = ''
    if exclude_words:
        exclude_text = f'\n다음 단어는 제외하세요: {", ".join(exclude_words)}'

    prompt = f"""당신은 영어 단어장을 만드는 전문가입니다.
다음 조건에 맞는 영어 단어 {count}개를 생성해주세요.
{condition_text}{exclude_text}

반드시 아래 JSON 배열 형식으로만 응답하세요. 중복 없이 정확히 {count}개, 다른 텍스트 없이 JSON만 출력하세요:
[
  {{
    "word": "영단어",
    "meanings": ["한국어 뜻1", "한국어 뜻2"],
    "examples": [{{"en": "영문 예문", "ko": "한국어 해석"}}]
  }}
]"""

    response = client.chat.completions.create(
        model='gpt-4o-mini',
        messages=[{'role': 'user', 'content': prompt}],
        temperature=0.7,
        max_tokens=16384,
    )
    print(f'[AI] model={response.model}, tokens={response.usage.total_tokens}')
    text = response.choices[0].message.content.strip()
    match = re.search(r'\[.*\]', text, re.DOTALL)
    if match:
        text = match.group(0)
    return json.loads(text.strip())


def _deduplicate(words):
    seen = set()
    result = []
    for w in words:
        key = w.get('word', '').strip().lower()
        if key and key not in seen:
            seen.add(key)
            result.append(w)
    return result


@bp.route('/api/ai/generate_words', methods=['POST'])
@login_required
def ai_generate_words():
    data = request.json or {}
    book_nm = data.get('book_nm', '')
    word_count = min(int(data.get('word_count', 10)), 150)
    category = data.get('category', '')
    situation = data.get('situation', '')

    api_key = current_app.config.get('OPENAI_API_KEY', '')
    if not api_key:
        return jsonify({'success': False, 'error': 'OpenAI API 키가 설정되지 않았습니다.'}), 500

    condition_text = _build_condition_text(book_nm, category, situation)
    client = OpenAI(api_key=api_key)

    try:
        # 여유분 20% 더 요청해서 중복 제거 후 부족하면 보완
        buffer_count = min(int(word_count * 1.2) + 3, 150)
        words = _deduplicate(_call_openai(client, buffer_count, condition_text))

        if len(words) < word_count:
            existing = [w['word'] for w in words]
            needed = word_count - len(words)
            extra = _deduplicate(_call_openai(client, needed + 3, condition_text, exclude_words=existing))
            existing_lower = {w.lower() for w in existing}
            words += [w for w in extra if w.get('word', '').lower() not in existing_lower]

        words = words[:word_count]

    except json.JSONDecodeError:
        return jsonify({'success': False, 'error': 'AI 응답 형식이 불안정합니다. 다시 시도해주세요.'}), 502
    except Exception as e:
        return jsonify({'success': False, 'error': f'AI 생성 중 오류가 발생했습니다: {str(e)}'}), 502

    return jsonify({'success': True, 'words': words})


@bp.route('/api/admin_voca_book/from_ai', methods=['POST'])
@login_required
def create_admin_voca_book_from_ai():
    resp, status = api('post', '/admin_voca_book/from_ai', json=request.json)
    if resp.get('code') == 200:
        word_count = resp['data']['word_count']
        return jsonify({
            'success': True,
            'id': resp['data']['id'],
            'word_count': word_count,
            'message': f'단어장이 생성되었습니다. ({word_count}개 단어)'
        })
    return jsonify({'success': False, 'error': resp.get('message', '단어장 생성 실패')}), status


# ──────────────────────────────────────────
# Voca autocomplete (bookstore 페이지에서 사용)
# ──────────────────────────────────────────

@bp.route('/api/voca/autocomplete', methods=['GET'])
@login_required
def voca_autocomplete():
    resp, _ = api('get', '/voca/autocomplete', params={'q': request.args.get('q', '')})
    return jsonify({'success': True, 'words': resp.get('data', [])})


# ──────────────────────────────────────────
# Strong 태그 삽입 (AdminVocaBook)
# ──────────────────────────────────────────

@bp.route('/api/admin_voca_book/<int:admin_voca_book_id>/tag_examples', methods=['POST'])
@login_required
def tag_admin_voca_book_examples(admin_voca_book_id):
    resp, status = api('post', f'/admin_voca_book/{admin_voca_book_id}/tag_examples')
    if resp.get('code') == 200:
        return jsonify({'success': True, 'results': resp['data']['results']})
    return jsonify({'success': False, 'error': resp.get('message', '오류 발생')}), status


@bp.route('/api/admin_voca_book/<int:admin_voca_book_id>/save_tagged_examples', methods=['PATCH'])
@login_required
def save_tagged_admin_voca_book_examples(admin_voca_book_id):
    resp, status = api('patch', f'/admin_voca_book/{admin_voca_book_id}/save_tagged_examples', json=request.json)
    if resp.get('code') == 200:
        return jsonify({'success': True})
    return jsonify({'success': False, 'error': resp.get('message', '오류 발생')}), status
