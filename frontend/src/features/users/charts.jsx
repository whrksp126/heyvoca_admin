// 유저 관리 대시보드용 가벼운 SVG 차트 (외부 차트 라이브러리 없음).
// 규칙: 축 하나, 얇은 선(2px), 막대 사이 2px 간격, 계열 색은 고정 순서(SERIES_COLORS),
// 글자는 텍스트 토큰 색만, 2계열 이상이면 범례, 마우스를 올리면 그 날의 값 툴팁.
import React, { useMemo, useRef, useState } from 'react';

export const SERIES_COLORS = [
  'var(--primary-main-600)',
  'var(--secondary-blue-600)',
  'var(--secondary-purple-600)',
  'var(--secondary-mint-600)',
];

const W = 640;
const PAD = { l: 36, r: 8, t: 8, b: 22 };

function niceMax(v) {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  const step = n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * p;
}

const shortDate = (iso) => (iso ? `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}` : '');

function Legend({ series }) {
  if (series.length < 2) return null;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 mb-1.5">
      {series.map((s, i) => (
        <span key={s.key} className="flex items-center gap-1.5 text-xs text-layout-gray-400">
          <span className="w-3 h-[3px] rounded-full" style={{ background: s.color || SERIES_COLORS[i] }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

function useHover(n, height) {
  const ref = useRef(null);
  const [idx, setIdx] = useState(null);
  const onMove = (e) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || n === 0) return;
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const inner = W - PAD.l - PAD.r;
    const i = Math.round(((x - PAD.l) / inner) * (n - 1));
    setIdx(Math.max(0, Math.min(n - 1, i)));
  };
  return { ref, idx, onMove, onLeave: () => setIdx(null), height };
}

function Tooltip({ idx, n, data, series, xKey }) {
  if (idx == null) return null;
  const leftPct = n > 1 ? (idx / (n - 1)) * 100 : 50;
  const row = data[idx];
  return (
    <div
      className="pointer-events-none absolute top-0 z-10 rounded-lg border border-layout-gray-100 bg-white px-2.5 py-1.5 shadow-sm text-xs"
      style={{ left: `${leftPct}%`, transform: `translateX(${leftPct > 60 ? '-105%' : '5%'})` }}
    >
      <div className="font-semibold text-layout-black mb-0.5">{row[xKey]}</div>
      {series.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1.5 text-layout-gray-500 whitespace-nowrap">
          <span className="w-2 h-2 rounded-full" style={{ background: s.color || SERIES_COLORS[i] }} />
          {s.label} <span className="ml-auto pl-2 font-semibold text-layout-black">{(row[s.key] ?? 0).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

function Axes({ max, n, data, xKey, height }) {
  const ticks = [0, max / 2, max];
  const innerH = height - PAD.t - PAD.b;
  const every = Math.max(1, Math.ceil(n / 7));
  return (
    <g>
      {ticks.map((t) => {
        const y = PAD.t + innerH - (t / max) * innerH;
        return (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="var(--layout-gray-100, #eee)" strokeWidth="1" />
            <text x={PAD.l - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#999">{Math.round(t).toLocaleString()}</text>
          </g>
        );
      })}
      {data.map((d, i) => (i % every === 0 || i === n - 1) && (
        <text
          key={d[xKey]}
          x={PAD.l + (n > 1 ? (i / (n - 1)) * (W - PAD.l - PAD.r) : (W - PAD.l - PAD.r) / 2)}
          y={height - 6} textAnchor="middle" fontSize="10" fill="#999"
        >
          {shortDate(d[xKey])}
        </text>
      ))}
    </g>
  );
}

/** 선 차트 — data: [{date, a, b}], series: [{key,label}] */
export function LineChart({ data, series, xKey = 'date', height = 180 }) {
  const n = data.length;
  const max = useMemo(() => niceMax(Math.max(1, ...data.flatMap((d) => series.map((s) => d[s.key] || 0)))), [data, series]);
  const h = useHover(n, height);
  const innerW = W - PAD.l - PAD.r;
  const innerH = height - PAD.t - PAD.b;
  const x = (i) => PAD.l + (n > 1 ? (i / (n - 1)) * innerW : innerW / 2);
  const y = (v) => PAD.t + innerH - ((v || 0) / max) * innerH;
  return (
    <div>
      <Legend series={series} />
      <div className="relative">
        <svg ref={h.ref} viewBox={`0 0 ${W} ${height}`} className="w-full h-auto" onMouseMove={h.onMove} onMouseLeave={h.onLeave} role="img">
          <Axes max={max} n={n} data={data} xKey={xKey} height={height} />
          {series.map((s, si) => (
            <polyline
              key={s.key}
              fill="none"
              stroke={s.color || SERIES_COLORS[si]}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={data.map((d, i) => `${x(i)},${y(d[s.key])}`).join(' ')}
            />
          ))}
          {h.idx != null && (
            <g>
              <line x1={x(h.idx)} x2={x(h.idx)} y1={PAD.t} y2={PAD.t + innerH} stroke="#bbb" strokeWidth="1" />
              {series.map((s, si) => (
                <circle key={s.key} cx={x(h.idx)} cy={y(data[h.idx][s.key])} r="4" fill={s.color || SERIES_COLORS[si]} stroke="white" strokeWidth="2" />
              ))}
            </g>
          )}
        </svg>
        <Tooltip idx={h.idx} n={n} data={data} series={series} xKey={xKey} />
      </div>
    </div>
  );
}

/** 누적 막대 — data: [{date, a, b}], series 아래→위 순 */
export function StackedBars({ data, series, xKey = 'date', height = 180 }) {
  const n = data.length;
  const max = useMemo(() => niceMax(Math.max(1, ...data.map((d) => series.reduce((a, s) => a + (d[s.key] || 0), 0)))), [data, series]);
  const h = useHover(n, height);
  const innerW = W - PAD.l - PAD.r;
  const innerH = height - PAD.t - PAD.b;
  const slot = innerW / Math.max(1, n);
  const bw = Math.max(2, Math.min(18, slot - 2));
  return (
    <div>
      <Legend series={series} />
      <div className="relative">
        <svg ref={h.ref} viewBox={`0 0 ${W} ${height}`} className="w-full h-auto" onMouseMove={h.onMove} onMouseLeave={h.onLeave} role="img">
          <Axes max={max} n={n} data={data} xKey={xKey} height={height} />
          {data.map((d, i) => {
            const cx = PAD.l + (n > 1 ? (i / (n - 1)) * innerW : innerW / 2);
            let acc = 0;
            return (
              <g key={d[xKey]} opacity={h.idx == null || h.idx === i ? 1 : 0.55}>
                {series.map((s, si) => {
                  const v = d[s.key] || 0;
                  if (!v) return null;
                  const y0 = PAD.t + innerH - (acc / max) * innerH;
                  acc += v;
                  const y1 = PAD.t + innerH - (acc / max) * innerH;
                  // 위 계열과 사이에 2px 간격
                  const gap = si > 0 ? 2 : 0;
                  return (
                    <rect key={s.key} x={cx - bw / 2} y={y1} width={bw} height={Math.max(1, y0 - y1 - gap)}
                      rx={Math.min(2, bw / 4)} fill={s.color || SERIES_COLORS[si]} />
                  );
                })}
              </g>
            );
          })}
        </svg>
        <Tooltip idx={h.idx} n={n} data={data} series={series} xKey={xKey} />
      </div>
    </div>
  );
}

/** 분포 가로 막대 — items: [{key, label, count}] (값·비율을 글자로 같이 보여 준다) */
export function DistBars({ items, color = SERIES_COLORS[0], empty = '데이터 없음' }) {
  const total = items.reduce((a, b) => a + b.count, 0);
  if (!total) return <p className="text-sm text-layout-gray-300 py-4 text-center">{empty}</p>;
  const max = Math.max(...items.map((i) => i.count));
  return (
    <ul className="space-y-1.5">
      {items.map((it) => (
        <li key={it.key} className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-2 text-xs" title={`${it.label}: ${it.count}`}>
          <span className="truncate text-layout-gray-500">{it.label}</span>
          <span className="h-2.5 rounded-full bg-layout-gray-50 overflow-hidden">
            <span className="block h-full rounded-full" style={{ width: `${(it.count / max) * 100}%`, background: color }} />
          </span>
          <span className="tabular-nums text-layout-black font-semibold">
            {it.count.toLocaleString()} <span className="text-layout-gray-300 font-normal">{Math.round((it.count / total) * 100)}%</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
