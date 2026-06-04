// 북스토어 색상 테마 5종 팔레트 + 미리보기 (팀원 T7 기능 보존, 디자인 토큰 색상).
// value/onChange 는 { main, sub, background } 객체.
import React from 'react';

export const COLOR_THEMES = [
  { key: 'pink',   label: '핑크',   main: '#FF70D4', sub: '#FFD7F3', background: '#FFEEFA' },
  { key: 'purple', label: '퍼플',   main: '#7A5AF8', sub: '#EBE9FE', background: '#F4F3FF' },
  { key: 'blue',   label: '블루',   main: '#2E90FA', sub: '#D1E9FF', background: '#EFF8FF' },
  { key: 'mint',   label: '민트',   main: '#00D0BF', sub: '#C1FDF8', background: '#E8FDFB' },
  { key: 'yellow', label: '옐로우', main: '#FB6514', sub: '#FFEAD5', background: '#FFF8E5' },
];

const sameTheme = (a, t) =>
  a && (a.main || '').toLowerCase() === t.main.toLowerCase();

export default function ColorThemePicker({ value, onChange }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {COLOR_THEMES.map((t) => {
          const active = sameTheme(value, t);
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onChange?.({ main: t.main, sub: t.sub, background: t.background })}
              className={
                'flex items-center gap-2 rounded-lg border px-3 py-2 transition ' +
                (active
                  ? 'border-primary-main-400 ring-2 ring-primary-main-100'
                  : 'border-layout-gray-100 hover:border-layout-gray-200')
              }
              title={t.label}
            >
              <span className="flex">
                <span className="w-4 h-4 rounded-l" style={{ background: t.main }} />
                <span className="w-4 h-4" style={{ background: t.sub }} />
                <span className="w-4 h-4 rounded-r border border-layout-gray-100" style={{ background: t.background }} />
              </span>
              <span className="text-xs text-layout-gray-500">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* 미리보기 */}
      <div
        className="rounded-xl p-4 border border-layout-gray-100"
        style={{ background: value?.background || '#fff' }}
      >
        <div className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold"
             style={{ background: value?.main || '#ccc', color: '#fff' }}>
          미리보기
        </div>
        <div className="mt-2 inline-block ml-2 rounded-md px-2 py-1 text-xs"
             style={{ background: value?.sub || '#eee', color: value?.main || '#666' }}>
          서브 색상
        </div>
      </div>
    </div>
  );
}
