// 유저 관리 — 마케팅용 사용자 대시보드 (heyvoca_back app/routes/admin_user_stats.py).
// 정의(실사용자·이탈·앱 삭제 추정 등)는 백엔드 모듈 docstring 이 원본. 관리자 제외 이메일은 모든 집계에서 빠진다.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Trash, UserMinus, Info, CaretUp, CaretDown } from '@phosphor-icons/react';
import { Button, Card, Field, Input, Select, Spinner, Tag } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/overlays';
import { ApiError } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { LineChart, StackedBars, DistBars, SERIES_COLORS } from './charts';
import {
  getUserStatsOverview, listStatUsers, listExcludedEmails, addExcludedEmail, deleteExcludedEmail,
} from './api';

const PERIODS = [7, 30, 90];
const PLATFORM_LABEL = { ios: 'iOS', android: 'Android', web: '웹', unknown: '알 수 없음' };
const LOGIN_LABEL = { google: 'Google', apple: 'Apple', other: '기타' };
const REAL_LABEL = { real: '실사용자', pending: '판정 대기', no: '미전환' };
const REAL_TONE = { real: 'green', pending: 'yellow', no: 'gray' };

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString() : '—');
const pct = (n) => (n == null ? '—' : `${n}%`);

function Stat({ label, value, sub, help }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1 text-xs text-layout-gray-400" title={help}>
        {label}{help && <Info size={12} weight="bold" />}
      </div>
      <div className="text-2xl font-bold mt-1 text-layout-black tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-layout-gray-300 mt-0.5">{sub}</div>}
    </Card>
  );
}

function Section({ title, desc, children, className = '' }) {
  return (
    <Card className={`p-4 ${className}`}>
      <h3 className="text-sm font-semibold text-layout-black">{title}</h3>
      {desc && <p className="text-[11px] text-layout-gray-300 mt-0.5 mb-2">{desc}</p>}
      {!desc && <div className="mb-2" />}
      {children}
    </Card>
  );
}

