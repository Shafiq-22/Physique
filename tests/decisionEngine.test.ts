import { describe, expect, it } from 'vitest';
import {
  evaluateDeload,
  evaluateOverreaching,
  evaluatePhaseTransition,
  evaluateWeekly,
} from '../src/lib/decisionEngine';
import { day, makeLog, makeLogs } from './helpers';
import type { DailyLog } from '../src/lib/types';

// ---------------------------------------------------------------------------
// §6.3 — Weekly rate check, cutting
// ---------------------------------------------------------------------------

describe('evaluateWeekly — cut', () => {
  const trend = (delta: number) => ({ emaNow: 82 + delta, emaPrevWeek: 82 });

  it('calls -0.48 kg at 90% compliance on track', () => {
    const v = evaluateWeekly(trend(-0.48), 'cut', 90);
    expect(v.code).toBe('on_track');
    expect(v.verdict).toBe('On track. Change nothing.');
    expect(v.severity).toBe('info');
  });

  it('calls -0.15 kg at 92% compliance a stall and prescribes one lever', () => {
    const v = evaluateWeekly(trend(-0.15), 'cut', 92);
    expect(v.code).toBe('stall');
    expect(v.verdict).toBe('Stall. Drop 150 kcal OR add ~1,500 steps/day.');
  });

  it('blames adherence, not calories, at -0.15 kg and 60% compliance', () => {
    const v = evaluateWeekly(trend(-0.15), 'cut', 60);
    expect(v.code).toBe('adherence');
    expect(v.verdict).toBe('Adherence is the issue — fix logging/steps before cutting calories.');
  });

  it('calls -0.85 kg too fast and adds calories back', () => {
    const v = evaluateWeekly(trend(-0.85), 'cut', 95);
    expect(v.code).toBe('losing_too_fast');
    expect(v.verdict).toBe('Too fast — muscle risk. Add 200 kcal.');
  });

  it('always shows the numbers behind the verdict', () => {
    const v = evaluateWeekly(trend(-0.48), 'cut', 90);
    expect(v.rationale.length).toBeGreaterThan(0);
    expect(v.snapshot).toMatchObject({
      phase: 'cut',
      deltaKg: -0.48,
      compliancePct: 90,
      targetBandKg: [-0.55, -0.4],
    });
  });

  it('expresses the rate as %bodyweight when bodyweight is known', () => {
    const v = evaluateWeekly({ emaNow: 81.52, emaPrevWeek: 82, bodyweightKg: 82 }, 'cut', 90);
    expect(v.snapshot.deltaPctBodyweight).toBeCloseTo(-0.59, 2);
  });
});

describe('evaluateWeekly — gain and maintain', () => {
  it('calls a +0.18 kg week on track while gaining', () => {
    expect(evaluateWeekly({ emaNow: 82.18, emaPrevWeek: 82 }, 'gain', 90).code).toBe('on_track');
  });

  it('adds calories when gaining too slowly with good adherence', () => {
    const v = evaluateWeekly({ emaNow: 82.02, emaPrevWeek: 82 }, 'gain', 90);
    expect(v.code).toBe('gain_too_slow');
    expect(v.verdict).toBe('Gaining too slowly. Add 150 kcal.');
  });

  it('blames adherence when gaining too slowly with poor adherence', () => {
    expect(evaluateWeekly({ emaNow: 82.02, emaPrevWeek: 82 }, 'gain', 55).code).toBe('adherence');
  });

  it('cuts calories when gaining too fast', () => {
    const v = evaluateWeekly({ emaNow: 82.5, emaPrevWeek: 82 }, 'gain', 90);
    expect(v.code).toBe('gain_too_fast');
    expect(v.verdict).toBe('Gaining too fast — fat risk. Drop 150 kcal.');
  });

  it('flags maintenance drift beyond 0.4 kg', () => {
    expect(evaluateWeekly({ emaNow: 82.5, emaPrevWeek: 82 }, 'maintain', 90).code).toBe(
      'maintain_drift',
    );
    expect(evaluateWeekly({ emaNow: 82.1, emaPrevWeek: 82 }, 'maintain', 90).code).toBe('on_track');
  });
});

// ---------------------------------------------------------------------------
// §6.4 — Phase transitions
// ---------------------------------------------------------------------------

