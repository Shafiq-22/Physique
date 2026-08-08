import { Link } from 'react-router-dom';
import { useDailyLogs } from '../hooks/useDailyLog';
import { useBenchmarks, useMeasurements } from '../hooks/useMeasurements';
import { usePhotos } from '../hooks/usePhotos';
import { useWorkoutSets } from '../hooks/useWorkouts';
import { useTrend } from '../hooks/useTrend';
import { TrendCard } from '../components/TrendCard';
import { MetricSparkline, type SparkPoint } from '../components/MetricSparkline';
import { PhotoCompare } from '../components/PhotoCompare';
import { adonisRatio, latestMeasurement, waistToHeight } from '../lib/analytics';
import { AESTHETICS, PROFILE } from '../lib/config';
import { shortLabel } from '../lib/dates';
import type { Measurement } from '../lib/types';

const TAPE: { key: keyof Measurement; label: string }[] = [
  { key: 'waist_cm', label: 'Waist' },
  { key: 'shoulders_cm', label: 'Shoulders' },
  { key: 'chest_cm', label: 'Chest' },
  { key: 'arm_l_cm', label: 'Arm (left)' },
  { key: 'arm_r_cm', label: 'Arm (right)' },
  { key: 'thigh_cm', label: 'Thigh' },
  { key: 'bodyfat_pct', label: 'Body fat' },
];

const BENCH_LABEL: Record<string, string> = {
  pushups_max: 'Push-ups',
  pullups_max: 'Pull-ups',
  plank_sec: 'Plank',
  deadhang_sec: 'Dead hang',
  hollow_sec: 'Hollow hold',
  run_5k_sec: '5k run',
};

export default function Progress() {
  const { data: logs } = useDailyLogs();
  const { data: measurements } = useMeasurements();
  const { data: photos } = usePhotos();
  const { data: benchmarks } = useBenchmarks();
  const { data: sets } = useWorkoutSets();
  const { series, delta } = useTrend(logs);

  const latest = latestMeasurement(measurements ?? []);
  const adonis =
    latest && latest.shoulders_cm !== null && latest.waist_cm !== null
      ? adonisRatio(latest.shoulders_cm, latest.waist_cm)
      : null;
  const wth =
    latest && latest.waist_cm !== null
      ? waistToHeight(latest.waist_cm, PROFILE.HEIGHT_CM)
      : null;

  const seriesFor = (key: keyof Measurement): SparkPoint[] =>
    (measurements ?? [])
      .filter((m) => typeof m[key] === 'number')
      .map((m) => ({ date: m.measured_on, value: m[key] as number }));

  const prs = (sets ?? []).filter((s) => s.is_pr);

  return (
    <div className="space-y-4 pt-1">
      <TrendCard series={series} delta={delta} days={365} />

      <Link to="/measure" className="btn-primary block w-full text-center">
        Add measurements
      </Link>

      <section className="space-y-3">
        <h2 className="px-1 text-sm font-medium muted">Proportions</h2>

        {adonis ? (
          <div className="card">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium muted">Adonis ratio</span>
              <span className="text-xs muted">shoulders ÷ waist</span>
            </div>
            <p
              className={`mt-1 text-3xl font-semibold tabular-nums ${
                adonis.status === 'in_band' ? 'text-accent' : 'text-slate-100'
              }`}
            >
              {adonis.ratio.toFixed(3)}
            </p>
            <p className="mt-1 text-sm muted">
              {adonis.label}
              {adonis.status !== 'in_band'
                ? ` · ${Math.abs(adonis.distanceToTarget).toFixed(3)} away`
                : ''}
            </p>
            <TargetBar
              value={adonis.ratio}
              lo={AESTHETICS.ADONIS_TARGET[0]!}
              hi={AESTHETICS.ADONIS_TARGET[1]!}
              min={1.2}
              max={1.8}
            />
          </div>
        ) : null}

        {wth ? (
          <div className="card">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium muted">Waist to height</span>
              <span className="text-xs muted">flag at {wth.threshold}</span>
            </div>
            <p
              className={`mt-1 text-3xl font-semibold tabular-nums ${
                wth.flagged ? 'text-amber-300' : 'text-accent'
              }`}
            >
              {wth.ratio.toFixed(3)}
            </p>
            <p className="mt-1 text-sm muted">{wth.label}</p>
          </div>
        ) : null}

        {!latest ? (
          <div className="card">
            <p className="text-sm muted">
              Add a tape measurement and the Adonis ratio and waist-to-height appear here.
            </p>
          </div>
        ) : null}
      </section>

      {latest ? (
        <section className="space-y-3">
          <h2 className="px-1 text-sm font-medium muted">
            Measurements · last taken {shortLabel(latest.measured_on)}
          </h2>
          {TAPE.map((t) => {
            const pts = seriesFor(t.key);
            return pts.length ? (
              <MetricSparkline
                key={t.key as string}
                label={t.label}
                points={pts}
                unit={t.key === 'bodyfat_pct' ? '%' : 'cm'}
              />
            ) : null;
          })}
        </section>
      ) : null}

      <PhotoCompare photos={photos ?? []} />

      {benchmarks && benchmarks.length > 0 ? (
        <section className="space-y-3">
          <h2 className="px-1 text-sm font-medium muted">Benchmarks</h2>
          {[...new Set(benchmarks.map((b) => b.metric))].map((metric) => (
            <MetricSparkline
              key={metric}
              label={BENCH_LABEL[metric] ?? metric}
              points={benchmarks
                .filter((b) => b.metric === metric)
                .map((b) => ({ date: b.measured_on, value: b.value }))}
              decimals={0}
            />
          ))}
        </section>
      ) : null}

      {prs.length > 0 ? (
        <section className="card">
          <h2 className="font-medium">Recent PRs</h2>
          <ul className="mt-2 space-y-1.5">
            {prs.slice(-8).reverse().map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-sm">
                <span aria-hidden className="text-accent">
                  ★
                </span>
                <span className="text-slate-200">{s.exercise_name}</span>
                <span className="muted tabular-nums">
                  {s.load_kg !== null ? `${s.load_kg} kg × ` : ''}
                  {s.reps} reps
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** Where the current value sits relative to its target band. */
function TargetBar({
  value,
  lo,
  hi,
  min,
  max,
}: {
  value: number;
  lo: number;
  hi: number;
  min: number;
  max: number;
}) {
  const pct = (v: number): number => Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100));

  return (
    <div className="relative mt-3 h-2 w-full rounded-full bg-ink-900">
      <div
        className="absolute inset-y-0 rounded-full bg-accent/30"
        style={{ left: `${pct(lo)}%`, width: `${pct(hi) - pct(lo)}%` }}
      />
      <div
        className="absolute -top-0.5 h-3 w-1 rounded-full bg-slate-100"
        style={{ left: `${pct(value)}%` }}
        aria-hidden
      />
    </div>
  );
}
