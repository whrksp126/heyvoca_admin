import React, { useCallback, useRef, useState } from 'react';
import { CaretRight } from '@phosphor-icons/react';
import { Button, Input, Spinner, Tag } from '@/components/ui/primitives';
import { useToast } from '@/lib/toast';
import { listVoca } from '@/lib/endpoints';
import { useInfiniteList } from '@/lib/useInfiniteList';
import { getList, setList } from '@/lib/listCache';
import { useDebouncedValue } from './useDebouncedValue';
import VocaDetailDrawer from './VocaDetailDrawer';
import { posLabel } from './posLabels';

const CACHE_KEY = 'voca';

/**
 * 단어 관리 페이지.
 *  - 목록(검색 + 무한 스크롤) / 행 클릭 시 상세·수정 Drawer
 *  - 컬럼: 단어(+발음) / 의미(전체) / 예문(강조 렌더) / 부사형
 */
export default function VocaPage({ onAuthError }) {
  const toast = useToast();
  const scrollRef = useRef(null);

  const [search, setSearch] = useState(() => getList(CACHE_KEY)?.search || '');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [total, setTotal] = useState(() => getList(CACHE_KEY)?.total ?? 0);
  const [detailId, setDetailId] = useState(null);

  const fetchPage = useCallback(async (page) => {
    const res = await listVoca({ page, q: debouncedSearch });
    const data = res?.data || {};
    const vocas = data.vocas || [];
    const pag = data.pagination || {};
    setTotal(pag.total ?? 0);
    setList(CACHE_KEY, { total: pag.total ?? 0, search: debouncedSearch });
    return { items: vocas, hasMore: !!pag.has_next };
  }, [debouncedSearch]);

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

  return (
    <div className="h-full flex flex-col px-4 py-4 sm:px-8 sm:py-6 gap-3 sm:gap-4">
      {/* 헤더 + 검색 */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-layout-black">단어 관리</h2>
          <p className="text-sm text-layout-gray-300 mt-0.5">전체 {total.toLocaleString()}개</p>
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

      {/* 목록 — 무한 스크롤 (리스트 영역만 스크롤) */}
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
            {/* 좁은 화면: 카드 리스트(단어 1개 = 카드 1장) */}
            <ul className="md:hidden divide-y divide-layout-gray-50">
              {vocas.map((v) => (
                <li
                  key={v.id}
                  onClick={() => setDetailId(v.id)}
                  className="flex items-start justify-between gap-2 px-4 py-3.5 active:bg-layout-gray-50 cursor-pointer transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-layout-black">{v.word}</span>
                      {v.pronunciation ? (
                        <span className="text-[11px] text-layout-gray-300">[{v.pronunciation}]</span>
                      ) : null}
                    </div>
                    <div className="mt-1.5 space-y-1">
                      {v.meanings_detail && v.meanings_detail.length ? (
                        v.meanings_detail.map((m, i) => (
                          <div key={m.id ?? i} className="flex items-start gap-1.5 text-sm text-layout-gray-500">
                            {m.pos ? <Tag tone="gray" className="shrink-0 mt-0.5">{posLabel(m.pos)}</Tag> : null}
                            <span className="break-words">{m.meaning}</span>
                          </div>
                        ))
                      ) : v.meanings && v.meanings.length ? (
                        <div className="text-sm text-layout-gray-500">{v.meanings.join(', ')}</div>
                      ) : (
                        <div className="text-sm text-layout-gray-300">뜻 없음</div>
                      )}
                    </div>
                    <div className="mt-1.5 text-xs text-layout-gray-300">
                      {v.examples && v.examples.length ? `예문 ${v.examples.length}개` : '예문 없음'}
                    </div>
                  </div>
                  <CaretRight size={16} className="shrink-0 mt-1 text-layout-gray-300" />
                </li>
              ))}
            </ul>

            {/* 넓은 화면: 테이블 */}
            <table className="hidden md:table w-full table-fixed text-sm">
              <colgroup>
                <col className="w-[16%]" />
                <col className="w-[24%]" />
                <col className="w-[44%]" />
                <col className="w-[16%]" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-layout-gray-50">
                <tr className="text-left text-xs text-layout-gray-400">
                  <th className="font-medium px-4 py-3">단어</th>
                  <th className="font-medium px-4 py-3">의미</th>
                  <th className="font-medium px-4 py-3">예문</th>
                  <th className="font-medium px-4 py-3">부사형</th>
                </tr>
              </thead>
              <tbody>
                {vocas.map((v) => (
                  <tr
                    key={v.id}
                    className="border-t border-layout-gray-50 hover:bg-layout-gray-50 cursor-pointer transition-colors align-top"
                    onClick={() => setDetailId(v.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-layout-black break-words">{v.word}</div>
                      {v.pronunciation ? (
                        <div className="text-[11px] text-layout-gray-300 mt-0.5 break-words">[{v.pronunciation}]</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-layout-gray-500 break-words">
                      {v.meanings_detail && v.meanings_detail.length ? (
                        <div className="flex flex-col gap-1">
                          {v.meanings_detail.map((m, i) => (
                            <div key={m.id ?? i} className="flex items-center gap-1.5">
                              {m.pos ? <Tag tone="gray" className="shrink-0">{posLabel(m.pos)}</Tag> : null}
                              <span className="break-words">{m.meaning}</span>
                            </div>
                          ))}
                        </div>
                      ) : v.meanings && v.meanings.length ? (
                        v.meanings.join(', ')
                      ) : (
                        <span className="text-layout-gray-300">뜻 없음</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-layout-gray-500 break-words space-y-1">
                      {v.examples && v.examples.length
                        ? v.examples.map((ex, i) => (
                            <div key={i} className="leading-relaxed">
                              <span dangerouslySetInnerHTML={{ __html: ex.exam_en || '' }} />
                              {ex.exam_en && ex.exam_ko ? <span className="text-layout-gray-300"> · </span> : null}
                              <span className="text-layout-gray-400" dangerouslySetInnerHTML={{ __html: ex.exam_ko || '' }} />
                            </div>
                          ))
                        : <span className="text-layout-gray-300">-</span>}
                    </td>
                    <td className="px-4 py-3 text-layout-gray-400 break-words">{v.verb_forms || '-'}</td>
                  </tr>
                ))}
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

      {/* 상세/수정 Drawer */}
      {detailId != null && (
        <VocaDetailDrawer
          vocaId={detailId}
          onClose={() => setDetailId(null)}
          onSaved={() => { setDetailId(null); reload(); }}
          onAuthError={onAuthError}
          toast={toast}
        />
      )}
    </div>
  );
}