describe('evaluatePhaseTransition', () => {
  it('ends the cut when waist reaches 81.5 cm', () => {
    const v = evaluatePhaseTransition(
      { waist_cm: 81.5, bodyfat_pct: null, measured_on: day(0) },
      'cut',
    )!;
    expect(v.code).toBe('end_cut');
    expect(v.verdict).toContain('Deficit target reached');
    expect(v.verdict).toContain('LEAN GAIN');
  });

  it('ends the cut on body fat alone', () => {
    expect(
      evaluatePhaseTransition({ waist_cm: 88, bodyfat_pct: 13.5, measured_on: day(0) }, 'cut')!.code,
    ).toBe('end_cut');
  });

  it('calls a mini-cut when body fat reaches 15.2% while gaining', () => {
    const v = evaluatePhaseTransition(
      { waist_cm: 83, bodyfat_pct: 15.2, measured_on: day(0) },
      'gain',
    )!;
    expect(v.code).toBe('bulk_ceiling');
    expect(v.verdict).toContain('mini-cut');
  });

  it('says nothing when the phase should simply continue', () => {
    expect(
      evaluatePhaseTransition({ waist_cm: 86, bodyfat_pct: 18, measured_on: day(0) }, 'cut'),
    ).toBeNull();
    expect(
      evaluatePhaseTransition({ waist_cm: 83, bodyfat_pct: 13, measured_on: day(0) }, 'gain'),
    ).toBeNull();
    expect(evaluatePhaseTransition(null, 'cut')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// §6.5 — Deload
// ---------------------------------------------------------------------------

describe('evaluateDeload', () => {
  /** 21 days: healthy until the closing stretch, which raises three flags. */
  const threeFlagLogs = (): DailyLog[] =>
    makeLogs(21, (i) => ({
      // Flag 1: RHR clears its trailing 7-day average by >5 bpm for 3 straight days.
      resting_hr: i >= 18 ? 64 : 55,
      // Flag 3: three nights under 6 hours.
      sleep_hours: i >= 18 ? 5 : 8,
      // Flag 5: mood under 5 on four days.
      mood_1_10: i >= 17 ? 4 : 7,
    }));

  it('calls a deload once three fatigue flags are up', () => {
    const v = evaluateDeload({ logs: threeFlagLogs(), daysSinceLastDeload: 20 });
    expect(v.code).toBe('deload_now');
    expect(v.verdict).toBe('Deload this week (halve volume, keep intensity).');
    expect(v.snapshot.flagCount).toBeGreaterThanOrEqual(3);
    expect(v.snapshot.flagsFired).toEqual(
      expect.arrayContaining(['rhr_elevated', 'short_sleep', 'low_mood']),
    );
  });

  it('warns that a deload is due at 44 days with no flags up', () => {
    const healthy = makeLogs(21, () => ({ resting_hr: 55, sleep_hours: 8, mood_1_10: 7 }));
    const v = evaluateDeload({ logs: healthy, daysSinceLastDeload: 44 });
    expect(v.code).toBe('deload_soon');
    expect(v.verdict).toBe('Deload due soon — plan it.');
    expect(v.snapshot.flagCount).toBe(0);
  });

  it('forces a deload at the 56-day limit regardless of flags', () => {
    const healthy = makeLogs(21, () => ({ resting_hr: 55, sleep_hours: 8, mood_1_10: 7 }));
    expect(evaluateDeload({ logs: healthy, daysSinceLastDeload: 56 }).code).toBe('deload_now');
  });

  it('leaves training alone when recovery is holding', () => {
    const healthy = makeLogs(21, () => ({ resting_hr: 55, sleep_hours: 8, mood_1_10: 7 }));
    expect(evaluateDeload({ logs: healthy, daysSinceLastDeload: 10 }).code).toBe('no_deload');
  });

  it('detects RPE creep at a matched load', () => {
    const healthy = makeLogs(21, () => ({ resting_hr: 55, sleep_hours: 8, mood_1_10: 7 }));
    const setDates = new Map([
      ['w1', day(5)],
      ['w2', day(19)],
    ]);
    const v = evaluateDeload({
      logs: healthy,
      daysSinceLastDeload: 10,
      setDates,
      sets: [
        {
          id: 's1', user_id: 'u', workout_id: 'w1', exercise_name: 'Bench Press',
          set_index: 1, load_kg: 80, leverage: null, reps: 5, rpe: 7, is_pr: false,
        },
        {
          id: 's2', user_id: 'u', workout_id: 'w2', exercise_name: 'Bench Press',
          set_index: 1, load_kg: 80, leverage: null, reps: 5, rpe: 9.5, is_pr: false,
        },
      ],
    });
    expect(v.rationale.join(' ')).toContain('bench press at 80 kg');
  });
});

// ---------------------------------------------------------------------------
// §6.6 — Overreaching safety net
// ---------------------------------------------------------------------------

describe('evaluateOverreaching', () => {
  it('forces a maintenance break on RHR +6 for 8 days, low mood, and cold hands', () => {
    // 45 days: a calm month establishes the baseline, then the last 14 go wrong.
    const logs = makeLogs(45, (i) => ({
      resting_hr: i >= 37 ? 61 : 55, // +6 bpm on the last 8 days
      sleep_hours: 8,
      energy_1_10: 7,
      mood_1_10: i >= 40 ? 4 : 7, // under 5 on the last 5 days
      cold_hands_feet: i >= 40,
    }));

    const v = evaluateOverreaching({ logs })!;
    expect(v).not.toBeNull();
    expect(v.code).toBe('overreaching');
    expect(v.severity).toBe('high');
    expect(v.verdict).toBe('Immediate 7–14 day maintenance break. Non-negotiable.');
    expect(v.snapshot.flagsFired).toEqual(
      expect.arrayContaining(['autonomic', 'affect_down', 'cold_hands_feet']),
    );
  });

  it('stays silent below three signals', () => {
    const logs = makeLogs(45, (i) => ({
      resting_hr: i >= 37 ? 61 : 55,
      sleep_hours: 8,
      energy_1_10: 7,
      mood_1_10: 7,
      cold_hands_feet: false,
    }));
    expect(evaluateOverreaching({ logs })).toBeNull();
  });

  it('counts declining performance as one of the signals', () => {
    const logs = makeLogs(45, (i) => ({
      resting_hr: i >= 37 ? 61 : 55,
      sleep_hours: 8,
      energy_1_10: 7,
      mood_1_10: 7,
      intrusive_food_thoughts: i >= 40,
    }));
    // autonomic + intrusive thoughts = 2, still silent...
    expect(evaluateOverreaching({ logs })).toBeNull();
    // ...until declining lifts make three.
    expect(evaluateOverreaching({ logs, performanceDeclining: true })!.code).toBe('overreaching');
  });

  it('handles an empty log history', () => {
    expect(evaluateOverreaching({ logs: [] })).toBeNull();
    expect(evaluateOverreaching({ logs: [makeLog(day(0))] })).toBeNull();
  });
});
