// 유저 관리 — 사용자 한 명의 학습 기록 상세 (읽기 전용).
// 숫자는 앱이 쓰는 서비스 함수를 그대로 호출해 만든다(heyvoca_back app/services/admin_user_detail.py).
// 2026-11-19 2차 — 드로어 안은 사용자가 앱에서 보는 그림 그대로(작물·아이템·불꽃·메달·퀘스트·문제 유형).
// 그림·이름·색은 ./appArt.jsx 가 앱(heyvoca_front)에서 옮겨 온 것만 쓴다.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CaretDown, CaretRight, Check, SealCheck } from '@phosphor-icons/react';
import { Drawer } from '@/components/ui/overlays';
import { Button, Card, Spinner, Tag } from '@/components/ui/primitives';
import { ApiError } from '@/lib/api';
import { getUserDetail, getUserHistory } from './api';
import {
  ART, ITEM_ART, ITEM_LABEL, ITEM_DESC, STAGES, HEALTHS, CropImage,
  StreakChip, StreakChipLegend, cellState, STREAK_LIT, RUN_CAPSULE_CLASS, litRuns,
  AchievementMedal, achievementTier, questionTypeOf,
} from './appArt';

const PLATFORM_LABEL = { ios: 'iOS', android: 'Android', web: '웹', unknown: '알 수 없음' };
const LOGIN_LABEL = { google: 'Google', apple: 'Apple', other: '기타' };
const REAL_LABEL = { real: '실사용자', pending: '판정 대기', no: '미전환' };
const REAL_TONE = { real: 'green', pending: 'yellow', no: 'gray' };
const LANG_LABEL = { en: '영어', ja: '일본어' };

const TEST_TYPE_LABEL = {
  plant: '새 씨앗 심기', quick: '농장 돌보기', recommend: '추천 학습', chat: '채팅 학습',
  test: '단어장 테스트', exam: '자유 설정 테스트', today: '오늘의 학습', study: '집중 반복 학습',
  pick: '밭 골라 돌보기', script: '글자 학습', placement: '수준 측정(온보딩)', rotten: '썩은 단어 살리기',
};
// 세션 종류 그림 — 심기는 씨앗 봉투, 듣기 학습은 물 주는 마스코트, 나머지 돌보기는 물뿌리개(앱 IconCare)
const testTypeArt = (t) => (t === 'plant' || t === 'placement' ? ART.seedPacket : t === 'study' ? ART.mascotWatering : ART.care);

