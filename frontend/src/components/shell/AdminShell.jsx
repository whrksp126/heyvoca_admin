// 데스크탑 관리자 셸 — 좌측 사이드바 + 상단 바. 라이트 테마.
import React, { useRef } from 'react';
import { NavLink } from 'react-router-dom';
import {
  ChartLineUp, Books, Translate, Storefront, SpeakerHigh, Waveform, SignOut,
} from '@phosphor-icons/react';
import { ScrollContext } from '@/lib/scrollContext';

const NAV = [
  { to: '/overview', label: '개요', icon: ChartLineUp },
  { to: '/voca-books', label: '단어장 관리', icon: Books },
  { to: '/voca', label: '단어 관리', icon: Translate },
  { to: '/bookstore', label: '북스토어', icon: Storefront },
  { to: '/tts', label: 'TTS 모니터링', icon: SpeakerHigh },
  { to: '/tts-test', label: 'TTS 테스트', icon: Waveform },
];

export default function AdminShell({ userId, onLogout, children }) {
  const mainRef = useRef(null);
  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-white border-r border-layout-gray-100 flex flex-col">
        <div className="px-5 py-5">
          <div className="text-xl font-bold text-primary-main-600">HeyVoca</div>
          <div className="text-xs text-layout-gray-300 mt-0.5">관리자 콘솔</div>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ' +
                (isActive
                  ? 'bg-primary-main-100 text-primary-main-600'
                  : 'text-layout-gray-400 hover:bg-layout-gray-50 hover:text-layout-gray-500')
              }
            >
              <Icon size={20} weight="bold" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-layout-gray-100">
          <div className="px-3 py-2 text-xs text-layout-gray-300 truncate">{userId}</div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-layout-gray-400 hover:bg-status-error-100 hover:text-status-error-600 transition-colors"
          >
            <SignOut size={20} weight="bold" />
            로그아웃
          </button>
        </div>
      </aside>

      {/* Content — 메인은 스크롤하지 않고(overflow-hidden), 각 페이지가 자체 영역만 스크롤한다 */}
      <ScrollContext.Provider value={mainRef}>
        <main ref={mainRef} className="flex-1 min-w-0 overflow-hidden">
          {children}
        </main>
      </ScrollContext.Provider>
    </div>
  );
}
