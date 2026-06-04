// AI로 단어장 생성 (T20 생성/미리보기 / T21 저장).
// 1) 조건 입력 → generateWords 로 미리보기 단어 생성
// 2) 단어/의미/예문 편집·삭제
// 3) createAdminVocaBookFromAI 로 관리자 단어장 저장
import React, { useState } from 'react';
import { Modal } from '@/components/ui/overlays';
import { Button, Field, Input, Textarea, Spinner } from '@/components/ui/primitives';
import { generateWords, createAdminVocaBookFromAI } from '@/lib/endpoints';
import { ApiError } from '@/lib/api';

const MAX_WORDS = 150;
const SOURCE_OPTIONS = ['AI 생성', '직접 제작'];

export default function AiGenerateModal({ onClose, onCreated, onAuthError, toast }) {
  // 단계: 'form'(조건) | 'preview'(편집)
  const [step, setStep] = useState('form');

  // 조건
  const [bookNm, setBookNm] = useState('');
  const [language, setLanguage] = useState('영어');
  const [source, setSource] = useState('AI 생성');
  const [category, setCategory] = useState('');
  const [username, setUsername] = useState('');
  const [wordCount, setWordCount] = useState(20);
  const [situation, setSituation] = useState('');

  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [words, setWords] = useState([]); // [{word, meanings:[str], examples:[{en,ko}]}]

  const handleErr = (e, fallback) => {
    if (e instanceof ApiError && e.status === 401) { onAuthError?.(); return; }
    toast?.error(e?.message || fallback);
  };

  const generate = async () => {
    if (!bookNm.trim()) { toast?.error('단어장명을 입력하세요.'); return; }
    const cnt = Math.min(MAX_WORDS, Math.max(1, Number(wordCount) || 0));
    setGenerating(true);
    try {
      const res = await generateWords({
        book_nm: bookNm.trim(),
        word_count: cnt,
        category: category.trim(),
        situation: situation.trim(),
      });
      if (!res?.success || !Array.isArray(res.words)) {
        toast?.error('단어 생성에 실패했습니다.');
        return;
      }
      setWords(res.words.map((w) => ({
        word: w.word || '',
        meanings: w.meanings || [],
        examples: (w.examples || []).map((ex) => ({ en: ex.en || '', ko: ex.ko || '' })),
      })));
      setStep('preview');
    } catch (e) {
      handleErr(e, '단어 생성에 실패했습니다.');
    } finally {
      setGenerating(false);
    }
  };

  // 미리보기 편집
  const updateWord = (i, key, val) => setWords((p) => p.map((w, idx) => (idx === i ? { ...w, [key]: val } : w)));
  const updateMeanings = (i, val) => updateWord(i, 'meanings', val.split(',').map((s) => s.trim()).filter(Boolean));
  const updateExample = (wi, ei, key, val) =>
    setWords((p) => p.map((w, idx) => idx === wi
      ? { ...w, examples: w.examples.map((ex, j) => (j === ei ? { ...ex, [key]: val } : ex)) } : w));
  const removeExample = (wi, ei) =>
    setWords((p) => p.map((w, idx) => idx === wi ? { ...w, examples: w.examples.filter((_, j) => j !== ei) } : w));
  const addExample = (wi) =>
    setWords((p) => p.map((w, idx) => idx === wi ? { ...w, examples: [...w.examples, { en: '', ko: '' }] } : w));
  const removeWord = (i) => setWords((p) => p.filter((_, idx) => idx !== i));

  const save = async () => {
    const cleaned = words.filter((w) => w.word.trim());
    if (cleaned.length === 0) { toast?.error('저장할 단어가 없습니다.'); return; }
    setSaving(true);
    try {
      await createAdminVocaBookFromAI({
        book_nm: bookNm.trim(),
        language: language.trim(),
        source,
        category: category.trim(),
        username: username.trim(),
        words: cleaned,
      });
      toast?.success('AI 단어장을 생성했습니다.');
      onCreated?.();
    } catch (e) {
      handleErr(e, 'AI 단어장 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title="AI로 단어장 생성"
      footer={step === 'form' ? (
        <>
          <Button variant="secondary" onClick={onClose} disabled={generating}>취소</Button>
          <Button onClick={generate} loading={generating}>단어 생성</Button>
        </>
      ) : (
        <>
          <Button variant="secondary" onClick={() => setStep('form')} disabled={saving}>조건 다시 입력</Button>
          <Button onClick={save} loading={saving} disabled={words.length === 0}>단어장 저장 ({words.filter((w) => w.word.trim()).length})</Button>
        </>
      )}
    >
      {step === 'form' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="단어장명" required>
              <Input value={bookNm} onChange={(e) => setBookNm(e.target.value)} placeholder="예: 비즈니스 영어" />
            </Field>
            <Field label="언어" required>
              <Input value={language} onChange={(e) => setLanguage(e.target.value)} />
            </Field>
            <Field label="Source">
              <select value={source} onChange={(e) => setSource(e.target.value)} className="w-full bg-white border border-layout-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-main-400">
                {SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="카테고리">
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="예: 비즈니스" />
            </Field>
            <Field label="작성자">
              <Input value={username} onChange={(e) => setUsername(e.target.value)} />
            </Field>
            <Field label={`단어 수 (최대 ${MAX_WORDS})`} required>
              <Input type="number" min="1" max={MAX_WORDS} value={wordCount} onChange={(e) => setWordCount(e.target.value)} />
            </Field>
          </div>
          <Field label="상황/주제 (선택)" hint="생성할 단어의 맥락을 자유롭게 입력하세요.">
            <Textarea value={situation} onChange={(e) => setSituation(e.target.value)} placeholder="예: 호텔 체크인, 공항 등 여행 상황에서 자주 쓰는 단어" />
          </Field>
          {generating && <Spinner label="AI가 단어를 생성하는 중…" />}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-sm text-layout-gray-400">{words.length}개 단어 미리보기 · 저장 전에 자유롭게 수정/삭제하세요.</div>
          {words.map((w, i) => (
            <div key={i} className="border border-layout-gray-100 rounded-lg p-3 bg-white space-y-2">
              <div className="flex items-center gap-2">
                <Input value={w.word} onChange={(e) => updateWord(i, 'word', e.target.value)} placeholder="단어" className="flex-1 font-semibold" />
                <Button size="sm" variant="danger" onClick={() => removeWord(i)}>삭제</Button>
              </div>
              <Field label="의미 (콤마 구분)">
                <Input value={(w.meanings || []).join(', ')} onChange={(e) => updateMeanings(i, e.target.value)} />
              </Field>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-layout-gray-400">예문</span>
                  <button onClick={() => addExample(i)} className="text-[11px] text-secondary-blue-600 hover:text-secondary-blue-500">+ 예문 추가</button>
                </div>
                <div className="space-y-1.5">
                  {(w.examples || []).map((ex, ei) => (
                    <div key={ei} className="flex items-center gap-1.5">
                      <input value={ex.en} onChange={(e) => updateExample(i, ei, 'en', e.target.value)} placeholder="EN"
                        className="flex-1 bg-white border border-layout-gray-100 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-primary-main-400" />
                      <input value={ex.ko} onChange={(e) => updateExample(i, ei, 'ko', e.target.value)} placeholder="KO"
                        className="flex-1 bg-white border border-layout-gray-100 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-primary-main-400" />
                      <button onClick={() => removeExample(i, ei)} className="text-layout-gray-300 hover:text-status-error-600 px-1" aria-label="예문 제거">×</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
