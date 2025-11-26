from flask import Blueprint, render_template, request, jsonify
from flask_login import login_required
from app.models.models import Bookstore, VocaBook, Level
from app import db
import json
from datetime import datetime

bp = Blueprint('bookstore', __name__)

@bp.route('/', methods=['GET'])
@login_required
def bookstore_list():
    bookstores = Bookstore.query.order_by(Bookstore.created_at.desc()).all()  # 최근 등록순
    levels = Level.query.order_by(Level.level).all()
    return render_template('bookstore_list.html', bookstores=bookstores, levels=levels)

@bp.route('/voca_books', methods=['GET'])
@login_required
def voca_books_list():
    """단어장 목록을 보여주는 페이지 (bookstore에 등록할 단어장 선택용)"""
    page = request.args.get('page', 1, type=int)
    per_page = 12  # 한 페이지당 12개 (3x4 그리드)
    
    # 검색 필터
    search = request.args.get('search', '')
    category = request.args.get('category', '')
    status = request.args.get('status', '')  # all, registered, unregistered
    
    # 기본 쿼리
    query = VocaBook.query
    
    # 검색 필터 적용
    if search:
        query = query.filter(VocaBook.book_nm.ilike(f'%{search}%'))
    if category:
        query = query.filter(VocaBook.category == category)
    
    # 페이지네이션
    pagination = query.paginate(
        page=page, 
        per_page=per_page, 
        error_out=False
    )
    voca_books = pagination.items
    
    # 각 voca_book이 bookstore에 등록되어 있는지 확인
    for voca_book in voca_books:
        bookstore_entry = Bookstore.query.filter_by(book_id=voca_book.id).first()
        voca_book.is_registered = bookstore_entry is not None
        if bookstore_entry:
            voca_book.bookstore_name = bookstore_entry.name
            voca_book.bookstore_id = bookstore_entry.id
    
    # 상태 필터 적용 (등록 여부)
    if status == 'registered':
        voca_books = [book for book in voca_books if book.is_registered]
    elif status == 'unregistered':
        voca_books = [book for book in voca_books if not book.is_registered]
    
    levels = Level.query.order_by(Level.level).all()
    
    return render_template('voca_books_list.html', 
                         voca_books=voca_books, 
                         pagination=pagination,
                         search=search,
                         category=category,
                         status=status,
                         levels=levels)

@bp.route('/api/bookstore', methods=['POST'])
@login_required
def create_bookstore():
    """새로운 bookstore 항목 생성"""
    data = request.json
    
    # color를 JSON 문자열로 변환
    color = data.get('color', '')
    if isinstance(color, dict):
        color = json.dumps(color)
    
    bookstore = Bookstore(
        name=data['name'],
        downloads=data.get('order', 0),
        category=data.get('category', ''),
        color=color,
        hide='N' if data.get('is_visible', True) else 'Y',  # hide 필드를 공개 여부로 활용
        gem=data.get('gem', 0),
        level=data.get('level_name'),
        level_id=data['level_id'],
        book_id=data['book_id']
    )
    db.session.add(bookstore)
    db.session.commit()
    return jsonify({'success': True, 'id': bookstore.id})

@bp.route('/api/bookstore/<int:bookstore_id>', methods=['PATCH'])
@login_required
def update_bookstore(bookstore_id):
    data = request.json
    print(data)
    bookstore = Bookstore.query.get_or_404(bookstore_id)
    bookstore.name = data.get('name', bookstore.name)
    bookstore.category = data.get('category', bookstore.category)
    
    # color 처리: 딕셔너리면 JSON 문자열로 변환, 없으면 기존 값 유지
    if 'color' in data:
        color = data['color']
        if isinstance(color, dict):
            color = json.dumps(color)
        bookstore.color = color
    # 'color' 키가 없으면 기존 값 유지 (아무것도 안 함)
    
    bookstore.hide = 'N' if data.get('is_visible', True) else 'Y'  # hide 필드를 공개 여부로 활용
    bookstore.gem = data.get('gem', bookstore.gem)
    bookstore.updated_at = datetime.utcnow()  # 수정 시간 명시적 업데이트
    db.session.commit()
    return jsonify({'success': True})

@bp.route('/api/bookstore/<int:bookstore_id>', methods=['DELETE'])
@login_required
def delete_bookstore(bookstore_id):
    bookstore = Bookstore.query.get_or_404(bookstore_id)
    db.session.delete(bookstore)
    db.session.commit()
    return jsonify({'success': True}) 