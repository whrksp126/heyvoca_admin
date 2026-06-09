// TTS 모니터링 — ElevenLabs 토큰(문자) 잔량 + 일별 생성/fallback 통계.
// 토큰 소진 시 백엔드는 gTTS(무료)로 자동 fallback → 여기서 잔량/전환 추이를 감시한다.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Spinner, Card, ProgressBar, Tag } from '@/components/ui/primitives';
import { ApiError } from '@/lib/api';
import { getTtsQuota, getTtsStats } from '@/lib/endpoints';

const REFRESH_MS = 60000;
const fmt = (n) => (typeof n === 'number' ? n.toLocaleString() : '—');

function quotaTone(ratio) {
  if (ratio == null) return 'pink';
  if (ratio >= 0.9) return 'red';
  if (ratio >= 0.7) return 'yellow';
  return 'green';
}

function fmtResetDate(unix) {
  if (!unix) return null;
  try {
    return new Date(unix * 1000).toLocaleDateString('ko-KR', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch {
    return null;
  }
}

function fmtDay(d) {
  // 'YYYYMMDD' → 'M/D'
  if (!d || d.length !== 8) return d;
  return `${Number(d.slice(4, 6))}/${Number(d.slice(6, 8))}`;
}

function QuotaCard({ quota, error }) {
  if (error) {
    return (
      <Card className="p-6 border-status-error-200 bg-status-error-50">
        <div className="text-sm font-bold text-status-error-600">ElevenLabs 토큰 조회 실패</div>
        <div className="text-xs text-status-error-600 mt-1">{error}</div>
        <div className="text-[11px] text-layout-gray-400 mt-2">
          키 만료·인증 오류일 수 있습니다. 이 상태에서는 신규 영어 음성이 gTTS(무료)로 자동 생성됩니다.
        </div>
      </Card>
    );
  }
  if (!quota) return null;

  const ratio = quota.usage_ratio; // 0~1 (사용 비율)
  const usedPct = ratio != null ? Math.round(ratio * 100) : null;
  const tone = quotaTone(ratio);
  const reset = fmtResetDate(quota.next_reset_unix);
  const accent = {
    green: 'text-status-success-600', yellow: 'text-secondary-yellow-600',
    red: 'text-status-error-600', pink: 'text-primary-main-600',
  }[tone];

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-bold text-layout-black">ElevenLabs 토큰 (문자) 잔량</div>
        <div className="flex items-center gap-2">
          {quota.tier && <Tag tone="gray">{quota.tier}</Tag>}
          {quota.status && <Tag tone={quota.status === 'active' ? 'green' : 'yellow'}>{quota.status}</Tag>}
        </div>
      </div>

      <div className="flex items-end gap-2">
        <div className={`text-3xl font-bold ${accent}`}>{fmt(quota.character_remaining)}</div>
        <div className="text-sm text-layout-gray-300 mb-1">/ {fmt(quota.character_limit)} 자 남음</div>
      </div>

      <div className="mt-3">
        <ProgressBar value={usedPct ?? 0} tone={tone === 'red' ? 'pink' : tone} />
        <div className="flex justify-between text-[11px] text-layout-gray-300 mt-1">
          <span>사용 {fmt(quota.character_count)}자 {usedPct != null ? `(${usedPct}%)` : ''}</span>
          {reset && <span>{reset} 리셋</span>}
        </div>
      </div>

      {tone === 'red' && (
        <div className="mt-3 text-xs text-status-error-600">
          ⚠️ 토큰이 거의 소진되었습니다. 소진 시 신규 영어 음성은 gTTS(무료)로 자동 전환됩니다.
        </div>
      )}
    </Card>
  );
}

function StatCard({ label, value, sub, tone = 'pink' }) {
  const accent = {
    pink: 'text-primary-main-600', blue: 'text-secondary-blue-600',
    purple: 'text-secondary-purple-600', green: 'text-status-success-600',
    yellow: 'text-secondary-yellow-600',
  }[tone] || 'text-primary-main-600';
  return (
    <Card className="p-5">
      <div className="text-xs text-layout-gray-400">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${accent}`}>{value}</div>
      {sub && <div className="text-[11px] text-layout-gray-300 mt-1">{sub}</div>}
    </Card>
  );
}

function StatsTable({ stats }) {
  const daily = stats?.daily || [];
  const maxGen = Math.max(1, ...daily.map((d) => d.gen || 0));
  return (
    <Card className="p-6">
      <div className="text-sm font-bold text-layout-black mb-4">
        최근 {stats?.days ?? 7}일 음성 생성 / fallback 추이
      </div>
      {daily.length === 0 ? (
        <div className="text-xs text-layout-gray-300 py-4">데이터가 없습니다.</div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-[64px_1fr_72px_88px] gap-3 text-[11px] text-layout-gray-300 px-1">
            <span>날짜</span><span>신규 생성</span><span className="text-right">생성 수</span><span className="text-right">fallback</span>
          </div>
          {daily.map((d) => {
            const gen = d.gen || 0;
            const fb = d.fallback || 0;
            const fbRatio = gen ? Math.round((fb / gen) * 100) : 0;
            return (
              <div key={d.date} className="grid grid-cols-[64px_1fr_72px_88px] gap-3 items-center px-1">
                <span className="text-xs text-layout-gray-500">{fmtDay(d.date)}</span>
                <div className="h-4 rounded-full bg-layout-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-primary-main-400" style={{ width: `${(gen / maxGen) * 100}%` }} />
                </div>
                <span className="text-xs text-layout-gray-500 text-right tabular-nums">{fmt(gen)}</span>
                <span className="text-right">
                  {fb > 0
                    ? <Tag tone={fbRatio >= 50 ? 'red' : 'yellow'}>{fmt(fb)} ({fbRatio}%)</Tag>
                    : <span className="text-xs text-layout-gray-300 tabular-nums">0</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <div className="text-[11px] text-layout-gray-300 mt-4">
        fallback = ElevenLabs 생성 실패로 gTTS(무료)로 전환된 건수. 비율이 높으면 토큰 소진/장애를 의심하세요.
      </div>
    </Card>
  );
}

export default function TtsMonitorPage({ onAuthError }) {
  const [quota, setQuota] = useState(null);
  const [quotaErr, setQuotaErr] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    if (firstLoad.current) setLoading(true); else setRefreshing(true);
    const [qRes, sRes] = await Promise.allSettled([getTtsQuota(), getTtsStats(7)]);

    let authError = false;
    if (qRes.status === 'fulfilled') {
      setQuota(qRes.value?.data);
      setQuotaErr(null);
    } else {
      if (qRes.reason instanceof ApiError && qRes.reason.status === 401) authError = true;
      else setQuotaErr(qRes.reason?.message || '조회 실패');
    }
    if (sRes.status === 'fulfilled') {
      setStats(sRes.value?.data);
    } else if (sRes.reason instanceof ApiError && sRes.reason.status === 401) {
      authError = true;
    }

    if (authError) { onAuthError?.(); return; }
    setUpdatedAt(new Date());
    setLoading(false);
    setRefreshing(false);
    firstLoad.current = false;
  }, [onAuthError]);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  if (loading) return <Spinner label="TTS 모니터링 불러오는 중…" />;

  return (
    <div className="h-full overflow-y-auto thin-scroll px-8 py-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-layout-black">TTS 모니터링</h1>
          <p className="text-sm text-layout-gray-300 mt-0.5">
            {updatedAt ? `${updatedAt.toLocaleTimeString('ko-KR')} 기준` : ''} · 60초마다 자동 새로고침
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={load} loading={refreshing}>새로고침</Button>
      </header>

      <QuotaCard quota={quota} error={quotaErr} />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="최근 7일 신규 생성" value={fmt(stats?.total_gen)} sub="ElevenLabs+gTTS 합계" tone="blue" />
        <StatCard
          label="최근 7일 fallback"
          value={fmt(stats?.total_fallback)}
          sub="gTTS 무료 전환 건수"
          tone={stats?.total_fallback > 0 ? 'yellow' : 'green'}
        />
        <StatCard
          label="오늘 fallback"
          value={fmt(stats?.daily?.[0]?.fallback)}
          sub={`오늘 생성 ${fmt(stats?.daily?.[0]?.gen)}건`}
          tone={stats?.daily?.[0]?.fallback > 0 ? 'yellow' : 'green'}
        />
      </div>

      <StatsTable stats={stats} />
    </div>
  );
}
