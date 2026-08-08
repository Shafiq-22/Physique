/**
 * Weight-derived phase targets.
 *
 * Pure functions that turn "what phase am I in, what do I weigh, what does my
 * metabolism actually cost" into calories, protein and a weekly rate band.
 *
 * The point is that none of this is a constant. A 2,300 kcal cut is only correct
 * for one person at one weight on one day; a 0.5 kg/week loss is gentle at 100 kg
 * and aggressive at 60 kg. Everything here scales off current bodyweight and
 * measured expenditure, falling back to textbook figures only when there is not
 * yet enough data to do better.
 */

import {
  ENERGY,
  MIN_SAFE_KCAL,
  PHASE_RULES,
  PHASE_TARGETS,
  PROTEIN_G_PER_KG_MAX,
} from './config';
import type { PhaseType } from './types';

const round = (n: number, dp = 2): number => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

const roundTo5 = (n: number): number => Math.round(n / 5) * 5;

export interface PhaseTargets {
  phase: PhaseType;
  /** Daily calorie target. */
  kcal: number;
  /** Daily protein target in grams. */
  protein_g: number;
  /** Acceptable weekly change in kg, derived from bodyweight. */
  weeklyChangeKg: [number, number];
  /** The same band as a percentage of bodyweight. */
  weeklyChangePctBw: [number, number];
  /** Midpoint of the band — what the calorie target actually aims at. */
  targetWeeklyChangeKg: number;
  /** Expenditure the calorie target was computed from. */
  tdee: number;
  /** Whether that expenditure was measured or estimated. */
  tdeeSource: 'measured' | 'estimated' | 'fallback';
  /** Human-readable derivation, shown in the UI so the numbers are never magic. */
  rationale: string[];
}

/**
 * Compute everything for a phase at a given bodyweight and expenditure.
 *
 * `tdee` should be the adaptive estimate when available, otherwise Mifflin. When
 * neither exists (no weight logged yet) the blueprint's absolute figures are
 * returned unchanged, flagged as `fallback`.
 */
export function computePhaseTargets(
  phase: PhaseType,
  bodyweightKg: number | null,
  tdee: number | null,
  tdeeSource: 'measured' | 'estimated' = 'estimated',
): PhaseTargets {
  const rule = PHASE_RULES[phase];
  const [loPct, hiPct] = rule.weekly_pct_bw as unknown as [number, number];

  // No weight yet: hand back the blueprint constants rather than inventing a number.
  if (bodyweightKg === null || bodyweightKg <= 0) {
    const fb = PHASE_TARGETS[phase];
    const band = fb.weekly_change_kg as unknown as [number, number];
    return {
      phase,
      kcal: fb.kcal,
      protein_g: fb.protein_g,
      weeklyChangeKg: band,
      weeklyChangePctBw: [loPct, hiPct],
      targetWeeklyChangeKg: (band[0] + band[1]) / 2,
      tdee: fb.kcal,
      tdeeSource: 'fallback',
      rationale: [
        'No logged weight yet, so these are the plan defaults.',
        'They will re-derive from your own weight and metabolism once you start logging.',
      ],
    };
  }

  const weeklyChangeKg: [number, number] = [
    round((loPct / 100) * bodyweightKg, 2),
    round((hiPct / 100) * bodyweightKg, 2),
  ];

  // Midpoint comes from the unrounded percentages, not the rounded kg band:
  // Math.round breaks symmetry across zero (-20.5 → -20 but 20.5 → 21), which
  // would give a symmetric maintain band a phantom surplus.
  const targetWeeklyChangeKg = round((((loPct + hiPct) / 2) / 100) * bodyweightKg, 3);

  const protein_g = Math.round(
    Math.min(rule.protein_g_per_kg, PROTEIN_G_PER_KG_MAX) * bodyweightKg,
  );

  // Energy balance: a kg of bodyweight change is ~7,700 kcal, spread over 7 days.
  const dailyOffset = (targetWeeklyChangeKg * ENERGY.KCAL_PER_KG_FAT) / 7;
  const base = tdee ?? PHASE_TARGETS[phase].kcal;
  const kcal = Math.max(MIN_SAFE_KCAL, roundTo5(base + dailyOffset));

  const rationale: string[] = [
    `Bodyweight ${round(bodyweightKg, 1)} kg.`,
    `${rule.label} targets ${loPct}% to ${hiPct}% of bodyweight per week, which is ${weeklyChangeKg[0]} to ${weeklyChangeKg[1]} kg.`,
    tdee !== null
      ? `Maintenance ${tdee} kcal (${tdeeSource === 'measured' ? 'learned from your intake and trend weight' : 'Mifflin–St Jeor estimate'}).`
      : 'No expenditure estimate yet, so the plan default is used as the baseline.',
    `${dailyOffset < 0 ? 'Deficit' : dailyOffset > 0 ? 'Surplus' : 'Balance'} of ${Math.abs(Math.round(dailyOffset))} kcal/day hits the middle of that band.`,
    `Protein at ${rule.protein_g_per_kg} g/kg is ${protein_g} g.`,
  ];

  if (kcal === MIN_SAFE_KCAL && base + dailyOffset < MIN_SAFE_KCAL) {
    rationale.push(
      `Floored at ${MIN_SAFE_KCAL} kcal — the arithmetic asked for less, which is not a deficit worth running.`,
    );
  }

  return {
    phase,
    kcal,
    protein_g,
    weeklyChangeKg,
    weeklyChangePctBw: [loPct, hiPct],
    targetWeeklyChangeKg,
    tdee: base,
    tdeeSource: tdee !== null ? tdeeSource : 'fallback',
    rationale,
  };
}

/**
 * What every phase would look like at this weight.
 *
 * Shown when choosing a phase, so the decision is made against real numbers
 * rather than a label.
 */
export function comparePhases(
  bodyweightKg: number | null,
  tdee: number | null,
  tdeeSource: 'measured' | 'estimated' = 'estimated',
): PhaseTargets[] {
  return (Object.keys(PHASE_RULES) as PhaseType[]).map((p) =>
    computePhaseTargets(p, bodyweightKg, tdee, tdeeSource),
  );
}

/**
 * Weeks to move from one weight to another at a phase's midpoint rate.
 *
 * Returns null when the phase does not move weight in the required direction —
 * a maintain phase will never get you to a goal weight, and saying "never" is
 * more useful than showing an absurd number.
 */
export function weeksToGoal(
  currentKg: number,
  goalKg: number,
  targetWeeklyChangeKg: number,
): number | null {
  const needed = goalKg - currentKg;
  if (Math.abs(needed) < 0.05) return 0;
  if (targetWeeklyChangeKg === 0) return null;
  if (Math.sign(needed) !== Math.sign(targetWeeklyChangeKg)) return null;
  return Math.ceil(needed / targetWeeklyChangeKg);
}
