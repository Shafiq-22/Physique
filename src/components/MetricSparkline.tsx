import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import { shortLabel } from '../lib/dates';
import { roundTo } from '../lib/analytics';
import type { ISODate } from '../lib/types';

const LINE = '#3987e5';

export interface SparkPoint {
  date: ISODate;
  value: number;
}

interface Props {
  label: string;
  points: SparkPoint[];
  unit?: string;
  /** Shown under the current value, e.g. "target 1.60–1.62". */
  note?: string;
  /** Colour override for the headline value when a target band applies. */
  tone?: 'neutral' | 'good' | 'warn';
  decimals?: number;
}

const TONE: Record<NonNullable<Props['tone']>, string> = {
  neutral: 'text-slate-100',
  good: 'text-accent',
  warn: 'text-amber-300',
};

/** A single metric over time: latest value, change since first, and a small line. */
export function MetricSparkline({
  label,
  points,
  unit,
  note,
  tone = 'neutral',
  decimals = 1,
}: Props) {
  if (points.length === 0) {
    return (
      <div className="card">
        <p className="text-sm font-medium muted">{label}</p>
        <p className="mt-1 text-sm muted">No readings yet.</p>
      </div>
    );
  }

  const latest = points[points.length - 1]!;
  const first = points[0]!;
  const delta = latest.value - first.value;
  const data = points.map((p) => ({ ...p, value: roundTo(p.value, decimals + 1) }));

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium muted">{label}</p>
          <p className={`mt-0.5 text-2xl font-semibold tabular-nums ${TONE[tone]}`}>
            {latest.value.toFixed(decimals)}
            {unit ? <span className="ml-1 text-sm font-normal muted">{unit}</span> : null}
          </p>
          {note ? <p className="mt-0.5 text-xs muted">{note}</p> : null}
        </div>

        {points.length > 1 ? (
          <div className="text-right">
            <p className="text-xs muted">since {shortLabel(first.date)}</p>
            <p className="text-sm tabular-nums text-slate-300">
              {delta >= 0 ? '+' : ''}
              {delta.toFixed(decimals)}
            </p>
          </div>
        ) : null}
      </div>

      {points.length > 1 ? (
        <div className="mt-3 h-16 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <YAxis domain={['dataMin - 0.5', 'dataMax + 0.5']} hide />
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
                formatter={(v: number) => [`${v.toFixed(decimals)}${unit ? ` ${unit}` : ''}`, label]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={LINE}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3, fill: LINE, stroke: '#0b0f14', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </div>
  );
}
