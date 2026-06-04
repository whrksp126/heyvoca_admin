// legacy VocaBook 편집 드로어 (T11~T14).
// 메타 편집(patchVocaBook) + 단어 목록(getVocaBookWords, 페이지네이션) + 단어 추가/삭제.
// legacy는 서점 인라인 토글 엔드포인트가 없어 안내만 노출한다.
import React, { useCallback, useEffect, useState } from 'react';
import { Drawer, ConfirmModal } from '@/components/ui/overlays';
import { Button, Field, Input, Select, Spinner } from '@/components/ui/primitives';
import { patchVocaBook, getVocaBookWords, addVocaBookWord, removeVocaBookWord } from '@/lib/endpoints';
import { ApiError } from '@/lib/api';

const SOURCE_OPTIONS = ['AI 생성', '직접 제작'];
const PER_PAGE = 50;

export default function LegacyBookDrawer({ book: initial, onClose, onChanged, onAuthError, toast }) {
  const bookId = initial.id;

  const [meta, setMeta] = useState({
    book_nm: initial.book_nm || '', language: initial.language || '',
    source: initial.source || '', category: initial.category || '', username: initial.username || '',
  });
  const [metaDirty, setMetaDirty] = useState(false);
  const [metaSaving, setMetaSaving] = useState(false);

  const [loading, setLoading] = useState(true);
  const [words, setWords] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, has_next: false, has_prev: false });

  // 단어 추가 폼
  const [addOpen, setAddOpen] = useState(false);
  const [newWord, setNewWord] = useState('');
  const [newPron, setNewPron] = useState('');
  const [adding, setAdding] = useState(false);

  const [confirmDel, setConfirmDel] = useState(null); // {voca_id, word}
  const [deleting, setDeleting] = useState(false);

  const handleErr = useCallback((e, fallback) => {
    if (e instanceof ApiError && e.status === 401) { onAuthError?.(); return; }
    toast?.error(e?.message || fallback);
  }, [onAuthError, toast]);

  const loadWords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getVocaBookWords(bookId, { page, perPage: PER_PAGE });
      const data = res?.data || {};
      setWords(data.words || []);
      setPagination(data.pagination || { page: 1, pages: 1, total: 0, has_next: false, has_prev: false });
    } catch (e) {
      handleErr(e, '단어 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [bookId, page, handleErr]);

  useEffect(() => { loadWords(); }, [loadWords]);

  const changeMeta = (k, v) => { setMeta((p) => ({ ...p, [k]: v })); setMetaDirty(true); };
  const saveMeta = async () => {
    setMetaSaving(true);
    try {
      await patchVocaBook(bookId, meta);
      setMetaDirty(false);
      onChanged?.({ id: bookId, ...meta });
      toast?.success('메타 정보를 저장했습니다.');
    } catch (e) {
      handleErr(e, '메타 정보 저장에 실패했습니다.');
    } finally {
      setMetaSaving(false);
    }
  };

  const addWord = async () => {
    if (!newWord.trim()) return;
    setAdding(true);
    try {
      await addVocaBookWord(bookId, { word: newWord.trim(), pronunciation: newPron.trim() || null });
      setNewWord(''); setNewPron(''); setAddOpen(false);
      toast?.success('단어를 추가했습니다.');
      onChanged?.({ id: bookId, word_count: (pagination.total || 0) + 1 });
      if (page !== 1) setPage(1); else loadWords();
    } catch (e) {
      handleErr(e, '단어 추가에 실패했습니다.');
    } finally {
      setAdding(false);
    }
  };

  const doDelete = async () => {
    if (!confirmDel) return;
    setDeleting(true);
    try {
      await removeVocaBookWord(bookId, confirmDel.voca_id);
      setConfirmDel(null);
      toast?.success('단어를 제거했습니다.');
      onChanged?.({ id: bookId, word_count: Math.max(0, (pagination.total || 0) - 1) });
      loadWords();
    } catch (e) {
      setConfirmDel(null);
      handleErr(e, '단어 제거에 실패했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Drawer open onClose={onClose} subtitle={`기본 단어장 #${bookId}`} title={meta.book_nm || initial.book_nm}>
      {/* 메타 정보 (T11) */}
      <section className="border border-layout-gray-100 rounded-xl bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-layout-black">메타 정보</h3>
          <Button size="sm" onClick={saveMeta} disabled={!metaDirty || metaSaving} loading={metaSaving}>
            {metaDirty ? '저장' : '변경 없음'}
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="단어장명" required>
            <Input value={meta.book_nm} onChange={(e) => changeMeta('book_nm', e.target.value)} />
          </Field>
          <Field label="언어" required>
            <Input value={meta.language} onChange={(e) => changeMeta('language', e.target.value)} />
          </Field>
          <Field label="Source">
            <Select value={meta.source} onChange={(e) => changeMeta('source', e.target.value)}>
              <option value="">선택</option>
              {!SOURCE_OPTIONS.includes(meta.source) && meta.source && <option value={meta.source}>{meta.source}</option>}
              {SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="카테고리">
            <Input value={meta.category} onChange={(e) => changeMeta('category', e.target.value)} />
          </Field>
          <Field label="작성자">
            <Input value={meta.username} onChange={(e) => changeMeta('username', e.target.value)} />
          </Field>
        </div>
      </section>

      {/* 서점 안내 (legacy는 인라인 토글 없음) */}
      <section className="border border-layout-gray-100 rounded-xl bg-layout-gray-50 p-4">
        <p className="text-[12px] text-layout-gray-400">
          기본 단어장의 서점 등록은 <span className="font-medium text-layout-gray-500">북스토어 관리</span> 메뉴에서 진행하세요.
        </p>
      </section>

      {/* 단어 섹션 (T12~T14) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-layout-black">단어 <span className="text-layout-gray-300 font-normal">({pagination.total})</span></h3>
          {!addOpen && <Button size="sm" onClick={() => setAddOpen(true)}>+ 단어 추가</Button>}
        </div>

        {addOpen && (
          <div className="border border-layout-gray-100 rounded-lg bg-white p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-layout-black">단어 추가</span>
              <button onClick={() => { setAddOpen(false); setNewWord(''); setNewPron(''); }} className="text-xs text-layout-gray-400 hover:text-layout-gray-500">닫기</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="단어" required>
                <Input value={newWord} onChange={(e) => setNewWord(e.target.value)} placeholder="word" />
              </Field>
              <Field label="발음 (선택)">
                <Input value={newPron} onChange={(e) => setNewPron(e.target.value)} placeholder="발음" />
              </Field>
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={addWord} disabled={adding || !newWord.trim()} loading={adding}>추가</Button>
            </div>
          </div>
        )}

        {loading ? (
          <Spinner label="단어 목록을 불러오는 중…" />
        ) : words.length === 0 ? (
          <div className="text-center text-layout-gray-300 text-xs py-8">단어가 없습니다.</div>
        ) : (
          <div className="space-y-2">
            {words.map((w) => (
              <div key={w.voca_id} className="border border-layout-gray-100 rounded-lg bg-white p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-bold text-layout-black">{w.word}</span>
                    {w.pronunciation && <span className="text-xs text-layout-gray-300">[{w.pronunciation}]</span>}
                    <span className="text-[10px] text-layout-gray-300">voca_id {w.voca_id}</span>
                  </div>
                  {(w.meanings || []).length > 0 && (
                    <div className="text-xs text-layout-gray-400 mt-1">{w.meanings.join(', ')}</div>
                  )}
                  {(w.examples || []).length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {w.examples.map((ex, i) => (
                        <div key={i} className="text-[11px] text-layout-gray-300">
                          {ex.exam_en || ex.origin || ex.en} {ex.exam_ko || ex.meaning || ex.ko ? `· ${ex.exam_ko || ex.meaning || ex.ko}` : ''}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Button size="sm" variant="danger" onClick={() => setConfirmDel({ voca_id: w.voca_id, word: w.word })}>삭제</Button>
              </div>
            ))}
          </div>
        )}

        {/* 페이지네이션 */}
        {!loading && pagination.total > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-layout-gray-300">{pagination.page} / {pagination.pages} 페이지</span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={!pagination.has_prev} onClick={() => setPage((p) => Math.max(1, p - 1))}>이전</Button>
              <Button size="sm" variant="secondary" disabled={!pagination.has_next} onClick={() => setPage((p) => p + 1)}>다음</Button>
            </div>
          </div>
        )}
      </section>

      <ConfirmModal
        open={!!confirmDel}
        title="단어 제거"
        message={confirmDel ? `"${confirmDel.word}" 단어를 단어장에서 제거할까요?` : ''}
        confirmText={deleting ? '제거 중…' : '제거'}
        onConfirm={doDelete}
        onCancel={() => !deleting && setConfirmDel(null)}
      />
    </Drawer>
  );
}
