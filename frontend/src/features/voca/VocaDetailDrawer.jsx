import React, { useEffect, useState, useCallback } from 'react';
import { Drawer, ConfirmModal } from '@/components/ui/overlays';
import { Button, Field, Input, Textarea, Spinner, ToggleSwitch, Tag } from '@/components/ui/primitives';
import { getVoca, patchVoca, hideVoca, showVoca } from '@/lib/endpoints';
import { ApiError } from '@/lib/api';
import EmphasisField from '../vocaBooks/EmphasisField';

// 난이도 옵션 (백엔드 level 컬럼 — 숫자/문자 자유. 미지정 가능)
const LEVEL_OPTIONS = ['', '1', '2', '3', '4', '5'];

// 빈 폼 기본값
const emptyForm = { word: '', pronunciation: '', verb_forms: '', level: '', meanings: [], examples: [] };

/**
 * 단어 상세 조회(T26) + 수정(T27) + 노출/숨김(T28/T29) Drawer.
 *
 * props:
 *  - vocaId            : 열려있는 단어 id (null 이면 닫힘)
 *  - initialActive     : 목록에서 넘겨받은 현재 노출 상태 (낙관적 표시용)
 *  - onClose()         : 닫기
 *  - onSaved(id)       : 저장 성공 후 목록 갱신용 콜백
 *  - onActiveChange(id, active) : 노출 상태 변경 시 목록 동기화
 *  - onAuthError()     : 401 처리
 *  - toast             : useToast() 결과
 */
