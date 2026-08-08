/**
 * Pure workout analysis: personal-record detection and the strength trend that
 * feeds the overreaching safety net. No I/O — everything is derived from the
 * sets handed in.
 */

import { isoCompare } from './dates';
import { shiftISO } from './analytics';
import type { ISODate, WorkoutSet } from './types';

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Exercise names are user-typed, so match them case- and whitespace-insensitively. */
export const normaliseExercise = (name: string): string => name.trim().toLowerCase();

/** The minimum shape PR detection needs — works for saved rows and unsaved drafts. */
export interface SetLike {
  exercise_name: string;
  load_kg: number | null;
  reps: number | null;
}

export interface PRResult {
  isPr: boolean;
  /** Why it counts, for the badge tooltip. Empty when not a PR. */
  reason: string;
}

interface ExerciseHistory {
  bestVolume: number;
  /** Best reps ever achieved at each exact load. */
  bestRepsAtLoad: Map<number, number>;
  heaviestLoad: number;
  bestBodyweightReps: number;
  count: number;
}

function emptyHistory(): ExerciseHistory {
  return {
    bestVolume: 0,
    bestRepsAtLoad: new Map(),
    heaviestLoad: 0,
    bestBodyweightReps: 0,
    count: 0,
  };
}

function absorb(h: ExerciseHistory, s: SetLike): void {
  h.count++;
  if (isNum(s.load_kg) && isNum(s.reps)) {
    h.bestVolume = Math.max(h.bestVolume, s.load_kg * s.reps);
    h.heaviestLoad = Math.max(h.heaviestLoad, s.load_kg);
    h.bestRepsAtLoad.set(s.load_kg, Math.max(h.bestRepsAtLoad.get(s.load_kg) ?? 0, s.reps));
  } else if (isNum(s.reps)) {
    h.bestBodyweightReps = Math.max(h.bestBodyweightReps, s.reps);
  }
}

/** Build per-exercise history from previously performed sets. */
export function buildHistory(sets: SetLike[]): Map<string, ExerciseHistory> {
  const map = new Map<string, ExerciseHistory>();
  for (const s of sets) {
    const key = normaliseExercise(s.exercise_name);
    const h = map.get(key) ?? emptyHistory();
    absorb(h, s);
    map.set(key, h);
  }
  return map;
}

/**
 * Is this set a personal record for its exercise?
 *
 * Three independent criteria:
 *   1. total work (load × reps) beats anything done before;
 *   2. more reps at *exactly* this load than ever before at it;
 *   3. a heavier load than has ever been lifted for this exercise.
 *
 * Criteria 2 and 3 exist because volume alone misses real progress: 5 reps at
 * 100 kg is a PR even though its volume trails 12 reps at 60 kg. Criterion 2
 * matches on the exact load rather than "this load or heavier" — comparing 12
 * reps at 40 kg against 10 reps at 60 kg would flag strictly easier work as a
 * record.
 *
 * A first-ever set is never a PR — there is no history to beat, and flagging
 * every new exercise would make the badge meaningless.
 */
export function detectPR(set: SetLike, history: Map<string, ExerciseHistory>): PRResult {
  const h = history.get(normaliseExercise(set.exercise_name));
  if (!h || h.count === 0) return { isPr: false, reason: '' };

  if (!isNum(set.reps) || set.reps <= 0) return { isPr: false, reason: '' };

  // Bodyweight / leverage work: reps are the only axis.
  if (!isNum(set.load_kg)) {
    return set.reps > h.bestBodyweightReps && h.bestBodyweightReps > 0
      ? { isPr: true, reason: `${set.reps} reps beats your previous best of ${h.bestBodyweightReps}.` }
      : { isPr: false, reason: '' };
  }

  const volume = set.load_kg * set.reps;
  if (h.bestVolume > 0 && volume > h.bestVolume) {
    return {
      isPr: true,
      reason: `${Math.round(volume)} kg total work beats your previous best of ${Math.round(h.bestVolume)} kg.`,
    };
  }

  const bestAtThisLoad = h.bestRepsAtLoad.get(set.load_kg);
  if (bestAtThisLoad !== undefined && set.reps > bestAtThisLoad) {
    return {
      isPr: true,
      reason: `${set.reps} reps at ${set.load_kg} kg beats your previous best of ${bestAtThisLoad}.`,
    };
  }

  if (h.heaviestLoad > 0 && set.load_kg > h.heaviestLoad) {
    return {
      isPr: true,
      reason: `${set.load_kg} kg is the heaviest you have lifted, past ${h.heaviestLoad} kg.`,
    };
  }

  return { isPr: false, reason: '' };
}

/**
 * Flag a whole session against prior history.
 *
 * Sets are evaluated in order and folded into the running history, so a later
 * set in the same session must beat the earlier ones too — otherwise three sets
 * across the old best would all light up as PRs.
 */
export function flagSessionPRs(sets: SetLike[], priorSets: SetLike[]): PRResult[] {
  const history = buildHistory(priorSets);
  const out: PRResult[] = [];

  for (const s of sets) {
    const result = detectPR(s, history);
    out.push(result);

    const key = normaliseExercise(s.exercise_name);
    const h = history.get(key) ?? emptyHistory();
    absorb(h, s);
    history.set(key, h);
  }

  return out;
}

// ---------------------------------------------------------------------------
// Strength trend — feeds evaluateOverreaching's "performance declining" flag
// ---------------------------------------------------------------------------

const bestVolumeOf = (sets: SetLike[]): number => {
  let best = 0;
  for (const s of sets) {
    if (isNum(s.load_kg) && isNum(s.reps)) best = Math.max(best, s.load_kg * s.reps);
    else if (isNum(s.reps)) best = Math.max(best, s.reps);
  }
  return best;
};

export interface StrengthTrend {
  declining: boolean;
  weeklyBest: number[];
  detail: string;
}

/**
 * Has top-set performance fallen for two consecutive weeks?
 *
 * Compares the best set of each of the last three weeks. Both recent weeks must
 * sit below the reference week — one bad session is noise, a two-week slide
 * during a deficit is the signal the overreaching rule cares about.
 */
export function computeStrengthTrend(
  sets: WorkoutSet[],
  setDates: Map<string, ISODate>,
  asOf: ISODate,
): StrengthTrend {
  const weekly: number[] = [];

  // weekly[0] is the oldest of the three windows.
  for (let w = 2; w >= 0; w--) {
    const end = shiftISO(asOf, -7 * w);
    const start = shiftISO(end, -6);
    const inWeek = sets.filter((s) => {
      const d = setDates.get(s.workout_id);
      return d !== undefined && isoCompare(d, start) >= 0 && isoCompare(d, end) <= 0;
    });
    weekly.push(bestVolumeOf(inWeek));
  }

  const [ref, mid, now] = weekly as [number, number, number];
  const haveData = ref > 0 && mid > 0 && now > 0;
  const declining = haveData && mid < ref && now < mid;

  return {
    declining,
    weeklyBest: weekly,
    detail: haveData
      ? `Best set by week: ${weekly.map((v) => Math.round(v)).join(' → ')}.`
      : 'Not enough training history to judge a trend.',
  };
}
