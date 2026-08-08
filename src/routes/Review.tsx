import { useState } from 'react';
import { useDailyLogs } from '../hooks/useDailyLog';
import { useActivePhase } from '../hooks/usePhase';
import { useMeasurements } from '../hooks/useMeasurements';
import { useWorkouts, useWorkoutSets } from '../hooks/useWorkouts';
import { useAcknowledge, useRecommendations } from '../hooks/useRecommendations';
import { useEngine } from '../hooks/useEngine';
import { VerdictCard } from '../components/VerdictCard';
import { summariseWeek, shiftISO } from '../lib/analytics';
import { shortLabel, todayISO } from '../lib/dates';
import type { RecommendationScope, Verdict } from '../lib/types';

/**
 * The Sunday ritual.
 *
 * Aggregates the week, runs every rule, and lets each verdict be acknowledged —
 * which files it to `recommendations` with its rationale and numbers intact, so
 * a decision made months ago can still be audited. Acknowledging a deload is
 * also what restarts the 42/56-day clock.
 */
export default function Review() {
  const { data: logs } = useDailyLogs();
  const { data: phase } = useActivePhase();
  const { data: measurements } = useMeasurements();
  const { data: workouts } = useWorkouts();
  const { data: sets } = useWorkoutSets();
  const { data: recommendations } = useRecommendations();

  const engine = useEngine({ logs, phase, measurements, workouts, sets, recommendations });

  const to = engine.trendDelta?.toDate ?? todayISO();
  const from = shiftISO(to, -6);
  const week = summariseWeek(logs ?? [], from, to);

  const prsThisWeek = (sets ?? []).filter((s) => {
    if (!s.is_pr) return false;
    const w = (workouts ?? []).find((x) => x.id === s.workout_id);
    const d = w?.performed_at.slice(0, 10);
    return d !== undefined && d >= from && d <= to;
  });

  const verdicts: { verdict: Verdict; eyebrow: string; scope: RecommendationScope }[] = [];
  if (engine.overreaching)
    verdicts.push({ verdict: engine.overreaching, eyebrow: 'Stop and read this', scope: 'alert' });
  if (engine.weekly) verdicts.push({ verdict: engine.weekly, eyebrow: 'Rate of change', scope: 'weekly' });
  if (engine.transition)
    verdicts.push({ verdict: engine.transition, eyebrow: 'Phase', scope: 'monthly' });
  if (engine.deload) verdicts.push({ verdict: engine.deload, eyebrow: 'Recovery', scope: 'deload' });

  return (
    <div className="space-y-4 pt-1">
      <p className="text-sm muted">
        Week of {shortLabel(from)} — {shortLabel(to)}
      </p>

      <section className="card">
        <h2 className="text-sm font-medium muted">The week in numbers</h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3">
          <Stat
            label="Trend change"
            value={
              engine.trendDelta
                ? `${engine.trendDelta.deltaKg >= 0 ? '+' : ''}${engine.trendDelta.deltaKg.toFixed(2)} kg`
                : null
            }
          />
          <Stat label="Adherence" value={`${engine.compliancePct}%`} />
          <Stat label="Days logged" value={`${week.daysLogged}/7`} />
          <Stat label="Avg sleep" value={week.avgSleep ? `${week.avgSleep} h` : null} />
          <Stat label="Avg resting HR" value={week.avgRhr ? `${week.avgRhr} bpm` : null} />
          <Stat label="Avg HRV" value={week.avgHrv ? `${week.avgHrv} ms` : null} />
          <Stat label="Avg energy" value={week.avgEnergy ? `${week.avgEnergy}/10` : null} />
          <Stat label="Avg mood" value={week.avgMood ? `${week.avgMood}/10` : null} />
          <Stat
            label="Avg steps"
            value={week.avgSteps ? Math.round(week.avgSteps).toLocaleString() : null}
          />
          <Stat label="PRs" value={`${prsThisWeek.length}`} />
        </dl>
        <p className="mt-3 text-xs muted">{engine.strengthDetail}</p>
      </section>

      {verdicts.length === 0 ? (
        <section className="card">
          <p className="muted">
            A week of weight and a set phase produce your first verdicts here.
          </p>
        </section>
      ) : (
        verdicts.map((v) => (
          <AcknowledgeableVerdict
            key={v.verdict.code}
            verdict={v.verdict}
            eyebrow={v.eyebrow}
            scope={v.scope}
          />
        ))
      )}

      {recommendations && recommendations.length > 0 ? (
        <section className="card">
          <h2 className="text-sm font-medium muted">Filed decisions</h2>
          <ul className="mt-2 space-y-2">
            {recommendations.slice(0, 6).map((r) => (
              <li key={r.id} className="text-sm">
                <span className="muted tabular-nums">{shortLabel(r.generated_on)}</span>{' '}
                <span className="text-slate-200">{r.verdict}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[11px] uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="truncate text-lg font-semibold tabular-nums text-slate-100">
        {value ?? '—'}
      </dd>
    </div>
  );
}

function AcknowledgeableVerdict({
  verdict,
  eyebrow,
  scope,
}: {
  verdict: Verdict;
  eyebrow: string;
  scope: RecommendationScope;
}) {
  const acknowledge = useAcknowledge();
  const [done, setDone] = useState(false);

  // "Recovery is holding" is information, not a decision — nothing to file.
  const fileable = verdict.code !== 'no_deload' && verdict.code !== 'on_track';

  return (
    <div className="space-y-2">
      <VerdictCard verdict={verdict} eyebrow={eyebrow} defaultOpen={verdict.severity !== 'info'} />
      {fileable ? (
        <button
          type="button"
          disabled={done || acknowledge.isPending}
          onClick={async () => {
            await acknowledge.mutateAsync({ verdict, scope });
            setDone(true);
          }}
          className="btn-ghost w-full text-sm"
        >
          {done ? 'Filed ✓' : acknowledge.isPending ? 'Filing…' : 'Acknowledge and file this'}
        </button>
      ) : null}
    </div>
  );
}
