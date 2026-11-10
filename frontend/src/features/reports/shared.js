// 신고 관리 공용 — 상태 라벨/색, 날짜 표시
export const STATUS_LABEL = { open: '대기', resolved: '처리', rejected: '반려' };
export const STATUS_TONE = { open: 'red', resolved: 'green', rejected: 'gray' };

export function fmtDate(iso) {
  if (!iso) return '-';
  // 서버는 UTC naive ISO — KST(브라우저 로컬)로 보여 준다
  const d = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
