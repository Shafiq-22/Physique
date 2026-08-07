/**
 * The decision engine: pure rules that turn logged data into one concrete
 * instruction. Every verdict carries the rationale and the numbers behind it —
 * the user must never be told what to do without being shown why.
 */

import {
  COMPLIANCE_GOOD_PCT,
  DELOAD,
  FATIGUE,
  PHASE_TARGETS,
  READINESS,
  TRANSITIONS,
} from './config';
import { computePriorBaseline, roundTo, shiftISO } from './analytics';
import { isoCompare } from './dates';
import type { DailyLog, ISODate, Measurement, PhaseType, Verdict, WorkoutSet } from './types';

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const kg = (n: number): string => `${n >= 0 ? '+' : ''}${roundTo(n, 2)} kg`;

// ---------------------------------------------------------------------------
// Weekly rate check
// ---------------------------------------------------------------------------

export interface WeeklyInput {
  /** Trend (EMA) weight now and seven days ago. */
  emaNow: number;
  emaPrevWeek: number;
  /** Optional, used only to express the rate as %BW in the rationale. */
  bodyweightKg?: number;
}

/**
 * Weekly rate-of-change verdict. Run on the Sunday review.
 *
 * The band comes from PHASE_TARGETS so retuning the plan needs no code change.
 * When progress has stalled, adherence is checked *before* calories are cut:
 * there is no point creating a deeper deficit the user isn't hitting.
 */
export function evaluateWeekly(
  trend: WeeklyInput,
  phase: PhaseType,
  compliancePct: number,
): Verdict {
  const delta = trend.emaNow - trend.emaPrevWeek;
  const [lo, hi] = PHASE_TARGETS[phase].weekly_change_kg as unknown as [number, number];

  const pctBW = isNum(trend.bodyweightKg) && trend.bodyweightKg > 0
    ? roundTo((delta / trend.bodyweightKg) * 100, 2)
    : null;

  const snapshot: Record<string, unknown> = {
    phase,
    emaNow: roundTo(trend.emaNow, 2),
    emaPrevWeek: roundTo(trend.emaPrevWeek, 2),
    deltaKg: roundTo(delta, 2),
    targetBandKg: [lo, hi],
    compliancePct,
    ...(pctBW === null ? {} : { deltaPctBodyweight: pctBW }),
  };

  const base = [
    `Trend weight moved ${kg(delta)} over 7 days (${roundTo(trend.emaPrevWeek, 2)} → ${roundTo(trend.emaNow, 2)} kg).`,
    `Target band for a ${phase.replace('_', ' ')} phase is ${lo} to ${hi} kg/week.`,
  ];
  if (pctBW !== null) base.push(`That is ${pctBW}% of bodyweight this week.`);

  const inBand = delta >= lo && delta <= hi;

  if (phase === 'maintain') {
    if (Math.abs(delta) > 0.4) {
      return {
        code: 'maintain_drift',
        verdict: `Drifting ${delta > 0 ? 'up' : 'down'} in maintenance. Check intake against your target.`,
        severity: 'warn',
        rationale: [...base, 'Maintenance drift beyond ±0.40 kg/week means intake has moved.'],
        snapshot,
      };
    }
    return {
      code: 'on_track',
      verdict: 'Holding steady. Change nothing.',
      severity: 'info',
      rationale: base,
      snapshot,
    };
  }

  if (inBand) {
    return {
      code: 'on_track',
      verdict: 'On track. Change nothing.',
      severity: 'info',
      rationale: base,
      snapshot,
    };
  }

  const losingPhase = phase === 'cut' || phase === 'mini_cut';

  // Slower than intended: losing too little, or gaining too little.
  const tooSlow = losingPhase ? delta > hi : delta < lo;

  if (tooSlow) {
    if (compliancePct < COMPLIANCE_GOOD_PCT) {
      return {
        code: 'adherence',
        verdict: 'Adherence is the issue — fix logging/steps before cutting calories.',
        severity: 'warn',
        rationale: [
          ...base,
          `Only ${compliancePct}% of days hit the calorie target (need ${COMPLIANCE_GOOD_PCT}%+ before changing the plan).`,
          'Changing the target while the current one is being missed just makes it harder to hit.',
        ],
        snapshot,
      };
    }
    return losingPhase
      ? {
          code: 'stall',
          verdict: 'Stall. Drop 150 kcal OR add ~1,500 steps/day.',
          severity: 'warn',
          rationale: [
            ...base,
            `Adherence is ${compliancePct}% — the plan is being followed, so the deficit itself is too small.`,
            'Pick one lever, not both, and hold it for a full week before judging it.',
          ],
          snapshot,
        }
      : {
          code: 'gain_too_slow',
          verdict: 'Gaining too slowly. Add 150 kcal.',
          severity: 'warn',
          rationale: [
            ...base,
            `Adherence is ${compliancePct}% — intake is simply below what growth needs.`,
          ],
          snapshot,
        };
  }

  // Faster than intended.
  return losingPhase
    ? {
        code: 'losing_too_fast',
        verdict: 'Too fast — muscle risk. Add 200 kcal.',
        severity: 'warn',
        rationale: [
          ...base,
          `Losing faster than ${lo} kg/week costs lean mass rather than fat.`,
        ],
        snapshot,
      }
    : {
        code: 'gain_too_fast',
        verdict: 'Gaining too fast — fat risk. Drop 150 kcal.',
        severity: 'warn',
        rationale: [...base, `Above ${hi} kg/week the surplus is mostly going to fat.`],
        snapshot,
      };
}

