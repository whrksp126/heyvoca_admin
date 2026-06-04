/** @type {import('tailwindcss').Config} */
// heyvoca_service 디자인 시스템 토큰을 그대로 사용 (CSS 변수 → Tailwind 색).
// 어드민은 라이트 테마 기준이므로 darkMode 클래스는 쓰지 않는다.
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          main: {
            600: 'var(--primary-main-600)',
            500: 'var(--primary-main-500)',
            400: 'var(--primary-main-400)',
            300: 'var(--primary-main-300)',
            200: 'var(--primary-main-200)',
            100: 'var(--primary-main-100)',
            50: 'var(--primary-main-50)',
          },
        },
        secondary: {
          blue: {
            600: 'var(--secondary-blue-600)', 500: 'var(--secondary-blue-500)', 400: 'var(--secondary-blue-400)',
            300: 'var(--secondary-blue-300)', 200: 'var(--secondary-blue-200)', 100: 'var(--secondary-blue-100)', 50: 'var(--secondary-blue-50)',
          },
          purple: {
            600: 'var(--secondary-purple-600)', 500: 'var(--secondary-purple-500)', 400: 'var(--secondary-purple-400)',
            300: 'var(--secondary-purple-300)', 200: 'var(--secondary-purple-200)', 100: 'var(--secondary-purple-100)', 50: 'var(--secondary-purple-50)',
          },
          yellow: {
            600: 'var(--secondary-yellow-600)', 500: 'var(--secondary-yellow-500)', 400: 'var(--secondary-yellow-400)',
            300: 'var(--secondary-yellow-300)', 200: 'var(--secondary-yellow-200)', 100: 'var(--secondary-yellow-100)', 50: 'var(--secondary-yellow-50)',
          },
          mint: {
            600: 'var(--secondary-mint-600)', 500: 'var(--secondary-mint-500)', 400: 'var(--secondary-mint-400)',
            300: 'var(--secondary-mint-300)', 200: 'var(--secondary-mint-200)', 100: 'var(--secondary-mint-100)', 50: 'var(--secondary-mint-50)',
          },
        },
        status: {
          success: {
            600: 'var(--status-success-600)', 500: 'var(--status-success-500)', 400: 'var(--status-success-400)',
            300: 'var(--status-success-300)', 200: 'var(--status-success-200)', 100: 'var(--status-success-100)', 50: 'var(--status-success-50)',
          },
          error: {
            600: 'var(--status-error-600)', 500: 'var(--status-error-500)', 400: 'var(--status-error-400)',
            300: 'var(--status-error-300)', 200: 'var(--status-error-200)', 100: 'var(--status-error-100)', 50: 'var(--status-error-50)',
          },
        },
        layout: {
          black: 'var(--layout-black)',
          white: 'var(--layout-white)',
          gray: {
            500: 'var(--layout-gray-500)', 400: 'var(--layout-gray-400)', 300: 'var(--layout-gray-300)',
            200: 'var(--layout-gray-200)', 100: 'var(--layout-gray-100)', 50: 'var(--layout-gray-50)',
          },
        },
      },
      fontFamily: {
        sans: [
          'Pretendard Variable', '-apple-system', 'BlinkMacSystemFont', 'system-ui',
          'Roboto', 'Helvetica Neue', 'Segoe UI', 'Apple SD Gothic Neo',
          'Noto Sans KR', 'Malgun Gothic', 'sans-serif',
        ],
      },
      borderRadius: { DEFAULT: '8px' },
      keyframes: {
        slideIn: { '0%': { transform: 'translateX(100%)' }, '100%': { transform: 'translateX(0)' } },
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
      },
      animation: {
        'slide-in': 'slideIn 0.25s ease-out forwards',
        'fade-in': 'fadeIn 0.15s ease-out forwards',
      },
    },
  },
  plugins: [],
};