export default function UserStatsPage({ onAuthError }) {
  const toast = useToast();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [platformScope, setPlatformScope] = useState('active');
  const [showExcluded, setShowExcluded] = useState(false);

  const handleErr = useCallback((e, fallback) => {
    if (e instanceof ApiError && e.status === 401) { onAuthError?.(); return; }
    toast.error(e?.message || fallback);
  }, [onAuthError, toast]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getUserStatsOverview(days);
      setData(res?.data || null);
    } catch (e) { handleErr(e, '사용자 통계를 불러오지 못했습니다.'); }
    finally { setLoading(false); }
  }, [days, handleErr]);

  useEffect(() => { load(); }, [load]);

  const daily = useMemo(() => (data?.daily || []).map((d) => ({
    ...d, signups_no: Math.max(0, d.signups - d.signups_real - d.signups_pending),
  })), [data]);

  const t = data?.totals || {};

  return (
    <div className="h-full overflow-y-auto px-4 py-4 sm:px-8 sm:py-6 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-layout-black">유저 관리</h2>
          <p className="text-sm text-layout-gray-300 mt-0.5">
            관리자 제외 {fmt(t.excluded)}명을 뺀 집계. 접속 기록은 {data?.activity_tracking_since || '2026-11-10'}부터, 그 전은 학습한 날로 추정합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-layout-gray-100 overflow-hidden">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setDays(p)}
                className={`px-3 py-1.5 text-sm font-semibold ${days === p ? 'bg-primary-main-100 text-primary-main-600' : 'bg-white text-layout-gray-400 hover:bg-layout-gray-50'}`}
              >
                {p}일
              </button>
            ))}
          </div>
          <Button size="sm" variant="secondary" onClick={() => setShowExcluded(true)}>
            <UserMinus size={14} weight="bold" /> 통계 제외 계정
          </Button>
        </div>
      </div>

      {loading && !data ? <Spinner label="사용자 통계를 계산하는 중…" /> : !data ? null : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
            <Stat label="전체 가입자" value={fmt(t.users)} sub={`기간 신규 ${fmt(t.period_signups)}명`} />
            <Stat label="실사용자" value={fmt(t.real)} sub={`판정 대기 ${fmt(t.pending)} · 미전환 ${fmt(t.not_real)}`}
              help="가입 후 7일 안에 서로 다른 2일 이상 사용한 계정" />
            <Stat label="DAU / WAU / MAU" value={`${fmt(t.dau)} / ${fmt(t.wau)} / ${fmt(t.mau)}`} sub="오늘 · 최근 7일 · 최근 30일" />
            <Stat label="이탈" value={fmt(t.churned)} sub={`실사용자의 ${pct(t.churn_rate)}`} help="실사용자 중 최근 14일 사용 없음" />
            <Stat label="탈퇴 / 앱 삭제 추정" value={`${fmt(t.period_withdrawals)} / ${fmt(t.app_deleted)}`} sub="탈퇴는 기간 합계, 앱 삭제는 현재"
              help="앱 삭제 추정: 푸시 토큰이 무효로 판정돼 지워졌고 그 뒤 접속이 없는 계정" />
            <Stat label="온보딩 완료율" value={pct(t.onboarded_rate)} sub={`기간 가입자 중 ${fmt(t.onboarded)}명`} />
          </div>

          <div className="grid lg:grid-cols-2 gap-3">
            <Section title="일별 신규 가입" desc="가입 당일 기준. 실사용자 전환 / 판정 대기 / 미전환">
              <StackedBars
                data={daily}
                series={[
                  { key: 'signups_real', label: '실사용자 전환' },
                  { key: 'signups_pending', label: '판정 대기' },
                  { key: 'signups_no', label: '미전환', color: 'var(--layout-gray-200, #ccc)' },
                ]}
              />
            </Section>
            <Section title="누적 가입 · 누적 실사용자" desc="탈퇴자도 가입 시점에 포함">
              <LineChart data={daily} series={[{ key: 'cum_signups', label: '누적 가입' }, { key: 'cum_real', label: '누적 실사용자' }]} />
            </Section>
            <Section title="활성 사용자" desc="DAU · 그날 기준 최근 7일(WAU) · 최근 30일(MAU)">
              <LineChart data={daily} series={[{ key: 'dau', label: 'DAU' }, { key: 'wau', label: 'WAU' }, { key: 'mau', label: 'MAU' }]} />
            </Section>
            <Section title="일별 탈퇴 · 앱 삭제 추정" desc="앱 삭제 추정은 푸시 발송이 토큰 무효로 실패한 날 기준(기록은 2026-11-10부터)">
              <LineChart data={daily} series={[{ key: 'withdrawals', label: '탈퇴' }, { key: 'app_deleted', label: '앱 삭제 추정' }]} />
            </Section>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <Section title="플랫폼">
              <div className="flex gap-1 mb-2">
                {[['active', '기간 활성'], ['all', '전체']].map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setPlatformScope(k)}
                    className={`px-2 py-0.5 rounded-md text-xs font-semibold ${platformScope === k ? 'bg-primary-main-100 text-primary-main-600' : 'text-layout-gray-400 hover:bg-layout-gray-50'}`}>
                    {l}
                  </button>
                ))}
              </div>
              <DistBars items={(data.platforms?.[platformScope] || []).map((x) => ({ ...x, label: PLATFORM_LABEL[x.key] || x.key }))} />
            </Section>
            <Section title="로그인 수단">
              <DistBars color={SERIES_COLORS[1]} items={(data.logins || []).map((x) => ({ ...x, label: LOGIN_LABEL[x.key] || x.key }))} />
            </Section>
            <Section title="앱 버전" desc="기간 활성 사용자의 마지막 앱 버전">
              <DistBars color={SERIES_COLORS[2]} items={(data.app_versions || []).slice(0, 10).map((x) => ({ ...x, label: x.key.replace(/^ios/, 'iOS').replace(/^android/, 'Android') }))} empty="앱 버전 기록 없음" />
            </Section>
          </div>

          <div className="grid lg:grid-cols-2 gap-3">
            <Section title="리텐션" desc={`가입 ${data.retention?.unit === 'week' ? '주(월요일 시작)' : '일'} 코호트 · 가입 N일 뒤 그날 사용한 비율`}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-layout-gray-400">
                    <tr>
                      <th className="text-left py-1 pr-2">코호트</th>
                      <th className="text-right py-1 px-2">가입</th>
                      <th className="text-right py-1 px-2">D1</th>
                      <th className="text-right py-1 px-2">D7</th>
                      <th className="text-right py-1 pl-2">D30</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.retention?.rows || []).length === 0 ? (
                      <tr><td colSpan={5} className="py-4 text-center text-layout-gray-300">기간 내 가입자가 없습니다.</td></tr>
                    ) : data.retention.rows.map((r) => (
                      <tr key={r.cohort} className="border-t border-layout-gray-100">
                        <td className="py-1 pr-2 text-layout-gray-500">{r.cohort}</td>
                        <td className="py-1 px-2 text-right tabular-nums">{r.size}</td>
                        {['d1', 'd7', 'd30'].map((k) => (
                          <td key={k} className="py-1 px-2 text-right tabular-nums">
                            {r[k] == null ? <span className="text-layout-gray-200">—</span> : (
                              <span className="inline-block min-w-[3rem] rounded px-1"
                                style={{ background: `color-mix(in srgb, var(--primary-main-600) ${Math.round(r[k] * 0.6)}%, transparent)` }}>
                                {r[k]}%
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
            <Section title="입문 퀘스트 단계별 도달률" desc="기간 내 가입자 중 각 퀘스트를 완료한 비율">
              <DistBars
                color={SERIES_COLORS[3]}
                items={(data.quest_steps || []).map((q) => ({ key: q.key, label: q.title, count: q.count }))}
                empty="기간 내 가입자가 없습니다."
              />
              <p className="text-[11px] text-layout-gray-300 mt-2">
                단계별 %: {(data.quest_steps || []).map((q) => `${q.title} ${pct(q.rate)}`).join(' · ')}
              </p>
            </Section>
          </div>
        </>
      )}

      <UserTable handleErr={handleErr} />

      {showExcluded && (
        <ExcludedModal
          onClose={() => setShowExcluded(false)}
          onChanged={load}
          handleErr={handleErr}
          toast={toast}
        />
      )}
    </div>
  );
}

const COLUMNS = [
  { key: 'email', label: '계정', sortable: true },
  { key: 'created_at', label: '가입일', sortable: true },
  { key: 'last_active', label: '마지막 사용일', sortable: true },
  { key: 'platform', label: '플랫폼' },
  { key: 'real', label: '실사용자' },
  { key: 'active_days', label: '사용 일수', sortable: true },
  { key: 'study_days', label: '학습 일수', sortable: true },
];

function UserTable({ handleErr }) {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [real, setReal] = useState('');
  const [platform, setPlatform] = useState('');
  const [sort, setSort] = useState({ key: 'created_at', order: 'desc' });
  const [page, setPage] = useState(1);
  const [list, setList] = useState({ items: [], total: 0, has_more: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = setTimeout(() => { setDebounced(q.trim()); setPage(1); }, 300);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    listStatUsers({ q: debounced, real, platform, sort: sort.key, order: sort.order, page, per_page: 50 })
      .then((res) => { if (alive) setList(res?.data || { items: [], total: 0 }); })
      .catch((e) => handleErr(e, '사용자 목록을 불러오지 못했습니다.'))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [debounced, real, platform, sort, page, handleErr]);

  const toggleSort = (key) => {
    setPage(1);
    setSort((s) => (s.key === key ? { key, order: s.order === 'desc' ? 'asc' : 'desc' } : { key, order: 'desc' }));
  };

  return (
    <Card className="overflow-hidden">
      <div className="p-3 flex flex-wrap items-center gap-2 border-b border-layout-gray-100">
        <h3 className="text-sm font-semibold text-layout-black mr-auto">사용자 목록 <span className="text-layout-gray-300 font-normal">{fmt(list.total)}명</span></h3>
        <Select value={real} onChange={(e) => { setReal(e.target.value); setPage(1); }} aria-label="실사용자 여부" className="w-32">
          <option value="">전체</option>
          {Object.entries(REAL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select value={platform} onChange={(e) => { setPlatform(e.target.value); setPage(1); }} aria-label="플랫폼" className="w-32">
          <option value="">플랫폼 전체</option>
          {Object.entries(PLATFORM_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이메일·이름 검색" aria-label="사용자 검색" className="w-full sm:w-56" />
      </div>
      {loading ? <Spinner label="사용자 목록을 불러오는 중…" /> : list.items.length === 0 ? (
        <div className="py-10 text-center text-sm text-layout-gray-300">조건에 맞는 사용자가 없습니다.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-layout-gray-50 text-layout-gray-400 text-xs">
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c.key} className="px-3 py-2 text-left whitespace-nowrap">
                    {c.sortable ? (
                      <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-0.5 hover:text-layout-gray-500">
                        {c.label}
                        {sort.key === c.key && (sort.order === 'desc' ? <CaretDown size={12} weight="bold" /> : <CaretUp size={12} weight="bold" />)}
                      </button>
                    ) : c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.items.map((u) => (
                <tr key={u.id} className="border-t border-layout-gray-100">
                  <td className="px-3 py-2 max-w-[260px]">
                    <div className="truncate font-medium text-layout-black">{u.email}</div>
                    <div className="text-[11px] text-layout-gray-300 truncate">
                      {u.name} · {LOGIN_LABEL[u.login] || u.login}
                      {u.churned && ' · 이탈'}{u.app_deleted && ' · 앱 삭제 추정'}
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-layout-gray-500">{u.signup_date}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-layout-gray-500">{u.last_active || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-layout-gray-500">
                    {PLATFORM_LABEL[u.platform] || u.platform}{u.app_version ? ` ${u.app_version}` : ''}
                  </td>
                  <td className="px-3 py-2"><Tag tone={REAL_TONE[u.real]}>{REAL_LABEL[u.real] || u.real}</Tag></td>
                  <td className="px-3 py-2 text-right tabular-nums">{u.active_days}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{u.study_days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(page > 1 || list.has_more) && (
        <div className="flex justify-center gap-2 p-3 border-t border-layout-gray-100">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>이전</Button>
          <span className="text-sm text-layout-gray-400 self-center">{page} 페이지</span>
          <Button size="sm" variant="secondary" disabled={!list.has_more} onClick={() => setPage((p) => p + 1)}>다음</Button>
        </div>
      )}
    </Card>
  );
}

function ExcludedModal({ onClose, onChanged, handleErr, toast }) {
  const [rows, setRows] = useState(null);
  const [email, setEmail] = useState('');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    listExcludedEmails()
      .then((res) => setRows(res?.data || []))
      .catch((e) => handleErr(e, '제외 목록을 불러오지 못했습니다.'));
  }, [handleErr]);

  useEffect(() => { reload(); }, [reload]);

  const add = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSaving(true);
    try {
      await addExcludedEmail(email.trim(), memo.trim() || null);
      toast.success('통계 제외 계정을 등록했습니다.');
      setEmail(''); setMemo('');
      reload(); onChanged?.();
    } catch (err) { handleErr(err, '등록하지 못했습니다.'); }
    finally { setSaving(false); }
  };

  const remove = async (row) => {
    try {
      await deleteExcludedEmail(row.id);
      toast.success(`${row.email} 을 제외 목록에서 뺐습니다.`);
      reload(); onChanged?.();
    } catch (err) { handleErr(err, '삭제하지 못했습니다.'); }
  };

  return (
    <Modal onClose={onClose} title="통계 제외 계정" size="lg">
      <p className="text-xs text-layout-gray-400 mb-3">관리자·테스트 계정 이메일을 등록하면 모든 집계와 사용자 목록에서 빠집니다(탈퇴한 계정도 이메일로 대조).</p>
      <form onSubmit={add} className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 items-end mb-4">
        <Field label="이메일"><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" /></Field>
        <Field label="메모"><Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="예: 개발자 테스트 계정" /></Field>
        <Button type="submit" loading={saving}>등록</Button>
      </form>
      {rows == null ? <Spinner /> : rows.length === 0 ? (
        <p className="text-sm text-layout-gray-300 text-center py-6">등록된 계정이 없습니다.</p>
      ) : (
        <ul className="divide-y divide-layout-gray-100">
          {rows.map((r) => (
            <li key={r.id} className="py-2 flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm text-layout-black truncate">{r.email}</div>
                <div className="text-[11px] text-layout-gray-300">{r.memo || '메모 없음'}{r.has_account ? '' : ' · 가입 계정 없음'}</div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => remove(r)} aria-label={`${r.email} 삭제`}>
                <Trash size={14} weight="bold" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
