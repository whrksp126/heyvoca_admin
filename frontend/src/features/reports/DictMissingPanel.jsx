// 사전 추가 요청 — 앱 사전 말풍선에서 '사전에 없는 단어'로 뜬 단어를 사용자가 요청한 것(reason=dict_missing).
// 단어(언어+정규화 키)별로 묶어 요청자 수 많은 순. 이미 사전에 있으면(요청 뒤 추가됨) 바로 편집 Drawer,
// 없으면 단어 관리(검색어 채움)·단어장 관리(단어 추가)로 이동. 묶음 단위로 처리/반려.
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PencilSimple, MagnifyingGlass, PlusCircle, Copy } from '@phosphor-icons/react';
import { Button, Card, Input, Select, Spinner, Tag } from '@/components/ui/primitives';
import { ApiError } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { clearList, setList } from '@/lib/listCache';
import VocaDetailDrawer from '@/features/voca/VocaDetailDrawer';
import { listDictMissing, patchDictMissing } from './api';
import { STATUS_LABEL, STATUS_TONE, fmtDate } from './shared';

const LANG_LABEL = { en: '영어', ja: '일본어' };
const SOURCE_LABEL = {
  fillInTheBlank: '빈칸 채우기', fillInTheBlankTyping: '빈칸 입력', sentenceArrange: '문장 만들기',
  sentenceArrangeAnswer: '문장 만들기(정답)', sentenceTranslate: '문장 해석',
};

