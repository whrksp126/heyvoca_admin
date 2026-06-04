"""
AI 단어 생성 — OpenAI(gpt-4o-mini) 호출 로직.

기존 bookstore.py 의 _build_condition_text / _call_openai / _deduplicate / ai_generate_words
를 그대로 이전(보존). 단어 GENERATION 은 heyvoca_admin 내부에서 수행하고,
실제 단어장 저장은 /api/admin_voca_book/from_ai (프록시 → heyvoca_back) 가 담당한다.

엔드포인트: POST /api/ai/generate_words  (세션 인증 필요)
"""
import json
import re

from flask import Blueprint, request, jsonify, current_app
from flask_login import login_required
from openai import OpenAI

bp = Blueprint('ai', __name__, url_prefix='/api/ai')


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


@bp.route('/generate_words', methods=['POST'])
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
