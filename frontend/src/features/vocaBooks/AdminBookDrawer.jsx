// AdminVocaBook 편집 드로어 (M8~M16, T16/T18/T19/T22/T23).
// 메타 편집 + 서점 인라인 + 단어 행 인라인 편집/추가/삭제 + 예문 강조 자동 태깅.
import React, { useCallback, useEffect, useState } from 'react';
import { Drawer } from '@/components/ui/overlays';
import { Button, Field, Input, Select, Spinner } from '@/components/ui/primitives';
import { getAdminBook, patchAdminBook } from '@/lib/endpoints';
import { ApiError } from '@/lib/api';
import AdminWordRow from './AdminWordRow';
import AdminWordAddForm from './AdminWordAddForm';
import BookstoreInlineForm from './BookstoreInlineForm';
import TagExamplesModal from './TagExamplesModal';

const SOURCE_OPTIONS = ['AI 생성', '직접 제작'];

export default function AdminBookDrawer({ bookId, onClose, onChanged, onAuthError, toast }) {
  const [loading, setLoading] = useState(true);
  const [book, setBook] = useState(null);
  const [bookstore, setBookstore] = useState(null);
  const [words, setWords] = useState([]);
  const [wordFilter, setWordFilter] = useState('');
  const [tagOpen, setTagOpen] = useState(false);

  // 메타 폼
  const [meta, setMeta] = useState({ book_nm: '', language: '', source: '', category: '', username: '' });
  const [metaDirty, setMetaDirty] = useState(false);
  const [metaSaving, setMetaSaving] = useState(false);

  const handleErr = useCallback((e, fallback) => {
    if (e instanceof ApiError && e.status === 401) { onAuthError?.(); return; }
    toast?.error(e?.message || fallback);
  }, [onAuthError, toast]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAdminBook(bookId);
      const b = res?.data?.book || null;
      setBook(b);
      setBookstore(b?.bookstore || null);
      setWords(res?.data?.words || []);
      setMeta({
        book_nm: b?.book_nm || '', language: b?.language || '',
        source: b?.source || '', category: b?.category || '', username: b?.username || '',
      });
      setMetaDirty(false);
    } catch (e) {
      handleErr(e, '단어장 정보를 불러오지 못했습니다.');
      onClose?.();
    } finally {
      setLoading(false);
    }
  }, [bookId, handleErr, onClose]);

  useEffect(() => { load(); }, [load]);

  // 메타 저장 (M9/T16)
  const changeMeta = (k, v) => { setMeta((p) => ({ ...p, [k]: v })); setMetaDirty(true); };
  const saveMeta = async () => {
    setMetaSaving(true);
    try {
      const res = await patchAdminBook(bookId, meta);
      const updated = res?.data;
      setBook((p) => ({ ...p, ...updated }));
      setMetaDirty(false);
      onChanged?.({ id: bookId, ...meta });
      toast?.success('메타 정보를 저장했습니다.');
    } catch (e) {
      handleErr(e, '메타 정보 저장에 실패했습니다.');
    } finally {
      setMetaSaving(false);
    }
  };

  // 서점 변경 → 목록 행 동기화
  const onBookstoreChanged = (next) => {
    setBookstore(next || null);
    setBook((p) => p ? { ...p, bookstore: next || null } : p);
    onChanged?.({ id: bookId, is_registered: !!next, bookstore_name: next?.name });
  };

  // 단어 변경 콜백
  const onWordUpdated = (updated) => {
    if (!updated) return;
    setWords((prev) => prev.map((w) => w.map_id === updated.map_id
      ? { ...w, meanings: updated.meanings, examples: updated.examples, level: updated.level, parse_error: false }
      : w));
  };
  const onWordDeleted = (mapId) => {
    setWords((prev) => prev.filter((w) => w.map_id !== mapId));
    setBook((p) => p ? { ...p, word_count: Math.max(0, (p.word_count || 0) - 1) } : p);
    onChanged?.({ id: bookId, word_count: Math.max(0, (book?.word_count || 0) - 1) });
  };
  const onWordAdded = (added) => {
    if (!added) return;
    setWords((prev) => [...prev, {
      map_id: added.map_id, voca_id: added.voca_id, word: added.word,
      pronunciation: added.pronunciation, verb_forms: added.verb_forms, voca_level: added.voca_level,
      level: added.level, meanings: added.meanings || [], examples: added.examples || [],
      parse_error: false, is_active: true,
    }]);
    setBook((p) => p ? { ...p, word_count: (p.word_count || 0) + 1 } : p);
    onChanged?.({ id: bookId, word_count: (book?.word_count || 0) + 1 });
  };

  const filtered = wordFilter
    ? words.filter((w) =>
        (w.word || '').toLowerCase().includes(wordFilter.toLowerCase()) ||
        (w.meanings || []).some((m) => m.includes(wordFilter)))
    : words;

  return (
    <Drawer
      open
      onClose={onClose}
      subtitle={`관리자 단어장 #${bookId}`}
      title={book?.book_nm || '불러오는 중…'}
    >
      {loading ? (
        <Spinner label="단어장 정보를 불러오는 중…" />
      ) : book && (
        <>
          {/* 메타 정보 (M9/T16) */}
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
              <Field label="Source" required>
                <Select value={meta.source} onChange={(e) => changeMeta('source', e.target.value)}>
                  {!SOURCE_OPTIONS.includes(meta.source) && meta.source && (
                    <option value={meta.source}>{meta.source}</option>
                  )}
                  {SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Field>
              <Field label="카테고리">
                <Input value={meta.category} onChange={(e) => changeMeta('category', e.target.value)} />
              </Field>
              <Field label="작성자">
                <Input value={meta.username} onChange={(e) => changeMeta('username', e.target.value)} />
              </Field>
              <Field label="단어 수 (자동)">
                <Input value={book.word_count ?? 0} disabled />
              </Field>
            </div>
          </section>

          {/* 서점 인라인 (M15/M16) */}
          <BookstoreInlineForm
            book={book}
            bookstore={bookstore}
            defaultName={book.book_nm}
            defaultCategory={book.category}
            onChanged={onBookstoreChanged}
            onAuthError={onAuthError}
            toast={toast}
          />

          {/* 단어 섹션 */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-layout-black">단어 <span className="text-layout-gray-300 font-normal">({words.length})</span></h3>
              <div className="flex items-center gap-2">
                <input
                  type="text" placeholder="단어/의미 필터" value={wordFilter}
                  onChange={(e) => setWordFilter(e.target.value)}
                  className="bg-white border border-layout-gray-100 text-xs text-layout-black rounded-lg px-2 py-1.5 w-40 focus:outline-none focus:border-primary-main-400"
                />
                <Button size="sm" variant="blue" onClick={() => setTagOpen(true)}>예문 강조 자동 태깅</Button>
              </div>
            </div>

            <AdminWordAddForm bookId={bookId} onAdded={onWordAdded} onAuthError={onAuthError} toast={toast} />

            <div className="space-y-2">
              {filtered.length === 0 ? (
                <div className="text-center text-layout-gray-300 text-xs py-8">
                  {wordFilter ? '필터에 맞는 단어가 없습니다.' : '단어가 없습니다.'}
                </div>
              ) : filtered.map((w) => (
                <AdminWordRow
                  key={w.map_id}
                  bookId={bookId}
                  word={w}
                  onUpdated={onWordUpdated}
                  onDeleted={onWordDeleted}
                  onAuthError={onAuthError}
                  toast={toast}
                />
              ))}
            </div>
          </section>
        </>
      )}

      {tagOpen && (
        <TagExamplesModal
          bookId={bookId}
          onClose={() => setTagOpen(false)}
          onSaved={() => { setTagOpen(false); load(); }}
          onAuthError={onAuthError}
          toast={toast}
        />
      )}
    </Drawer>
  );
}
