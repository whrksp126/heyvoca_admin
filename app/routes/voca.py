from flask import Blueprint, render_template, request, jsonify
from flask_login import login_required
from app.models.models import VocaBook
from app import db

bp = Blueprint('voca', __name__)

@bp.route('/', methods=['GET'])
@login_required
def voca_list():
    q = request.args.get('q')
    category = request.args.get('category')
    query = VocaBook.query
    if q:
        query = query.filter(VocaBook.book_nm.ilike(f"%{q}%"))
    if category:
        query = query.filter(VocaBook.category == category)
    voca_books = query.all()
    return render_template('voca_list.html', voca_books=voca_books)

@bp.route('/api/voca/<int:voca_id>', methods=['PATCH'])
@login_required
def update_voca_book(voca_id):
    data = request.json
    voca_book = VocaBook.query.get_or_404(voca_id)
    voca_book.book_nm = data.get('book_nm', voca_book.book_nm)
    voca_book.language = data.get('language', voca_book.language)
    voca_book.source = data.get('source', voca_book.source)
    voca_book.category = data.get('category', voca_book.category)
    voca_book.word_count = data.get('word_count', voca_book.word_count)
    db.session.commit()
    return jsonify({'success': True})

@bp.route('/api/voca/<int:voca_id>', methods=['DELETE'])
@login_required
def delete_voca_book(voca_id):
    voca_book = VocaBook.query.get_or_404(voca_id)
    db.session.delete(voca_book)
    db.session.commit()
    return jsonify({'success': True}) 