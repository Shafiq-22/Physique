import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSaveWorkout, useWorkouts, useWorkoutSets, type DraftSet } from '../hooks/useWorkouts';
import { buildHistory, detectPR } from '../lib/workouts';
import { lastPerformanceOf, prescribe, type Prescription } from '../lib/progression';
import {
  SESSIONS,
  WARMUP_GENERAL,
  WARMUP_LOWER,
  WARMUP_NOTE,
  WARMUP_UPPER,
  sessionForDate,
  type ProgramExercise,
  type ProgramSession,
  type SessionId,
} from '../lib/program';
import { ExercisePicker } from '../components/ExercisePicker';
import { RestTimer } from '../components/RestTimer';
import { ScalePicker } from '../components/ScalePicker';
import { todayISO } from '../lib/dates';
import type { Equipment, Exercise } from '../lib/exerciseLibrary';
import type { ISODate } from '../lib/types';

/** One logged set, tied back to the programmed exercise it belongs to. */
interface Entry extends DraftSet {
  /** Index into the session's exercise list; null for a freestyle addition. */
  programIndex: number | null;
}

const SELECTABLE: SessionId[] = [
  'upper_a',
  'lower_a',
  'upper_b',
  'conditioning',
  'power',
  'upper_c',
];

/**
 * Session logging, driven by the programme.
 *
 * Today's session loads pre-filled with its prescribed sets, and each exercise
 * carries a computed instruction from `progression.ts` — what to do today, based
 * on the worst set logged last time. The alternative is remembering it, and the
 * set people remember is the good one, not the one the rule keys on.
 *
 * Anything can still be edited or added; the template is a starting point, not a
 * cage.
 */
