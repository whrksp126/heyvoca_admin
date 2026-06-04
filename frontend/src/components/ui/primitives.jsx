// 공통 UI 프리미티브 — heyvoca 디자인 토큰 기반, 라이트 테마.
import React from 'react';

const cx = (...a) => a.filter(Boolean).join(' ');

// ── Button ──
const VARIANTS = {
  primary: 'bg-primary-main-600 hover:bg-primary-main-500 text-white border-transparent',
  secondary: 'bg-white hover:bg-layout-gray-50 text-layout-gray-500 border-layout-gray-100',
  ghost: 'bg-transparent hover:bg-layout-gray-50 text-layout-gray-400 border-transparent',
  danger: 'bg-status-error-600 hover:bg-status-error-500 text-white border-transparent',
  blue: 'bg-secondary-blue-600 hover:bg-secondary-blue-500 text-white border-transparent',
};
const SIZES = {
  sm: 'text-xs px-2.5 py-1.5 rounded-md gap-1',
  md: 'text-sm px-3.5 py-2 rounded-lg gap-1.5',
  lg: 'text-base px-5 py-2.5 rounded-lg gap-2',
};

export function Button({ variant = 'primary', size = 'md', className, children, loading, disabled, ...rest }) {
  return (
    <button
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center font-semibold border transition-colors',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        VARIANTS[variant], SIZES[size], className,
      )}
      {...rest}
    >
      {loading ? '처리중…' : children}
    </button>
  );
}

// ── Field (label + control) ──
export function Field({ label, hint, error, required, children, className }) {
  return (
    <label className={cx('block', className)}>
      {label && (
        <span className="block text-xs font-medium text-layout-gray-400 mb-1">
          {label}{required && <span className="text-status-error-600 ml-0.5">*</span>}
        </span>
      )}
      {children}
      {hint && !error && <span className="block text-[11px] text-layout-gray-300 mt-1">{hint}</span>}
      {error && <span className="block text-[11px] text-status-error-600 mt-1">{error}</span>}
    </label>
  );
}

const inputBase =
  'w-full bg-white border border-layout-gray-100 rounded-lg px-3 py-2 text-sm text-layout-black ' +
  'placeholder:text-layout-gray-300 focus:outline-none focus:border-primary-main-400 focus:ring-2 focus:ring-primary-main-100 transition';

export const Input = React.forwardRef(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(inputBase, className)} {...rest} />;
});

export const Textarea = React.forwardRef(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx(inputBase, 'resize-y min-h-[72px]', className)} {...rest} />;
});

export function Select({ className, children, ...rest }) {
  return <select className={cx(inputBase, 'pr-8 cursor-pointer', className)} {...rest}>{children}</select>;
}

// ── Tag / Badge ──
const TAG_TONE = {
  gray: 'bg-layout-gray-50 text-layout-gray-400 border-layout-gray-100',
  pink: 'bg-primary-main-100 text-primary-main-600 border-primary-main-200',
  blue: 'bg-secondary-blue-100 text-secondary-blue-600 border-secondary-blue-200',
  purple: 'bg-secondary-purple-100 text-secondary-purple-600 border-secondary-purple-200',
  green: 'bg-status-success-100 text-status-success-600 border-status-success-200',
  yellow: 'bg-secondary-yellow-100 text-secondary-yellow-600 border-secondary-yellow-200',
  red: 'bg-status-error-100 text-status-error-600 border-status-error-200',
};
export function Tag({ tone = 'gray', className, children }) {
  return (
    <span className={cx('inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-2 py-0.5 border whitespace-nowrap', TAG_TONE[tone], className)}>
      {children}
    </span>
  );
}

// ── Spinner ──
export function Spinner({ label = '불러오는 중…', className }) {
  return (
    <div className={cx('flex items-center justify-center gap-2 text-layout-gray-300 text-sm py-8', className)}>
      <span className="w-4 h-4 border-2 border-layout-gray-200 border-t-primary-main-500 rounded-full animate-spin" />
      {label}
    </div>
  );
}

// ── ProgressBar ──
export function ProgressBar({ value = 0, tone = 'pink', className }) {
  const pct = Math.max(0, Math.min(100, value));
  const fill = {
    pink: 'bg-primary-main-500', blue: 'bg-secondary-blue-500',
    green: 'bg-status-success-500', yellow: 'bg-secondary-yellow-500',
  }[tone] || 'bg-primary-main-500';
  return (
    <div className={cx('w-full h-2 rounded-full bg-layout-gray-100 overflow-hidden', className)}>
      <div className={cx('h-full rounded-full transition-all duration-500', fill)} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── ToggleSwitch ──
export function ToggleSwitch({ checked, onChange, disabled, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange?.(!checked)}
      className={cx(
        'inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed',
      )}
    >
      <span className={cx('relative w-10 h-6 rounded-full transition-colors', checked ? 'bg-primary-main-600' : 'bg-layout-gray-200')}>
        <span className={cx('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', checked && 'translate-x-4')} />
      </span>
      {label && <span className="text-sm text-layout-gray-500">{label}</span>}
    </button>
  );
}

// ── Card ──
export function Card({ className, children }) {
  return <div className={cx('bg-white border border-layout-gray-100 rounded-xl', className)}>{children}</div>;
}
