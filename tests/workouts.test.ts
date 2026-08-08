import { describe, expect, it } from 'vitest';
import { computeStrengthTrend, detectPR, buildHistory, flagSessionPRs } from '../src/lib/workouts';
import type { SetLike } from '../src/lib/workouts';
import type { ISODate, WorkoutSet } from '../src/lib/types';
import { day } from './helpers';

const s = (exercise_name: string, load_kg: number | null, reps: number | null): SetLike => ({
  exercise_name,
  load_kg,
  reps,
});

describe('detectPR', () => {
  const history = buildHistory([s('Bench Press', 80, 5), s('Bench Press', 60, 10)]);

  it('flags a set that beats the best total work', () => {
    // 85 x 8 = 680 kg, over the previous best of 600 kg (60 x 10).
    const r = detectPR(s('Bench Press', 85, 8), history);
    expect(r.isPr).toBe(true);
    expect(r.reason).toContain('680 kg total work');
  });

  it('flags more reps at a heavy load even when total work is lower', () => {
    // 80 x 6 = 480 kg, below the 600 kg volume best, but 6 reps at 80 beats 5.
    const r = detectPR(s('Bench Press', 80, 6), history);
    expect(r.isPr).toBe(true);
    expect(r.reason).toContain('6 reps at 80 kg');
  });

  it('does not flag an ordinary working set', () => {
    expect(detectPR(s('Bench Press', 70, 5), history).isPr).toBe(false);
  });

  it('ignores case and whitespace in exercise names', () => {
    expect(detectPR(s('  bench press ', 85, 8), history).isPr).toBe(true);
  });

  it('never flags the first set of a new exercise', () => {
    expect(detectPR(s('Overhead Press', 200, 20), history).isPr).toBe(false);
  });

  it('uses reps alone for bodyweight work', () => {
    const bw = buildHistory([s('Pull-up', null, 8)]);
    expect(detectPR(s('Pull-up', null, 10), bw).isPr).toBe(true);
    expect(detectPR(s('Pull-up', null, 7), bw).isPr).toBe(false);
  });

  it('flags a new heaviest load even at low reps', () => {
    // 90 x 3 = 270 kg of work, far under the 600 kg best, but 90 kg is heavier
    // than anything lifted before.
    const r = detectPR(s('Bench Press', 90, 3), history);
    expect(r.isPr).toBe(true);
    expect(r.reason).toContain('heaviest you have lifted');
  });

  it('does not treat reps at a lighter load as a PR', () => {
    // 12 reps at 40 kg beats nothing: 40 kg is lighter than any logged load,
    // and 480 kg of work is under the 600 kg best.
    expect(detectPR(s('Bench Press', 40, 12), history).isPr).toBe(false);
  });
});

describe('flagSessionPRs', () => {
  it('flags only the best set when several clear the old record', () => {
    const prior = [s('Squat', 100, 5)];
    const session = [s('Squat', 110, 5), s('Squat', 112, 5), s('Squat', 105, 5)];

    const flags = flagSessionPRs(session, prior);
    expect(flags.map((f) => f.isPr)).toEqual([true, true, false]);
  });

  it('returns one result per set, in order', () => {
    const flags = flagSessionPRs([s('Row', 60, 8), s('Curl', 20, 10)], [s('Row', 50, 8)]);
    expect(flags).toHaveLength(2);
    expect(flags[0]!.isPr).toBe(true);
    expect(flags[1]!.isPr).toBe(false); // no Curl history
  });
});

describe('computeStrengthTrend', () => {
  const mkSet = (workout_id: string, load: number, reps: number): WorkoutSet => ({
    id: `s-${workout_id}-${load}`,
    user_id: 'u',
    workout_id,
    exercise_name: 'Squat',
    set_index: 1,
    load_kg: load,
    leverage: null,
    reps,
    rpe: 8,
    is_pr: false,
  });

  const asOf = day(20) as ISODate;

  it('detects two consecutive weeks of decline', () => {
    const dates = new Map([
      ['w0', day(6)],
      ['w1', day(13)],
      ['w2', day(20)],
    ]);
    const sets = [mkSet('w0', 100, 5), mkSet('w1', 92, 5), mkSet('w2', 85, 5)];

    const t = computeStrengthTrend(sets, dates, asOf);
    expect(t.declining).toBe(true);
    expect(t.weeklyBest).toEqual([500, 460, 425]);
  });

  it('does not call one down week a decline', () => {
    const dates = new Map([
      ['w0', day(6)],
      ['w1', day(13)],
      ['w2', day(20)],
    ]);
    const sets = [mkSet('w0', 100, 5), mkSet('w1', 105, 5), mkSet('w2', 95, 5)];
    expect(computeStrengthTrend(sets, dates, asOf).declining).toBe(false);
  });

  it('stays silent without three weeks of data', () => {
    const dates = new Map([['w2', day(20)]]);
    const t = computeStrengthTrend([mkSet('w2', 100, 5)], dates, asOf);
    expect(t.declining).toBe(false);
    expect(t.detail).toContain('Not enough training history');
  });
});
