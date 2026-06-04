// 북스토어 관리 페이지 — 실서비스 카드 UI(정사각형) + 클라이언트 무한 스크롤.
// T3 목록 / T4 생성 / T5 수정 / T6 삭제 / T7 색상 팔레트.
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Plus, Trash } from '@phosphor-icons/react';
import { Button, Spinner } from '@/components/ui/primitives';
import { ConfirmModal } from '@/components/ui/overlays';
import { listBookstores, getLevels, getCategories, deleteBookstore } from '@/lib/endpoints';
import { ApiError } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { useInfiniteList } from '@/lib/useInfiniteList';
import { getList, setList } from '@/lib/listCache';
import { parseColor } from '../vocaBooks/helpers';
import BookstoreFormModal from './BookstoreFormModal';
import gemImg from '@/assets/gem.png';

const CACHE_KEY = 'bookstore';
const PAGE_SIZE = 24; // 클라이언트 무한 스크롤 한 번에 노출할 카드 수

// 색상 기본값 (color 없을 때 회색)
const DEFAULT_COLOR = { main: '#9ca3af', sub: '#e5e7eb', background: '#f3f4f6' };

export default function BookstorePage({ onAuthError }) {
  const toast = useToast();
  const scrollRef = useRef(null);

  // 탭 복귀 시 캐시에서 레벨/카테고리/전체목록 복원 (재호출 없이 라벨 렌더)
  const [levels, setLevels] = useState(() => getList(CACHE_KEY)?.levels || []);
  const [categories, setCategories] = useState(() => getList(CACHE_KEY)?.categories || []);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [editing, setEditing] = useState(null);

  const [confirmTarget, setConfirmTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // 전체 목록을 한 번만 가져와 클라이언트에서 페이지 단위로 잘라 보여준다.
  // 탭 복귀 시 캐시에 저장해 둔 전체 목록을 복원.
  const fullRef = useRef(getList(CACHE_KEY)?.full || null);

  const handleError = useCallback((err, fallback) => {
    if (err instanceof ApiError && err.status === 401) { onAuthError?.(); return true; }
    toast.error(err?.message || fallback);
    return false;
  }, [onAuthError, toast]);

  const fetchPage = useCallback(async (page) => {
    // 1페이지 요청 시 전체 목록 + 레벨/카테고리 동시 로드 후 캐시.
    if (page === 1 || !fullRef.current) {
      const [bs, lv, ct] = await Promise.all([listBookstores(), getLevels(), getCategories()]);
      fullRef.current = bs?.data || [];
      const lvData = lv?.data || [];
      const ctData = ct?.data || [];
      setLevels(lvData);
      setCategories(ctData);
      setList(CACHE_KEY, { full: fullRef.current, levels: lvData, categories: ctData });
    }
    const full = fullRef.current || [];
    const slice = full.slice(0, page * PAGE_SIZE);
    return { items: slice, hasMore: slice.length < full.length };
  }, []);

  const {
    items: bookstores, initialLoading, loading, error,
    sentinelRef, replaceItems, reload, retry,
  } = useInfiniteList({
    cacheKey: CACHE_KEY,
    fetchPage,
    onAuthError,
    onError: (e) => handleError(e, '데이터를 불러오지 못했습니다.'),
    scrollRef,
  });

  // 클라이언트 슬라이스 방식이라 page 누적이 곧 노출 개수.
  // replaceItems 는 삭제 후 즉시 반영용.

  const categoryLabel = useMemo(() => {
    const map = new Map();
    categories.forEach((c) => map.set(String(c.id), c.category));
    return map;
  }, [categories]);

  const openCreate = () => { setFormMode('create'); setEditing(null); setFormOpen(true); };
  const openEdit = (b) => { setFormMode('edit'); setEditing(b); setFormOpen(true); };

  const onSaved = () => { setFormOpen(false); setEditing(null); fullRef.current = null; reload(); };

  const confirmDelete = async () => {
    if (!confirmTarget) return;
    setDeleting(true);
    try {
      const res = await deleteBookstore(confirmTarget.id);
      toast.success(res?.message || '북스토어가 삭제되었습니다.');
      const removedId = confirmTarget.id;
      setConfirmTarget(null);
      // 전체 캐시에서도 제거 후 화면 즉시 반영
      if (fullRef.current) {
        fullRef.current = fullRef.current.filter((b) => b.id !== removedId);
        setList(CACHE_KEY, { full: fullRef.current });
      }
      replaceItems((prev) => prev.filter((b) => b.id !== removedId));
    } catch (err) {
      if (!handleError(err, '삭제 중 오류가 발생했습니다.')) setConfirmTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const categoryOf = (b) => (b.category_id != null
    ? (categoryLabel.get(String(b.category_id)) || b.category_name || '')
    : (b.category || ''));

  return (
    <div className="h-full flex flex-col px-8 py-6 gap-4">
      <header className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-layout-black">북스토어 관리</h1>
          <p className="text-sm text-layout-gray-400 mt-0.5">북스토어 상품을 생성·수정·삭제합니다.</p>
        </div>
        <Button onClick={openCreate}>+ 북스토어 생성</Button>
      </header>

      {initialLoading ? (
        <Spinner label="북스토어 불러오는 중…" />
      ) : error && bookstores.length === 0 ? (
        <div className="py-12 text-center space-y-3">
          <p className="text-sm text-status-error-600">{error}</p>
          <Button variant="secondary" size="sm" onClick={retry}>다시 시도</Button>
        </div>
      ) : bookstores.length === 0 ? (
        <div className="bg-white border border-layout-gray-100 rounded-xl p-10 text-center text-sm text-layout-gray-300">
          등록된 북스토어가 없습니다.
        </div>
      ) : (
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto thin-scroll -mx-1 px-1">
          {/* 카드 그리드 (실서비스 디자인) */}
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-[15px]">
            {bookstores.map((b) => {
              const color = parseColor(b.color) || DEFAULT_COLOR;
              const cat = categoryOf(b);
              const hidden = b.hide !== 'N';
              return (
                <li
                  key={b.id}
                  style={{ backgroundColor: color.background }}
                  onClick={() => openEdit(b)}
                  className="group relative flex flex-col justify-between aspect-square p-[20px] rounded-[12px] shadow-sm cursor-pointer transition-transform hover:scale-[1.03]"
                >
                  {/* 삭제 버튼 (hover 시 노출) */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setConfirmTarget(b); }}
                    className="absolute top-2 right-2 z-10 hidden group-hover:flex items-center justify-center w-7 h-7 rounded-full bg-white/80 text-status-error-600 hover:bg-white shadow-sm"
                    title="삭제"
                  >
                    <Trash size={15} weight="bold" />
                  </button>

                  <div className="flex flex-col gap-[5px] min-w-0">
                    {cat && (
                      <span
                        style={{ backgroundColor: color.main }}
                        className="inline-flex w-max items-center px-[8px] py-[3px] rounded-full text-[10px] font-bold text-white truncate max-w-full"
                      >
                        {cat}
                      </span>
                    )}
                    <h2 className="font-bold text-[16px] text-layout-black break-keep line-clamp-2">{b.name}</h2>
                    {hidden && (
                      <span className="text-[11px] font-medium text-layout-gray-400">비공개</span>
                    )}
                  </div>

                  <div className="flex items-end justify-between">
                    <span className="flex items-center gap-[3px] text-[14px] font-semibold text-layout-black">
                      <img src={gemImg} alt="보석" className="w-[17px] h-[15px] object-contain" /> {b.gem ?? 0}
                    </span>
                    <div
                      style={{ color: color.main, backgroundColor: color.sub }}
                      className="flex items-center justify-center w-[30px] h-[30px] rounded-full text-[16px]"
                    >
                      <Plus weight="bold" />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* 클라이언트 무한 스크롤 sentinel */}
          <div ref={sentinelRef} className="h-1" />
          {loading && bookstores.length > 0 && (
            <div className="py-3 text-center text-xs text-layout-gray-300">더 불러오는 중…</div>
          )}
        </div>
      )}

      <BookstoreFormModal
        open={formOpen}
        mode={formMode}
        initial={editing}
        levels={levels}
        categories={categories}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSaved={onSaved}
        onAuthError={onAuthError}
      />

      <ConfirmModal
        open={!!confirmTarget}
        title="북스토어 삭제"
        message={confirmTarget
          ? `"${confirmTarget.name}" 을(를) 삭제하시겠습니까?\n유저가 사용 중이면 삭제 대신 숨김 처리됩니다.`
          : ''}
        confirmText={deleting ? '삭제 중…' : '삭제'}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setConfirmTarget(null)}
      />
    </div>
  );
}
