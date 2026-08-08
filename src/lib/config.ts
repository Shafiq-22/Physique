/**
 * Single source of truth for every threshold in the decision engine.
 *
 * These numbers come from the transformation blueprint (recomposition cut →
 * lean gain → final cut). Nothing in `analytics.ts` or `decisionEngine.ts` may
 * hard-code a threshold: it is imported from here so the plan can be retuned in
 * one place as it evolves.
 */

export const PROFILE = { HEIGHT_CM: 180, DOB: '2000-06-22', SEX: 'male' } as const;

export const ENERGY = {
  KCAL_PER_KG_FAT: 7700,
  MIN_INTAKE_DAYS_FOR_TDEE: 10,
  TDEE_WINDOW_DAYS: 14,
  TDEE_WINDOW_DAYS_STABLE: 28,
} as const;

/**
 * Absolute fallbacks, quoted from the original blueprint at ~82 kg bodyweight.
 *
 * These are only used before there is a weight to scale from. Everything the app
 * actually shows comes from `lib/targets.ts`, which derives calories from
 * measured expenditure and rates from bodyweight — see PHASE_RULES below.
 */
export const PHASE_TARGETS = {
  cut: { kcal: 2300, protein_g: 170, weekly_change_kg: [-0.55, -0.4] },
  maintain: { kcal: 2800, protein_g: 165, weekly_change_kg: [-0.2, 0.2] },
  gain: { kcal: 3050, protein_g: 165, weekly_change_kg: [0.12, 0.25] },
  mini_cut: { kcal: 2300, protein_g: 175, weekly_change_kg: [-0.7, -0.45] },
  recomp: { kcal: 2800, protein_g: 180, weekly_change_kg: [-0.15, 0.15] },
} as const;

/**
 * The real targets: rates as a percentage of *current* bodyweight, protein as
 * g/kg, calories as an offset from measured expenditure.
 *
 * A fixed 2,300 kcal is only correct for one person at one weight on one day.
 * Losing 0.5 kg/week is a gentle deficit at 100 kg and an aggressive one at 60 kg,
 * so the rate that actually protects muscle is proportional. These percentages
 * reproduce the blueprint's original kg figures at ~82 kg and then keep pace as
 * the weight changes.
 */
export const PHASE_RULES = {
  cut: {
    /** Weekly change as % of bodyweight: −0.49%/wk at 82 kg is −0.40 kg. */
    weekly_pct_bw: [-0.67, -0.49],
    protein_g_per_kg: 2.1,
    label: 'Cut',
    blurb: 'Lose fat, hold muscle',
  },
  maintain: {
    weekly_pct_bw: [-0.25, 0.25],
    protein_g_per_kg: 2.0,
    label: 'Maintain',
    blurb: 'Hold weight steady',
  },
  gain: {
    weekly_pct_bw: [0.15, 0.3],
    protein_g_per_kg: 2.0,
    label: 'Lean gain',
    blurb: 'Add muscle, limit fat',
  },
  mini_cut: {
    weekly_pct_bw: [-0.85, -0.55],
    protein_g_per_kg: 2.2,
    label: 'Mini-cut',
    blurb: 'Short, sharper deficit',
  },
  recomp: {
    /** Scale weight barely moves; the change shows up in the tape and the mirror. */
    weekly_pct_bw: [-0.18, 0.18],
    protein_g_per_kg: 2.2,
    label: 'Recomp',
    blurb: 'Hold weight, trade fat for muscle',
  },
} as const;

/** Protein is capped in absolute terms — past this there is no further return. */
export const PROTEIN_G_PER_KG_MAX = 2.4;

/** Never prescribe fewer calories than this, whatever the arithmetic says. */
export const MIN_SAFE_KCAL = 1500;

/**
 * Drift that counts as "no longer maintaining", as % of bodyweight per week.
 * 0.5% is 0.41 kg at 82 kg — the blueprint's original 0.4 kg flag, now scaling.
 */
export const MAINTAIN_DRIFT_PCT_BW = 0.5;

