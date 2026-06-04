// 단어장 관리 페이지 (통합 어드민 핵심 화면).
// - 서버 페이지네이션 기반 무한 스크롤 (listBooksUnified), 12000건+ 대응.
// - 페이지 캐시 + 스크롤 위치 보존 (useInfiniteList).
// - 유형 필터/검색/정렬은 모두 서버 파라미터로 refetch(리셋).
// - 엑셀/AI 생성 + book_type 분기 드로어(편집)는 그대로 유지.
import React, { useCallback, useRef, useState } from 'react';
import { Button, Card, Input, Spinner, Tag } from '@/components/ui/primitives';
import { listBooksUnified } from '@/lib/endpoints';
import { useToast } from '@/lib/toast';
import { useInfiniteList } from '@/lib/useInfiniteList';
import { useDebouncedValue } from '../voca/useDebouncedValue';
import { formatDateShort } from './helpers';
import AdminBookDrawer from './AdminBookDrawer';
import LegacyBookDrawer from './LegacyBookDrawer';
import ExcelUploadModal from './ExcelUploadModal';
import AiGenerateModal from './AiGenerateModal';

const PAGE_SIZE = 50;

// 유형 필터 (서버 type 파라미터)
const TYPE_FILTERS = [
  { value: 'all', label: '전체' },
  { value: 'admin', label: '관리자' },
  { value: 'legacy', label: '기본' },
];

// 정렬 가능 컬럼 (서버 sort_by/sort_dir)
const COLUMNS = [
  { key: 'book_type', label: '유형', sortable: true },
  { key: 'book_nm', label: '단어장명', sortable: true },
  { key: 'language', label: '언어', sortable: true },
  { key: 'source', label: 'Source', sortable: true },
  { key: 'category', label: '카테고리', sortable: true },
  { key: 'word_count', label: '단어수', sortable: true, align: 'right' },
  { key: 'is_registered', label: '서점', sortable: true },
  { key: 'username', label: '작성자', sortable: true },
  { key: 'updated_at', label: '수정일', sortable: true },
];

const SOURCE_TONE = { 'AI 생성': 'purple', '직접 제작': 'green' };

