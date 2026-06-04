// 요약 카드 (M2) — progress.summary + metrics 종합.
import React from 'react';
import { Card } from '@/components/ui/primitives';

function StatCard({ label, value, sub, tone = 'pink' }) {
  const accent = {
    pink: 'text-primary-main-600', blue: 'text-secondary-blue-600',
    purple: 'text-secondary-purple-600', green: 'text-status-success-600',
  }[tone] || 'text-primary-main-600';
  return (
    <Card className="p-5">
      <div className="text-xs text-layout-gray-400">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${accent}`}>{value}</div>
      {sub && <div className="text-[11px] text-layout-gray-300 mt-1">{sub}</div>}
    </Card>
  );
}

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString() : '—');

export default function SummaryCards({ summary, metrics }) {
  const days = metrics?.days ?? 7;
  const score = metrics?.avg_score;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard label="전체 학습 로그" value={fmt(summary?.total_reviews)} sub="누적 복습 기록" tone="pink" />
      <StatCard label="전체 사용자" value={fmt(summary?.total_users)} sub={`200+ 복습 ${fmt(summary?.users_200_plus_reviews)}명`} tone="blue" />
      <StatCard label={`최근 ${days}일 복습`} value={fmt(metrics?.total_reviews)} sub={`학습자 ${fmt(metrics?.total_users)}명`} tone="purple" />
      <StatCard label={`최근 ${days}일 정답률`} value={score != null ? `${Math.round(score * 100)}%` : '—'} sub="평균 정답 비율" tone="green" />
    </div>
  );
}