// ---------------------------------------------------------------------------
// Phase transitions
// ---------------------------------------------------------------------------

/**
 * Should the current phase end? Returns null when it should simply continue.
 */
export function evaluatePhaseTransition(
  latest: Pick<Measurement, 'waist_cm' | 'bodyfat_pct' | 'measured_on'> | null,
  phase: PhaseType,
): Verdict | null {
  if (!latest) return null;

  const waist = isNum(latest.waist_cm) ? latest.waist_cm : null;
  const bf = isNum(latest.bodyfat_pct) ? latest.bodyfat_pct : null;

  const snapshot: Record<string, unknown> = {
    phase,
    measuredOn: latest.measured_on,
    waistCm: waist,
    bodyfatPct: bf,
  };

  if (phase === 'cut' || phase === 'mini_cut') {
    const byBf = bf !== null && bf <= TRANSITIONS.END_CUT_BF;
    const byWaist = waist !== null && waist <= TRANSITIONS.END_CUT_WAIST;
    if (byBf || byWaist) {
      const reasons: string[] = [];
      if (byBf) reasons.push(`Body fat ${bf}% is at or below the ${TRANSITIONS.END_CUT_BF}% target.`);
      if (byWaist)
        reasons.push(`Waist ${waist} cm is at or below the ${TRANSITIONS.END_CUT_WAIST} cm target.`);
      return {
        code: 'end_cut',
        verdict: 'Deficit target reached. Take a 4–6 week maintenance break, then switch to LEAN GAIN.',
        severity: 'info',
        rationale: [
          ...reasons,
          'Extending a cut past its target costs muscle and makes the next gaining phase worse.',
        ],
        snapshot: { ...snapshot, thresholds: { bf: TRANSITIONS.END_CUT_BF, waist: TRANSITIONS.END_CUT_WAIST } },
      };
    }
    return null;
  }

  if (phase === 'gain') {
    const byBf = bf !== null && bf >= TRANSITIONS.BULK_CEILING_BF;
    const byWaist = waist !== null && waist >= TRANSITIONS.BULK_CEILING_WAIST;
    if (byBf || byWaist) {
      const reasons: string[] = [];
      if (byBf)
        reasons.push(`Body fat ${bf}% is at or above the ${TRANSITIONS.BULK_CEILING_BF}% ceiling.`);
      if (byWaist)
        reasons.push(
          `Waist ${waist} cm is at or above the ${TRANSITIONS.BULK_CEILING_WAIST} cm ceiling.`,
        );
      return {
        code: 'bulk_ceiling',
        verdict: 'Bulk ceiling hit. Run a 6–8 week mini-cut, then resume gaining.',
        severity: 'warn',
        rationale: [
          ...reasons,
          'Gaining past this point adds fat faster than muscle and lengthens the cut that follows.',
        ],
        snapshot: {
          ...snapshot,
          thresholds: { bf: TRANSITIONS.BULK_CEILING_BF, waist: TRANSITIONS.BULK_CEILING_WAIST },
        },
      };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Deload
// ---------------------------------------------------------------------------

export interface FatigueFlag {
  key: string;
  fired: boolean;
  detail: string;
}

const sortLogs = (logs: DailyLog[]): DailyLog[] =>
  logs.slice().sort((a, b) => isoCompare(a.log_date, b.log_date));

const windowOf = (logs: DailyLog[], asOf: ISODate, days: number): DailyLog[] => {
  const start = shiftISO(asOf, -(days - 1));
  return logs.filter(
    (l) => isoCompare(l.log_date, start) >= 0 && isoCompare(l.log_date, asOf) <= 0,
  );
};

/**
 * RPE creep at matched load: the same exercise done at the same weight now
 * costs `RPE_CREEP` more points than it used to. A pure signal of accumulated
 * fatigue, since the external load is held constant.
 */
export function detectRpeCreep(sets: WorkoutSet[], setDates: Map<string, ISODate>): FatigueFlag {
  const byKey = new Map<string, { date: ISODate; rpe: number }[]>();

  for (const s of sets) {
    if (!isNum(s.load_kg) || !isNum(s.rpe)) continue;
    const date = setDates.get(s.workout_id);
    if (!date) continue;
    const key = `${s.exercise_name.toLowerCase().trim()}@${s.load_kg}`;
    const arr = byKey.get(key) ?? [];
    arr.push({ date, rpe: s.rpe });
    byKey.set(key, arr);
  }

  for (const [key, entries] of byKey) {
    if (entries.length < 2) continue;
    entries.sort((a, b) => isoCompare(a.date, b.date));
    const latest = entries[entries.length - 1]!;
    const priors = entries.filter((e) => e.date !== latest.date);
    if (priors.length === 0) continue;
    const bestPrior = Math.min(...priors.map((p) => p.rpe));
    if (latest.rpe - bestPrior >= FATIGUE.RPE_CREEP) {
      const [name, load] = key.split('@');
      return {
        key: 'rpe_creep',
        fired: true,
        detail: `${name} at ${load} kg now feels RPE ${latest.rpe} vs ${bestPrior} before (+${roundTo(latest.rpe - bestPrior, 1)}).`,
      };
    }
  }

  return { key: 'rpe_creep', fired: false, detail: 'No RPE creep at matched loads.' };
}

export interface DeloadInput {
  logs: DailyLog[];
  sets?: WorkoutSet[];
  /** workout_id → the date it was performed. */
  setDates?: Map<string, ISODate>;
  daysSinceLastDeload?: number | null;
  asOf?: ISODate;
}

/**
 * Fatigue-flag count plus time since the last deload.
 *
 * Flag 1 requires *consecutive* days, per the blueprint; the others count days
 * within the window, since broken sleep and low mood do not arrive in a tidy run.
 */
export function evaluateDeload(input: DeloadInput): Verdict {
  const logs = sortLogs(input.logs);
  const asOf = input.asOf ?? logs[logs.length - 1]?.log_date ?? shiftISO('1970-01-01', 0);
  const win = windowOf(logs, asOf, FATIGUE.WINDOW_DAYS);
  const daysSince = input.daysSinceLastDeload ?? null;

  const flags: FatigueFlag[] = [];

  // 1. RHR above its trailing 7-day average for 3+ consecutive days.
  {
    let best = 0;
    let run = 0;
    for (const l of win) {
      const priorStart = shiftISO(l.log_date, -7);
      const prior = logs.filter(
        (p) =>
          isoCompare(p.log_date, priorStart) >= 0 &&
          isoCompare(p.log_date, l.log_date) < 0 &&
          isNum(p.resting_hr),
      );
      if (!isNum(l.resting_hr) || prior.length === 0) {
        run = 0;
        continue;
      }
      const avg = prior.reduce((a, p) => a + (p.resting_hr as number), 0) / prior.length;
      run = l.resting_hr > avg + FATIGUE.RHR_ELEVATED_BPM ? run + 1 : 0;
      best = Math.max(best, run);
    }
    flags.push({
      key: 'rhr_elevated',
      fired: best >= FATIGUE.RHR_CONSECUTIVE_DAYS,
      detail: `Resting HR ran >${FATIGUE.RHR_ELEVATED_BPM} bpm above its 7-day average for ${best} consecutive day(s).`,
    });
  }

  // 2. HRV suppressed below 85% of the 30-day baseline on 5+ days.
  {
    const baseline = computePriorBaseline(
      logs,
      shiftISO(asOf, -(FATIGUE.WINDOW_DAYS - 1)),
      READINESS.BASELINE_DAYS,
    );
    let n = 0;
    if (isNum(baseline.hrv)) {
      const limit = baseline.hrv * FATIGUE.HRV_SUPPRESSED_RATIO;
      n = win.filter((l) => isNum(l.hrv_ms) && l.hrv_ms < limit).length;
    }
    flags.push({
      key: 'hrv_suppressed',
      fired: n >= FATIGUE.HRV_DAYS,
      detail: isNum(baseline.hrv)
        ? `HRV sat below ${Math.round(baseline.hrv * FATIGUE.HRV_SUPPRESSED_RATIO)}ms (85% of baseline) on ${n} day(s).`
        : 'No HRV baseline yet.',
    });
  }

  // 3. Sleep under 6h on 3+ nights.
  {
    const n = win.filter((l) => isNum(l.sleep_hours) && l.sleep_hours < FATIGUE.SHORT_SLEEP_HOURS).length;
    flags.push({
      key: 'short_sleep',
      fired: n >= FATIGUE.SHORT_SLEEP_NIGHTS,
      detail: `${n} night(s) under ${FATIGUE.SHORT_SLEEP_HOURS}h.`,
    });
  }

  // 4. RPE creep at matched load.
  flags.push(
    input.sets && input.setDates
      ? detectRpeCreep(input.sets, input.setDates)
      : { key: 'rpe_creep', fired: false, detail: 'No workout data supplied.' },
  );

  // 5. Mood under 5 on 4+ days.
  {
    const n = win.filter((l) => isNum(l.mood_1_10) && l.mood_1_10 < FATIGUE.LOW_MOOD).length;
    flags.push({
      key: 'low_mood',
      fired: n >= FATIGUE.LOW_MOOD_DAYS,
      detail: `Mood below ${FATIGUE.LOW_MOOD}/10 on ${n} day(s).`,
    });
  }

  const fired = flags.filter((f) => f.fired);
  const snapshot = {
    asOf,
    flagsFired: fired.map((f) => f.key),
    flagCount: fired.length,
    flagThreshold: DELOAD.FLAG_THRESHOLD,
    daysSinceLastDeload: daysSince,
    windowDays: FATIGUE.WINDOW_DAYS,
  };

  const overdue = daysSince !== null && daysSince >= DELOAD.MAX_DAYS;

  if (fired.length >= DELOAD.FLAG_THRESHOLD || overdue) {
    return {
      code: 'deload_now',
      verdict: 'Deload this week (halve volume, keep intensity).',
      severity: 'warn',
      rationale: [
        overdue
          ? `${daysSince} days since the last deload, past the ${DELOAD.MAX_DAYS}-day limit.`
          : `${fired.length} fatigue flags are up (threshold ${DELOAD.FLAG_THRESHOLD}).`,
        ...fired.map((f) => f.detail),
      ],
      snapshot,
    };
  }

  if (daysSince !== null && daysSince >= DELOAD.MIN_DAYS) {
    return {
      code: 'deload_soon',
      verdict: 'Deload due soon — plan it.',
      severity: 'info',
      rationale: [
        `${daysSince} days since the last deload (window opens at ${DELOAD.MIN_DAYS}, closes at ${DELOAD.MAX_DAYS}).`,
        `${fired.length} fatigue flag(s) currently up.`,
        ...fired.map((f) => f.detail),
      ],
      snapshot,
    };
  }

  return {
    code: 'no_deload',
    verdict: 'Recovery is holding. Keep training as planned.',
    severity: 'info',
    rationale: [
      `${fired.length} of ${flags.length} fatigue flags up (threshold ${DELOAD.FLAG_THRESHOLD}).`,
      ...(daysSince !== null ? [`${daysSince} days since the last deload.`] : []),
      // Show what is already brewing, so a rising flag count is never a surprise.
      ...fired.map((f) => f.detail),
    ],
    snapshot,
  };
}

// ---------------------------------------------------------------------------
// Overreaching safety net (Section 4.5)
// ---------------------------------------------------------------------------

export interface OverreachingInput {
  logs: DailyLog[];
  /** Derived from workout history: strength trending down for 2+ weeks. */
  performanceDeclining?: boolean;
  asOf?: ISODate;
}

/**
 * The non-negotiable brake. Three or more of these six signals during a cut
 * means the deficit has stopped being productive, and the answer is food and
 * rest — not more discipline.
 */
export function evaluateOverreaching(input: OverreachingInput): Verdict | null {
  const logs = sortLogs(input.logs);
  const asOf = input.asOf ?? logs[logs.length - 1]?.log_date;
  if (!asOf) return null;

  const win = windowOf(logs, asOf, FATIGUE.WINDOW_DAYS);
  const baseline = computePriorBaseline(
    logs,
    shiftISO(asOf, -(FATIGUE.WINDOW_DAYS - 1)),
    READINESS.BASELINE_DAYS,
  );
  const flags: FatigueFlag[] = [];

  flags.push({
    key: 'performance_decline',
    fired: input.performanceDeclining === true,
    detail: input.performanceDeclining
      ? 'Lifts have been trending down for 2+ weeks.'
      : 'Performance is holding.',
  });

  {
    const n = win.filter(
      (l) => isNum(l.sleep_hours) && l.sleep_hours < FATIGUE.SHORT_SLEEP_HOURS,
    ).length;
    flags.push({
      key: 'sleep_degraded',
      fired: n >= FATIGUE.OR_SHORT_SLEEP_NIGHTS,
      detail: `Sleep under ${FATIGUE.SHORT_SLEEP_HOURS}h on ${n} of the last ${FATIGUE.WINDOW_DAYS} nights.`,
    });
  }

  {
    const rhrDays = isNum(baseline.rhr)
      ? win.filter(
          (l) => isNum(l.resting_hr) && l.resting_hr >= (baseline.rhr as number) + FATIGUE.RHR_ELEVATED_BPM,
        ).length
      : 0;
    const hrvDays = isNum(baseline.hrv)
      ? win.filter(
          (l) => isNum(l.hrv_ms) && l.hrv_ms <= (baseline.hrv as number) * (1 - FATIGUE.OR_HRV_DROP_PCT),
        ).length
      : 0;
    const days = Math.max(rhrDays, hrvDays);
    flags.push({
      key: 'autonomic',
      fired: days >= FATIGUE.OR_AUTONOMIC_DAYS,
      detail: `Resting HR up ${FATIGUE.RHR_ELEVATED_BPM}+ bpm on ${rhrDays} day(s); HRV down ${FATIGUE.OR_HRV_DROP_PCT * 100}%+ on ${hrvDays} day(s).`,
    });
  }

  {
    const n = win.filter(
      (l) =>
        (isNum(l.mood_1_10) && l.mood_1_10 < FATIGUE.LOW_MOOD) ||
        (isNum(l.energy_1_10) && l.energy_1_10 < FATIGUE.LOW_MOOD),
    ).length;
    flags.push({
      key: 'affect_down',
      fired: n >= FATIGUE.OR_LOW_AFFECT_DAYS,
      detail: `Mood or energy below ${FATIGUE.LOW_MOOD}/10 on ${n} day(s).`,
    });
  }

  {
    const n = win.filter((l) => l.cold_hands_feet === true).length;
    flags.push({
      key: 'cold_hands_feet',
      fired: n >= FATIGUE.OR_SYMPTOM_DAYS,
      detail: `Cold hands/feet reported on ${n} day(s).`,
    });
  }

  {
    const n = win.filter((l) => l.intrusive_food_thoughts === true).length;
    flags.push({
      key: 'intrusive_food_thoughts',
      fired: n >= FATIGUE.OR_SYMPTOM_DAYS,
      detail: `Intrusive food thoughts reported on ${n} day(s).`,
    });
  }

  const fired = flags.filter((f) => f.fired);
  if (fired.length < FATIGUE.OR_FLAG_THRESHOLD) return null;

  return {
    code: 'overreaching',
    verdict: 'Immediate 7–14 day maintenance break. Non-negotiable.',
    severity: 'high',
    rationale: [
      `${fired.length} of ${flags.length} overreaching signals are present (threshold ${FATIGUE.OR_FLAG_THRESHOLD}).`,
      ...fired.map((f) => f.detail),
      'Eating at maintenance now protects the muscle you spent months building.',
    ],
    snapshot: {
      asOf,
      flagsFired: fired.map((f) => f.key),
      flagCount: fired.length,
      flagThreshold: FATIGUE.OR_FLAG_THRESHOLD,
      baselineRhr: isNum(baseline.rhr) ? Math.round(baseline.rhr) : null,
      baselineHrv: isNum(baseline.hrv) ? Math.round(baseline.hrv) : null,
    },
  };
}