export default function VocaDetailDrawer({
  vocaId, initialActive = true, onClose, onSaved, onActiveChange, onAuthError, toast,
}) {
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState(initialActive);
  const [toggling, setToggling] = useState(false);
  const [confirmHide, setConfirmHide] = useState(false);

  const handleApiError = useCallback((e, fallback) => {
    if (e instanceof ApiError && e.status === 401) { onAuthError?.(); return; }
    toast.error(e?.message || fallback);
  }, [onAuthError, toast]);

  // 상세 로드
  useEffect(() => {
    if (vocaId == null) return;
    let alive = true;
    setLoading(true);
    setLoadError(null);
    setActive(initialActive);
    getVoca(vocaId)
      .then((res) => {
        if (!alive) return;
        const d = res?.data || {};
        setForm({
          word: d.word || '',
          pronunciation: d.pronunciation || '',
          verb_forms: d.verb_forms || '',
          level: d.level != null ? String(d.level) : '',
          meanings: (d.meanings || []).map((m) => ({ id: m.id, meaning: m.meaning || '' })),
          examples: (d.examples || []).map((ex) => ({
            id: ex.id, exam_en: ex.exam_en || '', exam_ko: ex.exam_ko || '',
          })),
        });
      })
      .catch((e) => {
        if (!alive) return;
        if (e instanceof ApiError && e.status === 401) { onAuthError?.(); return; }
        setLoadError(e?.message || '단어 정보를 불러오지 못했습니다.');
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [vocaId, initialActive, onAuthError]);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  // ── 뜻 목록 편집 ──
  const addMeaning = () => setForm((f) => ({ ...f, meanings: [...f.meanings, { id: null, meaning: '' }] }));
  const updateMeaning = (idx, value) =>
    setForm((f) => ({ ...f, meanings: f.meanings.map((m, i) => (i === idx ? { ...m, meaning: value } : m)) }));
  const removeMeaning = (idx) =>
    setForm((f) => ({ ...f, meanings: f.meanings.filter((_, i) => i !== idx) }));

  // ── 예문 목록 편집 ──
  const addExample = () =>
    setForm((f) => ({ ...f, examples: [...f.examples, { id: null, exam_en: '', exam_ko: '' }] }));
  const updateExample = (idx, key, value) =>
    setForm((f) => ({ ...f, examples: f.examples.map((ex, i) => (i === idx ? { ...ex, [key]: value } : ex)) }));
  const removeExample = (idx) =>
    setForm((f) => ({ ...f, examples: f.examples.filter((_, i) => i !== idx) }));

  // ── 저장(T27) ──
  const handleSave = async () => {
    if (!form.word.trim()) { toast.error('단어(word)는 필수입니다.'); return; }
    setSaving(true);
    try {
      const patch = {
        word: form.word.trim(),
        pronunciation: form.pronunciation.trim(),
        verb_forms: form.verb_forms.trim(),
        level: form.level || '',
        // 빈 항목은 백엔드가 무시하므로 그대로 전달
        meanings: form.meanings.map((m) => ({ id: m.id, meaning: m.meaning })),
        examples: form.examples.map((ex) => ({ id: ex.id, exam_en: ex.exam_en, exam_ko: ex.exam_ko })),
      };
      const res = await patchVoca(vocaId, patch);
      const saved = res?.data?.examples;
      if (Array.isArray(saved)) {
        // 저장 시 백엔드가 강조 안 된 예문을 자동 태깅 → 결과를 폼에 반영
        setForm((f) => ({
          ...f,
          examples: saved.map((ex) => ({ id: ex.id, exam_en: ex.exam_en || '', exam_ko: ex.exam_ko || '' })),
        }));
      }
      toast.success('저장 완료. 강조가 자동 적용되었습니다.');
      onSaved?.(vocaId);
    } catch (e) {
      handleApiError(e, '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // ── 노출/숨김(T28/T29) ──
  const applyToggle = async (next) => {
    setToggling(true);
    try {
      if (next) await showVoca(vocaId);
      else await hideVoca(vocaId);
      setActive(next);
      onActiveChange?.(vocaId, next);
      toast.success(next ? '단어를 노출했습니다.' : '단어를 숨겼습니다.');
    } catch (e) {
      handleApiError(e, '노출 상태 변경에 실패했습니다.');
    } finally {
      setToggling(false);
    }
  };

  const handleToggle = (next) => {
    if (!next) { setConfirmHide(true); return; } // 숨김은 확인 다이얼로그
    applyToggle(true);
  };

  return (
    <Drawer
      open={vocaId != null}
      onClose={onClose}
      subtitle={`단어 #${vocaId ?? ''}`}
      title={form.word || (loading ? '불러오는 중…' : '단어 상세')}
    >
      {loading ? (
        <Spinner label="단어 정보를 불러오는 중…" />
      ) : loadError ? (
        <div className="text-sm text-status-error-600 py-8 text-center">{loadError}</div>
      ) : (
        <>
          {/* 노출 상태 (T28/T29) */}
          <section className="bg-white border border-layout-gray-100 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-layout-black">노출 상태</span>
              <Tag tone={active ? 'green' : 'gray'}>{active ? '노출 중' : '숨김'}</Tag>
            </div>
            <ToggleSwitch
              checked={active}
              disabled={toggling}
              onChange={handleToggle}
              label={active ? '노출' : '숨김'}
            />
          </section>

          {/* 기본 정보 (T27) */}
          <section className="bg-white border border-layout-gray-100 rounded-xl p-4 space-y-4">
            <h4 className="text-sm font-bold text-layout-black">기본 정보</h4>
            <Field label="단어 (word)" required>
              <Input value={form.word} onChange={(e) => setField('word', e.target.value)} placeholder="예: apple" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="발음 (pronunciation)">
                <Input value={form.pronunciation} onChange={(e) => setField('pronunciation', e.target.value)} placeholder="예: ˈæpl" />
              </Field>
              <Field label="난이도 (level)">
                <select
                  value={form.level}
                  onChange={(e) => setField('level', e.target.value)}
                  className="w-full bg-white border border-layout-gray-100 rounded-lg px-3 py-2 text-sm text-layout-black pr-8 cursor-pointer focus:outline-none focus:border-primary-main-400 focus:ring-2 focus:ring-primary-main-100 transition"
                >
                  {LEVEL_OPTIONS.map((lv) => (
                    <option key={lv || 'none'} value={lv}>{lv === '' ? '미지정' : `레벨 ${lv}`}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="동사형 (verb_forms)" hint="여러 형태는 쉼표 등으로 구분해 자유롭게 입력">
              <Textarea
                value={form.verb_forms}
                onChange={(e) => setField('verb_forms', e.target.value)}
                placeholder="예: go, went, gone"
              />
            </Field>
          </section>

          {/* 뜻 목록 (T27) */}
          <section className="bg-white border border-layout-gray-100 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-layout-black">뜻 ({form.meanings.length})</h4>
              <Button variant="secondary" size="sm" onClick={addMeaning}>+ 뜻 추가</Button>
            </div>
            {form.meanings.length === 0 ? (
              <p className="text-xs text-layout-gray-300 py-2">등록된 뜻이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {form.meanings.map((m, idx) => (
                  <div key={m.id ?? `new-${idx}`} className="flex items-center gap-2">
                    <span className="text-xs text-layout-gray-300 w-5 text-right">{idx + 1}</span>
                    <Input
                      value={m.meaning}
                      onChange={(e) => updateMeaning(idx, e.target.value)}
                      placeholder="뜻을 입력하세요"
                    />
                    <Button variant="ghost" size="sm" onClick={() => removeMeaning(idx)} className="text-status-error-600 shrink-0">삭제</Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 예문 목록 (T27) */}
          <section className="bg-white border border-layout-gray-100 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-layout-black">예문 ({form.examples.length})</h4>
              <Button variant="secondary" size="sm" onClick={addExample}>+ 예문 추가</Button>
            </div>
            {form.examples.length === 0 ? (
              <p className="text-xs text-layout-gray-300 py-2">등록된 예문이 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {form.examples.map((ex, idx) => (
                  <div key={ex.id ?? `new-${idx}`} className="border border-layout-gray-100 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-layout-gray-300">예문 {idx + 1}</span>
                      <Button variant="ghost" size="sm" onClick={() => removeExample(idx)} className="text-status-error-600">삭제</Button>
                    </div>
                    <Field label="원문 (exam_en)">
                      <EmphasisField value={ex.exam_en} onChange={(val) => updateExample(idx, 'exam_en', val)} placeholder="영어 예문" />
                    </Field>
                    <Field label="번역 (exam_ko)">
                      <EmphasisField value={ex.exam_ko} onChange={(val) => updateExample(idx, 'exam_ko', val)} placeholder="한국어 번역" />
                    </Field>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 저장 액션 */}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={onClose}>닫기</Button>
            <Button variant="primary" loading={saving} onClick={handleSave}>저장</Button>
          </div>
        </>
      )}

      <ConfirmModal
        open={confirmHide}
        title="단어 숨김"
        message={`"${form.word}" 단어를 숨길까요?\n앱 사용자에게 더 이상 노출되지 않습니다.`}
        confirmText="숨김"
        tone="danger"
        onCancel={() => setConfirmHide(false)}
        onConfirm={() => { setConfirmHide(false); applyToggle(false); }}
      />
    </Drawer>
  );
}
