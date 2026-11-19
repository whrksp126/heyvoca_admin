// 유저 관리 — 사용자 한 명의 학습 기록 상세 (읽기 전용).
// 숫자는 앱이 쓰는 서비스 함수를 그대로 호출해 만든다(heyvoca_back app/services/admin_user_detail.py).
// 작물 단계·건강 상태 이름과 색은 앱(heyvoca_front src/utils/crop.js)과 같게 둔다.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle, Circle, Shield, Trophy } from '@phosphor-icons/react';
import { Drawer } from '@/components/ui/overlays';
import { Button, Card, ProgressBar, Spinner, Tag } from '@/components/ui/primitives';
import { ApiError } from '@/lib/api';
import { getUserDetail, getUserHistory } from './api';

const PLATFORM_LABEL = { ios: 'iOS', android: 'Android', web: '웹', unknown: '알 수 없음' };
const LOGIN_LABEL = { google: 'Google', apple: 'Apple', other: '기타' };
const REAL_LABEL = { real: '실사용자', pending: '판정 대기', no: '미전환' };
const REAL_TONE = { real: 'green', pending: 'yellow', no: 'gray' };
const LANG_LABEL = { en: '영어', ja: '일본어' };
const ITEM_LABEL = { SHOVEL: '새심기 삽', NUTRIENT: '영양 회복제', SHIELD: '연속 학습 보호권' };

// 앱 crop.js CROP_LABEL_DETAIL / CROP_COLOR 와 같은 값
const STAGES = [
  { key: 'unplanted', label: '미학습', color: '#C9C2B6' },
  { key: 'seed', label: '씨앗', color: '#9D835A' },
  { key: 'sprout', label: '새싹', color: '#77CE4F' },
  { key: 'leaf', label: '이파리', color: '#38CE38' },
  { key: 'carrot', label: '당근', color: '#F68300' },
  { key: 'golden', label: '황금 당근', color: '#F2B713' },
];
// 앱 crop.js HEALTH_LABEL / HEALTH_COLOR 와 같은 값
const HEALTHS = [
  { key: 'fresh', label: '촉촉해요', color: '#12B76A' },
  { key: 'thirsty', label: '목말라요', color: '#2E90FA' },
  { key: 'wilted', label: '시들었어요', color: '#FD853A' },
  { key: 'critical', label: '많이 시들었어요', color: '#FB6514' },
  { key: 'rotten', label: '썩었어요', color: '#7B7B7B' },
  { key: 'golden', label: '황금이에요', color: '#F2B713' },
];
const TEST_TYPE_LABEL = {
  plant: '새 씨앗 심기', quick: '농장 돌보기', recommend: '추천 학습', chat: '채팅 학습',
  test: '단어장 테스트', exam: '자유 설정 테스트', today: '오늘의 학습', study: '집중 반복 듣기',
  pick: '골라 학습', script: '글자 학습', placement: '수준 측정(온보딩)',
};
const SHIELD_REASON = {
  WEEKLY_GRANT: '주간 지급', STREAK_REWARD: '연속 보상', GEM_PURCHASE: '보석 구매', SPENT: '사용',
  MIGRATION: '전환 보상', ADMIN_ADJUST: '관리자 조정', EVENT: '이벤트', STAGE_REWARD: '성장 보상',
};
const DAY_STYLE = {
  studied: { label: '학습(연속 인정)', cls: 'bg-status-success-500 text-white' },
  protected: { label: '보호권으로 이음', cls: 'bg-secondary-blue-500 text-white' },
  attended: { label: '학습했지만 5개 미만', cls: 'bg-status-success-100 text-status-success-600' },
  missed: { label: '학습 없음', cls: 'bg-layout-gray-50 text-layout-gray-300' },
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
      <div className="flex items-start gap-2 mb-2">
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

function MiniStat({ label, value, sub }) {
  return (
    <div className="rounded-lg bg-layout-gray-50 px-3 py-2">
      <div className="text-[11px] text-layout-gray-400">{label}</div>
      <div className="text-lg font-bold text-layout-black tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-layout-gray-300">{sub}</div>}
    </div>
  );
}

