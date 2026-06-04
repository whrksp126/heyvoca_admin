// AdminVocaBook 단어 한 행 — 의미 chip + 예문(원어/의미) 인라인 편집 + 저장/삭제.
// 사전(voca) 패널에서 의미/예문을 클릭으로 수입(M11)할 수 있다.
import React, { useEffect, useState } from 'react';
import { Button, Input, Tag } from '@/components/ui/primitives';
import { ConfirmModal } from '@/components/ui/overlays';
import { patchAdminWord, deleteAdminWord, getVocaDictionary } from '@/lib/endpoints';
import { ApiError } from '@/lib/api';
import { exOrigin, exMeaning, emphasisLevel } from './helpers';

// 강조 상태 dot 색상 (디자인 토큰)
const DOT = {
  green: { cls: 'bg-status-success-500', title: '원어·의미 모두 강조 처리됨' },
  yellow: { cls: 'bg-secondary-yellow-500', title: '한쪽만 강조 처리됨' },
  red: { cls: 'bg-status-error-500', title: '강조 처리 없음' },
};

export default function AdminWordRow({ bookId, word, onUpdated, onDeleted, onAuthError, toast }) {
  const [meanings, setMeanings] = useState(word.meanings || []);
  const [examples, setExamples] = useState((word.examples || []).map((ex) => ({ origin: exOrigin(ex), meaning: exMeaning(ex) })));
  const [level, setLevel] = useState(word.level ?? '');
  const [newMeaning, setNewMeaning] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [rawWarn, setRawWarn] = useState(word.parse_error || false);

  // 사전 패널 상태
  const [dictOpen, setDictOpen] = useState(false);
  const [dictLoading, setDictLoading] = useState(false);
  const [dict, setDict] = useState(null);

  // 다른 단어로 행이 재사용될 때 초기화
  useEffect(() => {
    setMeanings(word.meanings || []);
    setExamples((word.examples || []).map((ex) => ({ origin: exOrigin(ex), meaning: exMeaning(ex) })));
    setLevel(word.level ?? '');
    setDirty(false);
    setRawWarn(word.parse_error || false);
    setDictOpen(false);
    setDict(null);
  }, [word.map_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const markDirty = () => setDirty(true);

  const handleErr = (e, fallback) => {
    if (e instanceof ApiError && e.status === 401) { onAuthError?.(); return; }
    toast?.error(e?.message || fallback);
  };

  const addMeaning = () => {
    const m = newMeaning.trim();
    if (!m) return;
    if (!meanings.includes(m)) { setMeanings((p) => [...p, m]); markDirty(); }
    setNewMeaning('');
  };
  const removeMeaning = (idx) => { setMeanings((p) => p.filter((_, i) => i !== idx)); markDirty(); };

  const addExample = () => { setExamples((p) => [...p, { origin: '', meaning: '' }]); markDirty(); };
  const updateExample = (idx, key, val) => { setExamples((p) => p.map((e, i) => (i === idx ? { ...e, [key]: val } : e))); markDirty(); };
  const removeExample = (idx) => { setExamples((p) => p.filter((_, i) => i !== idx)); markDirty(); };

  const importMeaning = (text) => {
    if (!text || meanings.includes(text)) return;
    setMeanings((p) => [...p, text]); markDirty();
  };
  const importExample = (origin, meaning) => {
    if (!origin && !meaning) return;
    const dup = examples.some((e) => e.origin === (origin || '') && e.meaning === (meaning || ''));
    if (dup) return;
    setExamples((p) => [...p, { origin: origin || '', meaning: meaning || '' }]); markDirty();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await patchAdminWord(bookId, word.map_id, {
        meanings,
        examples,
        level: level === '' ? null : Number(level),
      });
      onUpdated?.(res?.data);
      setDirty(false);
      setRawWarn(false);
      toast?.success('단어를 저장했습니다.');
    } catch (e) {
      handleErr(e, '단어 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await deleteAdminWord(bookId, word.map_id);
      setConfirmDel(false);
      onDeleted?.(word.map_id);
      toast?.success('단어를 삭제했습니다.');
    } catch (e) {
      setConfirmDel(false);
      handleErr(e, '단어 삭제에 실패했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  const toggleDict = async () => {
    if (dictOpen) { setDictOpen(false); return; }
    setDictOpen(true);
    if (dict) return;
    setDictLoading(true);
    try {
      const res = await getVocaDictionary(word.voca_id);
      setDict(res?.data || null);
    } catch (e) {
      handleErr(e, '사전 조회에 실패했습니다.');
    } finally {
      setDictLoading(false);
    }
  };

  return (
    <div className="border border-layout-gray-100 rounded-lg bg-white p-3 space-y-3">
      {/* 헤더: 단어 정보 + 도구 */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-base font-bold text-layout-black truncate">{word.word}</span>
            {word.pronunciation && <span className="text-xs text-layout-gray-300">[{word.pronunciation}]</span>}
            {word.voca_level != null && <Tag tone="gray">난이도 {word.voca_level}</Tag>}
            <span className="text-[10px] text-layout-gray-300">voca_id {word.voca_id}</span>
          </div>
          {rawWarn && (
            <div className="mt-1 text-[11px] text-secondary-yellow-600">의미/예문 JSON 파싱 실패 — 저장 시 정규화됩니다.</div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button size="sm" variant={dictOpen ? 'blue' : 'secondary'} onClick={toggleDict}>사전</Button>
          <Input
            type="number"
            value={level}
            onChange={(e) => { setLevel(e.target.value); markDirty(); }}
            placeholder="lv"
            className="w-14 px-2 py-1.5"
          />
          <Button size="sm" onClick={handleSave} disabled={!dirty || saving || deleting} loading={saving}>저장</Button>
          <Button size="sm" variant="danger" onClick={() => setConfirmDel(true)} disabled={saving || deleting}>삭제</Button>
        </div>
      </div>

      {/* 사전 패널 (M11) */}
      {dictOpen && (
        <DictionaryPanel
          loading={dictLoading}
          dict={dict}
          existingMeanings={meanings}
          existingExamples={examples}
          onImportMeaning={importMeaning}
          onImportExample={importExample}
        />
      )}

      {/* 의미 chip */}
      <div>
        <div className="text-[11px] text-layout-gray-400 mb-1">의미</div>
        <div className="flex flex-wrap items-center gap-1.5">
          {meanings.map((m, i) => (
            <span key={`${m}-${i}`} className="inline-flex items-center gap-1 bg-layout-gray-50 border border-layout-gray-100 text-layout-gray-500 text-xs rounded-full px-2 py-0.5">
              {m}
              <button onClick={() => removeMeaning(i)} className="text-layout-gray-300 hover:text-status-error-600" aria-label="의미 제거">×</button>
            </span>
          ))}
          <input
            type="text"
            value={newMeaning}
            onChange={(e) => setNewMeaning(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMeaning(); } }}
            placeholder="의미 추가 후 Enter"
            className="bg-white border border-layout-gray-100 text-xs text-layout-black rounded-lg px-2 py-1 w-40 focus:outline-none focus:border-primary-main-400"
          />
        </div>
      </div>

      {/* 예문 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-layout-gray-400">예문</span>
          <button onClick={addExample} className="text-[11px] text-secondary-blue-600 hover:text-secondary-blue-500">+ 예문 추가</button>
        </div>
        <div className="space-y-1.5">
          {examples.length === 0 && <div className="text-[11px] text-layout-gray-300">예문이 없습니다.</div>}
          {examples.map((ex, i) => {
            const dot = DOT[emphasisLevel(ex.origin, ex.meaning)];
            return (
              <div key={i} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full shrink-0 ${dot.cls}`} title={dot.title} aria-label={dot.title} />
                <input
                  type="text" placeholder="원어" value={ex.origin}
                  onChange={(e) => updateExample(i, 'origin', e.target.value)}
                  className="flex-1 bg-white border border-layout-gray-100 text-xs text-layout-black rounded-lg px-2 py-1 focus:outline-none focus:border-primary-main-400"
                />
                <input
                  type="text" placeholder="의미" value={ex.meaning}
                  onChange={(e) => updateExample(i, 'meaning', e.target.value)}
                  className="flex-1 bg-white border border-layout-gray-100 text-xs text-layout-black rounded-lg px-2 py-1 focus:outline-none focus:border-primary-main-400"
                />
                <button onClick={() => removeExample(i)} className="text-layout-gray-300 hover:text-status-error-600 px-1" aria-label="예문 제거">×</button>
              </div>
            );
          })}
        </div>
      </div>

      <ConfirmModal
        open={confirmDel}
        title="단어 삭제"
        message={`"${word.word}" 단어를 단어장에서 제거할까요?`}
        confirmText={deleting ? '삭제 중…' : '삭제'}
        onConfirm={doDelete}
        onCancel={() => !deleting && setConfirmDel(false)}
      />
    </div>
  );
}

// ── 사전 패널: voca의 의미/예문 표시 + 단어장으로 수입 ──
function DictionaryPanel({ loading, dict, existingMeanings, existingExamples, onImportMeaning, onImportExample }) {
  if (loading) {
    return <div className="border border-secondary-blue-200 bg-secondary-blue-50 rounded-lg p-3 text-xs text-secondary-blue-600">사전 데이터를 불러오는 중…</div>;
  }
  if (!dict) return null;
  const meanings = dict.meanings || [];
  const examples = dict.examples || [];
  const takenM = (t) => existingMeanings.includes(t);
  const takenE = (o, m) => existingExamples.some((e) => e.origin === (o || '') && e.meaning === (m || ''));

  return (
    <div className="border border-secondary-blue-200 bg-secondary-blue-50 rounded-lg p-3 space-y-3">
      <div className="text-[11px] text-secondary-blue-600 font-semibold">사전에 있는 데이터 (수입용)</div>
      <div>
        <div className="text-[11px] text-secondary-blue-600 mb-1">의미 ({meanings.length})</div>
        {meanings.length === 0 ? (
          <div className="text-[11px] text-layout-gray-300">사전에 등록된 의미가 없습니다.</div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            {meanings.map((m) => {
              const taken = takenM(m.meaning);
              return (
                <button
                  key={m.id} onClick={() => onImportMeaning(m.meaning)} disabled={taken}
                  className={'inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 border transition-colors ' +
                    (taken ? 'bg-layout-gray-50 border-layout-gray-100 text-layout-gray-300 cursor-not-allowed'
                           : 'bg-white border-secondary-blue-200 text-secondary-blue-600 hover:bg-secondary-blue-100')}
                  title={taken ? '이미 단어장에 있습니다' : '단어장에 추가'}
                >{taken ? '✓' : '+'} {m.meaning}</button>
              );
            })}
          </div>
        )}
      </div>
      <div>
        <div className="text-[11px] text-secondary-blue-600 mb-1">예문 ({examples.length})</div>
        {examples.length === 0 ? (
          <div className="text-[11px] text-layout-gray-300">사전에 등록된 예문이 없습니다.</div>
        ) : (
          <div className="space-y-1.5">
            {examples.map((ex) => {
              const o = exOrigin(ex); const me = exMeaning(ex);
              const taken = takenE(o, me);
              return (
                <div key={ex.id} className="flex items-start gap-2 bg-white border border-secondary-blue-200 rounded-md px-2 py-1.5">
                  <div className="min-w-0 flex-1 text-[11px] leading-relaxed">
                    <div className="text-layout-black" dangerouslySetInnerHTML={{ __html: o }} />
                    <div className="text-layout-gray-400" dangerouslySetInnerHTML={{ __html: me }} />
                  </div>
                  <button
                    onClick={() => onImportExample(o, me)} disabled={taken}
                    className={'shrink-0 px-2 py-0.5 text-[11px] rounded border transition-colors ' +
                      (taken ? 'bg-layout-gray-50 border-layout-gray-100 text-layout-gray-300 cursor-not-allowed'
                             : 'bg-white border-secondary-blue-200 text-secondary-blue-600 hover:bg-secondary-blue-100')}
                    title={taken ? '이미 단어장에 있습니다' : '단어장에 추가'}
                  >{taken ? '✓ 추가됨' : '+ 추가'}</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="text-[10px] text-secondary-blue-600/70">수입한 항목은 dirty 상태로 들어갑니다. 행의 [저장] 버튼을 눌러야 반영됩니다.</div>
    </div>
  );
}
