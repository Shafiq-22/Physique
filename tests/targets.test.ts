import { describe, expect, it } from 'vitest';
import { comparePhases, computePhaseTargets, weeksToGoal } from '../src/lib/targets';
import { evaluateWeekly } from '../src/lib/decisionEngine';
import { MIN_SAFE_KCAL, PHASE_TARGETS } from '../src/lib/config';

describe('computePhaseTargets — scaling with bodyweight', () => {
  it('reproduces the blueprint figures at the reference weight of 82 kg', () => {
    const cut = computePhaseTargets('cut', 82, 2850, 'measured');

    // -0.67% to -0.49% of 82 kg is the blueprint's -0.55 to -0.40 kg/week.
    expect(cut.weeklyChangeKg[0]).toBeCloseTo(-0.55, 2);
    expect(cut.weeklyChangeKg[1]).toBeCloseTo(-0.4, 2);
    // 2.1 g/kg is the blueprint's 170 g.
    expect(cut.protein_g).toBe(172);
  });

  it('scales the rate band with bodyweight rather than holding it fixed', () => {
    const light = computePhaseTargets('cut', 60, 2400);
    const heavy = computePhaseTargets('cut', 110, 3200);

    // The same 0.5 kg/week is a very different ask at 60 kg and 110 kg.
    expect(Math.abs(light.weeklyChangeKg[0])).toBeLessThan(Math.abs(heavy.weeklyChangeKg[0]));
    expect(light.weeklyChangeKg[1]).toBeCloseTo(-0.294, 2);
    expect(heavy.weeklyChangeKg[1]).toBeCloseTo(-0.539, 2);
  });

  it('scales protein with bodyweight', () => {
    expect(computePhaseTargets('cut', 60, 2400).protein_g).toBe(126);
    expect(computePhaseTargets('cut', 110, 3200).protein_g).toBe(231);
  });

  it('derives calories from measured expenditure, not a constant', () => {
    // Two people at the same weight with different metabolisms get different
    // targets — the whole point of learning TDEE.
    const slow = computePhaseTargets('cut', 82, 2400, 'measured');
    const fast = computePhaseTargets('cut', 82, 3200, 'measured');
    expect(fast.kcal - slow.kcal).toBe(800);
  });

  it('sets the deficit to hit the middle of the band', () => {
    const cut = computePhaseTargets('cut', 82, 2850, 'measured');
    // Midpoint -0.58% of 82 kg = -0.476 kg/wk; x 7700 / 7 = -523 kcal/day.
    expect(cut.targetWeeklyChangeKg).toBeCloseTo(-0.476, 3);
    expect(cut.kcal).toBe(2325);
  });

  it('puts a surplus on a gain phase and nothing on maintain', () => {
    expect(computePhaseTargets('gain', 82, 2850).kcal).toBeGreaterThan(2850);
    expect(computePhaseTargets('maintain', 82, 2850).kcal).toBe(2850);
  });

  it('never prescribes an unsafe calorie floor', () => {
    const tiny = computePhaseTargets('mini_cut', 45, 1400);
    expect(tiny.kcal).toBeGreaterThanOrEqual(MIN_SAFE_KCAL);
    expect(tiny.rationale.join(' ')).toContain('Floored');
  });

  it('falls back to the plan defaults before any weight is logged', () => {
    const t = computePhaseTargets('cut', null, null);
    expect(t.tdeeSource).toBe('fallback');
    expect(t.kcal).toBe(PHASE_TARGETS.cut.kcal);
    expect(t.protein_g).toBe(PHASE_TARGETS.cut.protein_g);
  });

  it('always explains where the numbers came from', () => {
    const t = computePhaseTargets('cut', 82, 2850, 'measured');
    expect(t.rationale.join(' ')).toContain('82 kg');
    expect(t.rationale.join(' ')).toContain('learned from your intake');
  });
});

describe('recomp phase', () => {
  it('targets a near-flat scale weight', () => {
    const r = computePhaseTargets('recomp', 82, 2850, 'measured');
    expect(r.weeklyChangeKg[0]).toBeLessThan(0);
    expect(r.weeklyChangeKg[1]).toBeGreaterThan(0);
    expect(Math.abs(r.targetWeeklyChangeKg)).toBeLessThan(0.02);
    // Flat weight means eating at maintenance.
    expect(r.kcal).toBe(2850);
  });

  it('carries high protein, since the whole phase depends on it', () => {
    expect(computePhaseTargets('recomp', 82, 2850).protein_g).toBe(180);
  });

  it('calls a steady week a success and points at the tape', () => {
    const v = evaluateWeekly({ emaNow: 82.05, emaPrevWeek: 82, bodyweightKg: 82 }, 'recomp', 90);
    expect(v.code).toBe('on_track');
    expect(v.verdict).toContain('tape');
  });

  it('flags real drift during a recomp', () => {
    const v = evaluateWeekly({ emaNow: 82.7, emaPrevWeek: 82, bodyweightKg: 82 }, 'recomp', 90);
    expect(v.code).toBe('maintain_drift');
    expect(v.snapshot.driftLimitKg).toBeCloseTo(0.41, 2);
  });
});

describe('evaluateWeekly with a weight-derived band', () => {
  it('uses the supplied band over the config constants', () => {
    const heavy = computePhaseTargets('cut', 110, 3200);
    // -0.6 kg/week is on track at 110 kg...
    expect(
      evaluateWeekly({ emaNow: 109.4, emaPrevWeek: 110 }, 'cut', 90, heavy.weeklyChangeKg).code,
    ).toBe('on_track');

    // ...but too fast at 60 kg.
    const light = computePhaseTargets('cut', 60, 2400);
    expect(
      evaluateWeekly({ emaNow: 59.4, emaPrevWeek: 60 }, 'cut', 90, light.weeklyChangeKg).code,
    ).toBe('losing_too_fast');
  });

  it('falls back to the config band when none is supplied', () => {
    expect(evaluateWeekly({ emaNow: 81.52, emaPrevWeek: 82 }, 'cut', 90).code).toBe('on_track');
  });
});

describe('comparePhases', () => {
  it('returns every phase costed at the current weight', () => {
    const all = comparePhases(82, 2850, 'measured');
    expect(all.map((p) => p.phase)).toEqual(['cut', 'maintain', 'gain', 'mini_cut', 'recomp']);
    expect(new Set(all.map((p) => p.kcal)).size).toBeGreaterThan(1);
  });
});

describe('weeksToGoal', () => {
  it('estimates the weeks to a goal weight', () => {
    expect(weeksToGoal(82, 78, -0.4755)).toBe(9);
  });

  it('returns null when the phase moves the wrong way', () => {
    expect(weeksToGoal(82, 78, 0.2)).toBeNull();
    expect(weeksToGoal(82, 78, 0)).toBeNull();
  });

  it('returns zero when already there', () => {
    expect(weeksToGoal(78, 78, -0.4)).toBe(0);
  });
});
