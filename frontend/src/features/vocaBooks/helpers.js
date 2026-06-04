// 단어장 관리 공용 헬퍼.

// 예문 항목의 원어/의미를 폴백과 함께 정규화.
// 백엔드가 {origin,meaning}(신규) 또는 {en,ko}(과거형)를 섞어 내려줄 수 있다.
export const exOrigin = (ex) => ex?.origin ?? ex?.en ?? '';
export const exMeaning = (ex) => ex?.meaning ?? ex?.ko ?? '';

// 편집/저장용으로 항상 {origin,meaning} 형태로 통일.
export const normalizeExample = (ex) => ({ origin: exOrigin(ex), meaning: exMeaning(ex) });

// 강조(target-word strong 태그) 포함 여부.
const TARGET_WORD_RE = /<strong[^>]*class=["'][^"']*\btarget-word\b[^"']*["'][^>]*>/i;
export const hasEmphasis = (s) => TARGET_WORD_RE.test(s || '');

// 예문 한 쌍의 강조 상태 → 'green'(양쪽) | 'yellow'(한쪽) | 'red'(없음).
export const emphasisLevel = (origin, meaning) => {
  const a = hasEmphasis(origin);
  const b = hasEmphasis(meaning);
  if (a && b) return 'green';
  if (a || b) return 'yellow';
  return 'red';
};

// ISO 날짜 → ko 로컬 표기.
export const formatDate = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });
};

// ISO 날짜 → 짧은 표기 (YYYY.MM.DD). 테이블 셀에서 줄바꿈 없이 한 줄로 쓰기 위함.
export const formatDateShort = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
};

// color(JSON 문자열 또는 객체) → {main,sub,background} 정규화 (없으면 null).
export const parseColor = (raw) => {
  if (!raw) return null;
  let obj = raw;
  if (typeof raw === 'string') {
    try { obj = JSON.parse(raw); } catch { return null; }
  }
  if (obj && typeof obj === 'object' && obj.main) return obj;
  return null;
};
