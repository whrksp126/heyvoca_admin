from flask import Blueprint, render_template, request, jsonify
from flask_login import login_required
from app.models.models import (
    Bookstore, VocaBook, Level, BookstoreCategory,
    Voca, VocaMeaning, VocaExample, VocaBookMap, VocaMeaningMap, VocaExampleMap,
    UserVocaBook,
    AdminVocaBook, AdminVocaBookMap
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
    categories = BookstoreCategory.query.order_by(BookstoreCategory.sort_order, BookstoreCategory.category).all()
    
    # 각 bookstore에 카테고리 정보 추가
    for bookstore in bookstores:
        if bookstore.category_id:
            category = BookstoreCategory.query.get(bookstore.category_id)
            bookstore.category_list = category.category if category else '-'
            bookstore.category_id_value = bookstore.category_id
        else:
            bookstore.category_list = '-'
            bookstore.category_id_value = None
    
    return render_template('bookstore_list.html', bookstores=bookstores, levels=levels, categories=categories)

@bp.route('/voca_books', methods=['GET'])
@login_required
def voca_books_list():
    """단어장 목록을 보여주는 페이지 (VocaBook + AdminVocaBook 통합)"""
    page = request.args.get('page', 1, type=int)
    per_page = 12

    # 검색 필터
    search = request.args.get('search', '')
    category = request.args.get('category', '')
    status = request.args.get('status', '')

    # 등록된 book_id, admin_voca_book_id를 한 번에 조회
    registered_bookstores = Bookstore.query.with_entities(
        Bookstore.book_id, Bookstore.admin_voca_book_id, Bookstore.id, Bookstore.name
    ).all()

    registered_legacy = {b.book_id: {'id': b.id, 'name': b.name} for b in registered_bookstores if b.book_id}
    registered_admin = {b.admin_voca_book_id: {'id': b.id, 'name': b.name} for b in registered_bookstores if b.admin_voca_book_id}

    # VocaBook 쿼리
    voca_query = VocaBook.query
    if search:
        voca_query = voca_query.filter(VocaBook.book_nm.ilike(f'%{search}%'))
    if category:
        voca_query = voca_query.filter(VocaBook.category == category)
    legacy_books = voca_query.all()

    # AdminVocaBook 쿼리
    admin_query = AdminVocaBook.query
    if search:
        admin_query = admin_query.filter(AdminVocaBook.book_nm.ilike(f'%{search}%'))
    if category:
        admin_query = admin_query.filter(AdminVocaBook.category == category)
    admin_books = admin_query.all()

    # 각 책에 타입 및 등록 정보 표시 (N+1 없이)
    for book in legacy_books:
        book.book_type = 'legacy'
        if book.id in registered_legacy:
            book.is_registered = True
            book.bookstore_name = registered_legacy[book.id]['name']
            book.bookstore_id = registered_legacy[book.id]['id']
        else:
            book.is_registered = False

    for book in admin_books:
        book.book_type = 'admin'
        if book.id in registered_admin:
            book.is_registered = True
            book.bookstore_name = registered_admin[book.id]['name']
            book.bookstore_id = registered_admin[book.id]['id']
        else:
            book.is_registered = False

    # 합치고 정렬
    all_books = legacy_books + admin_books
    all_books.sort(key=lambda x: (x.updated_at or datetime.min), reverse=True)

    # 상태 필터 적용
    if status == 'registered':
        all_books = [book for book in all_books if book.is_registered]
    elif status == 'unregistered':
        all_books = [book for book in all_books if not book.is_registered]

    # 수동 페이지네이션
    total = len(all_books)
    start = (page - 1) * per_page
    end = start + per_page
    voca_books = all_books[start:end]

    # 페이지네이션 정보 객체
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
    levels = Level.query.order_by(Level.level).all()
    categories = BookstoreCategory.query.order_by(BookstoreCategory.sort_order, BookstoreCategory.category).all()

    return render_template('voca_books_list.html',
                         voca_books=voca_books,
                         pagination=pagination,
                         search=search,
                         category=category,
                         status=status,
                         levels=levels,
                         categories=categories)

@bp.route('/api/bookstore', methods=['POST'])
@login_required
def create_bookstore():
    """새로운 bookstore 항목 생성"""
    data = request.json
    print("=== create_bookstore data ===")
    print(data)

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
        book_id=data.get('book_id'),
        admin_voca_book_id=data.get('admin_voca_book_id'),
        category_id=data.get('category_id')
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
    
    # 카테고리 업데이트
    if 'category_id' in data:
        bookstore.category_id = data['category_id'] if data['category_id'] else None
    
    db.session.commit()
    return jsonify({'success': True})

@bp.route('/api/bookstore/<int:bookstore_id>', methods=['DELETE'])
@login_required
def delete_bookstore(bookstore_id):
    bookstore = Bookstore.query.get_or_404(bookstore_id)
    
    # user_voca_book에서 참조하고 있는지 확인
    user_voca_book = UserVocaBook.query.filter_by(bookstore_id=bookstore_id).first()
    if user_voca_book:
        # 유저가 사용한 적이 있으면 숨김 처리
        bookstore.hide = 'Y'
        db.session.commit()
        return jsonify({'success': True, 'message': '유저가 사용 중인 북스토어이므로 숨김 처리되었습니다.'})
    else:
        # 유저가 사용한 적이 없으면 실제 삭제
        db.session.delete(bookstore)
        db.session.commit()
        return jsonify({'success': True, 'message': '북스토어가 삭제되었습니다.'})


@bp.route('/api/voca_book/<int:voca_book_id>', methods=['PATCH'])
@login_required
def update_voca_book(voca_book_id):
    """단어장 정보 수정"""
    try:
        data = request.json
        voca_book = VocaBook.query.get_or_404(voca_book_id)
        
        # 수정 가능한 필드 업데이트
        if 'book_nm' in data:
            voca_book.book_nm = data['book_nm']
        if 'language' in data:
            voca_book.language = data['language']
        if 'source' in data:
            voca_book.source = data['source']
        if 'category' in data:
            voca_book.category = data['category'] if data['category'] else None
        if 'username' in data:
            voca_book.username = data['username'] if data['username'] else None
        
        voca_book.updated_at = datetime.utcnow()
        
        db.session.commit()
        return jsonify({'success': True})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

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

@bp.route('/voca_book/<int:voca_book_id>/words', methods=['GET'])
@login_required
def voca_book_words(voca_book_id):
    """단어장의 단어 목록 조회 (페이지네이션 지원)"""
    voca_book = VocaBook.query.get_or_404(voca_book_id)
    
    # 페이지네이션 파라미터
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)  # 기본 50개씩
    
    # 전체 단어 수 조회
    total_count = VocaBookMap.query.filter_by(book_id=voca_book_id).count()
    
    # JOIN을 사용하여 한 번에 조회 (성능 최적화)
    # voca_id 순서로 정렬 (추가된 순서대로)
    word_maps = db.session.query(VocaBookMap, Voca).join(
        Voca, VocaBookMap.voca_id == Voca.id
    ).filter(
        VocaBookMap.book_id == voca_book_id
    ).order_by(
        VocaBookMap.voca_id  # voca_id 순서로 정렬 (추가된 순서)
    ).offset(
        (page - 1) * per_page
    ).limit(
        per_page
    ).all()
    
    # 단어 ID 목록 수집
    voca_ids = [voca.id for _, voca in word_maps]
    
    # 뜻과 예문을 한 번에 조회 (성능 최적화)
    meanings_dict = {}
    if voca_ids:
        meaning_maps = db.session.query(VocaMeaningMap, VocaMeaning).join(
            VocaMeaning, VocaMeaningMap.meaning_id == VocaMeaning.id
        ).filter(VocaMeaningMap.voca_id.in_(voca_ids)).all()
        
        for mm, meaning in meaning_maps:
            if mm.voca_id not in meanings_dict:
                meanings_dict[mm.voca_id] = []
            meanings_dict[mm.voca_id].append(meaning.meaning)
    
    examples_dict = {}
    if voca_ids:
        example_maps = db.session.query(VocaExampleMap, VocaExample).join(
            VocaExample, VocaExampleMap.example_id == VocaExample.id
        ).filter(VocaExampleMap.voca_id.in_(voca_ids)).all()
        
        for em, example in example_maps:
            if em.voca_id not in examples_dict:
                examples_dict[em.voca_id] = []
            examples_dict[em.voca_id].append({
                'exam_en': example.exam_en,
                'exam_ko': example.exam_ko
            })
    
    # 결과 구성
    words = []
    for _, voca in word_maps:
        words.append({
            'voca_id': voca.id,
            'word': voca.word,
            'pronunciation': voca.pronunciation,
            'meanings': meanings_dict.get(voca.id, []),
            'examples': examples_dict.get(voca.id, [])
        })
    
    return jsonify({
        'success': True,
        'voca_book': {
            'id': voca_book.id,
            'book_nm': voca_book.book_nm,
            'language': voca_book.language,
            'word_count': total_count
        },
        'words': words,
        'pagination': {
            'page': page,
            'per_page': per_page,
            'total': total_count,
            'pages': (total_count + per_page - 1) // per_page,
            'has_next': page * per_page < total_count,
            'has_prev': page > 1
        }
    })