// 가로 누적 막대 + 범례 (단계/건강 분포 공용)
function StackBar({ defs, counts, showLegend = true }) {
  const total = defs.reduce((a, d) => a + (counts?.[d.key] || 0), 0);
  return (
    <div>
      <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full bg-layout-gray-50">
        {total > 0 && defs.map((d) => {
          const n = counts?.[d.key] || 0;
          if (!n) return null;
          return <span key={d.key} title={`${d.label} ${n}`} style={{ width: `${(n / total) * 100}%`, background: d.color }} />;
        })}
      </div>
      {showLegend && (
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
          {defs.map((d) => (
            <span key={d.key} className="flex items-center gap-1 text-[11px] text-layout-gray-400">
              <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
              {d.label} <b className="font-semibold text-layout-black tabular-nums">{fmt(counts?.[d.key] || 0)}</b>
            </span>
          ))}
        </div>
      )}
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
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat label="보석" value={fmt(p.gem_cnt)} />
        {Object.entries(ITEM_LABEL).map(([k, label]) => (
          <MiniStat key={k} label={label} value={fmt(p.items?.[k] ?? 0)} />
        ))}
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
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat label="전체 단어" value={fmt(total)} />
        <MiniStat label="오늘 돌볼 작물" value={fmt(f.today?.care_due_cnt)} sub={`남은 ${fmt(f.today?.care_left_cnt)}개`} />
        <MiniStat label="썩은 작물" value={fmt(f.health?.rotten)} />
        <MiniStat label="황금 당근" value={fmt(f.counts?.golden)} />
      </div>
      <div className="space-y-3">
        <div>
          <div className="mb-1 text-xs text-layout-gray-400">작물 단계</div>
          <StackBar defs={STAGES} counts={stageCounts} />
        </div>
        <div>
          <div className="mb-1 text-xs text-layout-gray-400">건강 상태</div>
          <StackBar defs={HEALTHS.filter((h) => h.key !== 'golden')} counts={f.health} />
        </div>
      </div>
      {f.comeback && (
        <p className="mt-2 text-xs text-layout-gray-400">
          복귀 미션 진행 중 · {f.comeback.progress_days}/{f.comeback.required_days}일
        </p>
      )}
    </Section>
  );
}

