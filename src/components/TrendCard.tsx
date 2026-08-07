import { useState } from 'react';
import {
  CartesianGrid,
  Line,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { EMAPoint, TrendDelta } from '../lib/analytics';
import { roundTo } from '../lib/analytics';
import { shortLabel } from '../lib/dates';

/** Identity, not status — the line must not imply good/bad. */
const TREND_COLOR = '#3987e5';
const RAW_COLOR = '#94a3b8';

interface Props {
  series: EMAPoint[];
  delta: TrendDelta | null;
  /** Days of history to plot. */
  days?: number;
}

/**
 * The headline weight card.
 *
 * The 7-day trend is the chart; raw daily weights are hidden behind a toggle by
 * design. A single salty dinner should never be the number that greets you.
 */
export function TrendCard({ series, delta, days = 60 }: Props) {
  const [showRaw, setShowRaw] = useState(false);

  const data = series.slice(-days).map((p) => ({
    date: p.date,
    ema: roundTo(p.ema, 2),
    raw: roundTo(p.raw, 2),
  }));

  if (data.length === 0) {
    return (
      <section className="card">
        <h2 className="text-sm font-medium muted">Trend weight</h2>
        <p className="mt-3 text-slate-300">
          Log your weight for a few days and the trend line starts here.
        </p>
      </section>
    );
  }

  const latest = data[data.length - 1]!;
  const values = data.flatMap((d) => (showRaw ? [d.ema, d.raw] : [d.ema]));
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max(0.4, (hi - lo) * 0.15);

  return (
    <section className="card" aria-label="Trend weight">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium muted">Trend weight</h2>
          {/* Hero number: the 7-day EMA, never today's raw reading. */}
          <p className="mt-1 text-4xl font-semibold tabular-nums">
            {latest.ema.toFixed(2)}
            <span className="ml-1 text-lg font-normal muted">kg</span>
          </p>
          {delta ? (
            <p className="mt-1 text-sm tabular-nums text-slate-300">
              <span className={delta.deltaKg < 0 ? 'text-sky-300' : 'text-amber-300'}>
                {delta.deltaKg >= 0 ? '+' : ''}
                {roundTo(delta.deltaKg, 2)} kg
              </span>{' '}
              <span className="muted">over {delta.spanDays} days</span>
            </p>
          ) : (
            <p className="mt-1 text-sm muted">Building your 7-day trend…</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowRaw((v) => !v)}
          aria-pressed={showRaw}
          className="chip shrink-0 bg-ink-700 text-slate-300"
        >
          {showRaw ? 'Hide daily' : 'Show daily'}
        </button>
      </div>

      <div className="mt-4 h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 6, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#26323f" strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => shortLabel(d).slice(4)}
              tick={{ fill: '#64748b', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              minTickGap={28}
            />
            <YAxis
              domain={[roundTo(lo - pad, 1), roundTo(hi + pad, 1)]}
              tick={{ fill: '#64748b', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={38}
              tickFormatter={(v: number) => v.toFixed(1)}
            />
            <Tooltip
              cursor={{ stroke: '#475569', strokeWidth: 1 }}
              contentStyle={{
                background: '#0b0f14',
                border: '1px solid #26323f',
                borderRadius: 12,
                fontSize: 12,
              }}
              labelStyle={{ color: '#94a3b8' }}
              labelFormatter={(d: string) => shortLabel(d)}
              formatter={(v: number, name: string) => [
                `${v.toFixed(2)} kg`,
                name === 'ema' ? 'Trend' : 'Daily',
              ]}
            />
            {showRaw ? (
              <Scatter dataKey="raw" fill={RAW_COLOR} fillOpacity={0.5} shape="circle" r={3} />
            ) : null}
            <ReferenceLine y={latest.ema} stroke="#26323f" strokeDasharray="3 3" />
            <Line
              type="monotone"
              dataKey="ema"
              stroke={TREND_COLOR}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: TREND_COLOR, stroke: '#0b0f14', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