@bp.route('/api/voca/autocomplete', methods=['GET'])
@login_required
def voca_autocomplete():
    """단어 자동완성 API"""
    query = request.args.get('q', '').strip()
    if not query or len(query) < 2:
        return jsonify({'success': True, 'words': []})
    
    # 단어 검색 (대소문자 무시)
    vocas = Voca.query.filter(Voca.word.ilike(f'%{query}%')).limit(10).all()
    
    words = []
    for voca in vocas:
        # 각 단어의 첫 번째 뜻만 가져오기
        first_meaning = None
        meaning_map = VocaMeaningMap.query.filter_by(voca_id=voca.id).first()
        if meaning_map:
            meaning = VocaMeaning.query.get(meaning_map.meaning_id)
            if meaning:
                first_meaning = meaning.meaning
        
        words.append({
            'id': voca.id,
            'word': voca.word,
            'pronunciation': voca.pronunciation,
            'meaning': first_meaning
        })
    
    return jsonify({'success': True, 'words': words})

@bp.route('/api/voca_book/<int:voca_book_id>/word', methods=['POST'])
@login_required
def add_word_to_book(voca_book_id):
    """단어장에 단어 추가"""
    try:
        data = request.json
        word_text = data.get('word', '').strip()
        
        if not word_text:
            return jsonify({'success': False, 'error': '단어를 입력해주세요.'}), 400
        
        # 이미 해당 단어장에 단어가 있는지 확인
        existing_voca = Voca.query.filter_by(word=word_text).first()
        
        if existing_voca:
            # 기존 단어가 있으면 해당 단어 사용
            voca_id = existing_voca.id
        else:
            # 새 단어 생성
            new_voca = Voca(word=word_text, pronunciation=data.get('pronunciation'))
            db.session.add(new_voca)
            db.session.flush()
            voca_id = new_voca.id
        
        # 이미 단어장에 포함되어 있는지 확인
        existing_map = VocaBookMap.query.filter_by(book_id=voca_book_id, voca_id=voca_id).first()
        if existing_map:
            return jsonify({'success': False, 'error': '이미 단어장에 포함된 단어입니다.'}), 400
        
        # 단어장에 단어 추가
        word_map = VocaBookMap(book_id=voca_book_id, voca_id=voca_id)
        db.session.add(word_map)
        
        # 단어 수 업데이트
        voca_book = VocaBook.query.get(voca_book_id)
        if voca_book:
            word_count = VocaBookMap.query.filter_by(book_id=voca_book_id).count()
            voca_book.word_count = word_count
            voca_book.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({'success': True, 'message': '단어가 추가되었습니다.'})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@bp.route('/api/voca_book/<int:voca_book_id>/word/<int:voca_id>', methods=['DELETE'])