function Books({ books }) {
  const [open, setOpen] = useState(null);
  return (
    <Section title={`단어장 ${books.length}개`} desc="단어장별 작물 단계·건강 상태 분포. 단어장을 누르면 숫자가 펼쳐진다.">
      {books.length === 0 ? (
        <p className="py-4 text-center text-sm text-layout-gray-300">단어장이 없습니다.</p>
      ) : (
        <ul className="divide-y divide-layout-gray-100">
          {books.map((b) => (
            <li key={b.id} className="py-2.5">
              <button type="button" onClick={() => setOpen(open === b.id ? null : b.id)} className="w-full text-left">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: b.color?.main || '#ccc' }} />
                  <span className="truncate text-sm font-medium text-layout-black">{b.name}</span>
                  {b.book_kind === 'script' && <Tag tone="purple">글자</Tag>}
                  {b.bookstore_id && <Tag tone="blue">서점</Tag>}
                  {b.language !== 'en' && <Tag tone="gray">{LANG_LABEL[b.language] || b.language}</Tag>}
                  <span className="ml-auto shrink-0 text-xs text-layout-gray-400 tabular-nums">{fmt(b.total)}단어</span>
                </div>
                <StackBar defs={STAGES} counts={b.stages} showLegend={false} />
              </button>
              {open === b.id && (
                <div className="mt-2 space-y-2 rounded-lg bg-layout-gray-50 p-2.5">
                  <StackBar defs={STAGES} counts={b.stages} />
                  <StackBar defs={HEALTHS} counts={b.health} />
                  <div className="text-[11px] text-layout-gray-300">만든 날 {dt(b.created_at)} · 수정 {dt(b.updated_at)}</div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

// 월 단위 달력 — /farm/streak calendar 와 같은 데이터(앱 농장 방문 기록)
function VisitCalendar({ calendar }) {
  const months = useMemo(() => {
    const byMonth = new Map();
    calendar.forEach((c) => {
      const ym = c.date.slice(0, 7);
      if (!byMonth.has(ym)) byMonth.set(ym, []);
      byMonth.get(ym).push(c);
    });
    return [...byMonth.entries()].reverse();
  }, [calendar]);
  const kind = (c) => (c.status === 'studied' ? 'studied' : c.status === 'protected' ? 'protected' : c.attended ? 'attended' : 'missed');
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1">
        {Object.entries(DAY_STYLE).map(([k, s]) => (
          <span key={k} className="flex items-center gap-1 text-[11px] text-layout-gray-400">
            <span className={`h-3 w-3 rounded ${s.cls}`} />{s.label}
          </span>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {months.map(([ym, days]) => {
          const [y, m] = ym.split('-').map(Number);
          const firstDow = new Date(y, m - 1, 1).getDay();
          const lastDay = new Date(y, m, 0).getDate();
          const map = Object.fromEntries(days.map((d) => [Number(d.date.slice(8, 10)), d]));
          const cells = [...Array(firstDow).fill(null), ...Array.from({ length: lastDay }, (_, i) => i + 1)];
          const studied = days.filter((d) => d.status === 'studied').length;
          return (
            <div key={ym}>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-xs font-semibold text-layout-black">{y}년 {m}월</span>
                <span className="text-[11px] text-layout-gray-300">연속 인정 {studied}일</span>
              </div>
              <div className="grid grid-cols-7 gap-[3px] text-center text-[10px]">
                {DOW.map((d) => <span key={d} className="text-layout-gray-300">{d}</span>)}
                {cells.map((day, i) => {
                  if (day == null) return <span key={`e${i}`} />;
                  const c = map[day];
                  if (!c) return <span key={day} className="rounded py-1 text-layout-gray-200">{day}</span>;
                  const s = DAY_STYLE[kind(c)];
                  return (
                    <span
                      key={day}
                      title={`${c.date} · ${s.label} · 정답 단어 ${c.correct_cnt}개${c.daily_mission_complete ? ' · 데일리 미션 완료' : ''}`}
                      className={`rounded py-1 tabular-nums ${s.cls} ${c.is_today ? 'ring-2 ring-primary-main-500' : ''}`}
                    >
                      {day}
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
  return (
    <Section title="연속 학습 · 농장 방문 기록" desc={`앱 '농장 방문 기록'과 같은 데이터. 날짜 기준 ${s.timezone}, 오늘 ${s.today}.`}>
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat label="현재 연속" value={`${fmt(s.current)}일`} sub={s.paused ? '멈춤 중' : s.today_done ? '오늘 완료' : `오늘 ${s.today_correct}/${s.required}`} />
        <MiniStat label="최장 연속" value={`${fmt(s.best)}일`} />
        <MiniStat label="보유 보호권" value={fmt(s.shield_cnt)} />
        <MiniStat label="보호권으로 이은 날" value={`${fmt(s.protected_days_cnt)}일`} />
      </div>
      {(s.pause || s.earn_back || s.next_milestone) && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {s.pause && <Tag tone="yellow">멈춤 · 빈 날 {s.pause.missed_days?.length ?? s.pause.needed}일 · 기한 {dt(s.pause.deadline)}</Tag>}
          {s.earn_back && <Tag tone="blue">다시 잇기 {s.earn_back.status === 'active' ? `${s.earn_back.days_done}/${s.earn_back.days_required}일` : '제안됨'}</Tag>}
          {s.next_milestone && <Tag tone="pink">다음 보상 {s.next_milestone.days}일 · {s.next_milestone.reward}</Tag>}
        </div>
      )}
      <VisitCalendar calendar={s.calendar || []} />
      <div className="mt-3 border-t border-layout-gray-100 pt-3">
        <button type="button" onClick={() => setShowLogs((v) => !v)} className="flex items-center gap-1 text-xs font-medium text-layout-gray-500 hover:text-layout-black">
          <Shield size={14} weight="bold" /> 보호권 지급·사용 이력 {s.shield_logs?.length || 0}건 {showLogs ? '접기' : '보기'}
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

function Achievements({ list }) {
  return (
    <Section title="업적" desc="앱 마이페이지 '나의 업적'과 같은 기준. 막대는 진행 중인 다음 레벨의 진행도.">
      <ul className="grid gap-2 sm:grid-cols-2">
        {list.map((a) => {
          const ip = a.in_progress;
          const next = a.levels.find((l) => l.level === a.level + 1);
          return (
            <li key={a.type} className="rounded-lg bg-layout-gray-50 p-2.5">
              <div className="flex items-center gap-1.5">
                <Trophy size={14} weight="fill" className={a.level > 0 ? 'text-secondary-yellow-500' : 'text-layout-gray-200'} />
                <span className="text-sm font-medium text-layout-black">{a.type}</span>
                <span className="ml-auto text-xs text-layout-gray-400 tabular-nums">{a.level}/{a.max_level}레벨</span>
              </div>
              {a.level >= a.max_level ? (
                <p className="mt-1 text-[11px] text-status-success-600">모든 레벨 달성</p>
              ) : (
                <>
                  <p className="mt-1 truncate text-[11px] text-layout-gray-400">{next?.goal || '—'}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <ProgressBar value={ip ? (ip.current / ip.target) * 100 : 0} tone="yellow" className="h-1.5" />
                    <span className="shrink-0 text-[11px] text-layout-gray-400 tabular-nums">{ip ? `${ip.current}/${ip.target}` : `0/${next?.target_value ?? '—'}`}</span>
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function Quests({ q }) {
  if (!q) return null;
  const done = (q.missions || []).filter((m) => m.done).length;
  return (
    <Section
      title="입문 퀘스트"
      desc={q.legacy ? '수준 측정형 온보딩 이전 가입자 — 앱에서는 퀘스트가 보이지 않고 전부 완료로 간주한다.' : `완료 ${done}/${q.missions?.length || 0}`}
      right={<div className="flex gap-1">
        {q.required_done && <Tag tone="green">필수 완료</Tag>}
        {q.quest_hidden && <Tag tone="gray">홈 카드 숨김</Tag>}
      </div>}
    >
      <ul className="space-y-1">
        {(q.missions || []).map((m) => (
          <li key={m.key} className="flex items-center gap-2 text-sm">
            {m.done
              ? <CheckCircle size={16} weight="fill" className="shrink-0 text-status-success-500" />
              : <Circle size={16} className="shrink-0 text-layout-gray-200" />}
            <span className={m.done ? 'text-layout-black' : 'text-layout-gray-400'}>{m.title}</span>
            {m.required && <Tag tone="pink">필수</Tag>}
            {q.current_mission === m.key && <Tag tone="blue">진행 중</Tag>}
            <span className="ml-auto text-[11px] text-layout-gray-300">{m.completed_at ? dt(m.completed_at) : ''}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

// 날짜별 학습 기록 — 최근순, 아래로 내리면 다음 페이지
function History({ userId, total, handleErr }) {
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
      desc={`학습 세션 전체 ${fmt(total)}건 · 최근순. 문제 수·정답률은 실제 답안 기록 기준, 시간은 시작~마지막 답안(또는 종료).`}
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
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <tbody>
                    {g.rows.map((r) => (
                      <tr key={r.id} className="text-layout-gray-500">
                        <td className="w-14 py-1 tabular-nums text-layout-gray-300">{dt(r.started_at).slice(11)}</td>
                        <td className="py-1 pr-2">
                          <span className="text-layout-black">{TEST_TYPE_LABEL[r.test_type] || r.test_type}</span>
                          {r.is_onboarding && <span className="ml-1 text-layout-gray-300">온보딩</span>}
                          {!r.finished && <span className="ml-1 text-secondary-yellow-600">중단</span>}
                        </td>
                        <td className="whitespace-nowrap py-1 text-right tabular-nums">{r.correct_count}/{r.question_count}문제</td>
                        <td className="w-14 whitespace-nowrap py-1 text-right tabular-nums">{r.accuracy == null ? '—' : `${Math.round(r.accuracy)}%`}</td>
                        <td className="w-20 whitespace-nowrap py-1 text-right tabular-nums text-layout-gray-400">{dur(r.duration_sec)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
          <History userId={userId} total={data.sessions_total} handleErr={handleErr} />
        </>
      )}
    </Drawer>
  );
}
