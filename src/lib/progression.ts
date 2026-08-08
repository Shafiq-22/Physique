/**
 * Double progression, as a decision rule.
 *
 * The programme's second governing rule: work at the bottom of the rep range,
 * add reps each week until you hit the top on *all* sets, then make the movement
 * harder and start again at the bottom.
 *
 * Doing that from memory is exactly the sort of bookkeeping people get wrong —
 * you remember the good set, not the worst one, and the worst one is what the
 * rule keys on. So it is computed from what was actually logged.
 */

import { LADDERS, PROGRAM_RULES, type ProgramExercise } from './program';
import { normaliseExercise } from './workouts';
import { isoCompare } from './dates';
import type { ISODate, WorkoutSet } from './types';

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export interface PerformedSet {
  reps: number | null;
  load_kg: number | null;
  rpe: number | null;
}

export interface LastPerformance {
  date: ISODate;
  sets: PerformedSet[];
  /** Worst set of the session — what double progression actually keys on. */
  minReps: number | null;
  maxLoad: number | null;
}

export type ProgressionAction =
  | 'start'
  | 'add_reps'
  | 'progress_exercise'
  | 'repeat'
  | 'back_off';

export interface Prescription {
  exercise: ProgramExercise;
  last: LastPerformance | null;
  /** Reps to aim for on every set today. Null for timed work. */
  targetReps: number | null;
  /** Seconds to aim for, when the movement is timed. */
  targetSeconds: number | null;
  /** Carry the same load unless the movement is being made harder. */
  targetLoad: number | null;
  action: ProgressionAction;
  /** One line, imperative — what to do today. */
  instruction: string;
  /** Why, in terms of what was logged. */
  rationale: string[];
  /** The next rung, when it is time to make the movement harder. */
  nextLadderStep: string | null;
}

/** Most recent session's sets for one exercise. */
export function lastPerformanceOf(
  exerciseName: string,
  sets: WorkoutSet[],
  setDates: Map<string, ISODate>,
  before?: ISODate,
): LastPerformance | null {
  const key = normaliseExercise(exerciseName);

  const dated = sets
    .filter((s) => normaliseExercise(s.exercise_name) === key)
    .map((s) => ({ set: s, date: setDates.get(s.workout_id) }))
    .filter((x): x is { set: WorkoutSet; date: ISODate } => x.date !== undefined)
    .filter((x) => (before ? isoCompare(x.date, before) < 0 : true));

  if (dated.length === 0) return null;

  const latest = dated.reduce((a, b) => (isoCompare(a.date, b.date) >= 0 ? a : b)).date;
  const group = dated
    .filter((x) => x.date === latest)
    .map((x) => x.set)
    .sort((a, b) => a.set_index - b.set_index);

  const reps = group.map((s) => s.reps).filter(isNum);
  const loads = group.map((s) => s.load_kg).filter(isNum);

  return {
    date: latest,
    sets: group.map((s) => ({ reps: s.reps, load_kg: s.load_kg, rpe: s.rpe })),
    minReps: reps.length ? Math.min(...reps) : null,
    maxLoad: loads.length ? Math.max(...loads) : null,
  };
}

const fmtSets = (n: number, reps: number, perSide?: boolean): string =>
  `${n} × ${reps}${perSide ? '/side' : ''}`;

/**
 * What to do today for one programmed exercise.
 *
 * The rule reads off the *worst* set last time, because "all sets at the top of
 * the range" is the gate for making the movement harder. Timed holds progress on
 * seconds instead of reps, and everything is capped at the top of the prescribed
 * range so the target never runs away.
 */