export default function DictMissingPanel({ onAuthError }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ status: 'open', lang: '', from: '', to: '', q: '' });
  const [page, setPage] = useState(1);
  const [list, setListState] = useState({ items: [], total: 0, has_more: false });
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState(null);
  const [editVocaId, setEditVocaId] = useState(null);

  const handleErr = useCallback((e, fallback) => {
    if (e instanceof ApiError && e.status === 401) { onAuthError?.(); return; }
    toast.error(e?.message || fallback);
  }, [onAuthError, toast]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listDictMissing({ ...filters, page });
      setListState(res?.data || { items: [], total: 0 });
    } catch (e) { handleErr(e, '사전 추가 요청을 불러오지 못했습니다.'); }
    finally { setLoading(false); }
  }, [filters, page, handleErr]);

  useEffect(() => { load(); }, [load]);

  const setFilter = (k, v) => { setPage(1); setFilters((f) => ({ ...f, [k]: v })); };

  const setStatus = async (item, status) => {
    const key = `${item.dict_lang}:${item.key}`;
    setBusyKey(key);
    try {
      const res = await patchDictMissing({ dict_lang: item.dict_lang, key: item.key, status });
      toast.success(`'${item.word || item.key}' 요청 ${res?.data?.updated ?? 0}건을 '${STATUS_LABEL[status]}'(으)로 바꿨습니다.`);
      load();
    } catch (e) { handleErr(e, '상태 변경에 실패했습니다.'); }
    finally { setBusyKey(null); }
  };

  const openVocaSearch = (word) => {
    clearList('voca');
    setList('voca', { search: word });
    navigate('/voca');
  };

  const copy = async (word) => {
    try { await navigator.clipboard.writeText(word); toast.success(`'${word}' 를 복사했습니다.`); }
    catch { toast.error('복사하지 못했습니다.'); }
  };

  const items = list.items || [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-layout-gray-300">
        사전 말풍선에서 '사전에 없는 단어'로 나온 단어를 사용자가 요청한 목록. 같은 사용자는 단어당 1번만 셉니다. 조건에 맞는 단어 {list.total?.toLocaleString?.() ?? 0}개
      </p>

      <Card className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        <Select value={filters.status} onChange={(e) => setFilter('status', e.target.value)} aria-label="상태">
          <option value="">상태 전체</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select value={filters.lang} onChange={(e) => setFilter('lang', e.target.value)} aria-label="언어">
          <option value="">언어 전체</option>
          {Object.entries(LANG_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Input type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} aria-label="시작일" />
        <Input type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} aria-label="종료일" />
        <Input value={filters.q} onChange={(e) => setFilter('q', e.target.value)} placeholder="단어 검색" aria-label="검색" />
      </Card>

      <Card className="overflow-hidden">
        {loading ? <Spinner label="사전 추가 요청을 불러오는 중…" /> : items.length === 0 ? (
          <div className="py-12 text-center text-sm text-layout-gray-300">조건에 맞는 요청이 없습니다.</div>
        ) : (
          <ul className="divide-y divide-layout-gray-100">
            {items.map((it) => {
              const k = `${it.dict_lang}:${it.key}`;
              return (
                <li key={k} className="p-3 sm:p-4 flex flex-col lg:flex-row lg:items-start gap-3">
                  <div className="lg:w-56 shrink-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-base font-bold text-layout-black break-all">{it.word || it.key}</span>
                      <span className="text-lg font-bold text-primary-main-600">{it.users}</span>
                      <span className="text-xs text-layout-gray-300">명 요청</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Tag>{LANG_LABEL[it.dict_lang] || it.dict_lang}</Tag>
                      {it.open_count > 0 ? <Tag tone={STATUS_TONE.open}>대기 {it.open_count}</Tag> : <Tag tone="gray">대기 없음</Tag>}
                      {it.existing_voca_id ? <Tag tone="green">사전에 있음 #{it.existing_voca_id}</Tag> : <Tag tone="yellow">사전에 없음</Tag>}
                    </div>
                    <p className="mt-1 text-[11px] text-layout-gray-300">
                      키 {it.key} · 최근 {fmtDate(it.last_at)}
                    </p>
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    {(it.samples || []).map((s, i) => (
                      <p key={i} className="text-sm text-layout-gray-500 break-words">
                        {s.context ? `“${s.context}”` : <span className="text-layout-gray-300">문맥 없음</span>}
                        <span className="ml-1.5 text-[11px] text-layout-gray-300">{SOURCE_LABEL[s.source] || s.source || ''}</span>
                      </p>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-1.5 lg:justify-end lg:w-72 shrink-0">
                    {it.existing_voca_id && it.dict_lang === 'en' ? (
                      <Button size="sm" variant="blue" onClick={() => setEditVocaId(it.existing_voca_id)}>
                        <PencilSimple size={14} weight="bold" /> 사전 단어 편집
                      </Button>
                    ) : it.dict_lang === 'en' ? (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => openVocaSearch(it.key)}>
                          <MagnifyingGlass size={14} weight="bold" /> 단어 관리에서 찾기
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => navigate('/voca-books')}>
                          <PlusCircle size={14} weight="bold" /> 단어장 관리에서 추가
                        </Button>
                      </>
                    ) : (
                      <span className="text-[11px] text-layout-gray-300 self-center">일본어 사전은 어드민 편집 화면이 아직 없습니다.</span>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => copy(it.word || it.key)} aria-label="단어 복사">
                      <Copy size={14} weight="bold" />
                    </Button>
                    <Button size="sm" loading={busyKey === k} onClick={() => setStatus(it, 'resolved')}>처리</Button>
                    <Button size="sm" variant="secondary" loading={busyKey === k} onClick={() => setStatus(it, 'rejected')}>반려</Button>
                    {it.open_count < it.count && (
                      <Button size="sm" variant="ghost" loading={busyKey === k} onClick={() => setStatus(it, 'open')}>대기로</Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {(page > 1 || list.has_more) && (
        <div className="flex justify-center gap-2">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>이전</Button>
          <span className="text-sm text-layout-gray-400 self-center">{page} 페이지</span>
          <Button size="sm" variant="secondary" disabled={!list.has_more} onClick={() => setPage((p) => p + 1)}>다음</Button>
        </div>
      )}

      {editVocaId != null && (
        <VocaDetailDrawer
          vocaId={editVocaId}
          onClose={() => setEditVocaId(null)}
          onSaved={() => { setEditVocaId(null); load(); }}
          onAuthError={onAuthError}
          toast={toast}
        />
      )}
    </div>
  );
}
