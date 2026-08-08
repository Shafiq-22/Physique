import { describe, expect, it } from 'vitest';
import { detectProgressStall, lastPerformanceOf, prescribe } from '../src/lib/progression';
import {
  SESSIONS,
  intervalForWeek,
  isHighRiskWindow,
  sessionForDate,
  sessionByLabel,
  type ProgramExercise,
} from '../src/lib/program';
import type { ISODate, WorkoutSet } from '../src/lib/types';
import { day } from './helpers';

const ex = (over: Partial<ProgramExercise> = {}): ProgramExercise => ({
  name: 'Incline push-up',
  sets: 4,
  repRange: [6, 12],
  rpe: 8,
  restSec: 120,
  kind: 'primary',
  ladder: 'pushup',
  ...over,
});

const mkSet = (
  workout_id: string,
  exercise_name: string,
  set_index: number,
  reps: number | null,
  load_kg: number | null = null,
): WorkoutSet => ({
  id: `${workout_id}-${exercise_name}-${set_index}`,
  user_id: 'u',
  workout_id,
  exercise_name,
  set_index,
  load_kg,
  leverage: null,
  reps,
  rpe: 8,
  is_pr: false,
});

describe('double progression', () => {
  it('starts at the bottom of the range with no history', () => {
    const p = prescribe(ex(), null);
    expect(p.action).toBe('start');
    expect(p.targetReps).toBe(6);
    expect(p.instruction).toContain('4 × 6');
  });

  it('adds one rep when inside the range', () => {
    const p = prescribe(ex(), {
      date: day(0),
      sets: [],
      minReps: 8,
      maxLoad: null,
    });
    expect(p.action).toBe('add_reps');
    expect(p.targetReps).toBe(9);
    expect(p.instruction).toContain('4 × 9');
  });

  it('keys on the WORST set, not the best', () => {
    // 12, 12, 12, 7 is not a topped-out range — the 7 governs.
    const sets = [
      mkSet('w1', 'Incline push-up', 1, 12),
      mkSet('w1', 'Incline push-up', 2, 12),
      mkSet('w1', 'Incline push-up', 3, 12),
      mkSet('w1', 'Incline push-up', 4, 7),
    ];
    const last = lastPerformanceOf('Incline push-up', sets, new Map([['w1', day(0)]]))!;
    expect(last.minReps).toBe(7);

    const p = prescribe(ex(), last);
    expect(p.action).toBe('add_reps');
    expect(p.targetReps).toBe(8);
  });

  it('makes the movement harder once every set tops the range', () => {
    const p = prescribe(ex(), { date: day(0), sets: [], minReps: 12, maxLoad: null });
    expect(p.action).toBe('progress_exercise');
    // Reps reset to the bottom after the movement gets harder.
    expect(p.targetReps).toBe(6);
    expect(p.instruction).toContain('ladder');
    expect(p.nextLadderStep).toContain('Floor');
  });

  it('holds rather than adding when the range was missed', () => {
    const p = prescribe(ex(), { date: day(0), sets: [], minReps: 4, maxLoad: null });
    expect(p.action).toBe('back_off');
    expect(p.targetReps).toBe(6);
    expect(p.rationale.join(' ')).toContain('under the 6-rep floor');
  });

  it('never targets past the top of the range', () => {
    const p = prescribe(ex(), { date: day(0), sets: [], minReps: 11, maxLoad: null });
    expect(p.targetReps).toBe(12);
  });

  it('carries the working load forward', () => {
    const p = prescribe(ex({ name: 'Romanian deadlift', ladder: 'rdl' }), {
      date: day(0),
      sets: [],
      minReps: 9,
      maxLoad: 24,
    });
    expect(p.targetLoad).toBe(24);
    expect(p.instruction).toContain('24 kg');
  });

  it('progresses timed holds on seconds', () => {
    const hold = ex({ name: 'Hollow hold', repRange: null, timeSec: [20, 45], sets: 3 });
    expect(prescribe(hold, null).targetSeconds).toBe(20);

    const p = prescribe(hold, { date: day(0), sets: [], minReps: 25, maxLoad: null });
    expect(p.targetSeconds).toBe(30);
    expect(p.instruction).toContain('30s');
  });

  it('marks per-side work in the instruction', () => {
    const p = prescribe(ex({ name: 'Bulgarian split squat', perSide: true, repRange: [8, 12] }), null);
    expect(p.instruction).toContain('/side');
  });
});

describe('lastPerformanceOf', () => {
  const setDates = new Map<string, ISODate>([
    ['w1', day(0)],
    ['w2', day(7)],
  ]);
  const sets = [
    mkSet('w1', 'Pull-up progression', 1, 3),
    mkSet('w2', 'Pull-up progression', 1, 5),
    mkSet('w2', 'Pull-up progression', 2, 4),
    mkSet('w1', 'Lateral raise', 1, 15),
  ];

  it('takes only the most recent session', () => {
    const last = lastPerformanceOf('Pull-up progression', sets, setDates)!;
    expect(last.date).toBe(day(7));
    expect(last.sets).toHaveLength(2);
    expect(last.minReps).toBe(4);
  });

  it('can look strictly before a date', () => {
    const last = lastPerformanceOf('Pull-up progression', sets, setDates, day(7))!;
    expect(last.date).toBe(day(0));
  });

  it('returns null for an exercise never performed', () => {
    expect(lastPerformanceOf('Nordic curl', sets, setDates)).toBeNull();
  });
});

