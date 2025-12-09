from flask import Blueprint, render_template, request, jsonify
from flask_login import login_required
from app.models.models import (
    Bookstore, VocaBook, Level, BookstoreCategory, BookstoreHasCategory,
    Voca, VocaMeaning, VocaExample, VocaBookMap, VocaMeaningMap, VocaExampleMap
)
from app import db
import json
from datetime import datetime
import pandas as pd
from io import BytesIO

bp = Blueprint('bookstore', __name__)

@bp.route('/', methods=['GET'])
@login_required
def bookstore_list():
    bookstores = Bookstore.query.order_by(Bookstore.created_at.desc()).all()  # 최근 등록순
    levels = Level.query.order_by(Level.level).all()
    categories = BookstoreCategory.query.order_by(BookstoreCategory.category).all()
    
    # 각 bookstore에 카테고리 목록 추가
    for bookstore in bookstores:
        category_mappings = BookstoreHasCategory.query.filter_by(bookstore_id=bookstore.id).all()
        category_ids = [m.category_id for m in category_mappings]
        category_names = []
        for cat_id in category_ids:
            cat = BookstoreCategory.query.get(cat_id)
            if cat:
                category_names.append(cat.category)
        bookstore.category_list = ', '.join(category_names) if category_names else '-'
        bookstore.category_ids = category_ids
    
    return render_template('bookstore_list.html', bookstores=bookstores, levels=levels, categories=categories)

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
    
    # 카테고리 업데이트 (다중 선택)
    if 'category_ids' in data:
        # 기존 카테고리 관계 삭제
        BookstoreHasCategory.query.filter_by(bookstore_id=bookstore_id).delete()
        # 새 카테고리 관계 추가
        for cat_id in data['category_ids']:
            new_mapping = BookstoreHasCategory(bookstore_id=bookstore_id, category_id=cat_id)
            db.session.add(new_mapping)
    
    db.session.commit()
    return jsonify({'success': True})

@bp.route('/api/bookstore/<int:bookstore_id>', methods=['DELETE'])
@login_required
def delete_bookstore(bookstore_id):
    bookstore = Bookstore.query.get_or_404(bookstore_id)
    db.session.delete(bookstore)
    db.session.commit()
    return jsonify({'success': True})


@bp.route('/api/voca_book', methods=['POST'])
@login_required
def create_voca_book():
    """단어장 생성 및 엑셀 파일로부터 단어 추가"""
    try:
        # 폼 데이터 받기
        book_nm = request.form.get('book_nm', '').strip()
        language = request.form.get('language', '').strip()
        source = request.form.get('source', '').strip()
        category = request.form.get('category', '').strip()
        username = request.form.get('username', '').strip()
        
        if not book_nm or not language or not source:
            return jsonify({'success': False, 'error': '필수 항목(이름, 언어, 소스)을 입력해주세요.'}), 400
        
        # 엑셀 파일 확인
        if 'excel_file' not in request.files:
            return jsonify({'success': False, 'error': '엑셀 파일을 업로드해주세요.'}), 400
        
        excel_file = request.files['excel_file']
        if excel_file.filename == '':
            return jsonify({'success': False, 'error': '엑셀 파일을 선택해주세요.'}), 400
        
        # 1. VocaBook 생성
        voca_book = VocaBook(
            book_nm=book_nm,
            language=language,
            source=source,
            category=category if category else None,
            username=username if username else None,
            word_count=0,
            updated_at=datetime.utcnow()
        )
        db.session.add(voca_book)
        db.session.flush()  # ID 할당받기
        
        # 2. 엑셀 파일 읽기
        excel_data = BytesIO(excel_file.read())
        df = pd.read_excel(excel_data, header=None)  # 헤더 없이 읽기
        
        word_count = 0
        
        # 3. 각 행 처리
        for idx, row in df.iterrows():
            if pd.isna(row[0]):  # 단어가 비어있으면 스킵
                continue
                
            word = str(row[0]).strip()
            if not word:
                continue
            
            # 3-1. Voca 생성
            voca = Voca(word=word)
            db.session.add(voca)
            db.session.flush()
            
            # 3-2. VocaBookMap 생성 (단어장-단어 연결)
            voca_book_map = VocaBookMap(voca_id=voca.id, book_id=voca_book.id)
            db.session.add(voca_book_map)
            
            # 3-3. VocaMeaning 처리 (2번째 열: 뜻, 콤마로 구분)
            if len(row) > 1 and pd.notna(row[1]):
                meanings_str = str(row[1])
                meanings = [m.strip() for m in meanings_str.split(',') if m.strip()]
                
                for meaning_text in meanings:
                    # VocaMeaning 생성
                    voca_meaning = VocaMeaning(meaning=meaning_text)
                    db.session.add(voca_meaning)
                    db.session.flush()
                    
                    # VocaMeaningMap 생성
                    meaning_map = VocaMeaningMap(voca_id=voca.id, meaning_id=voca_meaning.id)
                    db.session.add(meaning_map)
            
            # 3-4. VocaExample 처리 (3번째 열부터: 예문1, 예문뜻1, 예문2, 예문뜻2, ...)
            col_idx = 2  # 예문 시작 열 인덱스
            while col_idx < len(row):
                # 예문 (영어)
                if pd.isna(row[col_idx]):
                    col_idx += 2
                    continue
                    
                exam_en = str(row[col_idx]).strip()
                if not exam_en:
                    col_idx += 2
                    continue
                
                # 예문 뜻 (한국어)
                exam_ko = ''
                if col_idx + 1 < len(row) and pd.notna(row[col_idx + 1]):
                    exam_ko = str(row[col_idx + 1]).strip()
                
                # VocaExample 생성
                voca_example = VocaExample(exam_en=exam_en, exam_ko=exam_ko)
                db.session.add(voca_example)
                db.session.flush()
                
                # VocaExampleMap 생성
                example_map = VocaExampleMap(voca_id=voca.id, example_id=voca_example.id)
                db.session.add(example_map)
                
                col_idx += 2  # 다음 예문 쌍으로 이동
            
            word_count += 1
        
        # 4. 단어 수 업데이트
        voca_book.word_count = word_count
        
        db.session.commit()
        
        return jsonify({
            'success': True, 
            'id': voca_book.id, 
            'word_count': word_count,
            'message': f'단어장이 생성되었습니다. ({word_count}개 단어)'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500 