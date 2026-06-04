// Modal(중앙) + Drawer(우측 슬라이드) — 디자인 토큰 기반.
import React, { useEffect } from 'react';

const cx = (...a) => a.filter(Boolean).join(' ');

function useEscClose(onClose) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
}

export function Modal({ open = true, onClose, title, children, footer, size = 'md' }) {
  useEscClose(onClose);
  if (!open) return null;
  const maxW = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size] || 'max-w-lg';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-layout-black/40 animate-fade-in" onClick={onClose} />
      <div className={cx('relative w-full bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh] animate-fade-in', maxW)}>
        {title && (
          <header className="flex items-center justify-between px-5 py-4 border-b border-layout-gray-100">
            <h3 className="text-base font-bold text-layout-black">{title}</h3>
            <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-lg hover:bg-layout-gray-50 text-layout-gray-400">✕</button>
          </header>
        )}
        <div className="flex-1 overflow-y-auto thin-scroll px-5 py-4">{children}</div>
        {footer && <footer className="px-5 py-4 border-t border-layout-gray-100 flex justify-end gap-2">{footer}</footer>}
      </div>
    </div>
  );
}

export function Drawer({ open = true, onClose, title, subtitle, children, width = 'max-w-3xl' }) {
  useEscClose(onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex" role="dialog" aria-modal="true">
      <div className="flex-1 bg-layout-black/40 animate-fade-in" onClick={onClose} />
      <aside className={cx('w-full h-full bg-layout-gray-50 border-l border-layout-gray-100 flex flex-col animate-slide-in', width)}>
        <header className="flex items-center justify-between px-5 py-4 bg-white border-b border-layout-gray-100">
          <div className="min-w-0">
            {subtitle && <div className="text-[11px] text-layout-gray-300 uppercase tracking-wide">{subtitle}</div>}
            <div className="text-lg font-bold text-layout-black truncate">{title}</div>
          </div>
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg bg-layout-gray-50 hover:bg-layout-gray-100 text-layout-gray-500">닫기</button>
        </header>
        <div className="flex-1 overflow-y-auto thin-scroll px-5 py-5 space-y-6">{children}</div>
      </aside>
    </div>
  );
}

// 확인 다이얼로그 (window.confirm 대체)
export function ConfirmModal({ open, title = '확인', message, confirmText = '확인', cancelText = '취소', tone = 'danger', onConfirm, onCancel }) {
  if (!open) return null;
  const btn = tone === 'danger'
    ? 'bg-status-error-600 hover:bg-status-error-500'
    : 'bg-primary-main-600 hover:bg-primary-main-500';
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-layout-black/40" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl p-5">
        <h3 className="text-base font-bold text-layout-black mb-1.5">{title}</h3>
        <p className="text-sm text-layout-gray-400 mb-5 whitespace-pre-line">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-3.5 py-2 text-sm rounded-lg border border-layout-gray-100 text-layout-gray-500 hover:bg-layout-gray-50">{cancelText}</button>
          <button onClick={onConfirm} className={cx('px-3.5 py-2 text-sm rounded-lg text-white font-semibold', btn)}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}
