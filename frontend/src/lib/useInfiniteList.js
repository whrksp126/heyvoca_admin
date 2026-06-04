// 무한 스크롤 + 페이지 캐시 + 스크롤 위치 보존을 한 번에 처리하는 공통 훅.
// 3개 목록 화면(단어장/단어/북스토어)이 동일하게 사용한다.
//
// - 마운트 시 캐시(getList(key))에 items 가 있으면 재호출 없이 그대로 복원.
// - 없으면 page=1 부터 fetchPage 로 첫 페이지 로드.
// - 메인 스크롤 컨테이너(useScrollEl) 하단 sentinel 이 보이면 다음 페이지 append.
// - 스크롤 위치는 throttle 저장 후 마운트 시 복원.
// - filters/sort 변경 → reset() 으로 items 비우고 page=1 부터 재조회 + scrollTop 0.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getList, setList } from './listCache';
import { useScrollEl } from './scrollContext';

/**
 * @param {object}   opts
 * @param {string}   opts.cacheKey            캐시 key ('vocaBooks'|'voca'|'bookstore')
 * @param {function} opts.fetchPage           async (page, ctx) => { items, hasMore, extra }
 * @param {object}   [opts.deps]              filters/sort 등 — 변경 시 자동 리셋 (얕은 비교)
 * @param {function} [opts.onAuthError]       401 처리
 * @param {function} [opts.onError]           기타 에러 (toast 등)
 * @param {boolean}  [opts.enabled=true]      false 면 조회하지 않음(선행 데이터 대기용)
 * @param {object}   [opts.scrollRef]         스크롤/IO root 컨테이너 ref. 미지정 시 메인 컨테이너(useScrollEl) 사용.
 *                                            테이블 리스트 영역만 스크롤시키려면 그 영역 ref 를 전달.
 */
export function useInfiniteList({ cacheKey, fetchPage, deps = {}, onAuthError, onError, enabled = true, scrollRef: providedScrollRef }) {
  const ctxScrollRef = useScrollEl();
  const scrollRef = providedScrollRef || ctxScrollRef;
  const cached = useRef(getList(cacheKey)).current;

  const [items, setItems] = useState(cached?.items || []);
  const [page, setPage] = useState(cached?.page || 0); // 0 = 아직 로드 안 함
  const [hasMore, setHasMore] = useState(cached?.hasMore ?? true);
  const [extra, setExtra] = useState(cached?.extra || null); // type_counts 등 부가 데이터
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // 캐시 items 가 있으면 초기 로딩을 건너뛴다.
  const [initialLoading, setInitialLoading] = useState(!(cached?.items?.length));

  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;
  const reqRef = useRef(0);
  const loadingRef = useRef(false);

  // 캐시에 현재 상태 반영
  const sync = useCallback((patch) => {
    setList(cacheKey, patch);
  }, [cacheKey]);

  const fetchAt = useCallback(async (targetPage, { append }) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    const reqId = ++reqRef.current;
    setLoading(true);
    if (!append) setInitialLoading(true);
    setError(null);
    try {
      const res = await fetchRef.current(targetPage);
      if (reqId !== reqRef.current) return; // 오래된 응답 무시
      const nextItems = append ? [...items, ...(res.items || [])] : (res.items || []);
      setItems(nextItems);
      setPage(targetPage);
      setHasMore(!!res.hasMore);
      if (res.extra !== undefined) setExtra(res.extra);
      sync({ items: nextItems, page: targetPage, hasMore: !!res.hasMore, ...(res.extra !== undefined ? { extra: res.extra } : {}) });
    } catch (e) {
      if (reqId !== reqRef.current) return;
      if (e?.status === 401) { onAuthError?.(); }
      else { setError(e?.message || '목록을 불러오지 못했습니다.'); onError?.(e); }
    } finally {
      if (reqId === reqRef.current) { setLoading(false); setInitialLoading(false); }
      loadingRef.current = false;
    }
  }, [items, sync, onAuthError, onError]);

  // deps(필터/정렬) 변경 시 리셋 후 1페이지부터.
  const depsKey = JSON.stringify(deps);
  const firstRun = useRef(true);
  useEffect(() => {
    if (!enabled) return;
    if (firstRun.current) {
      firstRun.current = false;
      // 캐시에 데이터가 있으면 재호출 안 함.
      if (cached?.items?.length) return;
      fetchAt(1, { append: false });
      return;
    }
    // 필터/정렬 변경 → 리셋
    setItems([]);
    setPage(0);
    setHasMore(true);
    sync({ items: [], page: 0, hasMore: true, scrollTop: 0 });
    const el = scrollRef.current;
    if (el) el.scrollTop = 0;
    fetchAt(1, { append: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey, enabled]);

  // 스크롤 위치 복원 + 저장 리스너
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (cached?.scrollTop) el.scrollTop = cached.scrollTop;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      setTimeout(() => {
        sync({ scrollTop: el.scrollTop });
        ticking = false;
      }, 150);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollRef]);

  // sentinel IntersectionObserver
  const sentinelRef = useRef(null);
  useEffect(() => {
    const el = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!el || !sentinel) return;
    const io = new IntersectionObserver((entries) => {
      const e = entries[0];
      if (e.isIntersecting && hasMore && !loadingRef.current && page > 0) {
        fetchAt(page + 1, { append: true });
      }
    }, { root: el, rootMargin: '300px' });
    io.observe(sentinel);
    return () => io.disconnect();
  }, [scrollRef, hasMore, page, fetchAt]);

  // 행 단위 갱신 (드로어 등에서 사용)
  const patchItem = useCallback((matcher, patch) => {
    setItems((prev) => {
      const next = prev.map((it) => (matcher(it) ? { ...it, ...patch } : it));
      sync({ items: next });
      return next;
    });
  }, [sync]);

  const replaceItems = useCallback((updater) => {
    setItems((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      sync({ items: next });
      return next;
    });
  }, [sync]);

  // 강제 새로고침 (생성/삭제 후) — 캐시 비우고 1페이지부터.
  const reload = useCallback(() => {
    setItems([]);
    setPage(0);
    setHasMore(true);
    sync({ items: [], page: 0, hasMore: true, scrollTop: 0 });
    const el = scrollRef.current;
    if (el) el.scrollTop = 0;
    fetchAt(1, { append: false });
  }, [fetchAt, sync, scrollRef]);

  return {
    items, page, hasMore, extra, loading, initialLoading, error,
    sentinelRef, patchItem, replaceItems, reload,
    retry: () => fetchAt(1, { append: false }),
  };
}
