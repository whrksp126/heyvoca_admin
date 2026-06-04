import React, { useCallback, useRef, useState } from 'react';
import { Button, Input, Spinner, ToggleSwitch } from '@/components/ui/primitives';
import { ConfirmModal } from '@/components/ui/overlays';
import { useToast } from '@/lib/toast';
import { listVoca, hideVoca, showVoca } from '@/lib/endpoints';
import { useInfiniteList } from '@/lib/useInfiniteList';
import { getList, setList } from '@/lib/listCache';
import { useDebouncedValue } from './useDebouncedValue';
import VocaDetailDrawer from './VocaDetailDrawer';

const CACHE_KEY = 'voca';

// 뜻 미리보기 — 배열을 최대 2개까지 합쳐 보여준다.
function meaningPreview(meanings) {
  if (!meanings || meanings.length === 0) return '';
  const shown = meanings.slice(0, 2).join(', ');
  return meanings.length > 2 ? `${shown} 외 ${meanings.length - 2}` : shown;
}

/**
 * 단어 관리 페이지.
 *  - T25 목록(검색 + 무한 스크롤)  - T26 상세  - T27 수정  - T28/T29 노출/숨김
 */
export default function VocaPage({ onAuthError }) {
  const toast = useToast();
  const scrollRef = useRef(null);

  const [search, setSearch] = useState(() => getList(CACHE_KEY)?.search || '');
  const debouncedSearch = useDebouncedValue(search, 300);

  // 노출 상태는 목록 응답에 없을 수 있어 행 단위로 낙관적 관리 (id → boolean). 캐시에 보존.
  const [activeMap, setActiveMap] = useState(() => getList(CACHE_KEY)?.activeMap || {});
  const [togglingId, setTogglingId] = useState(null);
  const [confirmHideRow, setConfirmHideRow] = useState(null); // {id, word}
  const [total, setTotal] = useState(() => getList(CACHE_KEY)?.total ?? 0);
  const [detailId, setDetailId] = useState(null);

  const updateActiveMap = useCallback((updater) => {
    setActiveMap((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      setList(CACHE_KEY, { activeMap: next });
      return next;
    });
  }, []);

  const fetchPage = useCallback(async (page) => {
    const res = await listVoca({ page, q: debouncedSearch });
    const data = res?.data || {};
    const vocas = data.vocas || [];
    const pag = data.pagination || {};
    setTotal(pag.total ?? 0);
    setList(CACHE_KEY, { total: pag.total ?? 0, search: debouncedSearch });
    // 응답에 is_active 있으면 반영 (없으면 노출 기본값)
    updateActiveMap((prev) => {
      const m = { ...prev };
      vocas.forEach((v) => {
        if (m[v.id] === undefined) m[v.id] = v.is_active !== undefined ? !!v.is_active : true;
      });
      return m;
    });
    return { items: vocas, hasMore: !!pag.has_next };
  }, [debouncedSearch, updateActiveMap]);

  const {
    items: vocas, initialLoading, loading, error,
    sentinelRef, reload, retry,
  } = useInfiniteList({
    cacheKey: CACHE_KEY,
    fetchPage,
    deps: { debouncedSearch },
    onAuthError,
    onError: (e) => toast.error(e?.message || '단어 목록을 불러오지 못했습니다.'),
    scrollRef,
  });

  const handleApiError = useCallback((e, fallback) => {
    if (e?.status === 401) { onAuthError?.(); return true; }
    toast.error(e?.message || fallback);
    return false;
  }, [onAuthError, toast]);

  // 인라인 노출/숨김 (T28/T29)
  const applyToggle = async (id, next) => {
    setTogglingId(id);
    try {
      if (next) await showVoca(id);
      else await hideVoca(id);
      updateActiveMap((m) => ({ ...m, [id]: next }));
      toast.success(next ? '단어를 노출했습니다.' : '단어를 숨겼습니다.');
    } catch (e) {
      handleApiError(e, '노출 상태 변경에 실패했습니다.');
    } finally {
      setTogglingId(null);
    }
  };

  const onRowToggle = (row, next) => {
    if (!next) { setConfirmHideRow({ id: row.id, word: row.word }); return; }
    applyToggle(row.id, true);
  };

  return (
    <div className="h-full flex flex-col px-8 py-6 gap-4">
      {/* 헤더 + 검색 */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-layout-black">단어 관리</h2>
          <p className="text-sm text-layout-gray-300 mt-0.5">
            전체 {total.toLocaleString()}개
          </p>
        </div>
        <div className="w-full sm:w-72">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="단어 검색…"
            aria-label="단어 검색"
          />
        </div>
      </div>

      {/* 목록 (T25) — 무한 스크롤 (리스트 영역만 스크롤, 좌우 스크롤 없음) */}
      <div className="flex-1 min-h-0 flex flex-col bg-white border border-layout-gray-100 rounded-xl overflow-hidden">
        {initialLoading ? (
          <Spinner label="단어 목록을 불러오는 중…" />
        ) : error && vocas.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <p className="text-sm text-status-error-600">{error}</p>
            <Button variant="secondary" size="sm" onClick={retry}>다시 시도</Button>
          </div>
        ) : vocas.length === 0 ? (
          <div className="py-12 text-center text-sm text-layout-gray-300">
            {debouncedSearch ? `"${debouncedSearch}"에 해당하는 단어가 없습니다.` : '등록된 단어가 없습니다.'}
          </div>
        ) : (
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto thin-scroll">
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col className="w-[24%]" />
                <col className="w-[22%]" />
                <col className="hidden md:table-column" />
                <col className="w-[120px]" />
                <col className="w-[88px]" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-layout-gray-50">
                <tr className="text-left text-xs text-layout-gray-400">
                  <th className="font-medium px-4 py-3">단어</th>
                  <th className="font-medium px-4 py-3">발음</th>
                  <th className="font-medium px-4 py-3 hidden md:table-cell">뜻 미리보기</th>
                  <th className="font-medium px-4 py-3 text-center">노출</th>
                  <th className="font-medium px-4 py-3 text-right">동작</th>
                </tr>
              </thead>
              <tbody>
                {vocas.map((v) => {
                  const isActive = activeMap[v.id] !== false;
                  return (
                    <tr
                      key={v.id}
                      className="border-t border-layout-gray-50 hover:bg-layout-gray-50 cursor-pointer transition-colors"
                      onClick={() => setDetailId(v.id)}
                    >
                      <td className="px-4 py-3 truncate">
                        <span className="font-semibold text-layout-black">{v.word}</span>
                        {v.verb_forms ? (
                          <span className="ml-2 text-[11px] text-layout-gray-300">{v.verb_forms}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-layout-gray-400 truncate">{v.pronunciation || '-'}</td>
                      <td className="px-4 py-3 text-layout-gray-400 hidden md:table-cell truncate">
                        {meaningPreview(v.meanings) || <span className="text-layout-gray-300">뜻 없음</span>}
                      </td>
                      {/* 노출: 토글 + 라벨을 한 줄(가로)로 배치 */}
                      <td className="px-4 py-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-2">
                          <ToggleSwitch
                            checked={isActive}
                            disabled={togglingId === v.id}
                            onChange={(next) => onRowToggle(v, next)}
                          />
                          <span className={'text-xs font-medium ' + (isActive ? 'text-status-success-600' : 'text-layout-gray-300')}>
                            {isActive ? '노출' : '숨김'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <Button variant="secondary" size="sm" onClick={() => setDetailId(v.id)}>편집</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* 무한 스크롤 sentinel */}
            <div ref={sentinelRef} className="h-1" />
            {loading && vocas.length > 0 && (
              <div className="py-4 text-center text-xs text-layout-gray-300">더 불러오는 중…</div>
            )}
            {error && vocas.length > 0 && (
              <div className="py-4 text-center text-xs text-status-error-600">{error}</div>
            )}
          </div>
        )}
      </div>

      {/* 상세/수정 Drawer (T26/T27/T28/T29) */}
      {detailId != null && (
        <VocaDetailDrawer
          vocaId={detailId}
          initialActive={activeMap[detailId] !== false}
          onClose={() => setDetailId(null)}
          onSaved={() => { setDetailId(null); reload(); }}
          onActiveChange={(id, next) => updateActiveMap((m) => ({ ...m, [id]: next }))}
          onAuthError={onAuthError}
          toast={toast}
        />
      )}

      {/* 행 인라인 숨김 확인 */}
      <ConfirmModal
        open={!!confirmHideRow}
        title="단어 숨김"
        message={confirmHideRow ? `"${confirmHideRow.word}" 단어를 숨길까요?\n앱 사용자에게 더 이상 노출되지 않습니다.` : ''}
        confirmText="숨김"
        tone="danger"
        onCancel={() => setConfirmHideRow(null)}
        onConfirm={() => {
          const row = confirmHideRow;
          setConfirmHideRow(null);
          if (row) applyToggle(row.id, false);
        }}
      />
    </div>
  );
}
