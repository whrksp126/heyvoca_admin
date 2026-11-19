// 사용자 상세 드로어가 앱(heyvoca_front)과 같은 그림으로 보이도록 옮겨 온 자산·표현.
// 원본은 앱 쪽이 정본이다 — 그림을 바꾸면 여기도 같이 맞출 것.
//   작물       heyvoca_front src/components/farm/CropImage.jsx (getCropAsset · align="center" 변환)
//   이름·색    heyvoca_front src/utils/crop.js (CROP_LABEL_DETAIL · CROP_COLOR · HEALTH_LABEL · HEALTH_COLOR · FARM_ITEM_LABEL)
//   연속 칩    heyvoca_front src/components/streak/StreakChip.jsx · StreakMonthCalendar.jsx (cellState)
//   업적 메달  heyvoca_front src/components/achievement/AchievementMedal.jsx · takeTest/rewards/achievement.js
//   문제 유형  heyvoca_front src/components/common/QuestionTypeGlyphs.jsx · plugins/questionTypes/index.js(label)
// 그림 파일은 src/assets/app/ 에 복사했다(작물 512px → 192px, 아이템 → 160px 로 줄였을 뿐 비율·여백은 같다).
// 어드민은 framer-motion 이 없어 움직임은 빼고 정지 화면만 옮긴다.
import React, { useId } from 'react';
import { Crown, LockSimple } from '@phosphor-icons/react';

const toMap = (modules) => {
  const out = {};
  Object.entries(modules).forEach(([path, mod]) => {
    out[path.split('/').pop().replace(/\.(png|svg)$/, '')] = mod?.default || mod;
  });
  return out;
};

const ROOT = toMap(import.meta.glob('../../assets/app/*.{png,svg}', { eager: true }));
const UNPLANTED = toMap(import.meta.glob('../../assets/app/crops/unplanted/*.png', { eager: true }));
const BARE = toMap(import.meta.glob('../../assets/app/crops/bare/*.png', { eager: true }));
const ACH = toMap(import.meta.glob('../../assets/app/achievement/*.png', { eager: true }));

export const ART = {
  gem: ROOT['icon-gem'],
  shovel: ROOT['item-shovel'],
  nutrient: ROOT['item-nutrient'],
  shield: ROOT['item-streak-shield'],
  flame: ROOT['icon-streak'],
  ember: ROOT['icon-streak-ember'],
  goldenCarrot: ROOT['icon-golden-carrot'],
  care: ROOT['icon-care'],
  mascotWatering: ROOT['mascot-watering'],
  seedPacket: UNPLANTED['healthy-seed'],
};

export const ITEM_ART = { SHOVEL: ART.shovel, NUTRIENT: ART.nutrient, SHIELD: ART.shield };
export const ITEM_LABEL = { SHOVEL: '새심기 삽', NUTRIENT: '영양 회복제', SHIELD: '연속 학습 보호권' };
export const ITEM_DESC = {
  SHOVEL: '썩은 작물을 씨앗부터 다시 심어요',
  NUTRIENT: '썩기 전 단계를 그대로 되살려요',
  SHIELD: '학습을 쉬는 날에도 연속 기록을 이어줘요',
};

// 여섯 단계 — 앱 CROP_LABEL_DETAIL / CROP_COLOR (미학습은 봉투, 씨앗은 낱알)
export const STAGES = [
  { key: 'unplanted', label: '미학습', color: '#7B7B7B' },
  { key: 'seed', label: '씨앗', color: '#9D835A' },
  { key: 'sprout', label: '새싹', color: '#77CE4F' },
  { key: 'leaf', label: '이파리', color: '#38CE38' },
  { key: 'carrot', label: '당근', color: '#F68300' },
  { key: 'golden', label: '황금 당근', color: '#F2B713' },
];

// 건강 상태 — 앱 HEALTH_LABEL / HEALTH_COLOR, 그림 variant 는 healthToVariant(CRITICAL 은 시든 그림)
export const HEALTHS = [
  { key: 'fresh', label: '촉촉해요', color: '#12B76A', variant: 'healthy' },
  { key: 'thirsty', label: '목말라요', color: '#2E90FA', variant: 'drying' },
  { key: 'wilted', label: '시들었어요', color: '#FD853A', variant: 'wilted' },
  { key: 'critical', label: '많이 시들었어요', color: '#FB6514', variant: 'wilted' },
  { key: 'rotten', label: '썩었어요', color: '#7B7B7B', variant: 'rotten' },
  { key: 'golden', label: '황금이에요', color: '#F2B713', variant: 'golden' },
];

