// AdminVocaBook 단어 추가 폼 (M12 ⊇ T18).
// - word 입력 시 searchVoca 자동완성으로 기존 voca 선택 가능 (M13)
// - 추가 시 409 동음이의 후보 응답을 받으면 기존 voca 선택 또는 강제 신규 생성(force) 처리
import React, { useEffect, useRef, useState } from 'react';
import { Button, Input, Field } from '@/components/ui/primitives';
import { addAdminWord, searchVoca } from '@/lib/endpoints';
import { ApiError } from '@/lib/api';

export default function AdminWordAddForm({ bookId, onAdded, onAuthError, toast }) {
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState('');
  const [pronunciation, setPronunciation] = useState('');
  const [meaningsText, setMeaningsText] = useState('');
  const [exOriginV, setExOriginV] = useState('');
  const [exMeaningV, setExMeaningV] = useState('');
  const [level, setLevel] = useState('');
  const [saving, setSaving] = useState(false);
  const [candidates, setCandidates] = useState(null);
  const [existingMapId, setExistingMapId] = useState(null);

  // 자동완성
  const [suggestions, setSuggestions] = useState([]);
  const [showSug, setShowSug] = useState(false);
  const sugTimer = useRef(null);

  const reset = () => {
    setWord(''); setPronunciation(''); setMeaningsText('');
    setExOriginV(''); setExMeaningV(''); setLevel('');
    setCandidates(null); setExistingMapId(null); setSuggestions([]); setShowSug(false);
  };

  // word 입력 시 자동완성 (debounce 300ms)
  useEffect(() => {
    if (sugTimer.current) clearTimeout(sugTimer.current);
    const q = word.trim();
    if (q.length < 1) { setSuggestions([]); return; }
    sugTimer.current = setTimeout(async () => {
      try {
        const res = await searchVoca(q, 8);
        setSuggestions(res?.data || []);
        setShowSug(true);
      } catch { /* 자동완성 실패는 조용히 무시 */ }
    }, 300);
    return () => clearTimeout(sugTimer.current);
  }, [word]);

  const handleErr = (e, fallback) => {
    if (e instanceof ApiError && e.status === 401) { onAuthError?.(); return; }
    toast?.error(e?.message || fallback);
  };

  const buildPayload = (vocaId) => {
    const meanings = meaningsText.split(',').map((s) => s.trim()).filter(Boolean);
    const examples = (exOriginV.trim() || exMeaningV.trim())
      ? [{ origin: exOriginV.trim(), meaning: exMeaningV.trim() }] : [];
    if (vocaId) return { voca_id: vocaId, meanings, examples, level: level === '' ? null : Number(level) };
    return {
      word: word.trim(),
      pronunciation: pronunciation.trim() || null,
      meanings, examples,
      level: level === '' ? null : Number(level),
    };
  };

  const submit = async (opts = {}) => {
    setSaving(true);
    setExistingMapId(null);
    try {
      const res = await addAdminWord(bookId, buildPayload(opts.vocaId), { force: opts.force });
      onAdded?.(res?.data);
      reset();
      setOpen(false);
      toast?.success('단어를 추가했습니다.');
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const data = e.payload?.data || {};
        if (data.existing_map_id) {
          setExistingMapId(data.existing_map_id);
        } else if (data.candidates) {
          setCandidates(data.candidates);
        } else {
          toast?.error(e.message || '이미 단어장에 있는 단어입니다.');
        }
      } else {
        handleErr(e, '단어 추가에 실패했습니다.');
      }
    } finally {
      setSaving(false);
    }
  };

  const pickSuggestion = (s) => {
    setWord(s.word);
    if (s.pronunciation) setPronunciation(s.pronunciation);
    setShowSug(false);
  };

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>+ 단어 추가</Button>
    );
  }

  return (
    <div className="border border-layout-gray-100 rounded-lg bg-white p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-layout-black">단어 추가</span>
        <button onClick={() => { setOpen(false); reset(); }} className="text-xs text-layout-gray-400 hover:text-layout-gray-500">닫기</button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="relative">
          <Field label="단어" required>
            <Input
              value={word}
              onChange={(e) => setWord(e.target.value)}
              onFocus={() => suggestions.length && setShowSug(true)}
              placeholder="word"
            />
          </Field>
          {showSug && suggestions.length > 0 && (
            <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-layout-gray-100 rounded-lg shadow-lg max-h-48 overflow-y-auto thin-scroll">
              {suggestions.map((s) => (
                <button
                  key={s.id ?? s.voca_id ?? s.word}
                  onClick={() => pickSuggestion(s)}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-layout-gray-50 flex items-center gap-2"
                >
                  <span className="font-medium text-layout-black">{s.word}</span>
                  {s.pronunciation && <span className="text-xs text-layout-gray-300">[{s.pronunciation}]</span>}
                  {s.voca_id != null && <span className="ml-auto text-[10px] text-layout-gray-300">#{s.voca_id ?? s.id}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <Field label="발음 (선택)">
          <Input value={pronunciation} onChange={(e) => setPronunciation(e.target.value)} placeholder="발음" />
        </Field>
      </div>

      <Field label="의미 (콤마 구분: 사과, 능금)">
        <Input value={meaningsText} onChange={(e) => setMeaningsText(e.target.value)} placeholder="의미" />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="예문 원어 (선택)">
          <Input value={exOriginV} onChange={(e) => setExOriginV(e.target.value)} />
        </Field>
        <Field label="예문 의미 (선택)">
          <Input value={exMeaningV} onChange={(e) => setExMeaningV(e.target.value)} />
        </Field>
      </div>

      <div className="flex items-center gap-2">
        <div className="w-20">
          <Field label="레벨">
            <Input type="number" value={level} onChange={(e) => setLevel(e.target.value)} placeholder="lv" />
          </Field>
        </div>
        <div className="flex-1" />
        <Button onClick={() => submit()} disabled={saving || !word.trim()} loading={saving}>추가</Button>
      </div>

      {/* 이미 단어장에 존재 */}
      {existingMapId && (
        <div className="border border-secondary-yellow-200 bg-secondary-yellow-50 rounded-lg p-2 text-[12px] text-secondary-yellow-600">
          이미 이 단어장에 포함된 단어입니다.
        </div>
      )}

      {/* 409 동음이의 후보 */}
      {candidates && (
        <div className="border border-secondary-yellow-200 bg-secondary-yellow-50 rounded-lg p-3 space-y-2">
          <div className="text-[12px] text-secondary-yellow-600">사전에 동일 단어가 있어요. 기존 단어를 선택하거나 강제로 신규 생성하세요.</div>
          <div className="space-y-1.5">
            {candidates.map((c) => (
              <div key={c.voca_id} className="flex items-center gap-2 text-xs">
                <Button size="sm" variant="secondary" onClick={() => submit({ vocaId: c.voca_id })} disabled={saving}>
                  voca_id {c.voca_id} 선택
                </Button>
                <span className="text-layout-gray-500">{c.word}</span>
                {c.pronunciation && <span className="text-layout-gray-300">[{c.pronunciation}]</span>}
                {c.level != null && <span className="text-layout-gray-300">난이도 {c.level}</span>}
              </div>
            ))}
            <button onClick={() => submit({ force: true })} disabled={saving} className="text-[12px] text-secondary-yellow-600 hover:underline">
              ↪ 그래도 신규 voca로 생성하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
