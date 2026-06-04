// 개발 로드맵 phase 카드 (M3).
import React, { useState } from 'react';
import { Card, Tag, ProgressBar } from '@/components/ui/primitives';

const STATUS_TONE = {
  '완료': 'green', '진행 가능': 'blue', '대기중': 'gray', '보류': 'yellow',
};

function CommandBox({ command }) {
  const [copied, setCopied] = useState(false);
  if (!command) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* noop */ }
  };
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-layout-gray-400">다음 액션 명령</span>
        <button onClick={copy} className="text-[11px] text-secondary-blue-600 hover:underline">
          {copied ? '복사됨!' : '복사'}
        </button>
      </div>
      <pre className="text-[11px] text-layout-gray-500 bg-layout-gray-50 rounded-lg p-3 max-h-32 overflow-auto thin-scroll whitespace-pre-wrap">{command}</pre>
    </div>
  );
}

function PhaseItem({ phase }) {
  const th = phase.thresholds || {};
  const cur = phase.current_value ?? 0;
  const best = th.best || th.recommended || th.minimum || 1;
  const pct = Math.min(100, Math.round((cur / best) * 100));
  const done = phase.status === '완료';
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold text-sm text-layout-black">
          <span className="text-layout-gray-300 mr-1.5">{phase.key}</span>{phase.title}
        </div>
        <Tag tone={STATUS_TONE[phase.status] || 'gray'}>{phase.status}</Tag>
      </div>

      {!done && (th.minimum != null) && (
        <div className="mt-3">
          <ProgressBar value={pct} tone={phase.status === '진행 가능' ? 'blue' : 'yellow'} />
          <div className="flex justify-between text-[11px] text-layout-gray-300 mt-1">
            <span>{cur.toLocaleString?.() ?? cur}{phase.unit ? ` ${phase.unit}` : ''}</span>
            <span>최소 {th.minimum?.toLocaleString?.()} / 권장 {th.recommended?.toLocaleString?.()} / 최상 {th.best?.toLocaleString?.()}</span>
          </div>
        </div>
      )}

      {phase.next_action?.description && (
        <p className="text-xs text-layout-gray-400 mt-3">{phase.next_action.description}</p>
      )}
      <CommandBox command={phase.next_action?.command_for_claude} />
    </Card>
  );
}

export default function PhasesPanel({ progress }) {
  const phases = progress?.phases || [];
  if (phases.length === 0) return null;
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-layout-black">개발 로드맵</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {phases.map((p) => <PhaseItem key={p.key} phase={p} />)}
      </div>
    </div>
  );
}