// CropImage align="center" 변환 — 512 캔버스 기준 내용물 세로 중심(cy)과 배율
const ALIGN = {
  envelopeSeed: { scale: 1, cy: 323 },
  bareSeed: { scale: 1.6, cy: 397 },
  sprout: { scale: 1.2, cy: 358 },
  leaf: { scale: 1, cy: 276 },
  carrot: { scale: 1, cy: 245 },
};

/** stage: unplanted|seed|sprout|leaf|carrot|golden, variant: healthy|drying|wilted|rotten */
const cropSrc = (stage, variant) => {
  if (stage === 'golden' || variant === 'golden') return { src: ART.goldenCarrot, align: null };
  if (stage === 'unplanted') return { src: UNPLANTED[`${variant}-seed`] || UNPLANTED['healthy-seed'], align: 'envelopeSeed' };
  if (stage === 'seed') return { src: BARE[`${variant}-seed`] || BARE['healthy-seed'], align: 'bareSeed' };
  return { src: UNPLANTED[`${variant}-${stage}`] || UNPLANTED[`healthy-${stage}`], align: stage };
};

export function CropImage({ stage, variant = 'healthy', size = 26, className = '', alt = '' }) {
  const { src, align } = cropSrc(stage, variant);
  const cfg = align ? ALIGN[align] : null;
  const style = { width: size, height: size };
  if (cfg) {
    style.transform = `translateY(${((-cfg.scale * (cfg.cy - 256)) / 512 * 100).toFixed(2)}%) scale(${cfg.scale})`;
  }
  return <img src={src} alt={alt} draggable={false} className={`shrink-0 select-none object-contain ${className}`} style={style} />;
}

// ── 연속 학습 칩 (앱 StreakChip) ─────────────────────────────

/** 셀 상태 — 앱 StreakMonthCalendar.cellState 와 같은 규칙 */
export const cellState = (info) => {
  if (!info) return 'miss';
  if (info.qualified) return (info.daily_mission_complete ?? false) ? 'all' : 'part';
  if (info.protected) return 'shield';
  return 'miss';
};
export const STREAK_LIT = new Set(['all', 'part', 'shield']);
export const RUN_CAPSULE_CLASS = 'bg-secondary-yellow-300 shadow-[inset_0_-2px_0_rgba(0,0,0,.07),inset_0_1.5px_0_rgba(255,255,255,.45)]';

const CHIP_ART = {
  all: { k: 0.86, bottom: false },
  part: { k: 0.62, bottom: true },
  shield: { k: 0.8, bottom: false },
};

export function StreakChip({ status, size = 24 }) {
  if (status === 'none' || status === 'upcoming') {
    const dot = Math.max(4, Math.round(size * 0.16));
    return (
      <span className="flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
        <i className={`block rounded-full ${status === 'upcoming' ? 'bg-layout-gray-100' : 'bg-layout-gray-200'}`} style={{ width: dot, height: dot }} />
      </span>
    );
  }
  if (status === 'today_empty' || status === 'off') {
    const k = size * 0.56;
    return (
      <span className="flex shrink-0 items-center justify-center rounded-full bg-layout-gray-50" style={{ width: size, height: size }}>
        <img src={ART.ember} alt="" draggable={false} className="block select-none object-contain opacity-40 grayscale" style={{ width: k, height: k }} />
      </span>
    );
  }
  const art = CHIP_ART[status] || CHIP_ART.all;
  const src = status === 'part' ? ART.ember : status === 'shield' ? ART.shield : ART.flame;
  const k = size * art.k;
  return (
    <span
      className={`relative flex shrink-0 justify-center ${art.bottom ? 'items-end' : 'items-center'}`}
      style={{ width: size, height: size, paddingBottom: art.bottom ? size * 0.12 : 0 }}
    >
      <img src={src} alt="" draggable={false} className="relative block select-none object-contain" style={{ width: k, height: k }} />
    </span>
  );
}

