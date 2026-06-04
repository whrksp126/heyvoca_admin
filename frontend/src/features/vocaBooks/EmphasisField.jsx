// 예문 강조 입력 필드 — 보기/편집 토글.
//  - 보기 모드: <strong class="target-word">…</strong> 태그를 숨기고 볼드(분홍)로 렌더.
//  - 편집 모드(클릭/포커스 시): raw HTML 을 그대로 보여주는 input/textarea 로 전환, blur 시 복귀.
// dangerouslySetInnerHTML 대신 정규식 파싱(target-word 만 화이트리스트)이라 XSS 안전, 라이브러리 불필요.
import React, { useState, useRef, useEffect } from 'react';

// 박스 스타일 (primitives.inputBase / AdminWordRow 인라인 스타일과 외형 일치)
const BOX = {
  md: 'w-full bg-white border border-layout-gray-100 rounded-lg px-3 py-2 text-sm text-layout-black ' +
      'placeholder:text-layout-gray-300 focus:outline-none focus:border-primary-main-400 ' +
      'focus:ring-2 focus:ring-primary-main-100 transition',
  sm: 'flex-1 bg-white border border-layout-gray-100 text-xs text-layout-black rounded-lg px-2 py-1 ' +
      'focus:outline-none focus:border-primary-main-400',
};
const MIN_H = { md: 'min-h-[2.375rem]', sm: 'min-h-[1.625rem]' };

// <strong class="target-word">…</strong> → 볼드 span. 그 외 텍스트는 그대로(이스케이프 자동).
const renderHighlighted = (html) => {
  const re = /<strong[^>]*class=["'][^"']*\btarget-word\b[^"']*["'][^>]*>(.*?)<\/strong>/gi;
  const parts = [];
  let last = 0;
  let m;
  let k = 0;
  while ((m = re.exec(html)) !== null) {
    if (m.index > last) parts.push(<span key={k++}>{html.slice(last, m.index)}</span>);
    parts.push(<span key={k++} className="text-primary-main-600 font-bold">{m[1]}</span>);
    last = re.lastIndex;
  }
  if (last < html.length) parts.push(<span key={k++}>{html.slice(last)}</span>);
  return parts;
};

/**
 * props:
 *  - value       : 현재 문자열(강조 HTML 포함 가능)
 *  - onChange(v) : 새 문자열 값을 인자로 받는 콜백 (이벤트 아님)
 *  - placeholder : 빈 값일 때 안내 문구
 *  - size        : 'md'(기본, VocaDetailDrawer) | 'sm'(AdminWordRow)
 *  - multiline   : true 면 textarea
 */
export default function EmphasisField({ value, onChange, placeholder = '', size = 'md', multiline = false }) {
  const [editing, setEditing] = useState(false);
  const ref = useRef(null);
  const v = value || '';

  useEffect(() => {
    if (editing && ref.current) {
      const el = ref.current;
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
  }, [editing]);

  if (editing) {
    const common = {
      ref,
      value: v,
      placeholder,
      onChange: (e) => onChange(e.target.value),
      onBlur: () => setEditing(false),
      className: BOX[size],
    };
    return multiline
      ? <textarea rows={2} {...common} className={`${BOX[size]} resize-y`} />
      : <input type="text" {...common} />;
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setEditing(true)}
      onFocus={() => setEditing(true)}
      title="클릭하여 편집"
      className={`${BOX[size]} ${MIN_H[size]} cursor-text whitespace-pre-wrap break-words`}
    >
      {v ? renderHighlighted(v) : <span className="text-layout-gray-300">{placeholder}</span>}
    </div>
  );
}
