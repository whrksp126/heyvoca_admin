// FSRS 헬스 패널 (M5).
import React from 'react';
import { Card, Tag } from '@/components/ui/primitives';

const STATE_LABEL = { new: '신규', learning: '학습중', review: '복습', relearning: '재학습' };

function Metric({ label, value }) {
  return (
    <div className="bg-layout-gray-50 rounded-lg px-3 py-2.5">
      <div className="text-[11px] text-layout-gray-400">{label}</div>
      <div className="text-lg font-bold text-layout-black mt-0.5">{value}</div>
    </div>
  );
}

const num = (v, d = 2) => (typeof v === 'number' ? v.toFixed(d) : '—');
const pct = (v) => (typeof v === 'number' ? `${Math.round(v * 100)}%` : '—');

export default function HealthPanel({ health }) {
  const states = health?.states || {};
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-layout-black">FSRS 헬스</h3>
        {health?.sampled && <Tag tone="yellow">샘플 {health?.sample_size?.toLocaleString?.() || ''}건</Tag>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Metric label="전체 카드" value={(health?.total_cards ?? 0).toLocaleString()} />
        <Metric label="Lapse Rate" value={pct(health?.lapse_rate)} />
        <Metric label="Avg Stability" value={num(health?.avg_stability)} />
        <Metric label="Avg Difficulty" value={num(health?.avg_difficulty)} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {['new', 'learning', 'review', 'relearning'].map((s) => (
          <Metric key={s} label={STATE_LABEL[s]} value={(states[s] ?? 0).toLocaleString()} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Metric label="Avg Retrievability" value={pct(health?.avg_retrievability)} />
      </div>

      {Array.isArray(health?.partition_rows) && health.partition_rows.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-semibold text-layout-gray-500 mb-2">파티션</div>
          <div className="flex flex-wrap gap-2">
            {health.partition_rows.map((p) => (
              <Tag key={p.partition} tone="gray">{p.partition}: {(p.rows ?? 0).toLocaleString()}</Tag>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
