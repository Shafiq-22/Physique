import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useActivePhase, useStartPhase } from '../hooks/usePhase';
import { useDailyLogs } from '../hooks/useDailyLog';
import { useMeasurements } from '../hooks/useMeasurements';
import { useWorkouts, useWorkoutSets } from '../hooks/useWorkouts';
import { useRecommendations } from '../hooks/useRecommendations';
import { useProfile, useSaveProfile } from '../hooks/useProfile';
import { useEngine } from '../hooks/useEngine';
import { RotaryDial } from '../components/RotaryDial';
import { comparePhases, weeksToGoal } from '../lib/targets';
import { PHASE_RULES, PROFILE } from '../lib/config';
import { shortLabel } from '../lib/dates';
import type { PhaseType } from '../lib/types';

export default function Settings() {
  const { data: phase } = useActivePhase();
  const { data: logs } = useDailyLogs();
  const { data: measurements } = useMeasurements();
  const { data: workouts } = useWorkouts();
  const { data: sets } = useWorkoutSets();
  const { data: recommendations } = useRecommendations();
  const { data: profile } = useProfile();
  const saveProfile = useSaveProfile();
  const startPhase = useStartPhase();

  const engine = useEngine({ logs, phase, measurements, workouts, sets, recommendations });

  const [confirming, setConfirming] = useState<PhaseType | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [goalWeight, setGoalWeight] = useState<number | null>(null);

  useEffect(() => {
    if (profile) setHeight((h) => (h === null ? (profile.height_cm ?? PROFILE.HEIGHT_CM) : h));
  }, [profile]);

  const currentWeight = engine.series[engine.series.length - 1]?.ema ?? null;
  const tdee = engine.tdee?.tdee ?? engine.mifflin;
  const options = comparePhases(currentWeight, tdee, engine.tdee ? 'measured' : 'estimated');

  const exportJson = (): void => {
    const blob = new Blob(
      [JSON.stringify({ profile, phase, logs, measurements, workouts, sets, recommendations }, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vector-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 pt-1">
      <section className="space-y-3">
        <h2 className="px-1 text-sm font-medium muted">You</h2>

        <RotaryDial
          label="Height"
          unit="cm"
          value={height}
          onChange={setHeight}
          step={0.5}
          decimals={1}
          min={120}
          max={230}
          placeholder={PROFILE.HEIGHT_CM}
        />

        <button
          type="button"
          disabled={height === null || saveProfile.isPending}
          onClick={() => height !== null && saveProfile.mutate({ height_cm: height })}
          className="btn-ghost w-full"
        >
          {saveProfile.isPending ? 'Saving…' : saveProfile.isSuccess ? 'Height saved ✓' : 'Save height'}
        </button>

        <div className="card">
          <p className="text-sm muted">
            Current trend weight{' '}
            <span className="font-semibold text-slate-100 tabular-nums">
              {currentWeight !== null ? `${currentWeight.toFixed(1)} kg` : '—'}
            </span>
            . Every target below is derived from it, so they move as you do.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="px-1 text-sm font-medium muted">Phase</h2>

        {phase ? (
          <p className="px-1 text-xs muted">
            {PHASE_RULES[phase.phase_type].label} since {shortLabel(phase.start_date)}
          </p>
        ) : (
          <p className="px-1 text-xs muted">No phase set. Verdicts need one.</p>
        )}

        {options.map((o) => {
          const active = phase?.phase_type === o.phase;
          const isConfirming = confirming === o.phase;
          const rule = PHASE_RULES[o.phase];
          const weeks =
            goalWeight !== null && currentWeight !== null
              ? weeksToGoal(currentWeight, goalWeight, o.targetWeeklyChangeKg)
              : null;

          return (
            <div key={o.phase}>
              <button
                type="button"
                disabled={startPhase.isPending}
                onClick={() => setConfirming(isConfirming ? null : o.phase)}
                className={`w-full rounded-xl px-4 py-3 text-left transition ${
                  active ? 'bg-accent/15 ring-1 ring-accent/40' : 'bg-ink-800 ring-1 ring-ink-700'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">
                    {rule.label}
                    {active ? <span className="ml-2 text-xs text-accent">current</span> : null}
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-slate-200">
                    {o.kcal} kcal
                  </span>
                </div>
                <span className="block text-xs muted">{rule.blurb}</span>
                {/* The decision is made against numbers, not a label. */}
                <span className="mt-1 block text-xs muted tabular-nums">
                  {o.protein_g} g protein · {o.weeklyChangeKg[0]} to {o.weeklyChangeKg[1]} kg/week
                  {weeks !== null ? ` · ~${weeks} wk to goal` : ''}
                </span>
              </button>

              {isConfirming && !active ? (
                <div className="mt-2 rounded-xl bg-ink-900 p-3">
                  <p className="text-sm text-slate-300">
                    Start a {rule.label.toLowerCase()} phase at {o.kcal} kcal and {o.protein_g} g
                    protein? This closes the current phase.
                  </p>
                  <ul className="mt-2 space-y-1">
                    {o.rationale.map((r) => (
                      <li key={r} className="text-xs muted">
                        {r}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      className="btn-primary flex-1"
                      onClick={async () => {
                        await startPhase.mutateAsync({
                          phase_type: o.phase,
                          target_kcal: o.kcal,
                          protein_g: o.protein_g,
                          target_weekly_change_kg: o.targetWeeklyChangeKg,
                        });
                        setConfirming(null);
                      }}
                    >
                      Start
                    </button>
                    <button
                      type="button"
                      className="btn-ghost flex-1"
                      onClick={() => setConfirming(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}

        {startPhase.error ? (
          <p className="text-sm text-danger">{(startPhase.error as Error).message}</p>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="px-1 text-sm font-medium muted">Goal weight (optional)</h2>
        <RotaryDial
          label="Goal weight"
          unit="kg"
          value={goalWeight}
          onChange={setGoalWeight}
          step={0.5}
          decimals={1}
          min={40}
          max={200}
          placeholder={currentWeight}
        />
        <p className="px-1 text-xs muted">
          Sets the "weeks to goal" estimate above. Not stored — it is a planning aid, not a target
          to chase daily.
        </p>
      </section>

      <section className="card">
        <h2 className="font-medium">Your data</h2>
        <p className="mt-1 text-sm muted">
          {logs?.length ?? 0} daily logs · {measurements?.length ?? 0} measurements ·{' '}
          {workouts?.length ?? 0} workouts
        </p>
        <button type="button" onClick={exportJson} className="btn-ghost mt-3 w-full">
          Export everything as JSON
        </button>
      </section>

      <button
        type="button"
        onClick={() => void supabase.auth.signOut()}
        className="btn-ghost w-full text-danger"
      >
        Sign out
      </button>
    </div>
  );
}
