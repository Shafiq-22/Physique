import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSaveWorkout, useWorkouts, useWorkoutSets, type DraftSet } from '../hooks/useWorkouts';
import { buildHistory, detectPR, normaliseExercise } from '../lib/workouts';
import { ExercisePicker } from '../components/ExercisePicker';
import { findExercise, pushPullBalance, type Equipment, type Exercise } from '../lib/exerciseLibrary';
import { ScalePicker } from '../components/ScalePicker';
import { shortLabel } from '../lib/dates';
import type { Workout as WorkoutRow, WorkoutSet } from '../lib/types';

const SESSION_TYPES = ['Upper A', 'Upper B', 'Lower A', 'Lower B', 'Power', 'Full body'];

const blankSet = (exercise = ''): DraftSet => ({
  exercise_name: exercise,
  load_kg: null,
  leverage: null,
  reps: null,
  rpe: null,
});

/**
 * Session logging with live PR feedback.
 *
 * Records are flagged as you type rather than after saving, because the moment
 * that matters is standing at the rack deciding whether to add weight. The same
 * pure function decides both the badge here and the stored `is_pr` column, so
 * they can never disagree.
 */
export default function Workout() {
  const navigate = useNavigate();
  const { data: workouts } = useWorkouts();
  const { data: allSets } = useWorkoutSets();
  const save = useSaveWorkout();

  const [sessionType, setSessionType] = useState<string>('');
  const [sessionRpe, setSessionRpe] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [sets, setSets] = useState<DraftSet[]>([blankSet()]);
  /** Which set the picker is filling, or null when it is closed. */
  const [pickingFor, setPickingFor] = useState<number | null>(null);
  const [equipment, setEquipment] = useState<Equipment[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('vector:equipment') ?? '[]') as Equipment[];
    } catch {
      return [];
    }
  });

  const saveEquipment = (next: Equipment[]): void => {
    setEquipment(next);
    // Your gym does not change between sets, so remember it across sessions.
    try {
      localStorage.setItem('vector:equipment', JSON.stringify(next));
    } catch {
      /* private mode — filtering just resets next launch */
    }
  };

  const pickExercise = (e: Exercise): void => {
    if (pickingFor !== null) update(pickingFor, { exercise_name: e.name });
    setPickingFor(null);
  };

  const balance = pushPullBalance(sets.map((s) => s.exercise_name));

  const history = useMemo(() => buildHistory(allSets ?? []), [allSets]);

  /** The most recent session of this type, offered as a starting point. */
  const lastOfType = useMemo(() => {
    if (!workouts || !allSets) return null;
    const match = workouts.find((w) => w.session_type === sessionType);
    if (!match) return null;
    return {
      workout: match,
      sets: allSets
        .filter((s) => s.workout_id === match.id)
        .sort((a, b) => a.set_index - b.set_index),
    };
  }, [workouts, allSets, sessionType]);

  const prefill = (from: { workout: WorkoutRow; sets: WorkoutSet[] }): void => {
    setSets(
      from.sets.map((s) => ({
        exercise_name: s.exercise_name,
        load_kg: s.load_kg,
        leverage: s.leverage,
        reps: s.reps,
        rpe: s.rpe,
      })),
    );
  };

  const update = (i: number, patch: Partial<DraftSet>): void => {
    setSets((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  };

  const addSet = (): void => {
    // Repeat the last exercise — sets come in groups, so this is usually right.
    const last = sets[sets.length - 1];
    setSets((prev) => [
      ...prev,
      last ? { ...blankSet(last.exercise_name), load_kg: last.load_kg, leverage: last.leverage } : blankSet(),
    ]);
  };

  const removeSet = (i: number): void => {
    setSets((prev) => (prev.length === 1 ? [blankSet()] : prev.filter((_, idx) => idx !== i)));
  };

  const usable = sets.filter((s) => s.exercise_name.trim() !== '' && s.reps !== null);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    await save.mutateAsync({
      session_type: sessionType || null,
      session_rpe: sessionRpe,
      notes: notes.trim() || null,
      sets,
      priorSets: allSets ?? [],
    });
    navigate('/');
  };

  return (
    <form onSubmit={submit} className="space-y-4 pt-1">
      {pickingFor !== null ? (
        <ExercisePicker
          onPick={pickExercise}
          onClose={() => setPickingFor(null)}
          equipment={equipment}
          onEquipmentChange={saveEquipment}
        />
      ) : null}

      <div className="card">
        <span className="text-sm font-medium text-slate-300">Session</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {SESSION_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={sessionType === t}
              onClick={() => setSessionType(sessionType === t ? '' : t)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                sessionType === t ? 'bg-accent text-ink-900' : 'bg-ink-700 text-slate-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {lastOfType ? (
          <button
            type="button"
            onClick={() => prefill(lastOfType)}
            className="mt-3 text-sm font-medium text-sky-300"
          >
            Load last {sessionType} ({shortLabel(lastOfType.workout.performed_at.slice(0, 10))})
          </button>
        ) : null}
      </div>

      {sets.map((s, i) => {
        const pr = detectPR(s, history);
        return (
          <div key={i} className="card space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs muted">Set {i + 1}</span>
              <div className="flex items-center gap-2">
                {pr.isPr ? (
                  <span className="chip bg-accent/20 text-accent" title={pr.reason}>
                    ★ PR
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => removeSet(i)}
                  aria-label={`Remove set ${i + 1}`}
                  className="text-xs muted"
                >
                  Remove
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                value={s.exercise_name}
                onChange={(e) => update(i, { exercise_name: e.target.value })}
                placeholder="Exercise"
                aria-label={`Exercise for set ${i + 1}`}
                list="exercise-names"
                className="min-w-0 flex-1 rounded-xl bg-ink-900 px-3 py-2.5 outline-none ring-1 ring-ink-700 focus:ring-2 focus:ring-accent/60"
              />
              <button
                type="button"
                onClick={() => setPickingFor(i)}
                className="shrink-0 rounded-xl bg-ink-700 px-3 text-sm font-medium text-slate-200"
              >
                Browse
              </button>
            </div>

            <div className="flex gap-2">
              <NumField
                label="kg"
                value={s.load_kg}
                onChange={(v) => update(i, { load_kg: v })}
                step="0.5"
              />
              <NumField
                label="reps"
                value={s.reps}
                onChange={(v) => update(i, { reps: v })}
                step="1"
              />
              <NumField
                label="RPE"
                value={s.rpe}
                onChange={(v) => update(i, { rpe: v })}
                step="0.5"
              />
            </div>

            <input
              value={s.leverage ?? ''}
              onChange={(e) => update(i, { leverage: e.target.value || null })}
              placeholder="Leverage (optional) — e.g. incline 60cm, band-assisted"
              aria-label={`Leverage for set ${i + 1}`}
              className="w-full rounded-xl bg-ink-900 px-3 py-2 text-sm outline-none ring-1 ring-ink-700 focus:ring-2 focus:ring-accent/60"
            />

            {pr.isPr ? <p className="text-xs text-accent">{pr.reason}</p> : null}
            {(() => {
              const lib = findExercise(s.exercise_name);
              if (!lib) return null;
              const timed = lib.repRange[0] === lib.repRange[1];
              const outOfRange =
                !timed && s.reps !== null && (s.reps < lib.repRange[0] || s.reps > lib.repRange[1]);
              return (
                <p className={`text-xs ${outOfRange ? 'text-amber-300' : 'muted'}`}>
                  {timed
                    ? 'Timed hold — log seconds in the reps field.'
                    : `Typical range ${lib.repRange[0]}–${lib.repRange[1]} reps.`}
                  {outOfRange ? ' You are outside it — deliberate, or a typo?' : ''}
                </p>
              );
            })()}
          </div>
        );
      })}

      {/* Autocomplete from every exercise ever logged, so names stay consistent. */}
      <datalist id="exercise-names">
        {[...new Set((allSets ?? []).map((s) => s.exercise_name))].map((n) => (
          <option key={normaliseExercise(n)} value={n} />
        ))}
      </datalist>

      {balance.push + balance.pull >= 3 && Math.abs(balance.push - balance.pull) >= 3 ? (
        <p className="px-1 text-xs text-amber-300">
          {balance.push} pushing sets to {balance.pull} pulling. Long-run imbalance is what pulls
          shoulders forward — worth evening up.
        </p>
      ) : null}

      <button type="button" onClick={addSet} className="btn-ghost w-full">
        + Add set
      </button>

      <ScalePicker
        label="Session RPE"
        value={sessionRpe}
        onChange={setSessionRpe}
        hint="how hard overall"
      />

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        aria-label="Session notes"
        rows={2}
        className="w-full rounded-xl bg-ink-800 px-3 py-2 outline-none ring-1 ring-ink-700 focus:ring-2 focus:ring-accent/60"
      />

      <button
        type="submit"
        disabled={save.isPending || usable.length === 0}
        className="btn-primary w-full"
      >
        {save.isPending ? 'Saving…' : `Save session (${usable.length} sets)`}
      </button>

      {save.error ? (
        <p className="text-sm text-danger">{(save.error as Error).message}</p>
      ) : null}

      <p className="pb-2 text-center text-xs muted">
        Workouts save straight to the server — they are not queued offline.
      </p>
    </form>
  );
}

function NumField({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  step: string;
}) {
  return (
    <label className="min-w-0 flex-1">
      <span className="text-xs muted">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        aria-label={label}
        className="mt-0.5 w-full rounded-xl bg-ink-900 px-2 py-2.5 text-center text-lg font-semibold tabular-nums outline-none ring-1 ring-ink-700 focus:ring-2 focus:ring-accent/60"
      />
    </label>
  );
}
