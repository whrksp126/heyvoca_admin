from flask import Blueprint, render_template, request, jsonify
from flask_login import login_required
from app.models.models import Voca
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

@bp.route('/api/voca/<int:voca_id>', methods=['PATCH'])
@login_required
def update_voca(voca_id):
    data = request.json
    voca = Voca.query.get_or_404(voca_id)
    voca.word = data.get('word', voca.word)
    voca.pronunciation = data.get('pronunciation', voca.pronunciation)
    voca.verb_forms = data.get('verb_forms', voca.verb_forms)
    db.session.commit()
    return jsonify({'success': True})

@bp.route('/api/voca/<int:voca_id>', methods=['DELETE'])
@login_required
def hide_voca(voca_id):
    voca = Voca.query.get_or_404(voca_id)
    db.session.delete(voca)
    db.session.commit()
    return jsonify({'success': True}) 