export default function Workout() {
  const navigate = useNavigate();
  const { data: workouts } = useWorkouts();
  const { data: allSets } = useWorkoutSets();
  const save = useSaveWorkout();

  const [sessionId, setSessionId] = useState<SessionId>(() => {
    const s = sessionForDate(todayISO());
    return s.exercises.length ? s.id : 'upper_a';
  });
  const session: ProgramSession = SESSIONS[sessionId];

  const [entries, setEntries] = useState<Entry[]>([]);
  const [sessionRpe, setSessionRpe] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [pickingFor, setPickingFor] = useState<number | null>(null);
  const [restFor, setRestFor] = useState<{ seconds: number; key: number } | null>(null);
  const [showWarmup, setShowWarmup] = useState(false);
  const [equipment, setEquipment] = useState<Equipment[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('vector:equipment') ?? '[]') as Equipment[];
    } catch {
      return [];
    }
  });

  const setDates = useMemo(() => {
    const m = new Map<string, ISODate>();
    for (const w of workouts ?? []) m.set(w.id, w.performed_at.slice(0, 10));
    return m;
  }, [workouts]);

  const history = useMemo(() => buildHistory(allSets ?? []), [allSets]);

  /** One prescription per programmed exercise, from what was actually logged. */
  const prescriptions = useMemo<Prescription[]>(
    () =>
      session.exercises.map((e) =>
        prescribe(e, lastPerformanceOf(e.name, allSets ?? [], setDates)),
      ),
    [session, allSets, setDates],
  );

  // Rebuild the sheet whenever the session changes: one row per prescribed set,
  // pre-filled with the target so a straight-through session is just taps.
  useEffect(() => {
    const rows: Entry[] = [];
    session.exercises.forEach((e, i) => {
      const p = prescriptions[i];
      for (let n = 0; n < e.sets; n++) {
        rows.push({
          programIndex: i,
          exercise_name: e.name,
          load_kg: p?.targetLoad ?? null,
          leverage: null,
          reps: p?.targetReps ?? p?.targetSeconds ?? null,
          rpe: Array.isArray(e.rpe) ? e.rpe[1]! : e.rpe,
        });
      }
    });
    setEntries(rows);
    // Prescriptions are derived from the same inputs, so this stays in step.
  }, [session, prescriptions]);

  const update = (i: number, patch: Partial<Entry>): void =>
    setEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));

  const removeRow = (i: number): void =>
    setEntries((prev) => prev.filter((_, idx) => idx !== i));

  const addFreestyle = (): void =>
    setEntries((prev) => [
      ...prev,
      { programIndex: null, exercise_name: '', load_kg: null, leverage: null, reps: null, rpe: null },
    ]);

  const saveEquipment = (next: Equipment[]): void => {
    setEquipment(next);
    try {
      localStorage.setItem('vector:equipment', JSON.stringify(next));
    } catch {
      /* private mode — the filter just resets next launch */
    }
  };

  const pickExercise = (e: Exercise): void => {
    if (pickingFor !== null) update(pickingFor, { exercise_name: e.name });
    setPickingFor(null);
  };

  const usable = entries.filter((e) => e.exercise_name.trim() !== '' && e.reps !== null);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    await save.mutateAsync({
      session_type: session.label,
      session_rpe: sessionRpe,
      notes: notes.trim() || null,
      sets: entries.map(({ programIndex: _ignored, ...s }) => s),
      priorSets: allSets ?? [],
    });
    navigate('/');
  };

  // Group the flat row list back into per-exercise blocks for rendering.
  const blocks = useMemo(() => {
    const out: { programIndex: number | null; rows: number[] }[] = [];
    entries.forEach((e, i) => {
      const tail = out[out.length - 1];
      if (tail && tail.programIndex === e.programIndex && e.programIndex !== null) {
        tail.rows.push(i);
      } else {
        out.push({ programIndex: e.programIndex, rows: [i] });
      }
    });
    return out;
  }, [entries]);

  const warmup =
    sessionId === 'lower_a' ? WARMUP_LOWER : sessionId === 'conditioning' ? [] : WARMUP_UPPER;

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

      {restFor ? (
        <RestTimer
          key={restFor.key}
          seconds={restFor.seconds}
          onDismiss={() => setRestFor(null)}
        />
      ) : null}

      <div className="card">
        <span className="text-sm font-medium text-slate-300">Session</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {SELECTABLE.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={sessionId === id}
              onClick={() => setSessionId(id)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                sessionId === id ? 'bg-accent text-ink-900' : 'bg-ink-700 text-slate-300'
              }`}
            >
              {SESSIONS[id].label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs muted">{session.focus}</p>
        {session.note ? <p className="mt-1 text-xs muted">{session.note}</p> : null}
      </div>

      <div className="card">
        <button
          type="button"
          onClick={() => setShowWarmup((v) => !v)}
          aria-expanded={showWarmup}
          className="w-full text-left text-sm font-medium text-sky-300"
        >
          {showWarmup ? 'Hide warm-up' : 'Warm-up (7 min)'}
        </button>
        {showWarmup ? (
          <div className="mt-2 space-y-2 border-t border-ink-700 pt-2">
            <ul className="space-y-1">
              {[...WARMUP_GENERAL, ...warmup].map((w) => (
                <li key={w} className="flex gap-2 text-sm text-slate-300">
                  <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-500" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs muted">{WARMUP_NOTE}</p>
          </div>
        ) : null}
      </div>

      {blocks.map((block) => {
        const pi = block.programIndex;
        const ex: ProgramExercise | null = pi !== null ? (session.exercises[pi] ?? null) : null;
        const p = pi !== null ? (prescriptions[pi] ?? null) : null;

        return (
          <section key={`${pi}-${block.rows[0]}`} className="card space-y-2">
            {ex && p ? (
              <ExerciseHeader exercise={ex} prescription={p} />
            ) : (
              <div className="flex gap-2">
                <input
                  value={entries[block.rows[0]!]?.exercise_name ?? ''}
                  onChange={(e) => update(block.rows[0]!, { exercise_name: e.target.value })}
                  placeholder="Extra exercise"
                  aria-label="Exercise name"
                  className="min-w-0 flex-1 rounded-xl bg-ink-900 px-3 py-2.5 outline-none ring-1 ring-ink-700 focus:ring-2 focus:ring-accent/60"
                />
                <button
                  type="button"
                  onClick={() => setPickingFor(block.rows[0]!)}
                  className="shrink-0 rounded-xl bg-ink-700 px-3 text-sm font-medium text-slate-200"
                >
                  Browse
                </button>
              </div>
            )}

            {block.rows.map((rowIndex, n) => {
              const row = entries[rowIndex]!;
              const pr = detectPR(row, history);
              const timed = ex?.repRange === null && ex?.timeSec !== undefined;
              return (
                <div key={rowIndex} className="flex items-end gap-2">
                  <span className="w-8 shrink-0 pb-3 text-xs muted tabular-nums">{n + 1}</span>
                  <NumField
                    label="kg"
                    value={row.load_kg}
                    onChange={(v) => update(rowIndex, { load_kg: v })}
                    step="0.5"
                  />
                  <NumField
                    label={timed ? 'sec' : 'reps'}
                    value={row.reps}
                    onChange={(v) => update(rowIndex, { reps: v })}
                    step="1"
                  />
                  <NumField
                    label="RPE"
                    value={row.rpe}
                    onChange={(v) => update(rowIndex, { rpe: v })}
                    step="0.5"
                  />
                  {pr.isPr ? (
                    <span className="chip mb-2 shrink-0 bg-accent/20 text-accent" title={pr.reason}>
                      ★
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() =>
                      setRestFor({ seconds: ex?.restSec ?? 90, key: Date.now() })
                    }
                    aria-label={`Start rest timer after set ${n + 1}`}
                    className="mb-1 shrink-0 rounded-lg bg-ink-700 px-2 py-2 text-xs text-slate-300"
                  >
                    ⏱
                  </button>
                  {pi === null ? (
                    <button
                      type="button"
                      onClick={() => removeRow(rowIndex)}
                      aria-label="Remove set"
                      className="mb-1 shrink-0 px-1 text-xs muted"
                    >
                      ✕
                    </button>
                  ) : null}
                </div>
              );
            })}

            <input
              value={entries[block.rows[0]!]?.leverage ?? ''}
              onChange={(e) =>
                block.rows.forEach((r) => update(r, { leverage: e.target.value || null }))
              }
              placeholder="Leverage / variation — e.g. incline 60cm, band-assisted"
              aria-label="Leverage"
              className="w-full rounded-xl bg-ink-900 px-3 py-2 text-sm outline-none ring-1 ring-ink-700 focus:ring-2 focus:ring-accent/60"
            />
          </section>
        );
      })}

      <button type="button" onClick={addFreestyle} className="btn-ghost w-full">
        + Add an exercise
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
        {save.isPending ? 'Saving…' : `Save ${session.label} (${usable.length} sets)`}
      </button>

      {save.error ? <p className="text-sm text-danger">{(save.error as Error).message}</p> : null}

      <p className="pb-2 text-center text-xs muted">
        Workouts save straight to the server — they are not queued offline.
      </p>
    </form>
  );
}

/** Name, prescription and the reasoning behind today's target. */
function ExerciseHeader({
  exercise,
  prescription,
}: {
  exercise: ProgramExercise;
  prescription: Prescription;
}) {
  const [open, setOpen] = useState(false);
  const rpe = Array.isArray(exercise.rpe) ? exercise.rpe.join('–') : exercise.rpe;

  const tone =
    prescription.action === 'progress_exercise'
      ? 'text-accent'
      : prescription.action === 'back_off'
        ? 'text-amber-300'
        : 'text-slate-200';

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-medium">
          {exercise.name}
          {exercise.priority === 2 ? (
            <span className="ml-1 text-accent" title="Top priority">
              ★★
            </span>
          ) : exercise.priority === 1 ? (
            <span className="ml-1 text-accent" title="Priority muscle">
              ★
            </span>
          ) : null}
        </h3>
        <span className="shrink-0 text-xs muted tabular-nums">
          RPE {rpe} · {exercise.restSec}s
        </span>
      </div>

      <p className={`mt-0.5 text-sm font-medium ${tone}`}>{prescription.instruction}</p>

      {exercise.note ? <p className="mt-0.5 text-xs muted">{exercise.note}</p> : null}

      {prescription.rationale.length > 0 ? (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="mt-1 text-xs font-medium text-sky-300"
          >
            {open ? 'Hide' : 'Why this target?'}
          </button>
          {open ? (
            <ul className="mt-1 space-y-1">
              {prescription.rationale.map((r) => (
                <li key={r} className="text-xs muted">
                  {r}
                </li>
              ))}
              {prescription.nextLadderStep ? (
                <li className="text-xs text-slate-300">Ladder: {prescription.nextLadderStep}</li>
              ) : null}
            </ul>
          ) : null}
        </>
      ) : null}
    </div>
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
