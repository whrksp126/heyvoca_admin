// UD(Universal Dependencies) 품사 태그 → 한국어 라벨.
// voca_meaning.pos 컬럼에 저장되는 15종 태그.
export const POS_LABELS = {
  NOUN: '명사',
  VERB: '동사',
  ADJ: '형용사',
  ADV: '부사',
  PRON: '대명사',
  DET: '한정사',
  ADP: '전치사',
  CCONJ: '등위접속사',
  SCONJ: '종속접속사',
  NUM: '수사',
  INTJ: '감탄사',
  PART: '불변화사',
  AUX: '조동사',
  PROPN: '고유명사',
  X: '기타',
};

// "NOUN 명사" 형태 라벨. 미지정 태그면 원문만 반환.
export function posLabel(pos) {
  if (!pos) return '';
  const ko = POS_LABELS[pos];
  return ko ? `${pos} ${ko}` : pos;
}