export default function VocaBooksPage({ onAuthError }) {
  const toast = useToast();
  const scrollRef = useRef(null);

  // 필터/검색/정렬 (서버 파라미터)
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [sortBy, setSortBy] = useState('updated_at');
  const [sortDir, setSortDir] = useState('desc');

  // 액션 모달/드로어
  const [excelOpen, setExcelOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [editing, setEditing] = useState(null); // { id, book_type, raw }

  const fetchPage = useCallback(async (page) => {
    const res = await listBooksUnified({
      page, pageSize: PAGE_SIZE, type: typeFilter, q: debouncedSearch, sortBy, sortDir,
    });
    const data = res?.data || {};
    const items = data.items || [];
    const hasMore = (data.page || page) * (data.page_size || PAGE_SIZE) < (data.total || 0);
    return { items, hasMore, extra: data.type_counts || null };
  }, [typeFilter, debouncedSearch, sortBy, sortDir]);

  const {
    items: books, extra: typeCounts, initialLoading, loading, error,
    sentinelRef, patchItem, reload, retry,
  } = useInfiniteList({
    cacheKey: 'vocaBooks',
    fetchPage,
    deps: { typeFilter, debouncedSearch, sortBy, sortDir },
    onAuthError,
    onError: (e) => toast.error(e?.message || '단어장 목록을 불러오지 못했습니다.'),
    scrollRef,
  });

  const counts = typeCounts || { all: 0, admin: 0, legacy: 0 };

  const onSort = (col) => {
    if (!col.sortable) return;
    if (col.key === sortBy) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(col.key); setSortDir('desc'); }
  };

  // 드로어 내 변경 → 해당 행만 즉시 반영
  const onBookChanged = useCallback((patch) => {
    if (!patch?.id) return;
    patchItem(
      (b) => b.id === patch.id && b.book_type === (editing?.book_type ?? b.book_type),
      patch,
    );
  }, [patchItem, editing]);

  return (
    <div className="h-full flex flex-col px-8 py-6 gap-4">
      {/* 헤더 + 액션 */}
      <header className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-layout-black">단어장 관리</h1>
          <p className="text-sm text-layout-gray-400 mt-0.5">관리자 단어장과 기본 단어장을 통합 관리합니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setExcelOpen(true)}>엑셀로 단어장 추가</Button>
          <Button onClick={() => setAiOpen(true)}>AI로 단어장 생성</Button>
        </div>
      </header>

      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-3 shrink-0">
        <div className="inline-flex rounded-lg border border-layout-gray-100 overflow-hidden">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTypeFilter(t.value)}
              className={'px-3 py-1.5 text-sm whitespace-nowrap transition-colors ' +
                (typeFilter === t.value ? 'bg-primary-main-600 text-white' : 'bg-white text-layout-gray-500 hover:bg-layout-gray-50')}
            >
              {t.label} ({counts[t.value] ?? 0})
            </button>
          ))}
        </div>
        <div className="w-full sm:w-72">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="단어장명 검색…" />
        </div>
      </div>

      {/* 목록 — Card 가 남은 높이를 채우고, 내부 리스트 영역만 스크롤 */}
      <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {initialLoading ? (
          <Spinner label="단어장 목록을 불러오는 중…" />
        ) : error && books.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <p className="text-sm text-status-error-600">{error}</p>
            <Button variant="secondary" size="sm" onClick={retry}>다시 시도</Button>
          </div>
        ) : books.length === 0 ? (
          <div className="py-12 text-center text-sm text-layout-gray-300">조건에 맞는 단어장이 없습니다.</div>
        ) : (
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto thin-scroll">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-layout-gray-50">
                <tr className="text-layout-gray-400 text-xs">
                  {COLUMNS.map((col) => {
                    const active = col.sortable && col.key === sortBy;
                    return (
                      <th
                        key={col.key}
                        onClick={() => onSort(col)}
                        className={'font-medium px-4 py-3 whitespace-nowrap ' + (col.align === 'right' ? 'text-right ' : 'text-left ') +
                          (col.sortable ? 'cursor-pointer select-none hover:text-layout-gray-500' : '')}
                      >
                        <span className={active ? 'text-layout-black' : ''}>{col.label}</span>
                        {col.sortable && (
                          <span className="ml-1">{active ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {books.map((b) => (
                  <tr key={`${b.book_type}-${b.id}`} className="border-t border-layout-gray-100 hover:bg-layout-gray-50/50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Tag tone={b.book_type === 'admin' ? 'purple' : 'blue'}>{b.book_type === 'admin' ? '관리자' : '기본'}</Tag>
                    </td>
                    <td
                      className="px-4 py-3 font-medium text-layout-black max-w-[320px] truncate cursor-pointer hover:underline"
                      title={b.book_nm}
                      onClick={() => setEditing({ id: b.id, book_type: b.book_type, raw: b })}
                    >{b.book_nm}</td>
                    <td className="px-4 py-3 text-layout-gray-500 whitespace-nowrap">{b.language || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {b.source ? <Tag tone={SOURCE_TONE[b.source] || 'gray'}>{b.source}</Tag> : <span className="text-layout-gray-300">-</span>}
                    </td>
                    <td className="px-4 py-3 text-layout-gray-500 whitespace-nowrap">{b.category || '-'}</td>
                    <td className="px-4 py-3 text-right text-layout-gray-500 tabular-nums whitespace-nowrap">{b.word_count ?? 0}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {b.is_registered
                        ? <Tag tone="green" className="cursor-default" title={b.bookstore_name || '등록됨'}>등록</Tag>
                        : <Tag tone="gray">미등록</Tag>}
                    </td>
                    <td className="px-4 py-3 text-layout-gray-500 whitespace-nowrap">{b.username || '-'}</td>
                    <td className="px-4 py-3 text-layout-gray-400 text-xs whitespace-nowrap">{formatDateShort(b.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* 무한 스크롤 sentinel */}
            <div ref={sentinelRef} className="h-1" />
            {loading && books.length > 0 && (
              <div className="py-4 text-center text-xs text-layout-gray-300">더 불러오는 중…</div>
            )}
            {error && books.length > 0 && (
              <div className="py-4 text-center text-xs text-status-error-600">{error}</div>
            )}
          </div>
        )}
      </Card>

      {/* 편집 드로어 — book_type 분기 */}
      {editing?.book_type === 'admin' && (
        <AdminBookDrawer
          bookId={editing.id}
          onClose={() => setEditing(null)}
          onChanged={onBookChanged}
          onAuthError={onAuthError}
          toast={toast}
        />
      )}
      {editing?.book_type === 'legacy' && (
        <LegacyBookDrawer
          book={editing.raw}
          onClose={() => setEditing(null)}
          onChanged={onBookChanged}
          onAuthError={onAuthError}
          toast={toast}
        />
      )}

      {/* 생성 모달 */}
      {excelOpen && (
        <ExcelUploadModal
          onClose={() => setExcelOpen(false)}
          onCreated={() => { setExcelOpen(false); reload(); }}
          onAuthError={onAuthError}
          toast={toast}
        />
      )}
      {aiOpen && (
        <AiGenerateModal
          onClose={() => setAiOpen(false)}
          onCreated={() => { setAiOpen(false); reload(); }}
          onAuthError={onAuthError}
          toast={toast}
        />
      )}
    </div>
  );
}
