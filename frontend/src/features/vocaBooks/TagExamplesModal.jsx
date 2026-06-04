// 예문 강조 자동 태깅 (T22 미리보기 / T23 저장).
// tagExamples(id) → strong 태깅 결과 미리보기 → saveTaggedExamples(id, {items})로 저장.
import React, { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/overlays';
import { Button, Spinner, Tag } from '@/components/ui/primitives';
import { tagExamples, saveTaggedExamples } from '@/lib/endpoints';
import { ApiError } from '@/lib/api';
import { hasEmphasis } from './helpers';

export default function TagExamplesModal({ bookId, onClose, onSaved, onAuthError, toast }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState([]);

  const handleErr = (e, fallback) => {
    if (e instanceof ApiError && e.status === 401) { onAuthError?.(); return; }
    toast?.error(e?.message || fallback);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await tagExamples(bookId);
        setResults(res?.data?.results || []);
      } catch (e) {
        handleErr(e, '예문 강조 태깅에 실패했습니다.');
        onClose?.();
      } finally {
        setLoading(false);
      }
    })();
  }, [bookId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 강조가 적용된 예문 건수
  const changedCount = results.reduce((acc, r) =>
    acc + (r.examples || []).filter((ex) => hasEmphasis(ex.en) || hasEmphasis(ex.ko)).length, 0);

  const save = async () => {
    setSaving(true);
    try {
      const items = results.map((r) => ({ map_id: r.map_id, examples: r.examples || [] }));
      await saveTaggedExamples(bookId, { items });
      toast?.success('강조 태깅을 저장했습니다.');
      onSaved?.();
    } catch (e) {
      handleErr(e, '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title="예문 강조 자동 태깅"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>닫기</Button>
          <Button onClick={save} loading={saving} disabled={loading || results.length === 0}>저장</Button>
        </>
      )}
    >
      {loading ? (
        <Spinner label="예문을 분석하는 중…" />
      ) : results.length === 0 ? (
        <div className="py-8 text-center text-sm text-layout-gray-300">태깅할 예문이 없습니다.</div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-layout-gray-400">
            단어 {results.length}개 · 강조 적용 예문 <Tag tone="green">{changedCount}건</Tag>
            <span className="text-[12px] text-layout-gray-300">저장하면 미리보기 내용이 그대로 반영됩니다.</span>
          </div>
          <div className="space-y-3">
            {results.map((r) => (
              <div key={r.map_id} className="border border-layout-gray-100 rounded-lg p-3 bg-white">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="font-bold text-layout-black">{r.word}</span>
                  {(r.meanings || []).length > 0 && (
                    <span className="text-xs text-layout-gray-400">{r.meanings.join(', ')}</span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {(r.examples || []).length === 0 && <div className="text-[12px] text-layout-gray-300">예문 없음</div>}
                  {(r.examples || []).map((ex, i) => (
                    <div key={i} className="text-[12px] leading-relaxed border-l-2 border-layout-gray-100 pl-2">
                      <div className="text-layout-black" dangerouslySetInnerHTML={{ __html: ex.en || '' }} />
                      <div className="text-layout-gray-400" dangerouslySetInnerHTML={{ __html: ex.ko || '' }} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