const LegendMark = ({ status }) => (
  <span className={`flex h-[18px] w-[18px] items-center justify-center rounded-full ${RUN_CAPSULE_CLASS}`}>
    <StreakChip status={status} size={16} />
  </span>
);

export function StreakChipLegend({ className = '' }) {
  return (
    <span className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 ${className}`}>
      <span className="flex items-center gap-[5px]"><LegendMark status="all" />오늘 할 일 모두</span>
      <span className="flex items-center gap-[5px]"><LegendMark status="part" />일부</span>
      <span className="flex items-center gap-[5px]"><LegendMark status="shield" />보호권</span>
      <span className="flex items-center gap-[5px]"><StreakChip status="none" size={18} />쉰 날</span>
    </span>
  );
}

/** 칸 배열에서 연속 구간(시작·끝 인덱스) — 앱 StreakChip.litRuns */
export const litRuns = (cells, isLit) => {
  const runs = [];
  let start = -1;
  cells.forEach((c, i) => {
    const lit = c && isLit(c);
    if (lit && start === -1) start = i;
    if (!lit && start !== -1) { runs.push([start, i - 1]); start = -1; }
  });
  if (start !== -1) runs.push([start, cells.length - 1]);
  return runs;
};

// ── 업적 메달 (앱 AchievementMedal, 정지 화면) ───────────────

const ACHIEVEMENT_IMAGES = {
  '초대왕': ACH.InviteKing,
  '출석왕': ACH.AttendanceKing,
  '노력왕': ACH.NoryeokKing,
  '단어왕': ACH.WordKing,
  '끈기왕': ACH.PerseveranceKing,
  '독서왕': ACH.ReadingKing,
  '암기왕': ACH.MemorizedKing,
};
const RAINBOW_STOPS = ['var(--primary-main-600)', '#CD8DFF', '#74D5FF'];
const TIER_INK = { bronze: '#9A6238', silver: '#6B6B6B', gold: '#9A7300', rainbow: '#A24BD9' };
export const achievementTier = (level) => {
  if (level >= 10) return { key: 'rainbow', label: '무지개', color: '#CD8DFF', bg: 'linear-gradient(135deg, var(--primary-main-600) 0%, #CD8DFF 50%, #74D5FF 100%)' };
  if (level >= 6) return { key: 'gold', label: '금', color: '#F2D252', bg: '#F2D252' };
  if (level >= 3) return { key: 'silver', label: '은', color: '#C0C0C0', bg: '#C0C0C0' };
  return { key: 'bronze', label: '동', color: '#D3A686', bg: '#D3A686' };
};

export function AchievementMedal({ type, level = 0, ratio = 0, size = 66, isMax = false }) {
  const gradId = useId();
  const locked = level <= 0;
  const tier = achievementTier(level);
  const stroke = Math.max(3, Math.round(size * 0.055));
  const c = size / 2;
  const r = c - stroke / 2;
  const len = 2 * Math.PI * r;
  const inset = stroke + Math.max(2, Math.round(size * 0.04));
  const face = size - inset * 2;
  const pillH = Math.max(16, Math.round(size * 0.26));
  const pillFont = Math.max(10, Math.round(size * 0.17));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden className="absolute inset-0 h-full w-full -rotate-90">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={RAINBOW_STOPS[0]} />
            <stop offset="50%" stopColor={RAINBOW_STOPS[1]} />
            <stop offset="100%" stopColor={RAINBOW_STOPS[2]} />
          </linearGradient>
        </defs>
        <circle cx={c} cy={c} r={r} fill="none" strokeWidth={stroke} className="stroke-layout-gray-100" />
        {!locked && (
          <circle
            cx={c} cy={c} r={r} fill="none"
            stroke={tier.key === 'rainbow' ? `url(#${gradId})` : tier.color}
            strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={len} strokeDashoffset={len * (1 - ratio)}
          />
        )}
      </svg>
      <div
        className={`absolute overflow-hidden rounded-full ${locked
          ? 'bg-layout-gray-100 shadow-[inset_0_-3px_0_rgba(0,0,0,.08)]'
          : 'shadow-[inset_0_-4px_0_rgba(0,0,0,.14),inset_0_3px_0_rgba(255,255,255,.4)]'}`}
        style={{ left: inset, top: inset, width: face, height: face, ...(locked ? {} : { background: tier.bg }) }}
      />
      {ACHIEVEMENT_IMAGES[type] && (
        <img
          src={ACHIEVEMENT_IMAGES[type]}
          alt=""
          draggable={false}
          className={`pointer-events-none absolute select-none object-contain ${locked ? 'opacity-45 grayscale' : ''}`}
          style={{ left: inset - face * 0.03, top: inset - face * 0.12, width: face * 1.06, height: face * 1.06 }}
        />
      )}
      {locked ? (
        <span
          className="absolute left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full border-[1.5px] border-layout-gray-100 bg-layout-white text-layout-gray-300"
          style={{ bottom: -pillH * 0.32, width: pillH, height: pillH }}
        >
          <LockSimple size={Math.round(pillH * 0.6)} weight="fill" />
        </span>
      ) : (
        <span
          className="absolute left-1/2 flex -translate-x-1/2 items-center gap-[1px] whitespace-nowrap rounded-full border-[1.5px] bg-layout-white font-extrabold leading-none tabular-nums"
          style={{
            bottom: -pillH * 0.32, height: pillH, padding: `0 ${Math.round(pillH * 0.4)}px`,
            fontSize: pillFont, borderColor: tier.color, color: TIER_INK[tier.key],
          }}
        >
          {isMax ? (<><Crown size={pillFont} weight="fill" /><span>MAX</span></>) : (
            <><span style={{ fontSize: Math.round(pillFont * 0.72) }}>LV.</span><span>{level}</span></>
          )}
        </span>
      )}
    </div>
  );
}

