// 북스토어 생성(T4) / 수정(T5) 폼 모달.
// - 생성: name, level_id(필수), gem, category, category_id, 노출여부, 색상, 연결 단어장 지정
// - 수정: name, color, is_visible, gem, category_id (백엔드가 허용하는 필드만)
import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/overlays';
import { Button, Field, Input, Select, ToggleSwitch } from '@/components/ui/primitives';
import ColorThemePicker, { COLOR_THEMES } from '@/components/ui/ColorThemePicker';
import { createBookstore, updateBookstore } from '@/lib/endpoints';
import { ApiError } from '@/lib/api';
import { useToast } from '@/lib/toast';

const DEFAULT_THEME = { main: COLOR_THEMES[0].main, sub: COLOR_THEMES[0].sub, background: COLOR_THEMES[0].background };

// color 값이 JSON 문자열이거나 객체일 수 있음 → {main,sub,background} 객체로 정규화
function normalizeColor(raw) {
  if (!raw) return { ...DEFAULT_THEME };
  let obj = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return { ...DEFAULT_THEME };
    }
  }
  if (obj && typeof obj === 'object' && obj.main) {
    return { main: obj.main, sub: obj.sub || DEFAULT_THEME.sub, background: obj.background || DEFAULT_THEME.background };
  }
  return { ...DEFAULT_THEME };
}

// 연결 단어장 종류
const LINK_BOOK = 'book';   // book_id (기본 단어장)
const LINK_ADMIN = 'admin'; // admin_voca_book_id (관리자 단어장)

export default function BookstoreFormModal({ open, mode, initial, levels, categories, onClose, onSaved, onAuthError }) {
  const toast = useToast();
  const isEdit = mode === 'edit';

  const [name, setName] = useState('');
  const [levelId, setLevelId] = useState('');
  const [gem, setGem] = useState('0');
  const [order, setOrder] = useState('0');
  const [category, setCategory] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [isVisible, setIsVisible] = useState(true);
  const [color, setColor] = useState({ ...DEFAULT_THEME });
  const [linkType, setLinkType] = useState(LINK_BOOK);
  const [linkId, setLinkId] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  // 모달이 열릴 때마다 초기값 동기화
  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (isEdit && initial) {
      setName(initial.name || '');
      setLevelId(initial.level_id != null ? String(initial.level_id) : '');
      setGem(String(initial.gem ?? 0));
      setOrder(String(initial.downloads ?? 0));
      setCategory(initial.category || '');
      setCategoryId(initial.category_id != null ? String(initial.category_id) : '');
      setIsVisible(initial.hide !== 'Y');
      setColor(normalizeColor(initial.color));
      if (initial.admin_voca_book_id != null) {
        setLinkType(LINK_ADMIN);
        setLinkId(String(initial.admin_voca_book_id));
      } else {
        setLinkType(LINK_BOOK);
        setLinkId(initial.book_id != null ? String(initial.book_id) : '');
      }
    } else {
      setName('');
      setLevelId('');
      setGem('0');
      setOrder('0');
      setCategory('');
      setCategoryId('');
      setIsVisible(true);
      setColor({ ...DEFAULT_THEME });
      setLinkType(LINK_BOOK);
      setLinkId('');
    }
  }, [open, isEdit, initial]);

  const selectedLevel = useMemo(
    () => levels.find((l) => String(l.id) === String(levelId)),
    [levels, levelId],
  );

  const validate = () => {
    const e = {};
    if (!name.trim()) e.name = '이름을 입력하세요.';
    if (!isEdit && !levelId) e.levelId = '레벨을 선택하세요.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (isEdit) {
        // 수정: 백엔드가 허용하는 필드만
        await updateBookstore(initial.id, {
          name: name.trim(),
          color,
          is_visible: isVisible,
          gem: Number(gem) || 0,
          category_id: categoryId ? Number(categoryId) : null,
        });
        toast.success('북스토어가 수정되었습니다.');
      } else {
        const payload = {
          name: name.trim(),
          level_id: Number(levelId),
          level_name: selectedLevel?.level_name,
          gem: Number(gem) || 0,
          order: Number(order) || 0,
          category: category.trim(),
          category_id: categoryId ? Number(categoryId) : null,
          is_visible: isVisible,
          color,
        };
        // 연결 단어장: 둘 중 하나만 전송
        if (linkId) {
          if (linkType === LINK_ADMIN) payload.admin_voca_book_id = Number(linkId);
          else payload.book_id = Number(linkId);
        }
        await createBookstore(payload);
        toast.success('북스토어가 생성되었습니다.');
      }
      onSaved?.();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onAuthError?.();
        return;
      }
      toast.error(err?.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? '북스토어 수정' : '북스토어 생성'}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>취소</Button>
          <Button onClick={submit} loading={saving}>{isEdit ? '저장' : '생성'}</Button>
        </>
      )}
    >
      <div className="space-y-4">
        <Field label="이름" required error={errors.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="북스토어 이름" />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field
            label="레벨"
            required={!isEdit}
            error={errors.levelId}
            hint={isEdit ? '레벨은 생성 후 변경할 수 없습니다.' : undefined}
          >
            <Select value={levelId} onChange={(e) => setLevelId(e.target.value)} disabled={isEdit}>
              <option value="">선택</option>
              {levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.level_name ? `${l.level_name} (Lv.${l.level})` : `Lv.${l.level}`}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="보석 가격 (gem)">
            <Input type="number" min="0" value={gem} onChange={(e) => setGem(e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="카테고리">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">선택 안 함</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.category}</option>
              ))}
            </Select>
          </Field>

          {!isEdit && (
            <Field label="카테고리 라벨 (자유 입력)" hint="레거시 category 텍스트 필드">
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="예: 토익" />
            </Field>
          )}
        </div>

        {!isEdit && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="연결 단어장 종류">
              <Select value={linkType} onChange={(e) => setLinkType(e.target.value)}>
                <option value={LINK_BOOK}>기본 단어장 (book_id)</option>
                <option value={LINK_ADMIN}>관리자 단어장 (admin_voca_book_id)</option>
              </Select>
            </Field>
            <Field label="단어장 ID" hint="비워두면 연결하지 않습니다.">
              <Input type="number" min="1" value={linkId} onChange={(e) => setLinkId(e.target.value)} placeholder="ID" />
            </Field>
          </div>
        )}

        {!isEdit && (
          <Field label="정렬 순서 (downloads)" hint="목록 정렬 기준값">
            <Input type="number" min="0" value={order} onChange={(e) => setOrder(e.target.value)} />
          </Field>
        )}

        <Field label="노출 여부">
          <ToggleSwitch checked={isVisible} onChange={setIsVisible} label={isVisible ? '공개' : '비공개'} />
        </Field>

        <Field label="색상 테마">
          <ColorThemePicker value={color} onChange={setColor} />
        </Field>
      </div>
    </Modal>
  );
}
