// 학습 지표 패널 (M4) — question_types / test_types / fsrs_states 분포.
import React from 'react';
import { Card } from '@/components/ui/primitives';

const LABELS = {
  // question_types
  multipleChoice: '객관식', fillInTheBlank: '빈칸', cardMatch: '카드매칭',
  multipleChoiceListening: '듣기객관식', cardMatchListening: '듣기카드매칭',
  // test_types
  test: '테스트', quick: '퀵', today: '오늘', exam: '시험',
  // fsrs states
  new: '신규', learning: '학습중', review: '복습', relearning: '재학습',
};
const label = (k) => LABELS[k] || k;

function Dist({ title, data, tone }) {
  const entries = Object.entries(data || {});
  const total = entries.reduce((s, [, v]) => s + (v || 0), 0);
  const fill = { pink: 'bg-primary-main-500', blue: 'bg-secondary-blue-500', purple: 'bg-secondary-purple-500' }[tone] || 'bg-primary-main-500';
  return (
    <div>
      <div className="text-xs font-semibold text-layout-gray-500 mb-2">{title}</div>
      {entries.length === 0 ? (
        <div className="text-[11px] text-layout-gray-300">데이터 없음</div>
      ) : (
        <div className="space-y-2">
          {entries.map(([k, v]) => {
            const pct = total ? Math.round((v / total) * 100) : 0;
            return (
              <div key={k}>
                <div className="flex justify-between text-[11px] text-layout-gray-400 mb-0.5">
                  <span>{label(k)}</span><span>{(v || 0).toLocaleString()} ({pct}%)</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-layout-gray-100 overflow-hidden">
                  <div className={`h-full rounded-full ${fill}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function MetricsPanel({ metrics }) {
  return (
    <Card className="p-5">
      <h3 className="text-sm font-bold text-layout-black mb-4">학습 지표 <span className="text-layout-gray-300 font-normal">· 최근 {metrics?.days ?? 7}일</span></h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Dist title="문제 유형" data={metrics?.question_types} tone="pink" />
        <Dist title="테스트 유형" data={metrics?.test_types} tone="blue" />
        <Dist title="FSRS 상태" data={metrics?.fsrs_states} tone="purple" />
      </div>
    </Card>
  );
}
