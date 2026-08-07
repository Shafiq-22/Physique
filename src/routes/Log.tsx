import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NumberStepper } from '../components/NumberStepper';
import { useDailyLogs, useSaveDailyLog } from '../hooks/useDailyLog';
import { useActivePhase } from '../hooks/usePhase';
import { PHASE_TARGETS } from '../lib/config';
import { shortLabel, todayISO } from '../lib/dates';

/**
 * The 30-second entry.
 *
 * Weight is the only number that must be typed; the two toggles below it feed
 * the compliance figure the weekly verdict depends on. Everything else arrives
 * in Phase 2 — adding fields here is the easiest way to make a daily habit fail.
 */
export default function Log() {
  const date = todayISO();
  const navigate = useNavigate();
  const { data: logs } = useDailyLogs();
  const { data: phase } = useActivePhase();
  const save = useSaveDailyLog();

  const existing = logs?.find((l) => l.log_date === date) ?? null;

  /** Yesterday's weight seeds the stepper so most days are two taps. */
  const lastWeight = useMemo(() => {
    const withWeight = (logs ?? []).filter((l) => l.weight_kg !== null && l.log_date < date);
    return withWeight.length ? (withWeight[withWeight.length - 1]!.weight_kg as number) : null;
  }, [logs, date]);

  const [weight, setWeight] = useState<number | null>(null);
  const [caloriesOnTarget, setCaloriesOnTarget] = useState<boolean | null>(null);
  const [proteinHit, setProteinHit] = useState<boolean | null>(null);
  const [saved, setSaved] = useState(false);

  // Hydrate once the cached log arrives, without clobbering in-progress edits.
  useEffect(() => {
    if (!existing) return;
    setWeight((w) => (w === null ? existing.weight_kg : w));
    setCaloriesOnTarget((c) => (c === null ? existing.calories_on_target : c));
    setProteinHit((p) => (p === null ? existing.protein_hit : p));
  }, [existing]);

  const targetKcal = phase ? (phase.target_kcal ?? PHASE_TARGETS[phase.phase_type].kcal) : null;
  const targetProtein = phase
    ? (phase.protein_g ?? PHASE_TARGETS[phase.phase_type].protein_g)
    : null;

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    await save.mutateAsync({
      log_date: date,
      weight_kg: weight,
      calories_on_target: caloriesOnTarget,
      protein_hit: proteinHit,
    });
    setSaved(true);
    setTimeout(() => navigate('/'), 450);
  };

  return (
    <form onSubmit={submit} className="space-y-4 pt-1">
      <p className="text-sm muted">{shortLabel(date)}</p>

      <NumberStepper
        label="Weight"
        unit="kg"
        value={weight}
        onChange={setWeight}
        step={0.1}
        decimals={1}
        min={30}
        max={250}
        placeholder={lastWeight}
        autoFocus
      />

      <Toggle
        label="Calories on target"
        hint={targetKcal ? `${targetKcal} kcal` : undefined}
        value={caloriesOnTarget}
        onChange={setCaloriesOnTarget}
      />

      <Toggle
        label="Protein hit"
        hint={targetProtein ? `${targetProtein} g` : undefined}
        value={proteinHit}
        onChange={setProteinHit}
      />

      <button type="submit" disabled={save.isPending} className="btn-primary w-full">
        {save.isPending ? 'Saving…' : saved ? 'Saved' : 'Save'}
      </button>

      <p className="text-center text-xs muted">
        Saves instantly and syncs later — this works with no signal.
      </p>
    </form>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  const opts: { v: boolean | null; text: string }[] = [
    { v: true, text: 'Yes' },
    { v: false, text: 'No' },
  ];

  return (
    <div className="card">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-slate-300">{label}</span>
        {hint ? <span className="text-xs muted">{hint}</span> : null}
      </div>
      <div className="mt-2 flex gap-2">
        {opts.map((o) => {
          const active = value === o.v;
          return (
            <button
              key={o.text}
              type="button"
              aria-pressed={active}
              // Tapping the active choice clears it — "no answer" stays reachable.
              onClick={() => onChange(active ? null : o.v)}
              className={`h-12 flex-1 rounded-xl font-semibold transition active:scale-[0.98] ${
                active ? 'bg-accent text-ink-900' : 'bg-ink-700 text-slate-300'
              }`}
            >
              {o.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