const SHIELD_REASON = {
  WEEKLY_GRANT: '주간 지급', STREAK_REWARD: '연속 보상', GEM_PURCHASE: '보석 구매', SPENT: '사용',
  MIGRATION: '전환 보상', ADMIN_ADJUST: '관리자 조정', EVENT: '이벤트', STAGE_REWARD: '성장 보상',
};
const DOW = ['일', '월', '화', '수', '목', '금', '토'];

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString() : '—');
const dt = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const dur = (sec) => {
  if (sec == null) return '—';
  if (sec < 60) return `${sec}초`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}분 ${sec % 60}초`;
  return `${Math.floor(m / 60)}시간 ${m % 60}분`;
};

function Section({ title, desc, right, children }) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-2 mb-3">
        <div className="mr-auto">
          <h3 className="text-sm font-semibold text-layout-black">{title}</h3>
          {desc && <p className="text-[11px] text-layout-gray-300 mt-0.5">{desc}</p>}
        </div>
        {right}
      </div>
      {children}
    </Card>
  );
}

function KV({ label, children }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-layout-gray-300">{label}</div>
      <div className="text-sm text-layout-black truncate">{children}</div>
    </div>
  );
}

/** 그림 + 이름 + 개수 칸 — 앱 마이페이지 창고 · 홈 팻말과 같은 결 */
function ArtTile({ art, label, count, color, sub, dim, ring, title }) {
  return (
    <div
      title={title}
      className={`flex flex-col items-center rounded-[14px] bg-layout-gray-50 px-1.5 pb-2.5 pt-3 ${dim ? 'opacity-40' : ''} ${ring ? 'ring-[1.5px] ring-inset' : ''}`}
      style={ring ? { '--tw-ring-color': ring } : undefined}
    >
      <span className="flex h-11 w-11 items-center justify-center">{art}</span>
      <span className="mt-1.5 text-center text-[11.5px] font-bold tracking-[-0.03em] text-layout-gray-500 [word-break:keep-all]">{label}</span>
      <span className="text-[17px] font-extrabold leading-tight tabular-nums tracking-[-0.03em]" style={color ? { color } : undefined}>{count}</span>
      {sub && <span className="text-[10.5px] text-layout-gray-300">{sub}</span>}
    </div>
  );
}

const Img = ({ src, size = 40, className = '' }) => (
  <img src={src} alt="" draggable={false} className={`select-none object-contain ${className}`} style={{ width: size, height: size }} />
);

/** 단계/건강 분포 한 줄 막대 — 칸 그림 아래 비율만 보조로 보여 준다 */
function RatioBar({ defs, counts }) {
  const total = defs.reduce((a, d) => a + (counts?.[d.key] || 0), 0);
  if (!total) return null;
  return (
    <div className="mt-2 flex h-2 w-full gap-[2px] overflow-hidden rounded-full bg-layout-gray-50">
      {defs.map((d) => {
        const n = counts?.[d.key] || 0;
        return n ? <span key={d.key} title={`${d.label} ${n}`} style={{ width: `${(n / total) * 100}%`, background: d.color }} /> : null;
      })}
    </div>
  );
}

function Profile({ p }) {
  return (
    <Section title="프로필">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {p.real && <Tag tone={REAL_TONE[p.real]}>{REAL_LABEL[p.real]}</Tag>}
        {p.excluded && <Tag tone="red">통계 제외 계정</Tag>}
        {p.churned && <Tag tone="yellow">이탈</Tag>}
        {p.app_deleted && <Tag tone="gray">앱 삭제 추정</Tag>}
        {!p.onboarded && <Tag tone="gray">온보딩 미완료</Tag>}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
        <KV label="가입">{dt(p.created_at)}</KV>
        <KV label="최근 접속">{dt(p.last_logged_at)}</KV>
        <KV label="마지막 사용일">{p.last_active || '—'}</KV>
        <KV label="플랫폼·앱 버전">{PLATFORM_LABEL[p.platform] || p.platform}{p.app_version ? ` ${p.app_version}` : ''}</KV>
        <KV label="로그인">{LOGIN_LABEL[p.login] || p.login}</KV>
        <KV label="학습 언어">{LANG_LABEL[p.learning_lang] || p.learning_lang}{p.multi_lang_enabled ? ' (다국어 켬)' : ''}</KV>
        <KV label="사용 일수 / 학습 일수">{fmt(p.active_days)}일 / {fmt(p.study_days)}일</KV>
        <KV label="하루 새 씨앗">{fmt(p.daily_new_limit)}개</KV>
        <KV label="가입 경로·목표">{p.source_channel || '—'} · {p.learning_goal || '—'}</KV>
      </div>
      <div className="mt-4 mb-1.5 text-xs font-semibold text-layout-gray-400">창고</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <ArtTile art={<Img src={ART.gem} size={40} />} label="보석" count={fmt(p.gem_cnt)} color="var(--primary-main-600)" />
        {Object.keys(ITEM_LABEL).map((k) => {
          const n = p.items?.[k] ?? 0;
          return (
            <ArtTile key={k} art={<Img src={ITEM_ART[k]} size={42} />} label={ITEM_LABEL[k]} count={`${fmt(n)}개`} dim={!n} title={ITEM_DESC[k]} />
          );
        })}
      </div>
    </Section>
  );
}

function FarmSummary({ farm, languages }) {
  const [lang, setLang] = useState(languages[0]);
  const f = farm[lang] || farm[languages[0]];
  if (!f) return null;
  const stageCounts = {
    unplanted: f.seed_detail?.unplanted || 0,
    seed: f.seed_detail?.planted || 0,
    sprout: f.counts?.sprout || 0,
    leaf: f.counts?.leaf || 0,
    carrot: Math.max(0, (f.counts?.carrot || 0) - (f.counts?.golden || 0)),
    golden: f.counts?.golden || 0,
  };
  const total = Object.values(stageCounts).reduce((a, b) => a + b, 0);
  const healths = HEALTHS.filter((h) => h.key !== 'golden');
  return (
    <Section
      title="전체 암기 상태"
      desc="앱 홈과 같은 집계(글자 밭 제외). 건강 상태는 밭에 심긴 작물만 센다."
      right={languages.length > 1 && (
        <div className="flex gap-1">
          {languages.map((l) => (
            <Button key={l} size="sm" variant={l === lang ? 'primary' : 'secondary'} onClick={() => setLang(l)}>
              {LANG_LABEL[l] || l}
            </Button>
          ))}
        </div>
      )}
    >
      <div className="mb-3 flex items-center gap-3 rounded-[14px] border border-layout-gray-100 bg-[linear-gradient(165deg,#FBF1DE_0%,#FFFFFF_70%)] px-3.5 py-3">
        <Img src={ART.care} size={40} />
        <div className="min-w-0 flex-1">
          <div className="text-[11.5px] font-semibold text-layout-gray-400">오늘 돌볼 작물</div>
          <div className="flex items-baseline gap-1">
            <span className="text-[24px] font-extrabold leading-none tabular-nums tracking-[-0.04em] text-layout-black">{fmt(f.today?.care_due_cnt)}</span>
            <span className="text-xs font-bold text-layout-gray-400">개 · 남은 {fmt(f.today?.care_left_cnt)}개</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11.5px] font-semibold text-layout-gray-400">전체 단어</div>
          <div className="text-[18px] font-extrabold tabular-nums text-layout-black">{fmt(total)}</div>
        </div>
      </div>

      <div className="mb-1.5 text-xs font-semibold text-layout-gray-400">작물 단계</div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {STAGES.map((s) => (
          <ArtTile
            key={s.key}
            art={<CropImage stage={s.key} size={40} alt={s.label} />}
            label={s.label}
            count={fmt(stageCounts[s.key])}
            color={s.color}
            dim={!stageCounts[s.key]}
          />
        ))}
      </div>
      <RatioBar defs={STAGES} counts={stageCounts} />

      <div className="mb-1.5 mt-4 text-xs font-semibold text-layout-gray-400">건강 상태</div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {healths.map((h) => (
          <ArtTile
            key={h.key}
            art={<CropImage stage="carrot" variant={h.variant} size={40} alt={h.label} />}
            label={h.label}
            count={fmt(f.health?.[h.key] || 0)}
            color={h.color}
            dim={!f.health?.[h.key]}
            ring={h.key === 'critical' ? h.color : null}
          />
        ))}
      </div>
      <RatioBar defs={healths} counts={f.health} />
      {f.comeback && (
        <p className="mt-2 text-xs text-layout-gray-400">
          복귀 미션 진행 중 · {f.comeback.progress_days}/{f.comeback.required_days}일
        </p>
      )}
    </Section>
  );
}

/** 단어장 카드 단계 줄 — 앱 VocaBookCard: 미학습 | 씨앗·새싹·이파리·당근(+황금) */
function BookStageRow({ stages }) {
  const n = (k) => stages?.[k] || 0;
  return (
    <span className="mt-1.5 grid w-full min-w-0 grid-cols-[auto_1px_1fr] items-center gap-x-1.5">
      <span className={`flex items-center gap-[2px] text-[11.5px] font-extrabold tracking-[-0.02em] text-layout-gray-400 ${n('unplanted') ? '' : 'opacity-30'}`}>
        <CropImage stage="unplanted" size={22} alt="미학습" />{fmt(n('unplanted'))}
      </span>
      <span className="h-4 w-px bg-layout-gray-100" aria-hidden />
      <span className="flex min-w-0 items-center justify-between">
        {STAGES.slice(1).map((s) => (
          <span
            key={s.key}
            title={s.label}
            className={`flex items-center gap-[1px] whitespace-nowrap text-[11.5px] font-extrabold tracking-[-0.02em] ${n(s.key) ? '' : 'opacity-30'}`}
            style={{ color: s.color }}
          >
            <CropImage stage={s.key} size={22} alt={s.label} />{fmt(n(s.key))}
          </span>
        ))}
      </span>
    </span>
  );
}

/** 단어장 밭 썸네일 — 단어장 색 테두리(앱 bookRimColor) 위에 가장 많이 자란 작물 한 그루 */
function BookThumb({ book }) {
  const top = [...STAGES].reverse().find((s) => (book.stages?.[s.key] || 0) > 0);
  const rim = book.color?.main || '#AAD97F';
  return (
    <span className="relative flex h-14 w-14 shrink-0 items-end justify-center overflow-hidden rounded-[12px] border-[3px] bg-[linear-gradient(180deg,#CEECB2_0%,#CEECB2_38%,#C69465_38%,#845A34_100%)]" style={{ borderColor: rim }}>
      {top
        ? <CropImage stage={top.key} size={44} alt={top.label} />
        : <Img src={ART.seedPacket} size={36} className="mb-1 opacity-50" />}
    </span>
  );
}

function Books({ books }) {
  const [open, setOpen] = useState(null);
  return (
    <Section title={`단어장 ${books.length}개`} desc="앱 단어장 탭 카드와 같은 그림. 카드를 누르면 건강 상태가 펼쳐진다.">
      {books.length === 0 ? (
        <p className="py-4 text-center text-sm text-layout-gray-300">단어장이 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {books.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => setOpen(open === b.id ? null : b.id)}
                className={`flex w-full items-center gap-3 rounded-[12px] border bg-white p-3 text-left ${open === b.id ? 'border-primary-main-600' : 'border-layout-gray-100'}`}
              >
                <BookThumb book={b} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    {b.bookstore_id && <SealCheck size={14} weight="fill" className="shrink-0 text-secondary-blue-600" aria-label="서점 단어장" />}
                    <span className="min-w-0 flex-1 truncate text-[15px] font-bold tracking-[-0.03em] text-layout-black">{b.name}</span>
                    {b.book_kind === 'script' && <Tag tone="purple">글자</Tag>}
                    {b.bookstore_id && <Tag tone="blue">서점</Tag>}
                    {b.language !== 'en' && <Tag tone="gray">{LANG_LABEL[b.language] || b.language}</Tag>}
                    <span className="shrink-0 text-xs text-layout-gray-400 tabular-nums">{fmt(b.total)}단어</span>
                  </span>
                  <BookStageRow stages={b.stages} />
                </span>
                {open === b.id ? <CaretDown size={14} className="shrink-0 text-layout-gray-300" /> : <CaretRight size={14} className="shrink-0 text-layout-gray-300" />}
              </button>
              {open === b.id && (
                <div className="mt-1.5 rounded-[12px] bg-layout-gray-50 p-2.5">
                  <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                    {HEALTHS.map((h) => (
                      <span key={h.key} className={`flex items-center gap-1 rounded-lg bg-white px-1.5 py-1 ${b.health?.[h.key] ? '' : 'opacity-35'}`}>
                        <CropImage stage="carrot" variant={h.variant} size={24} alt={h.label} />
                        <span className="min-w-0">
                          <span className="block truncate text-[10.5px] text-layout-gray-400">{h.label}</span>
                          <span className="block text-[13px] font-extrabold leading-tight tabular-nums" style={{ color: h.color }}>{fmt(b.health?.[h.key] || 0)}</span>
                        </span>
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 text-[11px] text-layout-gray-300">만든 날 {dt(b.created_at)} · 수정 {dt(b.updated_at)}</div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

// ── 농장 방문 달력 — 앱 StreakMonthCalendar 의 칸·띠를 정지 화면으로 ──
const CHIP = 24;
const CAP_H = 30;
const CELL_H = 52;
const CHIP_TOP = 19;
const CAP_TOP = CHIP_TOP - (CAP_H - CHIP) / 2;
const pad2 = (n) => String(n).padStart(2, '0');
const ymd = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;
const shiftDay = (y, m, d, off) => {
  const t = new Date(y, m - 1, d + off);
  return ymd(t.getFullYear(), t.getMonth() + 1, t.getDate());
};

function MonthCalendar({ year, month, byDate, today, windowStart }) {
  const cells = useMemo(() => {
    const firstDow = new Date(year, month - 1, 1).getDay();
    const days = new Date(year, month, 0).getDate();
    const rows = Math.ceil((firstDow + days) / 7);
    const litOn = (date) => date <= today && STREAK_LIT.has(cellState(byDate[date]));
    const out = [];
    for (let i = 0; i < rows * 7; i += 1) {
      const day = i - firstDow + 1;
      if (day < 1 || day > days) { out.push(null); continue; }
      const date = ymd(year, month, day);
      const isFuture = date > today;
      const outside = date < windowStart; // 조회 창 밖 — 모른다
      const state = isFuture || outside ? 'miss' : cellState(byDate[date]);
      const lit = STREAK_LIT.has(state);
      out.push({
        day, date, state, isFuture, outside, isToday: date === today, info: byDate[date],
        bandLeft: lit && litOn(shiftDay(year, month, day, -1)),
        bandRight: lit && litOn(shiftDay(year, month, day, 1)),
      });
    }
    return out;
  }, [year, month, byDate, today, windowStart]);
  const lit = cells.filter((c) => c && (c.state === 'all' || c.state === 'part')).length;

  return (
    <div className="rounded-[14px] border border-layout-gray-100 bg-white px-2.5 pb-3 pt-3">
      <div className="flex items-baseline justify-center gap-[5px] pb-2.5 text-layout-black">
        <span className="text-[16px] font-extrabold tracking-[-0.03em]">{month}월</span>
        <span className="text-[11.5px] font-semibold text-layout-gray-300">{year}</span>
        <span className="ml-auto text-[11px] text-layout-gray-300">불꽃 {lit}일</span>
      </div>
      <div className="mb-[2px] grid grid-cols-7">
        {DOW.map((d) => <span key={d} className="text-center text-[10.5px] font-bold text-layout-gray-300">{d}</span>)}
      </div>
      <div className="flex flex-col gap-y-[2px]">
        {Array.from({ length: cells.length / 7 }).map((_, w) => {
          const week = cells.slice(w * 7, w * 7 + 7);
          const runs = litRuns(week, (c) => STREAK_LIT.has(c.state) && !c.isFuture);
          return (
            <div key={w} className="relative">
              {runs.map(([s, e]) => {
                const openLeft = s === 0 && week[s].bandLeft;
                const openRight = e === 6 && week[e].bandRight;
                const col = '(100% / 7)';
                return (
                  <span
                    key={`${s}-${e}`}
                    aria-hidden
                    className={`pointer-events-none absolute ${RUN_CAPSULE_CLASS} ${openLeft ? '' : 'rounded-l-full'} ${openRight ? '' : 'rounded-r-full'}`}
                    style={{
                      top: CAP_TOP, height: CAP_H,
                      left: openLeft ? '0px' : `calc(${col} * ${s + 0.5} - ${CAP_H / 2}px)`,
                      right: openRight ? '0px' : `calc(${col} * ${6 - e + 0.5} - ${CAP_H / 2}px)`,
                    }}
                  />
                );
              })}
              <div className="relative grid grid-cols-7">
                {week.map((c, j) => {
                  if (!c) return <span key={`e${w}-${j}`} style={{ height: CELL_H }} />;
                  const status = c.isFuture || c.outside ? 'upcoming' : (c.state === 'miss' ? (c.isToday ? 'today_empty' : 'none') : c.state);
                  let numClass = 'font-semibold text-layout-gray-400';
                  if (c.isToday) numClass = 'font-extrabold text-primary-main-600';
                  else if (c.isFuture || c.outside) numClass = 'font-semibold text-layout-gray-200';
                  else if (STREAK_LIT.has(c.state)) numClass = 'font-bold text-layout-black';
                  const i = c.info;
                  const tip = i
                    ? `${c.date} · 맞힌 단어 ${i.correct_cnt ?? 0}개${i.daily_mission_complete ? ' · 오늘 할 일 모두' : ''}${i.protected ? ' · 보호권' : ''}${i.attended && !i.qualified ? ' · 학습했지만 기준 미달' : ''}`
                    : c.date;
                  return (
                    <span key={c.date} title={tip} className="relative flex flex-col items-center" style={{ height: CELL_H }}>
                      <span className={`mt-[2px] h-[13px] text-[11px] leading-[13px] tabular-nums ${numClass}`}>{c.day}</span>
                      <span className="relative mt-1 flex"><StreakChip status={status} size={CHIP} /></span>
                      <span className="mt-[3px] flex h-1 justify-center">
                        {c.isToday && <i className="block h-1 w-1 rounded-full bg-primary-main-600" />}
                        {!c.isToday && i?.attended && !i?.qualified && !i?.protected && <i className="block h-1 w-1 rounded-full bg-layout-gray-300" />}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Streak({ s }) {
  const [showLogs, setShowLogs] = useState(false);
  const calendar = s.calendar || [];
  const byDate = useMemo(() => Object.fromEntries(calendar.map((d) => [d.date, d])), [calendar]);
  const windowStart = calendar.length ? calendar.reduce((a, d) => (d.date < a ? d.date : a), calendar[0].date) : s.today;
  const months = useMemo(() => {
    const set = new Set(calendar.map((d) => d.date.slice(0, 7)));
    set.add(s.today.slice(0, 7));
    return [...set].sort().reverse().map((ym) => ym.split('-').map(Number));
  }, [calendar, s.today]);
  const current = s.current || 0;
  const lit = current > 0 && !s.paused;
  const required = s.required ?? 5;

  return (
    <Section title="연속 학습 · 농장 방문 기록" desc={`앱 '농장 방문' 화면과 같은 데이터·그림. 날짜 기준 ${s.timezone}, 오늘 ${s.today}. 칸에 마우스를 올리면 그날 기록.`}>
      {/* ① 연속 요약 — 앱 StreakRecordView */}
      <div className="rounded-[16px] border border-layout-gray-100 bg-[linear-gradient(165deg,var(--secondary-yellow-100)_0%,var(--layout-white)_62%)] p-3.5">
        <div className="flex items-center gap-3.5">
          <span className="relative flex h-14 w-14 shrink-0 items-end justify-center">
            {lit && <span aria-hidden className="absolute -inset-2 rounded-full bg-[radial-gradient(circle,var(--secondary-yellow-400)_0%,transparent_66%)] opacity-50" />}
            <Img src={ART.flame} size={lit ? 52 : 42} className={`relative ${lit ? '' : 'opacity-55 grayscale'}`} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1 text-layout-black">
              <span className="text-[40px] font-extrabold leading-none tracking-[-0.05em] tabular-nums">{fmt(current)}</span>
              <span className="text-[15px] font-bold tracking-[-0.03em]">일 연속</span>
              {s.paused && <span className="ml-1 self-center rounded-full bg-primary-main-100 px-2 py-[3px] text-[10.5px] font-extrabold text-primary-main-600">멈춤</span>}
            </div>
            <p className="mt-[7px] text-[11.5px] font-semibold tracking-[-0.02em] text-layout-gray-400">
              오늘 <b className="font-extrabold text-layout-black">{fmt(s.today_correct)}/{required}개</b> 맞힘{s.today_done ? ' · 오늘 이어짐' : ''}
            </p>
          </div>
          <span className="shrink-0 self-start text-xs font-bold tabular-nums text-layout-gray-300">최고 {fmt(s.best)}일</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 rounded-xl bg-white/70 px-2.5 py-2">
            <Img src={ART.shield} size={30} className={s.shield_cnt ? '' : 'opacity-40 grayscale'} />
            <div>
              <div className="text-[11px] text-layout-gray-400">보유 보호권</div>
              <div className="text-sm font-extrabold tabular-nums text-layout-black">{fmt(s.shield_cnt)}개</div>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white/70 px-2.5 py-2">
            <span className={`flex h-[30px] w-[30px] items-center justify-center rounded-full ${RUN_CAPSULE_CLASS}`}><StreakChip status="shield" size={26} /></span>
            <div>
              <div className="text-[11px] text-layout-gray-400">보호권으로 이은 날</div>
              <div className="text-sm font-extrabold tabular-nums text-layout-black">{fmt(s.protected_days_cnt)}일</div>
            </div>
          </div>
        </div>
      </div>
      {(s.pause || s.earn_back || s.next_milestone) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {s.pause && <Tag tone="yellow">멈춤 · 빈 날 {s.pause.missed_days?.length ?? s.pause.needed}일 · 기한 {dt(s.pause.deadline)}</Tag>}
          {s.earn_back && <Tag tone="blue">다시 잇기 {s.earn_back.status === 'active' ? `${s.earn_back.days_done}/${s.earn_back.days_required}일` : '제안됨'}</Tag>}
          {s.next_milestone && <Tag tone="pink">다음 보상 {s.next_milestone.days}일 · {s.next_milestone.reward}</Tag>}
        </div>
      )}

      {/* ② 월 달력 */}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {months.map(([y, m]) => (
          <MonthCalendar key={`${y}-${m}`} year={y} month={m} byDate={byDate} today={s.today} windowStart={windowStart} />
        ))}
      </div>
      <StreakChipLegend className="mt-3 px-0.5 text-[10.5px] font-semibold tracking-[-0.02em] text-layout-gray-300" />
      <p className="mt-1.5 px-0.5 text-[10.5px] text-layout-gray-300">
        한 띠로 이어진 날은 연속이 끊기지 않은 날. 칸 아래 회색 점은 학습했지만 {required}개를 못 채운 날. 조회 기간 밖은 옅게 표시.
      </p>

      <div className="mt-3 border-t border-layout-gray-100 pt-3">
        <button type="button" onClick={() => setShowLogs((v) => !v)} className="flex items-center gap-1.5 text-xs font-medium text-layout-gray-500 hover:text-layout-black">
          <Img src={ART.shield} size={16} /> 보호권 지급·사용 이력 {s.shield_logs?.length || 0}건 {showLogs ? '접기' : '보기'}
        </button>
        {showLogs && (
          <ul className="mt-2 space-y-1 text-xs">
            {(s.shield_logs || []).length === 0 && <li className="text-layout-gray-300">이력이 없습니다.</li>}
            {(s.shield_logs || []).map((l, i) => (
              <li key={i} className="flex gap-2">
                <span className="w-32 shrink-0 text-layout-gray-300 tabular-nums">{dt(l.created_at)}</span>
                <span className={`w-10 shrink-0 tabular-nums font-semibold ${l.amount < 0 ? 'text-status-error-600' : 'text-status-success-600'}`}>
                  {l.amount > 0 ? `+${l.amount}` : l.amount}
                </span>
                <span className="w-16 shrink-0 text-layout-gray-400">{SHIELD_REASON[l.reason] || l.reason}</span>
                <span className="min-w-0 truncate text-layout-gray-500">{l.description}</span>
                <span className="ml-auto shrink-0 text-layout-gray-300">잔액 {l.balance_after}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}

const shortGoal = (text) => String(text || '').replace(/\s*달성$/, '');

function Achievements({ list }) {
  const doneCnt = list.filter((a) => a.level > 0).length;
  return (
    <Section title="업적" desc={`앱 마이페이지 '나의 업적'과 같은 메달. 테두리 = 달성 레벨 / 최고 레벨. ${doneCnt}/${list.length} 시작`}>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {list.map((a) => {
          const ip = a.in_progress;
          const isMax = a.max_level > 0 && a.level >= a.max_level;
          const next = a.levels.find((l) => l.level === a.level + 1);
          const tier = achievementTier(a.level);
          return (
            <li key={a.type} className="flex flex-col items-center rounded-[14px] bg-layout-gray-50 px-1.5 pb-3 pt-3.5">
              <AchievementMedal type={a.type} level={a.level} ratio={a.max_level ? a.level / a.max_level : 0} isMax={isMax} size={66} />
              <span className={`mt-3.5 text-[12.5px] font-extrabold tracking-[-0.03em] ${a.level > 0 ? 'text-layout-black' : 'text-layout-gray-300'}`}>
                {a.type}
              </span>
              <span className="text-[10px] text-layout-gray-300">{a.level > 0 ? `${tier.label} · ${a.level}/${a.max_level}레벨` : `0/${a.max_level}레벨`}</span>
              <span className="mt-1 min-h-[29px] text-center text-[10px] font-semibold leading-[1.45] tracking-[-0.03em] text-layout-gray-400 [word-break:keep-all]">
                {isMax ? <span className="text-secondary-purple-500">모두 달성</span> : next ? (
                  <span className="line-clamp-2">
                    <span className="mr-[3px] font-extrabold text-primary-main-600">{a.level === 0 ? '첫 목표' : '다음'}</span>
                    {shortGoal(next.goal)}
                  </span>
                ) : null}
              </span>
              {!isMax && (
                <span className="mt-1 flex w-full items-center gap-1 px-1">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-layout-gray-100">
                    <span className="block h-full rounded-full bg-[linear-gradient(90deg,var(--secondary-yellow-400),var(--secondary-yellow-600))]" style={{ width: `${ip ? Math.min(100, (ip.current / ip.target) * 100) : 0}%` }} />
                  </span>
                  <span className="shrink-0 text-[10px] tabular-nums text-layout-gray-400">{ip ? `${ip.current}/${ip.target}` : `0/${next?.target_value ?? '—'}`}</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/** 입문 퀘스트 — 앱 QuestSteps 세로 타임라인(완료 초록 체크 / 지금 할 것 / 남음 + 보상 보석) */
function Quests({ q }) {
  if (!q) return null;
  const missions = q.missions || [];
  const done = missions.filter((m) => m.done).length;
  return (
    <Section
      title="입문 퀘스트"
      desc={q.legacy ? '수준 측정형 온보딩 이전 가입자 — 앱에서는 퀘스트가 보이지 않고 전부 완료로 간주한다.' : `완료 ${done}/${missions.length}`}
      right={<div className="flex gap-1">
        {q.required_done && <Tag tone="green">필수 완료</Tag>}
        {q.quest_hidden && <Tag tone="gray">홈 카드 숨김</Tag>}
      </div>}
    >
      <ol className="flex flex-col">
        {missions.map((m, idx) => {
          const isCurrent = q.current_mission === m.key && !m.done;
          const isLast = idx === missions.length - 1;
          return (
            <li key={m.key} className="relative">
              {!isLast && (
                <span aria-hidden className="absolute left-[11px] top-[29px] bottom-[-7px] w-[2px] overflow-hidden rounded-full bg-layout-gray-100">
                  {m.done && <span className="absolute inset-0 bg-status-success-600" />}
                </span>
              )}
              <div className="relative flex min-h-[36px] w-full items-center gap-2.5 py-[5px]">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
                    m.done
                      ? 'bg-status-success-600 text-white'
                      : isCurrent
                        ? 'border-[1.5px] border-status-success-600 bg-status-success-50 text-status-success-600'
                        : 'border-[1.5px] border-layout-gray-200 bg-white text-layout-gray-300'
                  }`}
                >
                  {m.done ? <Check size={13} weight="bold" /> : (m.order ?? idx + 1)}
                </span>
                <span className="flex min-w-0 flex-1 items-center gap-1.5">
                  <span className={`min-w-0 truncate text-sm tracking-[-0.02em] ${
                    m.done ? 'font-semibold text-layout-gray-300 line-through decoration-layout-gray-200'
                      : isCurrent ? 'font-extrabold text-layout-black' : 'font-semibold text-layout-gray-400'}`}
                  >
                    {m.title}
                  </span>
                  {m.required && <Tag tone="pink">필수</Tag>}
                  {isCurrent && <Tag tone="green">지금 할 것</Tag>}
                </span>
                <span className="shrink-0 text-[11px] text-layout-gray-300 tabular-nums">{m.completed_at ? dt(m.completed_at) : ''}</span>
                {m.reward_gem > 0 && (
                  <span className={`flex shrink-0 items-center gap-0.5 text-xs font-extrabold tabular-nums ${m.done ? 'text-layout-gray-300' : 'text-primary-main-600'}`}>
                    <Img src={ART.gem} size={16} className={m.done ? 'opacity-50' : ''} />{m.reward_gem}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

/** 학습 기록 한 줄의 문제 유형 칩 — 앱 테스트 설정 타일 그림 */
function QuestionTypeChips({ types, lang }) {
  if (!types?.length) return null;
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {types.map((t) => {
        const { label, Glyph } = questionTypeOf(t.type);
        return (
          <span key={t.type} title={`${label} ${t.correct}/${t.count} 정답`} className="flex items-center gap-1 rounded-full border border-layout-gray-100 bg-white py-[1px] pl-[3px] pr-2 text-[10.5px] text-layout-gray-500">
            <Glyph size={18} lang={lang} className="text-layout-gray-400" />
            {label}
            <b className="font-semibold tabular-nums text-layout-black">{t.correct}/{t.count}</b>
          </span>
        );
      })}
    </span>
  );
}

// 날짜별 학습 기록 — 최근순, 아래로 내리면 다음 페이지
function History({ userId, total, handleErr, lang }) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [includeEmpty, setIncludeEmpty] = useState(false);
  const sentinel = useRef(null);
  const busy = useRef(false);
  const gen = useRef(0); // 사용자·필터가 바뀌면 올려서, 늦게 도착한 이전 응답을 버린다

  const loadMore = useCallback(async (reset = false) => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    const my = gen.current;
    const next = reset ? 1 : page + 1;
    try {
      const res = await getUserHistory(userId, { page: next, per_page: 30, include_empty: includeEmpty ? 1 : '' });
      if (my !== gen.current) return;
      const d = res?.data || { items: [], has_more: false };
      setItems((prev) => (reset ? d.items : [...prev, ...d.items]));
      setPage(next);
      setHasMore(!!d.has_more);
    } catch (e) {
      if (my !== gen.current) return;
      handleErr(e, '학습 기록을 불러오지 못했습니다.');
      setHasMore(false);
    } finally {
      if (my === gen.current) {
        busy.current = false;
        setLoading(false);
      }
    }
  }, [userId, page, includeEmpty, handleErr]);

  // 사용자·필터가 바뀌면 처음부터
  useEffect(() => {
    gen.current += 1;
    busy.current = false;
    setItems([]); setPage(0); setHasMore(true); setLoading(false);
  }, [userId, includeEmpty]);
  useEffect(() => { if (page === 0 && hasMore && !busy.current) loadMore(true); }, [page, hasMore, loadMore]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return undefined;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && page > 0) loadMore();
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, page, loadMore]);

  const groups = useMemo(() => {
    const out = [];
    items.forEach((s) => {
      const last = out[out.length - 1];
      if (last && last.date === s.date_kst) last.rows.push(s);
      else out.push({ date: s.date_kst, rows: [s] });
    });
    return out;
  }, [items]);

  return (
    <Section
      title="날짜별 학습 기록"
      desc={`학습 세션 전체 ${fmt(total)}건 · 최근순. 문제 수·정답률은 실제 답안 기록 기준, 시간은 시작~마지막 답안(또는 종료). 칩은 앱 문제 유형 그림·이름별 정답/문항.`}
      right={(
        <label className="flex items-center gap-1 text-[11px] text-layout-gray-400">
          <input type="checkbox" checked={includeEmpty} onChange={(e) => setIncludeEmpty(e.target.checked)} />
          빈 세션 포함
        </label>
      )}
    >
      {groups.length === 0 && !loading && <p className="py-4 text-center text-sm text-layout-gray-300">학습 기록이 없습니다.</p>}
      <div className="space-y-3">
        {groups.map((g) => {
          const q = g.rows.reduce((a, r) => a + r.question_count, 0);
          const c = g.rows.reduce((a, r) => a + r.correct_count, 0);
          return (
            <div key={g.date}>
              <div className="mb-1 flex items-baseline gap-2 border-b border-layout-gray-100 pb-1">
                <span className="text-xs font-semibold text-layout-black">{g.date}</span>
                <span className="text-[11px] text-layout-gray-300">
                  {g.rows.length}회 · {fmt(q)}문제 · 정답률 {q ? Math.round((c * 100) / q) : '—'}%
                </span>
              </div>
              <ul className="divide-y divide-layout-gray-50">
                {g.rows.map((r) => (
                  <li key={r.id} className="flex items-start gap-2.5 py-2 text-xs text-layout-gray-500">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-layout-gray-50">
                      <img src={testTypeArt(r.test_type)} alt="" draggable={false} className="h-6 w-6 select-none object-contain" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-1.5">
                        <span className="tabular-nums text-layout-gray-300">{dt(r.started_at).slice(11)}</span>
                        <span className="font-semibold text-layout-black">{TEST_TYPE_LABEL[r.test_type] || r.test_type}</span>
                        {r.is_onboarding && <span className="text-layout-gray-300">온보딩</span>}
                        {!r.finished && <span className="text-secondary-yellow-600">중단</span>}
                        {r.book_cnt > 0 && <span className="text-layout-gray-300">단어장 {r.book_cnt}개</span>}
                      </span>
                      <QuestionTypeChips types={r.question_types} lang={lang} />
                    </span>
                    <span className="shrink-0 text-right tabular-nums">
                      <span className="block font-semibold text-layout-black">{r.correct_count}/{r.question_count}문제 · {r.accuracy == null ? '—' : `${Math.round(r.accuracy)}%`}</span>
                      <span className="block text-layout-gray-400">{dur(r.duration_sec)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <div ref={sentinel} />
      {loading && <Spinner label="학습 기록을 불러오는 중…" className="py-4" />}
      {!loading && hasMore && page > 0 && (
        <div className="mt-2 flex justify-center"><Button size="sm" variant="secondary" onClick={() => loadMore()}>더 보기</Button></div>
      )}
    </Section>
  );
}

/**
 * props: userId(null 이면 닫힘), title(목록의 이메일), onClose(), onAuthError(), toast
 */
export default function UserDetailDrawer({ userId, title, onClose, onAuthError, toast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleErr = useCallback((e, fallback) => {
    if (e instanceof ApiError && e.status === 401) { onAuthError?.(); return; }
    toast?.error(e?.message || fallback);
  }, [onAuthError, toast]);

  useEffect(() => {
    if (!userId) return undefined;
    let alive = true;
    setLoading(true);
    setError(null);
    setData(null);
    getUserDetail(userId)
      .then((res) => { if (alive) setData(res?.data || null); })
      .catch((e) => {
        if (!alive) return;
        if (e instanceof ApiError && e.status === 401) { onAuthError?.(); return; }
        setError(e?.message || '사용자 상세를 불러오지 못했습니다.');
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [userId, onAuthError]);

  if (!userId) return null;
  const p = data?.profile;
  return (
    <Drawer open onClose={onClose} subtitle="사용자 학습 기록" title={p ? `${p.name || ''} · ${p.email}` : (title || '사용자')}>
      {loading && <Spinner label="사용자 상세를 불러오는 중…" />}
      {error && <p className="py-8 text-center text-sm text-status-error-600">{error}</p>}
      {data && (
        <>
          <Profile p={data.profile} />
          <FarmSummary farm={data.farm} languages={data.languages} />
          <Books books={data.books} />
          <Streak s={data.streak} />
          <Quests q={data.quests} />
          <Achievements list={data.achievements} />
          <History userId={userId} total={data.sessions_total} handleErr={handleErr} lang={data.profile?.learning_lang} />
        </>
      )}
    </Drawer>
  );
}