@login_required
def remove_word_from_book(voca_book_id, voca_id):
    """단어장에서 단어 제거"""
    try:
        # VocaBookMap에서 제거
        word_map = VocaBookMap.query.filter_by(book_id=voca_book_id, voca_id=voca_id).first()
        if not word_map:
            return jsonify({'success': False, 'error': '단어를 찾을 수 없습니다.'}), 404
        
        db.session.delete(word_map)
        
        # 단어 수 업데이트
        voca_book = VocaBook.query.get(voca_book_id)
        if voca_book:
            word_count = VocaBookMap.query.filter_by(book_id=voca_book_id).count()
            voca_book.word_count = word_count
            voca_book.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({'success': True, 'message': '단어가 제거되었습니다.'})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/api/admin_voca_book', methods=['POST'])
@login_required
def create_admin_voca_book():
    """AdminVocaBook 생성 및 엑셀 파일로부터 단어 추가

    로직:
    1. AdminVocaBook 생성
    2. 엑셀 각 행 처리:
       - Voca 테이블에서 단어 검색
       - 없으면: Voca 생성 + VocaMeaning/VocaExample 저장 (글로벌 사전)
       - 있으면: 뜻/예문 비교해서 없는 것만 글로벌 사전에 추가
       - AdminVocaBookMap에 저장 (voca_id, meanings JSON, examples JSON)
    """
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

        # 1. AdminVocaBook 생성
        admin_voca_book = AdminVocaBook(
            book_nm=book_nm,
            language=language,
            source=source,
            category=category if category else None,
            username=username if username else None,
            word_count=0,
            updated_at=datetime.utcnow()
        )
        db.session.add(admin_voca_book)
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

            # 3-1. Voca 테이블에서 단어 검색
            existing_voca = Voca.query.filter_by(word=word).first()

            # 엑셀에서 뜻 파싱
            meanings_list = []
            if len(row) > 1 and pd.notna(row[1]):
                meanings_str = str(row[1])
                meanings_list = [m.strip() for m in meanings_str.split(',') if m.strip()]

            # 엑셀에서 예문 파싱
            examples_list = []
            col_idx = 2
            while col_idx < len(row):
                if pd.isna(row[col_idx]):
                    col_idx += 2
                    continue

                exam_en = str(row[col_idx]).strip()
                if not exam_en:
                    col_idx += 2
                    continue

                exam_ko = ''
                if col_idx + 1 < len(row) and pd.notna(row[col_idx + 1]):
                    exam_ko = str(row[col_idx + 1]).strip()

                examples_list.append({'en': exam_en, 'ko': exam_ko})
                col_idx += 2

            if existing_voca:
                # 3-2. 기존 단어가 있는 경우: 뜻/예문 비교 후 없는 것만 추가
                voca_id = existing_voca.id

                # 기존 뜻 가져오기
                existing_meanings = set()
                meaning_maps = VocaMeaningMap.query.filter_by(voca_id=voca_id).all()
                for mm in meaning_maps:
                    meaning_obj = VocaMeaning.query.get(mm.meaning_id)
                    if meaning_obj:
                        existing_meanings.add(meaning_obj.meaning)

                # 없는 뜻만 추가
                for meaning_text in meanings_list:
                    if meaning_text not in existing_meanings:
                        voca_meaning = VocaMeaning(meaning=meaning_text)
                        db.session.add(voca_meaning)
                        db.session.flush()
                        meaning_map = VocaMeaningMap(voca_id=voca_id, meaning_id=voca_meaning.id)
                        db.session.add(meaning_map)

                # 기존 예문 가져오기
                existing_examples = set()
                example_maps = VocaExampleMap.query.filter_by(voca_id=voca_id).all()
                for em in example_maps:
                    example_obj = VocaExample.query.get(em.example_id)
                    if example_obj:
                        existing_examples.add((example_obj.exam_en, example_obj.exam_ko))

                # 없는 예문만 추가
                for ex in examples_list:
                    if (ex['en'], ex['ko']) not in existing_examples:
                        voca_example = VocaExample(exam_en=ex['en'], exam_ko=ex['ko'])
                        db.session.add(voca_example)
                        db.session.flush()
                        example_map = VocaExampleMap(voca_id=voca_id, example_id=voca_example.id)
                        db.session.add(example_map)
            else:
                # 3-3. 새 단어인 경우: Voca 생성 + 뜻/예문 저장
                voca = Voca(word=word)
                db.session.add(voca)
                db.session.flush()
                voca_id = voca.id

                # VocaMeaning 생성
                for meaning_text in meanings_list:
                    voca_meaning = VocaMeaning(meaning=meaning_text)
                    db.session.add(voca_meaning)
                    db.session.flush()
                    meaning_map = VocaMeaningMap(voca_id=voca_id, meaning_id=voca_meaning.id)
                    db.session.add(meaning_map)

                # VocaExample 생성
                for ex in examples_list:
                    voca_example = VocaExample(exam_en=ex['en'], exam_ko=ex['ko'])
                    db.session.add(voca_example)
                    db.session.flush()
                    example_map = VocaExampleMap(voca_id=voca_id, example_id=voca_example.id)
                    db.session.add(example_map)

            # 3-4. AdminVocaBookMap에 저장 (JSON 형식)
            admin_voca_book_map = AdminVocaBookMap(
                voca_id=voca_id,
                book_id=admin_voca_book.id,
                voca_meanings=json.dumps(meanings_list, ensure_ascii=False) if meanings_list else None,
                voca_examples=json.dumps(examples_list, ensure_ascii=False) if examples_list else None
            )
            db.session.add(admin_voca_book_map)

            word_count += 1

        # 4. 단어 수 업데이트
        admin_voca_book.word_count = word_count

        db.session.commit()

        return jsonify({
            'success': True,
            'id': admin_voca_book.id,
            'word_count': word_count,
            'message': f'단어장이 생성되었습니다. ({word_count}개 단어)'
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/api/admin_voca_book/<int:admin_voca_book_id>', methods=['PATCH'])
@login_required
def update_admin_voca_book(admin_voca_book_id):
    """AdminVocaBook 정보 수정"""
    try:
        data = request.json
        admin_voca_book = AdminVocaBook.query.get_or_404(admin_voca_book_id)

        # 수정 가능한 필드 업데이트
        if 'book_nm' in data:
            admin_voca_book.book_nm = data['book_nm']
        if 'language' in data:
            admin_voca_book.language = data['language']
        if 'source' in data:
            admin_voca_book.source = data['source']
        if 'category' in data:
            admin_voca_book.category = data['category'] if data['category'] else None
        if 'username' in data:
            admin_voca_book.username = data['username'] if data['username'] else None

        admin_voca_book.updated_at = datetime.utcnow()

        db.session.commit()
        return jsonify({'success': True})

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/admin_voca_book/<int:admin_voca_book_id>/words', methods=['GET'])
@login_required
def admin_voca_book_words(admin_voca_book_id):
    """AdminVocaBook의 단어 목록 조회 (페이지네이션 지원)"""
    admin_voca_book = AdminVocaBook.query.get_or_404(admin_voca_book_id)

    # 페이지네이션 파라미터
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)

    # 전체 단어 수 조회
    total_count = AdminVocaBookMap.query.filter_by(book_id=admin_voca_book_id).count()

    # JOIN을 사용하여 한 번에 조회
    word_maps = db.session.query(AdminVocaBookMap, Voca).join(
        Voca, AdminVocaBookMap.voca_id == Voca.id
    ).filter(
        AdminVocaBookMap.book_id == admin_voca_book_id
    ).order_by(
        AdminVocaBookMap.id
    ).offset(
        (page - 1) * per_page
    ).limit(
        per_page
    ).all()

    # 결과 구성
    words = []
    for book_map, voca in word_maps:
        # AdminVocaBookMap에 저장된 meanings/examples 사용
        meanings = []
        examples = []

        if book_map.voca_meanings:
            try:
                meanings = json.loads(book_map.voca_meanings)
            except:
                pass

        if book_map.voca_examples:
            try:
                examples = json.loads(book_map.voca_examples)
            except:
                pass

        words.append({
            'voca_id': voca.id,
            'map_id': book_map.id,
            'word': voca.word,
            'pronunciation': voca.pronunciation,
            'meanings': meanings,
            'examples': examples
        })

    return jsonify({
        'success': True,
        'voca_book': {
            'id': admin_voca_book.id,
            'book_nm': admin_voca_book.book_nm,
            'language': admin_voca_book.language,
            'word_count': total_count
        },
        'words': words,
        'pagination': {
            'page': page,
            'per_page': per_page,
            'total': total_count,
            'pages': (total_count + per_page - 1) // per_page,
            'has_next': page * per_page < total_count,
            'has_prev': page > 1
        }
    })


@bp.route('/api/admin_voca_book/<int:admin_voca_book_id>/word/<int:voca_id>', methods=['DELETE'])
@login_required
def remove_word_from_admin_book(admin_voca_book_id, voca_id):
    """AdminVocaBook에서 단어 제거"""
    try:
        # AdminVocaBookMap에서 제거
        word_map = AdminVocaBookMap.query.filter_by(book_id=admin_voca_book_id, voca_id=voca_id).first()
        if not word_map:
            return jsonify({'success': False, 'error': '단어를 찾을 수 없습니다.'}), 404

        db.session.delete(word_map)

        # 단어 수 업데이트
        admin_voca_book = AdminVocaBook.query.get(admin_voca_book_id)
        if admin_voca_book:
            word_count = AdminVocaBookMap.query.filter_by(book_id=admin_voca_book_id).count()
            admin_voca_book.word_count = word_count
            admin_voca_book.updated_at = datetime.utcnow()

        db.session.commit()

        return jsonify({'success': True, 'message': '단어가 제거되었습니다.'})

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/api/admin_voca_book/<int:admin_voca_book_id>/word', methods=['POST'])
@login_required
def add_word_to_admin_book(admin_voca_book_id):
    """AdminVocaBook에 단어 추가"""
    try:
        data = request.json
        word_text = data.get('word', '').strip()

        if not word_text:
            return jsonify({'success': False, 'error': '단어를 입력해주세요.'}), 400

        # Voca 테이블에서 단어 검색
        existing_voca = Voca.query.filter_by(word=word_text).first()

        meanings_list = []
        examples_list = []

        if existing_voca:
            voca_id = existing_voca.id

            # 기존 의미 가져오기
            meaning_maps = VocaMeaningMap.query.filter_by(voca_id=voca_id).all()
            for mm in meaning_maps:
                meaning_obj = VocaMeaning.query.get(mm.meaning_id)
                if meaning_obj:
                    meanings_list.append(meaning_obj.meaning)

            # 기존 예문 가져오기
            example_maps = VocaExampleMap.query.filter_by(voca_id=voca_id).all()
            for em in example_maps:
                example_obj = VocaExample.query.get(em.example_id)
                if example_obj:
                    examples_list.append({'en': example_obj.exam_en, 'ko': example_obj.exam_ko})
        else:
            # 새 단어 생성
            new_voca = Voca(word=word_text, pronunciation=data.get('pronunciation'))
            db.session.add(new_voca)
            db.session.flush()
            voca_id = new_voca.id

        # 이미 단어장에 포함되어 있는지 확인
        existing_map = AdminVocaBookMap.query.filter_by(book_id=admin_voca_book_id, voca_id=voca_id).first()
        if existing_map:
            return jsonify({'success': False, 'error': '이미 단어장에 포함된 단어입니다.'}), 400

        # AdminVocaBookMap에 추가 (의미/예문 JSON으로 저장)
        admin_voca_book_map = AdminVocaBookMap(
            voca_id=voca_id,
            book_id=admin_voca_book_id,
            voca_meanings=json.dumps(meanings_list, ensure_ascii=False) if meanings_list else None,
            voca_examples=json.dumps(examples_list, ensure_ascii=False) if examples_list else None
        )
        db.session.add(admin_voca_book_map)

        # 단어 수 업데이트
        admin_voca_book = AdminVocaBook.query.get(admin_voca_book_id)
        if admin_voca_book:
            word_count = AdminVocaBookMap.query.filter_by(book_id=admin_voca_book_id).count()
            admin_voca_book.word_count = word_count
            admin_voca_book.updated_at = datetime.utcnow()

        db.session.commit()

        return jsonify({'success': True, 'message': '단어가 추가되었습니다.'})

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500