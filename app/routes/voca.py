from flask import Blueprint, render_template, request, jsonify
from flask_login import login_required
from app.models.models import Voca, VocaMeaning, VocaExample, VocaMeaningMap, VocaExampleMap
from app import db

bp = Blueprint('voca', __name__)

@bp.route('/', methods=['GET'])
@login_required
def voca_list():
    page = request.args.get('page', 1, type=int)
    per_page = 50  # 한 페이지당 50개 단어
    q = request.args.get('q')
    
    query = Voca.query
    if q:
        query = query.filter(Voca.word.ilike(f"%{q}%"))
    
    # 페이지네이션 추가
    pagination = query.order_by(Voca.word).paginate(
        page=page,
        per_page=per_page,
        error_out=False
    )
    
    return render_template('voca_list.html', 
                         vocas=pagination.items,
                         pagination=pagination,
                         search=q or '')

@bp.route('/api/voca/<int:voca_id>', methods=['GET'])
@login_required
def get_voca(voca_id):
    """단어 상세 정보 조회 (뜻, 예문 포함)"""
    voca = Voca.query.get_or_404(voca_id)

    # 뜻 목록
    meanings = []
    for meaning_map in voca.voca_meanings:
        meanings.append({
            'id': meaning_map.meaning.id,
            'meaning': meaning_map.meaning.meaning
        })
    
    # 예문 목록
    examples = []
    for example_map in voca.voca_examples:
        examples.append({
            'id': example_map.example.id,
            'exam_en': example_map.example.exam_en or '',
            'exam_ko': example_map.example.exam_ko or ''
        })
    
    return jsonify({
        'success': True,
        'voca': {
            'id': voca.id,
            'word': voca.word,
            'pronunciation': voca.pronunciation or '',
            'verb_forms': voca.verb_forms or '',
            'level': voca.level or '',
            'meanings': meanings,
            'examples': examples
        }
    })

@bp.route('/api/voca/<int:voca_id>', methods=['PATCH'])
@login_required
def update_voca(voca_id):
    data = request.json
    voca = Voca.query.get_or_404(voca_id)
    
    # 기본 정보 업데이트
    voca.word = data.get('word', voca.word)
    voca.pronunciation = data.get('pronunciation', voca.pronunciation)
    voca.verb_forms = data.get('verb_forms', voca.verb_forms)
    if 'level' in data:
        voca.level = data.get('level') if data.get('level') else None
    
    # 뜻 업데이트
    if 'meanings' in data:
        # 기존 뜻 관계 삭제
        VocaMeaningMap.query.filter_by(voca_id=voca_id).delete()
        
        # 새 뜻 추가
        for meaning_data in data['meanings']:
            meaning_text = meaning_data.get('meaning', '').strip()
            if not meaning_text:
                continue
            
            # 항상 새로운 뜻 생성 (기존 뜻은 다른 단어에서 사용될 수 있으므로 수정하지 않음)
            meaning = VocaMeaning(meaning=meaning_text)
            db.session.add(meaning)
            db.session.flush()
            
            # 관계 생성
            meaning_map = VocaMeaningMap(voca_id=voca_id, meaning_id=meaning.id)
            db.session.add(meaning_map)
    
    # 예문 업데이트
    if 'examples' in data:
        # 기존 예문 관계 삭제
        VocaExampleMap.query.filter_by(voca_id=voca_id).delete()
        
        # 새 예문 추가
        for example_data in data['examples']:
            exam_en = example_data.get('exam_en', '').strip()
            exam_ko = example_data.get('exam_ko', '').strip()
            
            if not exam_en and not exam_ko:
                continue
            
            # 항상 새로운 예문 생성 (기존 예문은 다른 단어에서 사용될 수 있으므로 수정하지 않음)
            example = VocaExample(exam_en=exam_en if exam_en else None, exam_ko=exam_ko if exam_ko else None)
            db.session.add(example)
            db.session.flush()
            
            # 관계 생성
            example_map = VocaExampleMap(voca_id=voca_id, example_id=example.id)
            db.session.add(example_map)
    
    db.session.commit()
    return jsonify({'success': True})

@bp.route('/api/voca/<int:voca_id>/hide', methods=['PATCH'])
@login_required
def hide_voca(voca_id):
    voca = Voca.query.get_or_404(voca_id)
    voca.is_active = False
    db.session.commit()
    return jsonify({'success': True})

@bp.route('/api/voca/<int:voca_id>/show', methods=['PATCH'])
@login_required
def show_voca(voca_id):
    voca = Voca.query.get_or_404(voca_id)
    voca.is_active = True
    db.session.commit()
    return jsonify({'success': True}) 