export function prescribe(
  exercise: ProgramExercise,
  last: LastPerformance | null,
): Prescription {
  const ladder = exercise.ladder ? LADDERS[exercise.ladder] : null;

  // --- Timed work: progress the hold, not the rep count ---
  if (exercise.repRange === null && exercise.timeSec) {
    const [lo, hi] = exercise.timeSec;
    if (!last || last.minReps === null) {
      return {
        exercise,
        last,
        targetReps: null,
        targetSeconds: lo,
        targetLoad: null,
        action: 'start',
        instruction: `${exercise.sets} × ${lo}s to start.`,
        rationale: ['No history for this hold yet — begin at the bottom of the range.'],
        nextLadderStep: null,
      };
    }
    const held = last.minReps;
    const next = Math.min(held + 5, hi);
    return {
      exercise,
      last,
      targetReps: null,
      targetSeconds: next,
      targetLoad: null,
      action: held >= hi ? 'progress_exercise' : 'add_reps',
      instruction:
        held >= hi
          ? `${hi}s reached — make it harder${ladder ? `: ${nextStep(ladder.steps, null) ?? 'progress the variation'}` : ''}.`
          : `${exercise.sets} × ${next}s (up from ${held}s).`,
      rationale: [`Held ${held}s last time; the range is ${lo}–${hi}s.`],
      nextLadderStep: ladder ? nextStep(ladder.steps, null) : null,
    };
  }

  if (exercise.repRange === null) {
    // Carries and other distance work: nothing to compute, just restate the plan.
    return {
      exercise,
      last,
      targetReps: null,
      targetSeconds: null,
      targetLoad: last?.maxLoad ?? null,
      action: last ? 'repeat' : 'start',
      instruction: exercise.distanceM
        ? `${exercise.sets} × ${exercise.distanceM} m.`
        : `${exercise.sets} sets as prescribed.`,
      rationale: [],
      nextLadderStep: null,
    };
  }

  const [lo, hi] = exercise.repRange;

  // --- No history: start at the bottom of the range ---
  if (!last || last.minReps === null) {
    return {
      exercise,
      last,
      targetReps: lo,
      targetSeconds: null,
      targetLoad: null,
      action: 'start',
      instruction: `${fmtSets(exercise.sets, lo, exercise.perSide)} to start.`,
      rationale: [
        'First time logging this — start at the bottom of the range and build up.',
      ],
      nextLadderStep: null,
    };
  }

  const minReps = last.minReps;
  const load = last.maxLoad;
  const loadNote = load !== null ? ` at ${load} kg` : '';

  // --- Top of the range on every set: make the movement harder ---
  if (minReps >= hi) {
    const step = ladder ? nextStep(ladder.steps, null) : null;
    return {
      exercise,
      last,
      targetReps: lo,
      targetSeconds: null,
      targetLoad: load,
      action: 'progress_exercise',
      instruction: ladder
        ? `Range topped out — move up the ${ladder.label.toLowerCase()} ladder, then back to ${fmtSets(exercise.sets, lo, exercise.perSide)}.`
        : `Range topped out — add load or slow the tempo, then back to ${fmtSets(exercise.sets, lo, exercise.perSide)}.`,
      rationale: [
        `Every set hit ${minReps}${loadNote} last time, the top of the ${lo}–${hi} range.`,
        'Reps reset to the bottom once the movement gets harder. That is the point of the cycle.',
      ],
      nextLadderStep: step,
    };
  }

  // --- Undershot the range: hold, do not add ---
  if (minReps < lo) {
    return {
      exercise,
      last,
      targetReps: lo,
      targetSeconds: null,
      targetLoad: load,
      action: 'back_off',
      instruction: `Repeat ${fmtSets(exercise.sets, lo, exercise.perSide)} — the range was not cleared last time.`,
      rationale: [
        `Worst set was ${minReps}${loadNote}, under the ${lo}-rep floor.`,
        'Adding reps on top of a missed target just compounds the miss.',
      ],
      nextLadderStep: null,
    };
  }

  // --- Inside the range: add a rep ---
  const target = Math.min(minReps + 1, hi);
  return {
    exercise,
    last,
    targetReps: target,
    targetSeconds: null,
    targetLoad: load,
    action: 'add_reps',
    instruction: `${fmtSets(exercise.sets, target, exercise.perSide)}${loadNote}.`,
    rationale: [
      `Worst set was ${minReps}${loadNote} last time; the range is ${lo}–${hi}.`,
      target === hi
        ? 'Clear this on every set and the movement gets harder next time.'
        : 'Add one rep to every set.',
    ],
    nextLadderStep: null,
  };
}

/** Where a ladder goes next. Without a recorded rung, name the whole ladder. */
function nextStep(steps: string[], current: string | null): string | null {
  if (current === null) return steps.join(' → ');
  const i = steps.findIndex((s) => s.toLowerCase() === current.toLowerCase());
  return i >= 0 && i < steps.length - 1 ? steps[i + 1]! : null;
}

// ---------------------------------------------------------------------------
// The 3-week stall rule
// ---------------------------------------------------------------------------

export interface StallCheck {
  stalled: boolean;
  weeksChecked: number;
  improvedExercises: string[];
  detail: string;
}

const bestOf = (s: WorkoutSet): number => {
  if (isNum(s.load_kg) && isNum(s.reps)) return s.load_kg * s.reps;
  if (isNum(s.reps)) return s.reps;
  return 0;
};

/**
 * "Did *something* improve — load, reps, range, tempo, or leverage? If nothing
 * has improved for 3 weeks straight, you need a deload, not more effort."
 *
 * Approximated with what is actually logged: an exercise counts as improved if
 * its best set in the recent window beats its best set from everything before.
 * Tempo and range live in the leverage note rather than the numbers, so this
 * under-reports rather than over-reports — which is the safe direction for a
 * rule whose output is "rest more".
 */
export function detectProgressStall(
  sets: WorkoutSet[],
  setDates: Map<string, ISODate>,
  asOf: ISODate,
  weeks: number = PROGRAM_RULES.STALL_WEEKS,
): StallCheck {
  const cutoff = shift(asOf, -(weeks * 7 - 1));

  const dated = sets
    .map((s) => ({ s, date: setDates.get(s.workout_id) }))
    .filter((x): x is { s: WorkoutSet; date: ISODate } => x.date !== undefined);

  const older = dated.filter((x) => isoCompare(x.date, cutoff) < 0);
  const recent = dated.filter((x) => isoCompare(x.date, cutoff) >= 0);

  // Not enough history to judge: say nothing rather than cry stall.
  if (older.length === 0 || recent.length === 0) {
    return {
      stalled: false,
      weeksChecked: weeks,
      improvedExercises: [],
      detail: 'Not enough training history to judge progression yet.',
    };
  }

  const bestBefore = new Map<string, number>();
  for (const { s } of older) {
    const k = normaliseExercise(s.exercise_name);
    bestBefore.set(k, Math.max(bestBefore.get(k) ?? 0, bestOf(s)));
  }

  const improved = new Set<string>();
  for (const { s } of recent) {
    const k = normaliseExercise(s.exercise_name);
    const prior = bestBefore.get(k);
    // A brand-new exercise is not evidence of progress on the old ones.
    if (prior !== undefined && bestOf(s) > prior) improved.add(s.exercise_name);
  }

  const list = [...improved];
  return {
    stalled: list.length === 0,
    weeksChecked: weeks,
    improvedExercises: list,
    detail: list.length
      ? `${list.length} exercise(s) improved in the last ${weeks} weeks: ${list.slice(0, 3).join(', ')}${list.length > 3 ? '…' : ''}.`
      : `Nothing has improved on load or reps in ${weeks} weeks.`,
  };
}

function shift(date: ISODate, days: number): ISODate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
