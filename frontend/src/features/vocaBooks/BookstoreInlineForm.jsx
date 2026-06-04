// 드로어 내 "서점 등록" 인라인 섹션 (M15/M16).
// - 미등록: 정보 입력 후 toggleBookstore(payload)로 최초 등록
// - 등록됨: 노출 토글(toggleBookstore({})) + 정보 인라인 수정(patchBookstoreInline)
import React, { useEffect, useState } from 'react';
import { Button, Field, Input, Tag, ToggleSwitch } from '@/components/ui/primitives';
import ColorThemePicker, { COLOR_THEMES } from '@/components/ui/ColorThemePicker';
import { toggleBookstore, patchBookstoreInline } from '@/lib/endpoints';
import { ApiError } from '@/lib/api';
import { parseColor } from './helpers';

const DEFAULT_THEME = { main: COLOR_THEMES[0].main, sub: COLOR_THEMES[0].sub, background: COLOR_THEMES[0].background };

const buildForm = (bs) => ({
  name: bs?.name || '',
  gem: bs?.gem ?? 10,
  category: bs?.category || '',
  category_id: bs?.category_id ?? '',
  level_id: bs?.level_id ?? 1,
  level: bs?.level || '',
  downloads: bs?.downloads ?? 0,
  color: parseColor(bs?.color) || { ...DEFAULT_THEME },
});

export default function BookstoreInlineForm({ book, bookstore, defaultName, defaultCategory, onChanged, onAuthError, toast }) {
  const [form, setForm] = useState(() => buildForm(bookstore));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [registering, setRegistering] = useState(false); // 미등록 상태에서 등록 폼 펼침

  useEffect(() => {
    setForm(bookstore ? buildForm(bookstore) : {
      ...buildForm(null),
      name: defaultName || '',
      category: defaultCategory || '',
    });
    setDirty(false);
  }, [bookstore?.id, bookstore?.hide, bookstore?.gem, bookstore?.color]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleErr = (e, fallback) => {
    if (e instanceof ApiError && e.status === 401) { onAuthError?.(); return; }
    toast?.error(e?.message || fallback);
  };

  const change = (key, val) => { setForm((p) => ({ ...p, [key]: val })); setDirty(true); };

  // 등록 payload(최초) / 수정 payload(공통)
  const buildPayload = () => ({
    name: form.name,
    gem: Number(form.gem) || 0,
    category: form.category || null,
    category_id: form.category_id === '' ? null : Number(form.category_id),
    level_id: Number(form.level_id),
    level: form.level || null,
    downloads: Number(form.downloads) || 0,
    color: JSON.stringify(form.color),
  });

  // 노출 토글 (등록된 경우)
  const onToggleVisible = async () => {
    setToggling(true);
    try {
      const res = await toggleBookstore(book.id, {});
      onChanged?.(res?.data?.bookstore);
      toast?.success('서점 노출 상태를 변경했습니다.');
    } catch (e) {
      handleErr(e, '노출 토글에 실패했습니다.');
    } finally {
      setToggling(false);
    }
  };

  // 최초 등록
  const onRegister = async () => {
    if (!form.name.trim()) { toast?.error('서점 표시명을 입력하세요.'); return; }
    setSaving(true);
    try {
      const res = await toggleBookstore(book.id, buildPayload());
      onChanged?.(res?.data?.bookstore ?? res?.data);
      setRegistering(false);
      toast?.success('서점에 등록했습니다.');
    } catch (e) {
      handleErr(e, '서점 등록에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 등록 정보 수정
  const onSaveInfo = async () => {
    setSaving(true);
    try {
      const res = await patchBookstoreInline(book.id, buildPayload());
      onChanged?.(res?.data?.bookstore ?? res?.data);
      setDirty(false);
      toast?.success('서점 정보를 저장했습니다.');
    } catch (e) {
      handleErr(e, '서점 정보 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const isVisible = bookstore?.hide === 'N';

  // 정보 입력 필드 (등록/수정 공용)
  const fields = (
    <>
      <Field label="서점 표시명" required>
        <Input value={form.name} onChange={(e) => change('name', e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="가격 (gem)">
          <Input type="number" min="0" value={form.gem} onChange={(e) => change('gem', e.target.value)} />
        </Field>
        <Field label="레벨 ID">
          <Input type="number" min="0" value={form.level_id} onChange={(e) => change('level_id', e.target.value)} />
        </Field>
        <Field label="카테고리">
          <Input value={form.category} onChange={(e) => change('category', e.target.value)} />
        </Field>
        <Field label="카테고리 ID (선택)">
          <Input type="number" min="0" value={form.category_id} onChange={(e) => change('category_id', e.target.value)} placeholder="선택" />
        </Field>
        <Field label="레벨 라벨">
          <Input value={form.level} onChange={(e) => change('level', e.target.value)} placeholder="예: 초급" />
        </Field>
        <Field label="다운로드">
          <Input type="number" min="0" value={form.downloads} onChange={(e) => change('downloads', e.target.value)} />
        </Field>
      </div>
      <Field label="색상 테마">
        <ColorThemePicker value={form.color} onChange={(c) => change('color', c)} />
      </Field>
    </>
  );

  return (
    <section className="border border-layout-gray-100 rounded-xl bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-layout-black">서점 등록</h3>
        {bookstore ? (
          <div className="flex items-center gap-2">
            <Tag tone={isVisible ? 'green' : 'gray'}>{isVisible ? '노출중' : '숨김'}</Tag>
            <ToggleSwitch checked={isVisible} disabled={toggling} onChange={onToggleVisible} />
          </div>
        ) : !registering ? (
          <Button size="sm" onClick={() => setRegistering(true)}>+ 서점에 등록</Button>
        ) : (
          <button onClick={() => setRegistering(false)} className="text-xs text-layout-gray-400 hover:text-layout-gray-500">취소</button>
        )}
      </div>

      {/* 등록됨: 정보 인라인 수정 */}
      {bookstore && (
        <>
          {fields}
          <div className="flex justify-end">
            <Button size="sm" onClick={onSaveInfo} disabled={!dirty || saving} loading={saving}>
              {dirty ? '서점 정보 저장' : '변경 없음'}
            </Button>
          </div>
        </>
      )}

      {/* 미등록 + 등록 폼 펼침 */}
      {!bookstore && registering && (
        <>
          {fields}
          <div className="flex justify-end">
            <Button size="sm" onClick={onRegister} disabled={saving || !form.name.trim()} loading={saving}>등록 후 노출</Button>
          </div>
        </>
      )}

      {!bookstore && !registering && (
        <p className="text-[12px] text-layout-gray-300">아직 서점에 등록되지 않았습니다.</p>
      )}
    </section>
  );
}