describe('the 3-week stall rule', () => {
  const dates = new Map<string, ISODate>([
    ['old', day(0)],
    ['recent', day(25)],
  ]);

  it('flags a stall when nothing beats its old best', () => {
    const sets = [
      mkSet('old', 'Incline push-up', 1, 10),
      mkSet('recent', 'Incline push-up', 1, 9),
    ];
    const r = detectProgressStall(sets, dates, day(25));
    expect(r.stalled).toBe(true);
    expect(r.detail).toContain('Nothing has improved');
  });

  it('does not flag when something improved', () => {
    const sets = [
      mkSet('old', 'Incline push-up', 1, 10),
      mkSet('recent', 'Incline push-up', 1, 11),
    ];
    const r = detectProgressStall(sets, dates, day(25));
    expect(r.stalled).toBe(false);
    expect(r.improvedExercises).toContain('Incline push-up');
  });

  it('counts added load as improvement even when reps drop', () => {
    const sets = [
      mkSet('old', 'Romanian deadlift', 1, 12, 20),
      mkSet('recent', 'Romanian deadlift', 1, 8, 32),
    ];
    expect(detectProgressStall(sets, dates, day(25)).stalled).toBe(false);
  });

  it('stays silent without enough history', () => {
    const r = detectProgressStall([mkSet('recent', 'Push-up', 1, 10)], dates, day(25));
    expect(r.stalled).toBe(false);
    expect(r.detail).toContain('Not enough training history');
  });

  it('does not treat a brand-new exercise as progress on the old ones', () => {
    const sets = [
      mkSet('old', 'Incline push-up', 1, 10),
      mkSet('recent', 'Incline push-up', 1, 9),
      mkSet('recent', 'Nordic curl', 1, 5),
    ];
    expect(detectProgressStall(sets, dates, day(25)).stalled).toBe(true);
  });
});

describe('the weekly schedule', () => {
  it('maps each weekday to its session', () => {
    // 2026-08-10 is a Monday.
    expect(sessionForDate('2026-08-10').id).toBe('upper_a');
    expect(sessionForDate('2026-08-11').id).toBe('lower_a');
    expect(sessionForDate('2026-08-12').id).toBe('upper_b');
    expect(sessionForDate('2026-08-13').id).toBe('conditioning');
    expect(sessionForDate('2026-08-14').id).toBe('power');
    expect(sessionForDate('2026-08-15').id).toBe('upper_c');
    expect(sessionForDate('2026-08-16').id).toBe('rest');
  });

  it('has no lifting on Thursday or Sunday', () => {
    expect(SESSIONS.rest.exercises).toHaveLength(0);
    expect(SESSIONS.conditioning.exercises.every((e) => e.kind === 'accessory')).toBe(true);
  });

  it('resolves a stored session label back to the programme', () => {
    expect(sessionByLabel('Upper A')?.id).toBe('upper_a');
    expect(sessionByLabel('upper c')?.id).toBe('upper_c');
    expect(sessionByLabel('Freestyle')).toBeNull();
  });

  it('keeps every prescribed RPE inside the 6–9 band', () => {
    for (const s of Object.values(SESSIONS)) {
      for (const e of s.exercises) {
        const vals = Array.isArray(e.rpe) ? e.rpe : [e.rpe];
        for (const v of vals) {
          expect(v).toBeGreaterThanOrEqual(6);
          expect(v).toBeLessThanOrEqual(9);
        }
      }
    }
  });
});

describe('interval progression', () => {
  it('steps through the skipping ladder over the first 12 weeks', () => {
    expect(intervalForWeek(0)!.protocol).toContain('20 s');
    expect(intervalForWeek(3)!.protocol).toContain('30 s');
    expect(intervalForWeek(6)!.protocol).toContain('45 s');
    expect(intervalForWeek(11)!.protocol).toContain('60 s');
  });

  it('moves to hill sprints, then flat sprints', () => {
    expect(intervalForWeek(20)!.title).toBe('Hill sprints');
    expect(intervalForWeek(45)!.title).toBe('Flat sprints & VO₂');
  });

  it('returns null before the programme starts', () => {
    expect(intervalForWeek(null)).toBeNull();
  });

  it('marks months 5–9 as the high-risk window', () => {
    expect(isHighRiskWindow(10)).toBe(false); // month 3
    expect(isHighRiskWindow(20)).toBe(true); // month 5
    expect(isHighRiskWindow(36)).toBe(true); // month 9
    expect(isHighRiskWindow(45)).toBe(false); // month 11
  });
});