export const TRANSITIONS = {
  END_CUT_BF: 14,
  END_CUT_WAIST: 82,
  BULK_CEILING_BF: 15,
  BULK_CEILING_WAIST: 85,
} as const;

export const DELOAD = { MIN_DAYS: 42, MAX_DAYS: 56, FLAG_THRESHOLD: 3 } as const;

export const READINESS = {
  WEIGHTS: { rhr: 0.3, hrv: 0.3, sleep: 0.25, subjective: 0.15 },
  GREEN: 70,
  AMBER: 50,
  SLEEP_GOOD: 7.5,
  SLEEP_POOR: 6,

  // --- Tunables added for the scoring curves (see analytics.computeReadiness) ---
  /** Score awarded to a metric sitting exactly at its 30-day baseline. */
  BASELINE_SCORE: 0.75,
  /** RHR this many bpm above baseline scores 0. */
  RHR_SPAN_BPM: 8,
  /** HRV this fraction below baseline scores 0. */
  HRV_SPAN_PCT: 0.25,
  /** Sleep below this many hours scores 0. */
  SLEEP_FLOOR: 4,
  /** Score at exactly SLEEP_POOR hours, before the ramp up to SLEEP_GOOD. */
  SLEEP_POOR_SCORE: 0.4,
  /** Trailing window used to build RHR/HRV baselines. */
  BASELINE_DAYS: 30,
  /** A component below this score is eligible to be named as a driver. */
  DRIVER_THRESHOLD: 0.6,
} as const;

export const AESTHETICS = {
  ADONIS_TARGET: [1.6, 1.62],
  WAIST_HEIGHT_FLAG: 0.5,
  TARGET_WAIST_CM: 78,
} as const;

export const EMA_SPAN = 7;

/**
 * Thresholds for the fatigue-flag rules in `evaluateDeload` and the
 * overreaching safety net in `evaluateOverreaching`.
 */
export const FATIGUE = {
  /** Window of daily logs each rule inspects. */
  WINDOW_DAYS: 14,
  /** RHR is elevated when it exceeds the trailing 7-day average by this much. */
  RHR_ELEVATED_BPM: 5,
  /** Consecutive elevated-RHR days needed to raise the deload flag. */
  RHR_CONSECUTIVE_DAYS: 3,
  /** HRV is suppressed below this multiple of the 30-day baseline. */
  HRV_SUPPRESSED_RATIO: 0.85,
  /** Suppressed-HRV days needed to raise the deload flag. */
  HRV_DAYS: 5,
  /** Nights under this many hours count as short sleep. */
  SHORT_SLEEP_HOURS: 6,
  /** Short nights needed to raise the deload flag. */
  SHORT_SLEEP_NIGHTS: 3,
  /** Mood at or below this counts as low. */
  LOW_MOOD: 5,
  /** Low-mood days needed to raise the deload flag. */
  LOW_MOOD_DAYS: 4,
  /** RPE creep at matched load that raises the deload flag. */
  RPE_CREEP: 2,

  // --- Overreaching (Section 4.5 safety net, runs during a cut) ---
  /** Days of elevated RHR *or* suppressed HRV that raise the overreaching flag. */
  OR_AUTONOMIC_DAYS: 7,
  /** HRV this fraction below baseline counts toward the autonomic flag. */
  OR_HRV_DROP_PCT: 0.15,
  /** Low mood/energy days that raise the overreaching flag. */
  OR_LOW_AFFECT_DAYS: 4,
  /** Short nights that raise the overreaching sleep flag. */
  OR_SHORT_SLEEP_NIGHTS: 4,
  /** Days a symptom toggle must be set to count as a standing symptom. */
  OR_SYMPTOM_DAYS: 2,
  /** Flags required to trigger the mandatory maintenance break. */
  OR_FLAG_THRESHOLD: 3,
} as const;

/** Adherence at or above this percentage means calories, not compliance, are the lever. */
export const COMPLIANCE_GOOD_PCT = 85;

/** Intake within this many kcal of target counts as an on-target day. */
export const COMPLIANCE_KCAL_TOLERANCE = 150;
