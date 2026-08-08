import { READINESS_ACTION, type Readiness } from '../lib/analytics';

const BAND_COLOR: Record<Readiness['band'], string> = {
  green: '#4ade80',
  amber: '#fbbf24',
  red: '#f87171',
};

const BAND_LABEL: Record<Readiness['band'], string> = {
  green: 'Ready',
  amber: 'Moderate',
  red: 'Low',
};

/**
 * Readiness as a ring plus the instruction it implies.
 *
 * The score is never shown on its own — a number with no verb invites staring at
 * it. What matters is "train as planned" vs "drop the last set", so the action
 * sits next to the ring and the drivers explain it.
 */
export function ReadinessRing({ readiness }: { readiness: Readiness }) {
  const size = 76;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = (readiness.score / 100) * circumference;
  const color = BAND_COLOR[readiness.band];

  return (
    <section className="card" aria-label="Readiness">
      <div className="flex items-center gap-4">
        <svg
          width={size}
          height={size}
          role="img"
          aria-label={`Readiness ${readiness.score} of 100, ${BAND_LABEL[readiness.band]}`}
          className="shrink-0 -rotate-90"
        >
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1a2430" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference - filled}`}
          />
          <text
            x={size / 2}
            y={size / 2}
            textAnchor="middle"
            dominantBaseline="central"
            className="rotate-90 fill-slate-100 text-lg font-semibold"
            style={{ transformOrigin: 'center' }}
          >
            {readiness.score}
          </text>
        </svg>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium muted">Readiness</span>
            {/* Never colour alone: the band is named as well as tinted. */}
            <span className="chip" style={{ background: `${color}22`, color }}>
              {BAND_LABEL[readiness.band]}
            </span>
          </div>
          <p className="mt-1 font-semibold leading-snug">{READINESS_ACTION[readiness.band]}</p>
          {readiness.drivers.length > 0 ? (
            <ul className="mt-1 space-y-0.5">
              {readiness.drivers.map((d) => (
                <li key={d} className="text-xs muted">
                  {d}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  );
}