// ── 문제 유형 그림 (앱 QuestionTypeGlyphs) ─────────────────────

const base = (size, className) => ({
  width: size, height: size, viewBox: '0 0 36 36', fill: 'none',
  xmlns: 'http://www.w3.org/2000/svg', 'aria-hidden': true, className,
});
const ACCENT = 'text-primary-main-400';

const McqGlyph = ({ className = '', size = 34 }) => (
  <svg {...base(size, className)}>
    <rect x="5" y="4" width="26" height="6" rx="2" fill="currentColor" opacity=".35" />
    <rect x="5" y="13" width="26" height="5" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
    <rect x="5" y="20" width="26" height="5" rx="2.5" fill="currentColor" className={ACCENT} />
    <rect x="5" y="27" width="26" height="5" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);
const CardMatchGlyph = ({ className = '', size = 34 }) => (
  <svg {...base(size, className)}>
    <rect x="3" y="6" width="11" height="9" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <rect x="3" y="21" width="11" height="9" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <rect x="22" y="6" width="11" height="9" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <rect x="22" y="21" width="11" height="9" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <g className={ACCENT}><path d="M14 10.5 22 25.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></g>
  </svg>
);
const SpellingGlyph = ({ className = '', size = 34, lang = 'en' }) => (
  <svg {...base(size, className)}>
    <text x="2" y="22" fontSize="12" fontWeight="800" fill="currentColor" fontFamily="Menlo, monospace">{lang === 'ja' ? 'あい' : 'ap'}</text>
    <path d="M19 24h4M25 24h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <g className={ACCENT}><path d="M32.5 12v14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></g>
  </svg>
);
const BlankGlyph = ({ className = '', size = 34 }) => (
  <svg {...base(size, className)}>
    <path d="M3 9h8M25 9h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <rect x="13" y="5" width="10" height="8" rx="2" stroke="currentColor" strokeWidth="1.8" strokeDasharray="2 1.5" />
    <rect x="4" y="21" width="12" height="8" rx="4" stroke="currentColor" strokeWidth="1.6" />
    <rect x="20" y="21" width="12" height="8" rx="4" fill="currentColor" className={ACCENT} />
  </svg>
);
const TypingGlyph = ({ className = '', size = 34 }) => (
  <svg {...base(size, className)}>
    <path d="M3 18h8M25 18h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <rect x="12" y="12" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" strokeDasharray="2 1.5" />
    <g className={ACCENT}><path d="M18 14.5v7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></g>
  </svg>
);
const ArrangeGlyph = ({ className = '', size = 34 }) => (
  <svg {...base(size, className)}>
    <rect x="3" y="7" width="9" height="7" rx="2" fill="currentColor" opacity=".35" />
    <rect x="14" y="7" width="12" height="7" rx="2" fill="currentColor" opacity=".35" />
    <path d="M28 10.5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M17 16.5v3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <rect x="11" y="22" width="12" height="7" rx="2" fill="currentColor" className={ACCENT} />
  </svg>
);
const TranslateGlyph = ({ className = '', size = 34, lang = 'en' }) => (
  <svg {...base(size, className)}>
    <text x="2" y="15" fontSize="11" fontWeight="800" fill="currentColor">{lang === 'ja' ? 'あ' : 'Aa'}</text>
    <path d="M19 11h6m-2.5-2.5L25 11l-2.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <g className={ACCENT}><rect x="4" y="21" width="12" height="9" rx="2" fill="currentColor" /></g>
    <text x="10" y="28.4" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="currentColor">가</text>
    <rect x="19" y="21" width="13" height="9" rx="2" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);
