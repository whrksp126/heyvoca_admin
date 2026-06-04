// Overview 대시보드 (M2~M6) — 요약/지표/FSRS헬스/로드맵 + 자동·수동 새로고침.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Spinner, Card } from '@/components/ui/primitives';
import { ApiError } from '@/lib/api';
import { getProgress, getMetrics, getHealth } from '@/lib/endpoints';
import SummaryCards from './SummaryCards';
import MetricsPanel from './MetricsPanel';
import HealthPanel from './HealthPanel';
import PhasesPanel from './PhaseCard';

const REFRESH_MS = 30000;

export default function OverviewPage({ onAuthError }) {
  const [progress, setProgress] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errors, setErrors] = useState([]);
  const [updatedAt, setUpdatedAt] = useState(null);
  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    if (firstLoad.current) setLoading(true); else setRefreshing(true);
    const results = await Promise.allSettled([getProgress(), getMetrics(7), getHealth()]);
    const errs = [];
    let authError = false;

    const [pRes, mRes, hRes] = results;
    if (pRes.status === 'fulfilled') setProgress(pRes.value?.data); else errs.push(['로드맵', pRes.reason]);
    if (mRes.status === 'fulfilled') setMetrics(mRes.value?.data); else errs.push(['학습 지표', mRes.reason]);
    if (hRes.status === 'fulfilled') setHealth(hRes.value?.data); else errs.push(['FSRS 헬스', hRes.reason]);

    errs.forEach(([, reason]) => {
      if (reason instanceof ApiError && reason.status === 401) authError = true;
    });
    if (authError) { onAuthError?.(); return; }

    setErrors(errs.map(([name, reason]) => `${name}: ${reason?.message || '불러오기 실패'}`));
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

  if (loading) return <Spinner label="대시보드 불러오는 중…" />;

  return (
    <div className="h-full overflow-y-auto thin-scroll px-8 py-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-layout-black">개요</h1>
          <p className="text-sm text-layout-gray-300 mt-0.5">
            {updatedAt ? `${updatedAt.toLocaleTimeString('ko-KR')} 기준` : ''} · 30초마다 자동 새로고침
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={load} loading={refreshing}>새로고침</Button>
      </header>

      {errors.length > 0 && (
        <Card className="p-3 border-status-error-200 bg-status-error-50">
          <ul className="text-xs text-status-error-600 space-y-0.5">
            {errors.map((e, i) => <li key={i}>⚠️ {e}</li>)}
          </ul>
        </Card>
      )}

      <SummaryCards summary={progress?.summary} metrics={metrics} />
      <MetricsPanel metrics={metrics} />
      <HealthPanel health={health} />
      <PhasesPanel progress={progress} />
    </div>
  );
}
