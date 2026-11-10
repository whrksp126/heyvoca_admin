// 관리자 셸 — lg 이상: 좌측 고정 사이드바 + 상단 바 없음(기존 그대로).
// lg 미만(모바일/태블릿): 상단 바 + 햄버거로 여는 사이드 드로어.
import React, { useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  ChartLineUp, Books, Translate, Storefront, ArrowsClockwise, Flag, UsersThree, SignOut, List, X,
} from '@phosphor-icons/react';
import { ScrollContext } from '@/lib/scrollContext';

const NAV = [
  { to: '/overview', label: '개요', icon: ChartLineUp },
  { to: '/voca-books', label: '단어장 관리', icon: Books },
  { to: '/voca', label: '단어 관리', icon: Translate },
  { to: '/bookstore', label: '북스토어', icon: Storefront },
  { to: '/dict-sync', label: '사전 동기화', icon: ArrowsClockwise },
  { to: '/reports', label: '신고 관리', icon: Flag },
  { to: '/users', label: '유저 관리', icon: UsersThree },
];

export default function AdminShell({ userId, onLogout, children }) {
  const mainRef = useRef(null);
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  const currentLabel = NAV.find((n) => location.pathname.startsWith(n.to))?.label || '';

  const navLinks = (onNavigate) => (
    <nav className="flex-1 px-3 space-y-1">
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
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
  );

  const accountFooter = (
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
  );

  return (
    <div className="flex flex-col lg:flex-row h-full">
      {/* 모바일/태블릿 상단 바 (lg 이상에서는 숨김) */}
      <header className="lg:hidden shrink-0 flex items-center gap-3 px-4 py-3 bg-white border-b border-layout-gray-100">
        <button
          onClick={() => setNavOpen(true)}
          className="w-9 h-9 -ml-1.5 grid place-items-center rounded-lg text-layout-gray-500 hover:bg-layout-gray-50"
          aria-label="메뉴 열기"
        >
          <List size={22} weight="bold" />
        </button>
        <span className="text-base font-bold text-primary-main-600">HeyVoca</span>
        {currentLabel && (
          <span className="ml-auto text-sm font-semibold text-layout-black truncate">{currentLabel}</span>
        )}
      </header>

      {/* 데스크탑 고정 사이드바 (기존과 동일) */}
      <aside className="hidden lg:flex w-60 shrink-0 bg-white border-r border-layout-gray-100 flex-col">
        <div className="px-5 py-5">
          <div className="text-xl font-bold text-primary-main-600">HeyVoca</div>
          <div className="text-xs text-layout-gray-300 mt-0.5">관리자 콘솔</div>
        </div>
        {navLinks()}
        {accountFooter}
      </aside>

      {/* 모바일 드로어 (오버레이 + 슬라이드 사이드바) */}
      {navOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-layout-black/40 animate-fade-in" onClick={() => setNavOpen(false)} />
          <aside className="relative w-64 max-w-[80%] h-full bg-white flex flex-col animate-slide-in-left shadow-xl">
            <div className="flex items-center justify-between px-5 py-5">
              <div>
                <div className="text-xl font-bold text-primary-main-600">HeyVoca</div>
                <div className="text-xs text-layout-gray-300 mt-0.5">관리자 콘솔</div>
              </div>
              <button
                onClick={() => setNavOpen(false)}
                className="w-8 h-8 grid place-items-center rounded-lg text-layout-gray-400 hover:bg-layout-gray-50"
                aria-label="메뉴 닫기"
              >
                <X size={20} weight="bold" />
              </button>
            </div>
            {navLinks(() => setNavOpen(false))}
            {accountFooter}
          </aside>
        </div>
      )}

      {/* Content — 메인은 스크롤하지 않고(overflow-hidden), 각 페이지가 자체 영역만 스크롤한다 */}
      <ScrollContext.Provider value={mainRef}>
        <main ref={mainRef} className="flex-1 min-w-0 min-h-0 overflow-hidden">
          {children}
        </main>
      </ScrollContext.Provider>
    </div>
  );
}