// 만나기(단어·글자 소개) — 앱에 전용 그림이 없어 카드 한 장으로 표현한다(같은 선 굵기·강조색)
const IntroGlyph = ({ className = '', size = 34 }) => (
  <svg {...base(size, className)}>
    <rect x="6" y="5" width="24" height="26" rx="3" stroke="currentColor" strokeWidth="1.6" />
    <rect x="10" y="10" width="16" height="6" rx="2" fill="currentColor" className={ACCENT} />
    <path d="M10 21h16M10 25.5h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity=".5" />
  </svg>
);

// 앱 plugins/questionTypes/index.js 의 id → label, 그림은 테스트 설정 타일과 같은 계열
export const QUESTION_TYPES = {
  multipleChoice: { label: '사지선다', Glyph: McqGlyph },
  multipleChoiceListening: { label: '사지선다(듣기)', Glyph: McqGlyph },
  reverseMultipleChoice: { label: '뜻 보고 단어 고르기', Glyph: McqGlyph },
  multipleChoiceDiagnosis: { label: '다시 심기 진단', Glyph: McqGlyph },
  fillInTheBlank: { label: '빈칸 고르기', Glyph: BlankGlyph },
  fillInTheBlankReverse: { label: '빈칸 고르기(역방향)', Glyph: BlankGlyph },
  cardMatch: { label: '카드 맞추기', Glyph: CardMatchGlyph },
  cardMatchListening: { label: '카드 맞추기(듣기)', Glyph: CardMatchGlyph },
  sentenceArrangePartial: { label: '문장 조립(부분)', Glyph: ArrangeGlyph },
  sentenceArrange: { label: '문장 조립', Glyph: ArrangeGlyph },
  listenArrange: { label: '듣고 받아쓰기', Glyph: ArrangeGlyph },
  fillInTheBlankTyping: { label: '빈칸 쓰기', Glyph: TypingGlyph },
  sentenceTranslate: { label: '해석 조립', Glyph: TranslateGlyph },
  sentenceMeaning: { label: '문장 뜻 고르기', Glyph: TranslateGlyph },
  spellingFill: { label: '단어 쓰기', Glyph: SpellingGlyph },
  wordIntro: { label: '단어 만나기', Glyph: IntroGlyph },
  scriptIntro: { label: '글자 만나기', Glyph: IntroGlyph },
  scriptSeePick: { label: '글자 보고 발음 고르기', Glyph: McqGlyph },
  scriptListenPick: { label: '소리 듣고 글자 고르기', Glyph: McqGlyph },
  scriptTrace: { label: '따라 쓰기', Glyph: SpellingGlyph },
  scriptListenWrite: { label: '듣고 쓰기', Glyph: SpellingGlyph },
  scriptWordRead: { label: '단어 읽기', Glyph: McqGlyph },
  scriptWordListen: { label: '듣고 단어 고르기', Glyph: McqGlyph },
  scriptListenMatch: { label: '듣기 카드 맞추기', Glyph: CardMatchGlyph },
};
export const questionTypeOf = (t) => QUESTION_TYPES[t] || { label: t, Glyph: McqGlyph };
