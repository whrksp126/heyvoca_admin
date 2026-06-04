// 엑셀로 단어장 추가 (T10 기본 / T15 관리자).
// 유형 선택 → 메타 입력 + 엑셀 파일 → multipart 업로드.
import React, { useRef, useState } from 'react';
import { Modal } from '@/components/ui/overlays';
import { Button, Field, Input, Select } from '@/components/ui/primitives';
import { createVocaBookExcel, createAdminVocaBookExcel } from '@/lib/endpoints';
import { ApiError } from '@/lib/api';

const SOURCE_OPTIONS = ['AI 생성', '직접 제작'];

export default function ExcelUploadModal({ onClose, onCreated, onAuthError, toast }) {
  const fileRef = useRef(null);
  const [bookType, setBookType] = useState('admin'); // 'admin' | 'legacy'
  const [bookNm, setBookNm] = useState('');
  const [language, setLanguage] = useState('영어');
  const [source, setSource] = useState('직접 제작');
  const [category, setCategory] = useState('');
  const [username, setUsername] = useState('');
  const [fileName, setFileName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleErr = (e, fallback) => {
    if (e instanceof ApiError && e.status === 401) { onAuthError?.(); return; }
    toast?.error(e?.message || fallback);
  };

  const submit = async () => {
    const file = fileRef.current?.files?.[0];
    if (!bookNm.trim()) { toast?.error('단어장명을 입력하세요.'); return; }
    if (!language.trim()) { toast?.error('언어를 입력하세요.'); return; }
    if (!file) { toast?.error('엑셀 파일을 선택하세요.'); return; }

    const fd = new FormData();
    fd.append('book_nm', bookNm.trim());
    fd.append('language', language.trim());
    fd.append('source', source);
    fd.append('category', category.trim());
    fd.append('username', username.trim());
    fd.append('excel_file', file);

    setSaving(true);
    try {
      if (bookType === 'admin') await createAdminVocaBookExcel(fd);
      else await createVocaBookExcel(fd);
      toast?.success('단어장을 생성했습니다.');
      onCreated?.();
    } catch (e) {
      handleErr(e, '단어장 생성에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title="엑셀로 단어장 추가"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>취소</Button>
          <Button onClick={submit} loading={saving}>생성</Button>
        </>
      )}
    >
      <div className="space-y-4">
        <Field label="단어장 유형" hint="관리자 단어장은 풍부한 편집(서점/예문 강조 등)을 지원합니다.">
          <Select value={bookType} onChange={(e) => setBookType(e.target.value)}>
            <option value="admin">관리자 단어장</option>
            <option value="legacy">기본 단어장</option>
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="단어장명" required>
            <Input value={bookNm} onChange={(e) => setBookNm(e.target.value)} placeholder="예: 토익 필수 단어" />
          </Field>
          <Field label="언어" required>
            <Input value={language} onChange={(e) => setLanguage(e.target.value)} />
          </Field>
          <Field label="Source">
            <Select value={source} onChange={(e) => setSource(e.target.value)}>
              {SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="카테고리">
            <Input value={category} onChange={(e) => setCategory(e.target.value)} />
          </Field>
          <Field label="작성자">
            <Input value={username} onChange={(e) => setUsername(e.target.value)} />
          </Field>
        </div>
        <Field label="엑셀 파일" required hint=".xlsx / .xls">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setFileName(e.target.files?.[0]?.name || '')}
            className="block w-full text-sm text-layout-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-main-600 file:text-white hover:file:bg-primary-main-500"
          />
          {fileName && <span className="block text-[11px] text-layout-gray-400 mt-1">선택됨: {fileName}</span>}
        </Field>
      </div>
    </Modal>
  );
}
